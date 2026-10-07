import { ensureStorefrontReady, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    await ensureStorefrontReady();
    const list = await db.select().from(categories).orderBy(asc(categories.displayOrder));
    return NextResponse.json({ success: true, categories: list });
  } catch (error: unknown) {
    logDatabaseError("categories request failed", error);
    return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureStorefrontReady();
    const { nameEn, nameAr, nameFr, imageUrl } = await req.json();

    const slug = nameEn
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-");

    const [inserted] = await db
      .insert(categories)
      .values({
        slug: `${slug}-${Math.floor(100 + Math.random() * 900)}`,
        nameEn,
        nameAr: nameAr || nameEn,
        nameFr: nameFr || nameEn,
        imageUrl,
        displayOrder: 99,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, category: inserted });
  } catch (error: unknown) {
    logDatabaseError("categories request failed", error);
    return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
  }
}
