import { formatDatabaseError } from "./errors";
import { pool } from "./index";
import { isMigrationStateCurrent } from "./migration-state";

const DATABASE_ERROR_PREFIX = "ZAVRUNE_DB_ERROR";

type DatabaseInitializationState = {
  ready: boolean;
  promise?: Promise<void>;
  error?: string;
};

const globalForDatabaseInitialization = globalThis as typeof globalThis & {
  __zavruneDatabaseInitialization?: DatabaseInitializationState;
};

function initializationState(): DatabaseInitializationState {
  if (!globalForDatabaseInitialization.__zavruneDatabaseInitialization) {
    globalForDatabaseInitialization.__zavruneDatabaseInitialization = { ready: false };
  }
  return globalForDatabaseInitialization.__zavruneDatabaseInitialization;
}

function initializationError(error: unknown): string {
  const detail = formatDatabaseError(error);
  // Avoid a duplicated prefix when the underlying error is already a ZAVRUNE one.
  return detail.startsWith(DATABASE_ERROR_PREFIX)
    ? detail
    : `${DATABASE_ERROR_PREFIX}: Database schema initialization failed: ${detail}`;
}

/** Cheap fast path, or bounded polling while a deployment commits migrations. */
async function waitForDatabaseSchema(): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await isMigrationStateCurrent(pool, Math.min(3000, deadline - Date.now()))) return;
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(250, remaining)));
  }
  throw new Error("Committed migrations are not ready. Run npm run db:migrate with a direct database URL; schema readiness polling deadline exceeded.");
}

/**
 * Read/poll only: the build/CLI owns DDL on a direct connection. Serverless
 * requests use the shared application pool and never enter a session lock or
 * migration path. Only successful readiness is memoized; failures can retry.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const state = initializationState();
  if (state.ready) return;

  if (!state.promise) {
    state.promise = waitForDatabaseSchema()
      .then(() => {
        state.ready = true;
        state.error = undefined;
      })
      .catch((error: unknown) => {
        const message = initializationError(error);
        state.error = message;
        console.error(message);
        throw new Error(message);
      })
      .finally(() => {
        state.promise = undefined;
      });
  }

  await state.promise;
}

/** Returns the latest redacted initialization failure for diagnostics. */
export function getDatabaseInitializationError(): string | undefined {
  return initializationState().error;
}

const globalForStorefront = globalThis as typeof globalThis & {
  __zavruneStorefrontPromise?: Promise<void>;
};

/** Schema first, then an atomic official bootstrap only for a genuinely empty store. */
export async function ensureStorefrontReady(): Promise<void> {
  await ensureDatabaseSchema();
  if (!globalForStorefront.__zavruneStorefrontPromise) {
    globalForStorefront.__zavruneStorefrontPromise = import("./seed")
      .then(({ seedDatabase }) => seedDatabase({ onlyIfEmpty: true }))
      .catch((error: unknown) => {
        globalForStorefront.__zavruneStorefrontPromise = undefined;
        const message = `ZAVRUNE_DB_ERROR: Storefront bootstrap failed: ${formatDatabaseError(error)}`;
        console.error(message);
        throw new Error(message);
      });
  }
  await globalForStorefront.__zavruneStorefrontPromise;
}

const globalForAdmin = globalThis as typeof globalThis & {
  __zavruneAdminPromise?: Promise<void>;
};

/**
 * Schema + delivery rates + managed product groups + first-admin provisioning.
 * Shared by admin pages/APIs. Existing defaults take read-only fast paths;
 * missing defaults are inserted without overwriting owner-managed values.
 */
export async function ensureAdminReady(): Promise<void> {
  await ensureDatabaseSchema();

  if (!globalForAdmin.__zavruneAdminPromise) {
    globalForAdmin.__zavruneAdminPromise = (async () => {
      const [{ ensureDeliveryRates }, { ensureProductGroups }, { ensureFirstAdmin }] = await Promise.all([
        import("@/lib/delivery"),
        import("@/lib/product-groups"),
        import("@/lib/admin-bootstrap"),
      ]);
      await ensureDeliveryRates();
      await ensureProductGroups();
      await ensureFirstAdmin();
    })().catch((error: unknown) => {
      globalForAdmin.__zavruneAdminPromise = undefined;
      const message = `ZAVRUNE_DB_ERROR: Admin initialization failed: ${formatDatabaseError(error)}`;
      console.error(message);
      throw new Error(message);
    });
  }

  await globalForAdmin.__zavruneAdminPromise;
}

/** Never return raw driver messages (which may contain connection credentials). */
export function logDatabaseError(context: string, error: unknown): void {
  console.error(`ZAVRUNE_DB_ERROR: ${context}: ${formatDatabaseError(error)}`);
}

/** Log/redact query failures without swallowing them or catching JSX/control flow. */
export async function storefrontQuery<T>(query: PromiseLike<T>): Promise<T> {
  try {
    return await query;
  } catch (error: unknown) {
    logDatabaseError("Storefront query failed", error);
    throw new Error("Storefront database request failed");
  }
}
