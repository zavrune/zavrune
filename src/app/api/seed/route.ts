import { NextResponse } from "next/server";
import { seedDatabase } from "@/db/seed";
import { ensureDatabaseSchema, logDatabaseError } from "@/db/initialize";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

// Read-only: crawlers, prefetches and health probes must never seed production.
export async function GET() {
  return NextResponse.json({ message: "Use authenticated admin POST to resume an unmarked official starter seed. Existing rows are preserved; missing official rows will be added. Completed seeds are left untouched." });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ success: false, error: "Forbidden origin" }, { status: 403 });
  }
  try {
    const admin = await getAdminSession();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await ensureDatabaseSchema();
    await seedDatabase();
    return NextResponse.json({ success: true, message: "Missing official starter data initialized; existing data preserved." });
  } catch (error: unknown) {
    logDatabaseError("Admin seed failed", error);
    return NextResponse.json({ success: false, error: "Database initialization failed" }, { status: 500 });
  }
}
