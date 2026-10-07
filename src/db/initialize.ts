import { applyPendingMigrations, formatDatabaseError } from "./migrate";

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
  return `${DATABASE_ERROR_PREFIX}: Database schema initialization failed: ${formatDatabaseError(error)}`;
}

/**
 * Ensures committed, additive schema migrations have completed before a
 * database-backed request proceeds. The in-flight promise is shared within a
 * server instance; a later request can retry after a transient failure.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const state = initializationState();
  if (state.ready) return;

  if (!state.promise) {
    state.promise = applyPendingMigrations()
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
