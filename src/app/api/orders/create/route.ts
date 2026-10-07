import { ensureStorefrontReady, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productVariants, orders, orderItems, customers, inventoryEvents, orderEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { DeliveryError, quoteDelivery, type DeliveryMethod } from "@/lib/delivery";
import { getStoreSettingsSafe } from "@/lib/store-settings";
import { ensureProductGroups } from "@/lib/product-groups";

export const runtime = "nodejs";

interface IncomingItem {
  productId?: string;
  variantId?: string;
  quantity?: number;
  /** Arbitrary option selection, e.g. { Size: "M", Material: "Cotton" } */
  options?: Record<string, string>;
  color?: string;
  size?: string;
}

export async function POST(req: Request) {
  try {
    // Same-origin check: order creation is a state-changing browser action.
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ success: false, error: "Forbidden origin" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ success: false, error: "Forbidden origin" }, { status: 403 });
      }
    }

    await ensureStorefrontReady();
    await ensureProductGroups();

    const body = await req.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      wilaya,
      wilayaCode,
      commune,
      address,
      postalCode,
      deliveryNotes,
      deliveryType = "home",
      items = [],
    } = body as Record<string, unknown> & { items?: IncomingItem[] };

    if (!customerName || !customerPhone || !wilaya || !commune || !address) {
      return NextResponse.json({ success: false, error: "Missing required customer information" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Order must contain at least one item" }, { status: 400 });
    }

    const method: DeliveryMethod = deliveryType === "bureau" ? "bureau" : "home";

    // 1. Resolve every line server-side (product, variant, price, stock).
    const resolved: {
      product: typeof products.$inferSelect;
      variant: typeof productVariants.$inferSelect;
      quantity: number;
      unitPrice: number;
      optionLabel: string;
      options: Record<string, string>;
    }[] = [];

    for (const incoming of items) {
      const quantity = Math.max(1, Math.min(50, Math.round(Number(incoming?.quantity ?? 1)) || 1));
      const productId = typeof incoming?.productId === "string" ? incoming.productId : null;
      if (!productId) {
        return NextResponse.json({ success: false, error: "Each order item needs a product." }, { status: 400 });
      }

      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product || product.status !== "published") {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      const variantsList = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      const requestedOptions: Record<string, string> = {};
      if (incoming?.options && typeof incoming.options === "object") {
        for (const [key, value] of Object.entries(incoming.options)) {
          if (typeof value === "string" && value.trim()) requestedOptions[key.slice(0, 60)] = value.trim().slice(0, 120);
        }
      }
      if (incoming?.color) requestedOptions.Color = String(incoming.color).trim();
      if (incoming?.size) requestedOptions.Size = String(incoming.size).trim();

      let matched =
        (typeof incoming?.variantId === "string" && variantsList.find((variant) => variant.id === incoming.variantId)) || null;

      if (!matched) {
        const wanted = Object.entries(requestedOptions).map(([key, value]) => `${key.toLowerCase()}=${value.toLowerCase()}`);
        matched =
          variantsList.find((variant) => {
            const combination = (variant.optionCombination ?? {}) as Record<string, string>;
            const signature = Object.entries(combination)
              .filter(([, value]) => `${value}`.trim())
              .map(([key, value]) => `${key.toLowerCase()}=${`${value}`.toLowerCase()}`);
            return wanted.length > 0 && signature.length === wanted.length && wanted.every((entry) => signature.includes(entry));
          }) ||
          // Legacy rows without an option snapshot still match on size/color.
          variantsList.find(
            (variant) =>
              (!requestedOptions.Size || (variant.size ?? "").toLowerCase() === requestedOptions.Size.toLowerCase()) &&
              (!requestedOptions.Color || (variant.color ?? "").toLowerCase() === requestedOptions.Color.toLowerCase())
          ) ||
          variantsList[0];
      }

      if (!matched) {
        return NextResponse.json({ success: false, error: "Selected product variant is unavailable" }, { status: 400 });
      }
      if (matched.status !== "active") {
        return NextResponse.json({ success: false, error: "That variant is no longer available" }, { status: 400 });
      }
      if (matched.stock < quantity) {
        return NextResponse.json(
          { success: false, error: `Only ${matched.stock} item(s) left for the selected option.` },
          { status: 400 }
        );
      }

      // Price always comes from the database, never from the request body.
      const unitPrice = matched.price ?? product.price;
      const combination = (matched.optionCombination ?? {}) as Record<string, string>;
      const optionLabel =
        Object.entries(combination)
          .filter(([, value]) => `${value}`.trim())
          .map(([key, value]) => `${key}: ${value}`)
          .join(" / ") ||
        [matched.color, matched.size].filter(Boolean).join(" / ");

      resolved.push({ product, variant: matched, quantity, unitPrice, optionLabel, options: combination });
    }

    const itemsSubtotal = resolved.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const settings = await getStoreSettingsSafe();

    // 2. Delivery price is computed and validated on the server.
    let quote;
    try {
      quote = await quoteDelivery({
        wilayaCode: (typeof wilayaCode === "string" && wilayaCode) || String(wilaya),
        method,
        itemsSubtotal,
        freeShippingThreshold: settings.freeShippingThreshold,
      });
    } catch (error) {
      if (error instanceof DeliveryError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      throw error;
    }

    const totalAmount = itemsSubtotal + quote.price;
    const orderNumber = `${settings.orderPrefix || "ZVR"}-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 89)}`;

    // Immutable snapshot so later price or rate changes never alter this order.
    const deliverySnapshot = {
      wilayaCode: quote.wilayaCode,
      wilayaName: quote.wilayaName,
      method: quote.method,
      methodLabel: quote.label,
      price: quote.price,
      freeShippingApplied: quote.freeShippingApplied,
      freeShippingThreshold: settings.freeShippingThreshold,
      currency: settings.currency,
      capturedAt: new Date().toISOString(),
    };

    const createdOrder = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          fullName: String(customerName).trim().slice(0, 160),
          phone: String(customerPhone).trim().slice(0, 40),
          email: customerEmail ? String(customerEmail).trim().slice(0, 160) : null,
          wilaya: quote.wilayaName,
          commune: String(commune).slice(0, 120),
          address: String(address).slice(0, 400),
          postalCode: postalCode ? String(postalCode).slice(0, 20) : null,
          notes: deliveryNotes ? String(deliveryNotes).slice(0, 400) : null,
        })
        .returning();

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: customer.id,
          customerName: String(customerName).trim().slice(0, 160),
          customerPhone: String(customerPhone).trim().slice(0, 40),
          customerEmail: customerEmail ? String(customerEmail).trim().slice(0, 160) : null,
          wilaya: quote.wilayaName,
          wilayaCode: quote.wilayaCode,
          commune: String(commune).slice(0, 120),
          address: String(address).slice(0, 400),
          postalCode: postalCode ? String(postalCode).slice(0, 20) : null,
          deliveryNotes: deliveryNotes ? String(deliveryNotes).slice(0, 400) : null,
          deliveryType: quote.method,
          deliverySnapshot,
          shippingMethodName: `${quote.label} — ${quote.wilayaName}`,
          shippingPrice: quote.price,
          itemsSubtotal,
          totalAmount,
          currency: settings.currency,
          status: "Pending",
        })
        .returning();

      for (const line of resolved) {
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: line.product.id,
          variantId: line.variant.id,
          productName: line.product.nameEn,
          variantSku: line.variant.sku,
          color: line.variant.color,
          size: line.variant.size,
          options: line.options,
          optionLabel: line.optionLabel,
          unitPrice: line.unitPrice,
          compareAtPrice: line.variant.compareAtPrice ?? line.product.compareAtPrice,
          quantity: line.quantity,
          totalPrice: line.unitPrice * line.quantity,
          imageUrl: line.variant.imageUrl || ((line.product.images as any[])?.[0]?.url ?? null),
        });

        await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
          .where(eq(productVariants.id, line.variant.id));

        await tx.insert(inventoryEvents).values({
          variantId: line.variant.id,
          changeQty: -line.quantity,
          type: "order_reserved",
          referenceId: order.orderNumber,
          notes: `Reserved for order ${order.orderNumber}`,
        });
      }

      await tx.insert(orderEvents).values({
        orderId: order.id,
        status: "Pending",
        note: "Order created from the storefront.",
        createdBy: "Storefront",
      });

      return order;
    });

    return NextResponse.json({
      success: true,
      orderNumber: createdOrder.orderNumber,
      totalAmount: createdOrder.totalAmount,
      shippingPrice: createdOrder.shippingPrice,
    });
  } catch (error: unknown) {
    logDatabaseError("order creation failed", error);
    return NextResponse.json({ success: false, error: "Order creation failed" }, { status: 500 });
  }
}
