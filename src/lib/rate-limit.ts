import { db } from "@/db";
import { adminLoginAttempts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/** Sliding window: N failures inside the window lock the identifier. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export interface RateLimitState {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

function nowMs() {
  return Date.now();
}

/**
 * Durable, database-backed throttle so protection is shared by every serverless
 * instance (in-memory counters reset on each cold start and are not sufficient).
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitState> {
  const [row] = await db
    .select()
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.identifier, identifier))
    .limit(1);

  if (!row) {
    return { allowed: true, retryAfterSeconds: 0, remaining: LOGIN_MAX_FAILURES };
  }

  const current = nowMs();

  if (row.lockedUntil && new Date(row.lockedUntil).getTime() > current) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((new Date(row.lockedUntil).getTime() - current) / 1000),
      remaining: 0,
    };
  }

  const windowAge = current - new Date(row.firstFailedAt).getTime();
  if (windowAge > LOGIN_WINDOW_MS) {
    // Window expired: treat as clean and let the next failure start a new window.
    return { allowed: true, retryAfterSeconds: 0, remaining: LOGIN_MAX_FAILURES };
  }

  return {
    allowed: row.failedCount < LOGIN_MAX_FAILURES,
    retryAfterSeconds: 0,
    remaining: Math.max(0, LOGIN_MAX_FAILURES - row.failedCount),
  };
}

export async function recordFailedAttempt(identifier: string): Promise<RateLimitState> {
  const current = nowMs();
  const lockUntil = new Date(current + LOGIN_LOCK_MS);
  const windowStart = new Date(current - LOGIN_WINDOW_MS);

  const [row] = await db
    .insert(adminLoginAttempts)
    .values({
      identifier,
      failedCount: 1,
      firstFailedAt: new Date(current),
      lockedUntil: null,
      updatedAt: new Date(current),
    })
    .onConflictDoUpdate({
      target: adminLoginAttempts.identifier,
      set: {
        // Restart the window when the previous one has fully aged out.
        failedCount: sql`case when ${adminLoginAttempts.firstFailedAt} < ${windowStart.toISOString()} then 1 else ${adminLoginAttempts.failedCount} + 1 end`,
        firstFailedAt: sql`case when ${adminLoginAttempts.firstFailedAt} < ${windowStart.toISOString()} then ${new Date(current).toISOString()}::timestamp else ${adminLoginAttempts.firstFailedAt} end`,
        lockedUntil: sql`case when (case when ${adminLoginAttempts.firstFailedAt} < ${windowStart.toISOString()} then 1 else ${adminLoginAttempts.failedCount} + 1 end) >= ${LOGIN_MAX_FAILURES} then ${lockUntil.toISOString()}::timestamp else ${adminLoginAttempts.lockedUntil} end`,
        updatedAt: new Date(current),
      },
    })
    .returning();

  const failures = row?.failedCount ?? 1;
  const locked = failures >= LOGIN_MAX_FAILURES;

  return {
    allowed: !locked,
    retryAfterSeconds: locked ? Math.ceil(LOGIN_LOCK_MS / 1000) : 0,
    remaining: Math.max(0, LOGIN_MAX_FAILURES - failures),
  };
}

export async function clearRateLimit(identifier: string): Promise<void> {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.identifier, identifier));
}
