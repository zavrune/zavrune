import { NextResponse } from "next/server";
import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
    }

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email.toLowerCase().trim()))
      .limit(1);

    if (!admin) {
      return NextResponse.json({ success: false, error: "Invalid admin credentials" }, { status: 401 });
    }

    // Generate session token
    const token = `zvr_sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(adminSessions).values({
      adminId: admin.id,
      token,
      expiresAt,
    });

    const cookieStore = await cookies();
    cookieStore.set("zavrune_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({ success: true, name: admin.name });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Login failed" }, { status: 500 });
  }
}
