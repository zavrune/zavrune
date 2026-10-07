import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db.select().from(categories).orderBy(asc(categories.displayOrder));
    return NextResponse.json({ success: true, categories: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
