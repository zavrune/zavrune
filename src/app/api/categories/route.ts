import { ensureStorefrontReady, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

// Public read-only catalogue data. All category mutations live under
// /api/admin/categories and require an admin session.
export async function GET() {
  try {
    await ensureStorefrontReady();
    const list = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder));

    return NextResponse.json({ success: true, categories: list });
  } catch (error: unknown) {
    logDatabaseError("categories request failed", error);
    return NextResponse.json({ success: false, error: "Database request failed" }, { status: 500 });
  }
}
