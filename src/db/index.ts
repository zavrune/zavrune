import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../lib/database-url";
import { formatDatabaseError } from "./errors";

export const APPLICATION_POOL_OPTIONS = Object.freeze({
  max: 3,
  min: 0,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  statement_timeout: 25000,
  query_timeout: 30000,
  lock_timeout: 5000,
  maxLifetimeSeconds: 120,
  maxUses: 7500,
  keepAlive: true,
});

const globalForDb = globalThis as typeof globalThis & {
  __zavruneApplicationPool?: Pool;
};

/** Lazy for env-less builds; fail BEFORE constructing pg if no URL is configured. */
export function getApplicationPool(): Pool {
  if (!globalForDb.__zavruneApplicationPool) {
    const { connectionString } = resolveDatabaseUrl();
    const shared = new Pool({ ...APPLICATION_POOL_OPTIONS, connectionString });
    // An idle backend disconnect must not become an unhandled process error.
    shared.on("error", (error) => console.error(`ZAVRUNE_DB_ERROR: Idle database connection: ${formatDatabaseError(error)}`));
    globalForDb.__zavruneApplicationPool = shared;
  }
  return globalForDb.__zavruneApplicationPool;
}

// Drizzle and readiness share one pool in production too. Binding preserves pg's
// receiver; no pool or localhost defaults are instantiated during module loading.
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const shared = getApplicationPool();
    const value = Reflect.get(shared, property, shared);
    return typeof value === "function" ? value.bind(shared) : value;
  },
});
// Drizzle itself is built on first use: its constructor inspects the client, so
// building it at import time would construct a pool during a plain import.
type QueryDatabase = NodePgDatabase<Record<string, never>>;
let queryDb: QueryDatabase | undefined;

export const db: QueryDatabase = new Proxy({} as QueryDatabase, {
  get(_target, property) {
    queryDb ??= drizzle(pool);
    const value = Reflect.get(queryDb, property, queryDb);
    return typeof value === "function" ? value.bind(queryDb) : value;
  },
});

