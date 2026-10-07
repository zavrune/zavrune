import { ensureStorefrontReady, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productVariants, orders, orderItems, customers, inventoryEvents, orderEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    await ensureStorefrontReady();
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      wilaya,
      commune,
      address,
      deliveryNotes,
      deliveryType = "home",
      items = [],
    } = body;

    if (!customerName || !customerPhone || !wilaya || !commune || !address) {
      return NextResponse.json(
        { success: false, error: "Missing required customer information" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    const orderItem = items[0];
    const { productId, variantId, color, size, quantity = 1 } = orderItem;

    // 1. Fetch Product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Variant if variantId provided, or find matching color+size variant
    let matchedVariant = null;
    if (variantId) {
      const [v] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      matchedVariant = v;
    } else {
      const variantsList = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));
      
      matchedVariant = variantsList.find(
        (v) => v.color.toLowerCase() === (color || "").toLowerCase() && v.size.toLowerCase() === (size || "").toLowerCase()
      ) || variantsList[0];
    }

    if (!matchedVariant) {
      return NextResponse.json(
        { success: false, error: "Selected product variant is unavailable" },
        { status: 400 }
      );
    }

    // Check stock
    if (matchedVariant.stock < quantity) {
      return NextResponse.json(
        { success: false, error: `Only ${matchedVariant.stock} items available in stock` },
        { status: 400 }
      );
    }

    // Server-determined unit price in DZD
    const unitPrice = matchedVariant.price || product.price;
    const itemsSubtotal = unitPrice * quantity;

    // Server-determined shipping cost based on Wilaya & Delivery type
    const isAlgiers = wilaya.includes("16") || wilaya.toLowerCase().includes("alger");
    let shippingPrice = 750;
    if (isAlgiers) {
      shippingPrice = deliveryType === "home" ? 400 : 300;
    } else {
      shippingPrice = deliveryType === "home" ? 750 : 450;
    }

    const totalAmount = itemsSubtotal + shippingPrice;

    // Generate unique order number (e.g., ZVR-94812)
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `ZVR-${randomDigits}`;

    // Execute DB Transaction
    const createdOrder = await db.transaction(async (tx) => {
      // Create or lookup customer
      const [newCustomer] = await tx
        .insert(customers)
        .values({
          fullName: customerName,
          phone: customerPhone,
          email: customerEmail || null,
          wilaya,
          commune,
          address,
          notes: deliveryNotes || null,
        })
        .returning();

      // Create Order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: newCustomer.id,
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          wilaya,
          commune,
          address,
          deliveryNotes: deliveryNotes || null,
          shippingMethodName: deliveryType === "home" ? "Home Delivery" : "Stop Desk Bureau",
          shippingPrice,
          itemsSubtotal,
          totalAmount,
          currency: "DZD",
          status: "Pending",
        })
        .returning();

      // Create Order Item
      const itemImage = matchedVariant.imageUrl || (product.images as any)?.[0]?.url || "";
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        productId: product.id,
        variantId: matchedVariant.id,
        productName: product.nameEn,
        variantSku: matchedVariant.sku,
        color: matchedVariant.color,
        size: matchedVariant.size,
        unitPrice,
        quantity,
        totalPrice: itemsSubtotal,
        imageUrl: itemImage,
      });

      // Update Variant Stock
      await tx
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} - ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, matchedVariant.id));

      // Record Inventory Event
      await tx.insert(inventoryEvents).values({
        variantId: matchedVariant.id,
        changeQty: -quantity,
        type: "order_reserved",
        referenceId: newOrder.id,
        notes: `Direct Order #${orderNumber}`,
      });

      // Record Order Event History
      await tx.insert(orderEvents).values({
        orderId: newOrder.id,
        status: "Pending",
        note: `Order placed via direct purchase. Customer: ${customerName} (${customerPhone}).`,
        createdBy: "Customer Direct Checkout",
      });

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
      totalAmount: createdOrder.totalAmount,
    });
  } catch (error: unknown) {
    logDatabaseError("orders/create request failed", error);

    return NextResponse.json(
      { success: false, error: "Database request failed" },
      { status: 500 }
    );
  }
}
