import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

/**
 * Schema changes ship as SQL in ./drizzle and are applied with
 * `npm run db:migrate`, which reads DATABASE_URL.
 * Do not use `drizzle-kit push` against production: push can drop columns.
 * This file must never contain a hosted connection string.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {}),
});
