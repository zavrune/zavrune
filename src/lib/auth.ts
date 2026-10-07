import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { compare as comparePassword, hash as hashPassword } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLog, adminSessions, admins } from "@/db/schema";
import { ensureAdminReady } from "@/db/initialize";
import { BCRYPT_ROUNDS, MIN_ADMIN_PASSWORD_LENGTH, revokeAdminSessions, validateAdminPassword } from "@/lib/admin-bootstrap";

export const SESSION_COOKIE = "zavrune_admin_session";
export const ADMIN_BASE_PATH = "/mohamedbdr";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000; // refresh last_seen hourly

const TOKEN_PREFIX = "zvr_secure_";
const TOKEN_PATTERN = /^zvr_secure_[a-f0-9]{64}$/;

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminSessionContext {
  admin: AdminIdentity;
  sessionId: string;
  expiresAt: Date;
  createdAt: Date;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`zavrune-ip:${ip}`).digest("hex").slice(0, 32);
}

export function clientIpFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export function userAgentFromRequest(req: Request): string | null {
  return req.headers.get("user-agent")?.slice(0, 400) ?? null;
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Issues a new session and returns the raw cookie value (never stored as-is). */
export async function createAdminSession(
  adminId: string,
  req?: Request
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [session] = await db
    .insert(adminSessions)
    .values({
      adminId,
      token: hashSessionToken(token),
      expiresAt,
      userAgent: req ? userAgentFromRequest(req) : null,
      ipHash: req ? hashIp(clientIpFromRequest(req)) : null,
      lastSeenAt: new Date(),
    })
    .returning();

  return { token, expiresAt, sessionId: session.id };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires: new Date(0),
  });
}

/**
 * Reads and validates the admin session. Returns null for anonymous visitors.
 * Cheap by design: rejects malformed cookies before touching the database.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionContext | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  // Reject legacy or forged cookies without a database round trip.
  if (!rawToken || !TOKEN_PATTERN.test(rawToken)) return null;

  await ensureAdminReady();

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.token, hashSessionToken(rawToken)))
    .limit(1);

  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
    return null;
  }

  const [admin] = await db.select().from(admins).where(eq(admins.id, session.adminId)).limit(1);
  if (!admin) return null;

  // Password changes invalidate every session issued earlier.
  if (new Date(session.createdAt).getTime() < new Date(admin.passwordChangedAt).getTime() - 1000) {
    await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
    return null;
  }

  if (Date.now() - new Date(session.lastSeenAt).getTime() > SESSION_TOUCH_INTERVAL_MS) {
    try {
      await db
        .update(adminSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(adminSessions.id, session.id));
    } catch {
      // Session tracking is best-effort and must never block a page render.
    }
  }

  return {
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    sessionId: session.id,
    expiresAt: new Date(session.expiresAt),
    createdAt: new Date(session.createdAt),
  };
});

/** Server-component guard: every admin page calls this before reading data. */
export async function requireAdminPage(nextPath?: string): Promise<AdminSessionContext> {
  const session = await getAdminSession();
  if (!session) {
    const target = nextPath ? `${ADMIN_BASE_PATH}/login?next=${encodeURIComponent(nextPath)}` : `${ADMIN_BASE_PATH}/login`;
    redirect(target);
  }
  return session;
}

export async function getAdminSessionOrNull(): Promise<AdminSessionContext | null> {
  return getAdminSession();
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function sameOriginDetail(req: Request): string | null {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return "Cross-site requests are not allowed.";
  }

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return "Cross-origin requests are not allowed.";
    } catch {
      return "Invalid origin header.";
    }
    return null;
  }

  const referer = req.headers.get("referer");
  if (!origin && referer && host) {
    try {
      if (new URL(referer).host !== host) return "Cross-origin requests are not allowed.";
    } catch {
      return "Invalid referer header.";
    }
    return null;
  }

  // Browsers always send one of these on state-changing requests. A request with
  // neither is not a normal same-origin admin action.
  if (!origin && !referer && !secFetchSite) {
    return "Missing origin information on a state-changing request.";
  }

  return null;
}

