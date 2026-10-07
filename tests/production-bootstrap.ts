/** Run only against a disposable local database; never against production.
 * DATABASE_URL=.../zavrune_test_bootstrap npm run test:bootstrap -- bootstrap
 * Modes: bootstrap, partial, occupied, rollback (each needs a fresh database).
 */
import assert from "node:assert/strict";
import { applyPendingMigrations, formatDatabaseError } from "../src/db/migrate";
import { seedDatabase } from "../src/db/seed";
import { pool } from "../src/db";
import { ensureStorefrontReady } from "../src/db/initialize";

const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
assert(["localhost", "127.0.0.1"].includes(url.hostname));
assert(url.pathname.startsWith("/zavrune_test_"), "Use a fresh disposable zavrune_test_* database");
for (const key of ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
  assert(!process.env[key] || process.env[key] === process.env.DATABASE_URL);
}
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
  const redacted = formatDatabaseError(new Error("postgresql://user:private-password@host/db password=private-password"));
  assert(!redacted.includes("private-password"));
  console.log(`PASS: migration/seed ${mode} checks`);
}
main().catch((error: unknown) => {
  console.error(`ZAVRUNE_DB_ERROR: Bootstrap test failed: ${formatDatabaseError(error)}`);
  process.exitCode = 1;
}).finally(() => pool.end());
