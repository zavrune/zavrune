import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ensureDatabaseSchema, logDatabaseError } from "@/db/initialize";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
    }

    await ensureDatabaseSchema();

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email.toLowerCase().trim()))
      .limit(1);

    if (!admin || !(await compare(password, admin.passwordHash))) {
      return NextResponse.json({ success: false, error: "Invalid admin credentials" }, { status: 401 });
    }

    // Generate session token
    const token = `zvr_secure_${randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(adminSessions).values({
      adminId: admin.id,
      token,
      expiresAt,
    });

    const cookieStore = await cookies();
    cookieStore.set("zavrune_admin_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({ success: true, name: admin.name });
  } catch (error: unknown) {
    logDatabaseError("Admin login failed", error);
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
  }
}
