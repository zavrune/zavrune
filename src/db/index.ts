import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

const queryDb = drizzle(pool);

// Fail closed without an application URL; never let pg use local defaults.
export const db = new Proxy(queryDb, {
  get(target, property, receiver) {
    if (!databaseUrl?.trim()) {
      throw new Error("ZAVRUNE_DB_ERROR: DATABASE_URL is required for application queries.");
    }
    return Reflect.get(target, property, receiver);
  },
});
