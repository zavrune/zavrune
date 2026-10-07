import { ensureStorefrontReady, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productVariants } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    await ensureStorefrontReady();
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
    const allVariants = await db.select().from(productVariants);

    const result = allProducts.map((p) => ({
      ...p,
      variants: allVariants.filter((v) => v.productId === p.id),
    }));

    return NextResponse.json({ success: true, products: result });
  } catch (error: unknown) {
    logDatabaseError("admin/products request failed", error);
    return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureStorefrontReady();
    const body = await req.json();
    const {
      nameEn,
      nameAr,
      nameFr,
      descriptionEn,
      descriptionAr,
      descriptionFr,
      price,
      compareAtPrice,
      sku,
      categoryId,
      collectionId,
      badge,
      featured = false,
      images = [],
      variants = [],
    } = body;

    const slug = nameEn
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const [newProduct] = await db
      .insert(products)
      .values({
        slug: `${slug}-${Math.floor(100 + Math.random() * 900)}`,
        nameEn,
        nameAr: nameAr || nameEn,
        nameFr: nameFr || nameEn,
        descriptionEn,
        descriptionAr,
        descriptionFr,
        price: Number(price),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
        sku,
        categoryId: categoryId || null,
        collectionId: collectionId || null,
        badge: badge || null,
        featured,
        images,
        status: "published",
      })
      .returning();

    // Insert variants
    if (variants && variants.length > 0) {
      for (const v of variants) {
        await db.insert(productVariants).values({
          productId: newProduct.id,
          sku: v.sku || `${sku}-${v.color}-${v.size}`,
          color: v.color,
          colorHex: v.colorHex || null,
          size: v.size,
          price: v.price ? Number(v.price) : Number(price),
          stock: Number(v.stock || 10),
          status: "active",
        });
      }
    } else {
      // Default baseline variant
      await db.insert(productVariants).values({
        productId: newProduct.id,
        sku: `${sku}-DEFAULT-M`,
        color: "Black",
        size: "M",
        price: Number(price),
        stock: 20,
        status: "active",
      });
    }

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: unknown) {
    logDatabaseError("admin/products request failed", error);
    return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
  }
}
