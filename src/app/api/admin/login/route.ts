import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { ensureAdminReady } from "@/db/initialize";
import {
  AdminApiError,
  createAdminSession,
  clientIpFromRequest,
  hashIp,
  recordAdminAudit,
  requireSameOrigin,
  setSessionCookie,
} from "@/lib/auth";
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from "@/lib/rate-limit";
import { isValidEmail, validateAdminPassword } from "@/lib/admin-bootstrap";
import { jsonError, jsonServerError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Cross-site form posts must not be able to establish a session.
    await requireSameOrigin(req);
  } catch (error) {
    if (error instanceof AdminApiError) return jsonError(error.message, error.status);
    return jsonError("Request rejected", 403);
  }

  try {
    await ensureAdminReady();

    const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) return jsonError("Email and password are required.", 400);
    if (!isValidEmail(email)) return jsonError("Invalid admin credentials.", 401);
    if (validateAdminPassword(password)) return jsonError("Invalid admin credentials.", 401);

    const ip = clientIpFromRequest(req);
    const ipKey = `ip:${hashIp(ip) ?? "unknown"}`;
    const accountKey = `admin:${email}`;

    // Throttle per account and per source address.
    for (const key of [accountKey, ipKey]) {
      const state = await checkRateLimit(key);
      if (!state.allowed) {
        await recordAdminAudit(null, "admin.login.rate_limited", { target: email, req });
        return NextResponse.json(
          {
            success: false,
            error: `Too many failed sign-in attempts. Try again in ${Math.max(1, Math.ceil(state.retryAfterSeconds / 60))} minute(s).`,
            retryAfterSeconds: state.retryAfterSeconds,
          },
          { status: 429, headers: { "Retry-After": String(state.retryAfterSeconds) } }
        );
      }
    }

    const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);

    if (!admin || !(await compare(password, admin.passwordHash))) {
      await recordFailedAttempt(accountKey);
      await recordFailedAttempt(ipKey);
      await recordAdminAudit(null, "admin.login.failed", { target: email, req });
      return jsonError("Invalid admin credentials.", 401);
    }

    await clearRateLimit(accountKey);
    await clearRateLimit(ipKey);

    const { token, expiresAt } = await createAdminSession(admin.id, req);
    await setSessionCookie(token, expiresAt);
    await recordAdminAudit({ id: admin.id, email: admin.email }, "admin.login.success", { req });

    return NextResponse.json({ success: true, name: admin.name, email: admin.email });
  } catch (error) {
    if (error instanceof AdminApiError) return jsonError(error.message, error.status);
    return jsonServerError("Admin login failed", error);
  }
}
