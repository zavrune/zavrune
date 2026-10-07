/** Run only against a disposable local database; never against production.
 * DATABASE_URL=.../zavrune_test_bootstrap npm run test:bootstrap -- bootstrap
 * Modes: bootstrap, partial, occupied, rollback (each needs a fresh database).
 */
import assert from "node:assert/strict";
import { applyPendingMigrations, formatDatabaseError } from "../src/db/migrate";
import { seedDatabase } from "../src/db/seed";
import { pool } from "../src/db";
import { ensureStorefrontReady } from "../src/db/initialize";
import { isMigrationStateCurrent } from "../src/db/migration-state";
import { applyMigrationsOnClient } from "../src/db/migrate";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
assert(["localhost", "127.0.0.1"].includes(url.hostname));
assert(url.pathname.startsWith("/zavrune_test_"), "Use a fresh disposable zavrune_test_* database");
for (const key of ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
  assert(!process.env[key] || process.env[key] === process.env.DATABASE_URL);
}
const embeddedJournal = JSON.parse(require("../src/db/embedded-migrations.json").files["meta/_journal.json"]);
const tables = ["categories", "collections", "products", "product_variants", "size_guides", "size_guide_measurements", "page_sections", "navigation", "shipping_zones", "shipping_methods", "settings", "admins"];
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of tables) {
    result[table] = (await pool.query(`select * from "${table}" order by ${table === "settings" ? "key" : "id"}`)).rows;
  }
  return result;
}
async function count(table: string) {
  return Number((await pool.query(`select count(*) from "${table}"`)).rows[0].count);
}
async function main() {
  await Promise.all([applyPendingMigrations(), applyPendingMigrations()]);
  for (const table of tables) assert.equal(await count(table), 0, "Tests require fresh databases");
  const mode = process.argv[2] || "bootstrap";
  if (mode === "bootstrap") {
    await pool.query(`insert into settings(key,value) values ('design_system', '{"custom":true}')`);
    await Promise.all([ensureStorefrontReady(), seedDatabase({ onlyIfEmpty: true }), seedDatabase({ onlyIfEmpty: true })]);
    assert.equal(await count("categories"), 16);
    assert.equal(await count("collections"), 4);
    assert.equal(await count("products"), 6);
    assert.equal(await count("page_sections"), 20);
    assert.equal(await count("size_guide_measurements"), 5);
    assert.equal(await count("navigation"), 9);
    assert.equal(await count("shipping_zones"), 2);
    assert.equal(await count("shipping_methods"), 3);
    assert.equal(await count("admins"), 0);
    assert((await count("product_variants")) > 20);
    const before = await snapshot();
    await Promise.all([seedDatabase(), seedDatabase(), seedDatabase({ onlyIfEmpty: true })]);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await pool.query(`select value from settings where key='design_system'`)).rows[0].value, { custom: true });
  } else if (mode === "occupied") {
    await pool.query(`insert into categories(slug,name_en,name_ar,name_fr) values ('user-category','Custom','Custom','Custom')`);
    const before = await snapshot();
    await seedDatabase({ onlyIfEmpty: true });
    assert.deepEqual(await snapshot(), before);
  } else if (mode === "partial") {
    await pool.query(`insert into categories(slug,name_en,name_ar,name_fr) values ('hoodies','Edited hoodie category','Edited','Edited')`);
    await pool.query(`insert into products(slug,name_en,name_ar,name_fr,price,sku) values ('zavrune-heavyweight-oversized-hoodie','Edited Hoodie','Edited','Edited',123,'ZVR-HD-001')`);
    await pool.query(`insert into product_variants(product_id,sku,color,size,stock) select id,'custom-sku','Charcoal Black','S',2 from products`);
    await pool.query(`insert into size_guides(category_id,name) select id,'Streetwear Oversized Tops' from categories`);
    await pool.query(`insert into size_guide_measurements(size_guide_id,size_label,chest) select id,'S','custom' from size_guides`);
    await pool.query(`insert into shipping_zones(name) values ('Grand Alger & Centre')`);
    await pool.query(`insert into page_sections(section_type,display_order,version,config) values ('hero',1,'published','{"custom":true}')`);
    const preserved = await snapshot();
    await Promise.all([seedDatabase(), seedDatabase()]);
    const after = await snapshot();
    for (const table of tables) {
      for (const row of preserved[table] as { id: string }[]) {
        assert.deepEqual((after[table] as { id: string }[]).find((r) => r.id === row.id), row);
      }
    }
    assert.equal(await count("products"), 6);
    assert.equal(await count("size_guide_measurements"), 5);
    assert.equal(await count("shipping_methods"), 3);
    assert.equal(await count("page_sections"), 20);
    await seedDatabase();
    assert.deepEqual(await snapshot(), after);
  } else if (mode === "rollback") {
    // Inject a failure only in this disposable database. No production reset SQL.
    await pool.query(`create function test_fail_seed() returns trigger language plpgsql as $$ begin raise exception 'injected seed failure'; end $$`);
    await pool.query(`create trigger test_fail_seed before insert on products for each row execute function test_fail_seed()`);
    await assert.rejects(seedDatabase({ onlyIfEmpty: true }), /insert into "products"/);
    for (const table of tables) assert.equal(await count(table), 0, "Failed transaction must roll back all writes");
    await pool.query(`alter table products disable trigger test_fail_seed`);
    await seedDatabase({ onlyIfEmpty: true });
    assert.equal(await count("products"), 6);
  } else throw new Error("Unknown test mode");
  // --- Startup/readiness architecture (cheap reads, bounded contention) ------
  const journal = JSON.parse(embeddedJournal.entries ? JSON.stringify(embeddedJournal) : "{}");

  const readinessReads: string[] = [];
  const spyPool = {
    query: async (config: string | { text: string }) => {
      readinessReads.push(typeof config === "string" ? config : config.text);
      return pool.query(config as never);
    },
  } as unknown as Parameters<typeof isMigrationStateCurrent>[0];
  const readinessStarted = Date.now();
  assert.equal(await isMigrationStateCurrent(spyPool), true, "a fully migrated database must be ready");
  assert.equal(await isMigrationStateCurrent(spyPool), true);
  assert.equal(readinessReads.length, 4, "readiness must be exactly two cheap reads per check");
  for (const statement of readinessReads) {
    assert.match(statement, /^select/i, "readiness may only read");
    assert.doesNotMatch(statement, /insert|update|delete|create table|alter table|drop|truncate|advisory/i, "readiness must not write, lock or run DDL");
  }
  assert.ok(Date.now() - readinessStarted < 3000, "readiness must be fast on an up-to-date database");
  assert.ok((await Promise.all(Array.from({ length: 8 }, () => isMigrationStateCurrent(spyPool)))).every(Boolean));

  // Repeated readiness checks must not mutate anything.
  const settingsBefore = await count("settings");
  const migrationRows = Number((await pool.query("select count(*) from drizzle.__drizzle_migrations")).rows[0].count);
  const repeated = Date.now();
  await Promise.all([applyPendingMigrations({ pool, waitTimeoutMs: 15000 }), applyPendingMigrations({ pool, waitTimeoutMs: 15000 })]);
  assert.ok(Date.now() - repeated < 3000, "an up-to-date database must not enter the migration path");
  assert.equal(await count("settings"), settingsBefore, "readiness must not write to the database");
  assert.equal(Number((await pool.query("select count(*) from drizzle.__drizzle_migrations")).rows[0].count), migrationRows, "no migration may be re-applied");

  // A held advisory lock must produce bounded, non-blocking contention.
  const holder = await pool.connect();
  let contentionConnects = 0;
  const contentionPool = {
    query: (config: never) => pool.query(config),
    connect: async () => {
      contentionConnects += 1;
      return pool.connect();
    },
  } as unknown as typeof pool;
  try {
    await holder.query("select pg_advisory_lock(hashtext($1))", ["zavrune-schema-initialization"]);
    await assert.rejects(
      // A stale state forces the lock path; the fast path would legitimately skip it.
      applyPendingMigrations({ pool: contentionPool, checkState: async () => false, waitTimeoutMs: 1500, pollIntervalMs: 150 }),
      /Schema migration is busy/,
      "a busy migration lock must fail with a bounded, clear error instead of queueing"
    );
    assert.ok(contentionConnects >= 2, "the try-lock must be retried a bounded number of times");
  } finally {
    await holder.query("select pg_advisory_unlock(hashtext($1))", ["zavrune-schema-initialization"]);
    holder.release();
  }

  // Concurrent instances: exactly one runs DDL, the others observe the commit.
  let ddlRuns = 0;
  let ddlInFlight = 0;
  let maxDdlInFlight = 0;
  let migrated = false;
  await Promise.all(
    Array.from({ length: 4 }, () =>
      applyPendingMigrations({
        pool: contentionPool,
        checkState: async () => migrated,
        executeMigrations: async (client, folder) => {
          ddlRuns += 1;
          ddlInFlight += 1;
          maxDdlInFlight = Math.max(maxDdlInFlight, ddlInFlight);
          try {
            await applyMigrationsOnClient(client, folder);
            migrated = true;
          } finally {
            ddlInFlight -= 1;
          }
        },
        waitTimeoutMs: 20000,
        pollIntervalMs: 100,
      })
    )
  );
  assert.equal(ddlRuns, 1, "pending migrations must be applied exactly once across concurrent instances");
  assert.equal(maxDdlInFlight, 1, "concurrent instances must never run DDL simultaneously");
  assert.equal(
    Number((await pool.query("select count(*) from drizzle.__drizzle_migrations")).rows[0].count),
    journal.entries.length,
    "the migration ledger must contain every committed migration exactly once"
  );

  // Without any configured URL the runner fails closed and never builds a pool.
  const savedUrls = {
    ZAVRUNE_DATABASE_URL: process.env.ZAVRUNE_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
  };
  delete process.env.ZAVRUNE_DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  let poolConstructions = 0;
  class NeverPool {
    constructor() {
      poolConstructions += 1;
      throw new Error("pg must not be constructed without a configured URL");
    }
  }
  try {
    await assert.rejects(
      applyPendingMigrations({ Pool: NeverPool as never, waitTimeoutMs: 300 }),
      /ZAVRUNE_DB_ERROR/,
      "a missing database URL must fail closed"
    );
    assert.equal(poolConstructions, 0, "pg must never be constructed, so localhost defaults can never apply");
  } finally {
    for (const [name, value] of Object.entries(savedUrls)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }

  // Committed migrations stay additive; destructive SQL is refused.
  const drizzleDir = path.resolve(__dirname, "../drizzle");
  const sqlFiles = readdirSync(drizzleDir).filter((name) => name.endsWith(".sql"));
  assert.ok(sqlFiles.length >= 2);
  for (const name of sqlFiles) {
    const sqlText = readFileSync(path.join(drizzleDir, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--[^\n]*/g, "");
    assert.doesNotMatch(sqlText, /\b(drop\s+(table|schema|index|constraint|column)|truncate\b|delete\s+from)\b/i, `${name} must not remove production data`);
  }

  // The request path cannot import or run migrations.
  const initializeSource = readFileSync(path.resolve(__dirname, "../src/db/initialize.ts"), "utf8");
  const instrumentationSource = readFileSync(path.resolve(__dirname, "../src/instrumentation.ts"), "utf8");
  assert.doesNotMatch(initializeSource, /applyPendingMigrations|pg_advisory_lock/);
  assert.doesNotMatch(instrumentationSource, /applyPendingMigrations|migrate-runner/);

  const redacted = formatDatabaseError(new Error("postgresql://user:private-password@host/db password=private-password"));
  assert(!redacted.includes("private-password"));
  console.log(`PASS: migration/seed ${mode} checks`);
}
main().catch((error: unknown) => {
  console.error(`ZAVRUNE_DB_ERROR: Bootstrap test failed: ${formatDatabaseError(error)}`);
  process.exitCode = 1;
}).finally(() => pool.end());
