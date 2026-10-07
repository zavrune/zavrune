import { db } from "@/db";
import { admins, adminSessions, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { hash as hashPassword } from "bcryptjs";

/**
 * First-admin provisioning from environment variables.
 *
 *   ZAVRUNE_ADMIN_EMAIL          (required to provision)
 *   ZAVRUNE_ADMIN_PASSWORD       (required to provision, min 10 chars)
 *   ZAVRUNE_ADMIN_NAME           (optional display name)
 *   ZAVRUNE_ADMIN_RESET_TOKEN    (optional; a new value rotates the password once)
 *
 * Only the bcrypt hash of the password is ever written to the database. The reset
 * token is stored as a SHA-256 digest so a database reader cannot reuse it.
 */
export const ADMIN_RESET_TOKEN_KEY = "admin_bootstrap_reset_token";

export const MIN_ADMIN_PASSWORD_LENGTH = 10;
export const BCRYPT_ROUNDS = 10;

export type AdminBootstrapStatus =
  | "unconfigured"
  | "created"
  | "password-rotated"
  | "unchanged"
  | "invalid-password";

export interface AdminBootstrapResult {
  status: AdminBootstrapStatus;
  email?: string;
  message?: string;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function validateAdminPassword(password: string): string | null {
  if (typeof password !== "string" || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Admin password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return "Admin password is too long.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Admin password must contain both letters and numbers.";
  }
  return null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readStoredResetTokenHash(): Promise<string | null> {
  const [record] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, ADMIN_RESET_TOKEN_KEY))
    .limit(1);
  const value = record?.value as { tokenHash?: string } | undefined;
  return value?.tokenHash ?? null;
}

async function writeStoredResetTokenHash(tokenHash: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: ADMIN_RESET_TOKEN_KEY, value: { tokenHash }, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { tokenHash }, updatedAt: new Date() },
    });
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hashPassword(password, BCRYPT_ROUNDS);
}

/** Deletes every session for an admin, optionally keeping the current device. */
export async function revokeAdminSessions(adminId: string, keepSessionId?: string): Promise<void> {
  const rows = await db.select().from(adminSessions).where(eq(adminSessions.adminId, adminId));
  for (const row of rows) {
    if (keepSessionId && row.id === keepSessionId) continue;
    await db.delete(adminSessions).where(eq(adminSessions.id, row.id));
  }
}

/**
 * Idempotent. Safe to call on every admin request: without the environment
 * variables it is a no-op, so a store whose admin already exists is untouched.
 */
export async function ensureFirstAdmin(): Promise<AdminBootstrapResult> {
  const email = process.env.ZAVRUNE_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ZAVRUNE_ADMIN_PASSWORD;
  const name = process.env.ZAVRUNE_ADMIN_NAME?.trim() || "Store Owner";
  const resetToken = process.env.ZAVRUNE_ADMIN_RESET_TOKEN?.trim();

  if (!email || !password) return { status: "unconfigured" };
  if (!isValidEmail(email)) {
    return { status: "unconfigured", message: "ZAVRUNE_ADMIN_EMAIL is not a valid email address." };
  }

  const passwordProblem = validateAdminPassword(password);
  if (passwordProblem) return { status: "invalid-password", email, message: passwordProblem };

  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);

  if (!existing) {
    await db.insert(admins).values({
      email,
      name,
      role: "admin",
      passwordHash: await hashAdminPassword(password),
      passwordChangedAt: new Date(),
    });
    if (resetToken) await writeStoredResetTokenHash(sha256(resetToken));
    console.log(`[admin] Provisioned the first admin account for ${email}.`);
    return { status: "created", email };
  }

  if (!resetToken) return { status: "unchanged", email };

  const storedHash = await readStoredResetTokenHash();
  if (storedHash === sha256(resetToken)) return { status: "unchanged", email };

  await db
    .update(admins)
    .set({
      passwordHash: await hashAdminPassword(password),
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
      ...(process.env.ZAVRUNE_ADMIN_NAME ? { name } : {}),
    })
    .where(eq(admins.id, existing.id));

  // A rotated password must invalidate every previously issued session.
  await revokeAdminSessions(existing.id);
  await writeStoredResetTokenHash(sha256(resetToken));
  console.log(`[admin] Rotated the admin password for ${email} from ZAVRUNE_ADMIN_RESET_TOKEN.`);
  return { status: "password-rotated", email };
}