/**
 * Guard for admin API routes. Returns the session or throws an AdminApiError the
 * route turns into a JSON response. State-changing requests are also checked for
 * cross-site origin.
 */
export async function requireAdminApi(req?: Request, options: { csrf?: boolean } = {}): Promise<AdminSessionContext> {
  const requiresCsrf = options.csrf ?? false;

  if (requiresCsrf && req) {
    const method = req.method.toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const detail = sameOriginDetail(req);
      if (detail) throw new AdminApiError(detail, 403);
    }
  }

  const session = await getAdminSession();
  if (!session) throw new AdminApiError("Unauthorized", 401);
  if (session.admin.role !== "admin") throw new AdminApiError("Forbidden", 403);
  return session;
}

export async function requireSameOrigin(req: Request): Promise<void> {
  const detail = sameOriginDetail(req);
  if (detail) throw new AdminApiError(detail, 403);
}

/** Deletes the server-side session row so logout is effective immediately. */
export async function destroySession(rawToken: string | undefined): Promise<void> {
  if (!rawToken || !TOKEN_PATTERN.test(rawToken)) return;
  await db.delete(adminSessions).where(eq(adminSessions.token, hashSessionToken(rawToken)));
}

export async function destroySessionById(sessionId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
}

export interface PasswordChangeResult {
  ok: boolean;
  error?: string;
}

/**
 * Verifies the current password, stores a new bcrypt hash and revokes every
 * session issued before the change (a fresh session is issued for this device).
 */
export async function changeAdminPassword(options: {
  adminId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeResult> {
  const { adminId, currentPassword, newPassword } = options;

  const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
  if (!admin) return { ok: false, error: "Admin account not found." };

  const currentValid = await comparePassword(currentPassword, admin.passwordHash);
  if (!currentValid) return { ok: false, error: "The current password is incorrect." };

  const problem = validateAdminPassword(newPassword);
  if (problem) return { ok: false, error: problem };

  if (await comparePassword(newPassword, admin.passwordHash)) {
    return { ok: false, error: "The new password must be different from the current password." };
  }

  await db
    .update(admins)
    .set({
      passwordHash: await hashPassword(newPassword, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(admins.id, adminId));

  // Every session issued before this change is invalidated.
  await revokeAdminSessions(adminId);
  return { ok: true };
}

export async function verifyAdminPassword(adminId: string, password: string): Promise<boolean> {
  const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
  if (!admin) return false;
  return comparePassword(password, admin.passwordHash);
}

export async function listAdminSessions(adminId: string) {
  const rows = await db.select().from(adminSessions).where(eq(adminSessions.adminId, adminId));
  return rows
    .map((row) => ({
      id: row.id,
      createdAt: new Date(row.createdAt),
      lastSeenAt: new Date(row.lastSeenAt),
      expiresAt: new Date(row.expiresAt),
      userAgent: row.userAgent,
      ipHash: row.ipHash,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function countAdminSessions(adminId: string): Promise<number> {
  const rows = await db.select({ id: adminSessions.id }).from(adminSessions).where(eq(adminSessions.adminId, adminId));
  return rows.length;
}

/** Audit trail for sensitive admin actions; never stores secrets. */
export async function recordAdminAudit(
  admin: { id: string; email: string } | null,
  action: string,
  options: { target?: string; detail?: Record<string, unknown>; req?: Request } = {}
): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      adminId: admin?.id ?? null,
      adminEmail: admin?.email ?? null,
      action,
      target: options.target ?? null,
      detail: options.detail ?? {},
      ipHash: options.req ? hashIp(clientIpFromRequest(options.req)) : null,
    });
  } catch {
    // Auditing must never break the admin action itself.
  }
}
