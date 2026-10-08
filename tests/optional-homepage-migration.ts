/** Genuine pre-0002 production schema; never drop columns or reset real data.
 * Invoked by test:db on disposable, local zavrune_test_* databases only.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pool } from "../src/db";
import { applyMigrationsOnClient, applyPendingMigrations } from "../src/db/migrate";
import { getMigrationReadiness, isMigrationStateCurrent } from "../src/db/migration-state";

const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
const base = new URL(process.env.TEST_BASE_URL || "http://localhost:3117");
assert(["localhost", "127.0.0.1"].includes(database.hostname), "use a disposable local database");
assert(database.pathname.startsWith("/zavrune_test_"), "use a zavrune_test_* database");
assert(["localhost", "127.0.0.1"].includes(base.hostname));
for (const key of ["ZAVRUNE_DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
  assert(!process.env[key] || process.env[key] === process.env.DATABASE_URL, "no external database URLs are allowed in this test");
}

const embedded = require("../src/db/embedded-migrations.json") as { files: Record<string, string> };
const journal = JSON.parse(embedded.files["meta/_journal.json"]);
const OPTIONAL = "0002_homepage_section_names";

async function hasName() {
  return (await pool.query("select exists (select 1 from pg_attribute where attrelid = to_regclass('public.page_sections') and attname = 'name' and not attisdropped) as present")).rows[0].present;
}

async function prepare(count: number) {
  assert.equal((await pool.query("select to_regclass('public.page_sections') as sections")).rows[0].sections, null, "preparation requires a fresh database");
  const folder = mkdtempSync(path.join(os.tmpdir(), "zavrune-pre-0002-"));
  try {
    mkdirSync(path.join(folder, "meta"));
    const entries = journal.entries.slice(0, count);
    writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) writeFileSync(path.join(folder, `${entry.tag}.sql`), embedded.files[`${entry.tag}.sql`]);
    const client = await pool.connect();
    try {
      await applyMigrationsOnClient(client, folder);
    } finally {
      client.release();
    }
    assert.equal(await hasName(), false);
    assert.equal(Number((await pool.query("select count(*) from drizzle.__drizzle_migrations")).rows[0].count), count);
    const readiness = await getMigrationReadiness(pool);
    assert.equal(readiness.ready, count === 2);
    assert.equal(readiness.degraded, count === 2);
    assert.equal(await isMigrationStateCurrent(pool), false, "deploy migrations must not skip optional 0002");
    console.log(`PASS: genuine schema with only ${entries.map((entry: { tag: string }) => entry.tag).join(", ")} applied`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Stable snapshots of every public table, not just the edited section rows. */
async function snapshot() {
  const tables = (await pool.query("select tablename from pg_tables where schemaname = 'public' order by tablename")).rows;
  const result: Record<string, Record<string, any>[]> = {};
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z_][a-z0-9_]*$/);
    const rows = (await pool.query(`select * from "${tablename}"`)).rows;
    rows.sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
    result[tablename] = rows;
  }
  return result;
}

async function health(degraded: boolean) {
  const response = await fetch(new URL("/api/health", base));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.databaseInitialized, true);
  assert.equal(payload.degraded, degraded);
  assert.deepEqual(payload.pendingMigrations, degraded ? [OPTIONAL] : []);
  console.log(`PASS: GET /api/health -> 200, degraded=${degraded}, pendingMigrations=${JSON.stringify(payload.pendingMigrations)}`);
}

async function verify() {
  assert.equal(await hasName(), false, "the reproduction must actually lack page_sections.name");
  await health(true);
  const home = await fetch(new URL("/", base));
  assert.equal(home.status, 200);
  assert.ok(!(await home.text()).includes("adminName"));
  console.log("PASS: GET / -> 200 while 0002 is pending");

  const headers = { "Content-Type": "application/json", Origin: base.origin, "Sec-Fetch-Site": "same-origin" };
  const login = await fetch(new URL("/api/admin/login", base), {
    method: "POST", headers,
    body: JSON.stringify({ email: process.env.ZAVRUNE_ADMIN_EMAIL, password: process.env.ZAVRUNE_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  const adminHeaders = { ...headers, Cookie: cookie };
  for (const route of ["/mohamedbdr/homepage", "/mohamedbdr", "/api/admin/health"]) {
    const response = await fetch(new URL(route, base), { headers: adminHeaders });
    assert.equal(response.status, 200, `${route} must work without the name column`);
    await response.text();
    console.log(`PASS: GET ${route} -> 200 while 0002 is pending`);
  }

  const list = async (version: "draft" | "published") => {
    const response = await fetch(new URL(`/api/admin/sections?version=${version}`, base), { headers: adminHeaders });
    assert.equal(response.status, 200);
    return (await response.json()).sections as Record<string, any>[];
  };
  const post = async (action: string, sections: Record<string, any>[]) => {
    const response = await fetch(new URL("/api/admin/sections", base), {
      method: "POST", headers: adminHeaders, body: JSON.stringify({ action, sections }),
    });
    assert.equal(response.status, 200, `${action}: ${await response.text()}`);
  };
  const original = await list("draft");
  const probeName = "Pending Migration Private Label";
  const sections = [...original, {
    sectionType: "hero", name: probeName, isVisible: true, desktopVisible: false, mobileVisible: true,
    config: { titleEn: "OPTIONAL MIGRATION PUBLIC HEADING", adminName: "Stale private mirror" },
  }];
  await post("save_draft", sections);
  await post("publish", sections);
  console.log("PASS: POST /api/admin/sections save_draft and publish -> 200 while 0002 is pending");
  const published = await list("published");
  const probe = published.find((section) => section.name === probeName);
  assert.ok(probe);
  assert.equal(probe.sectionType, "hero");
  assert.equal(probe.desktopVisible, false);
  assert.equal(probe.mobileVisible, true);
  assert.ok(!Object.hasOwn(probe.config, "adminName"));
  const pendingRows = (await pool.query("select config from page_sections where version='published' and config->>'adminName'=$1", [probeName])).rows;
  assert.equal(pendingRows.length, 1);
  const pendingHtml = await (await fetch(new URL("/", base))).text();
  assert.ok(pendingHtml.includes("OPTIONAL MIGRATION PUBLIC HEADING"));
  for (const privateValue of ["adminName", probeName, "Stale private mirror"]) assert.ok(!pendingHtml.includes(privateValue));

  // Apply the real, unchanged additive 0002 while next start is still running.
  // Every existing row/config/ID/timestamp and unrelated table must be preserved.
  const before = await snapshot();
  await applyPendingMigrations();
  assert.equal(await hasName(), true);
  assert.equal(await isMigrationStateCurrent(pool), true);
  const after = await snapshot();
  for (let index = 0; index < after.page_sections.length; index += 1) {
    const row = after.page_sections[index];
    const mirror = before.page_sections[index].config?.adminName;
    assert.equal(row.name, typeof mirror === "string" && mirror.trim() ? mirror.trim().slice(0, 120) : null, "existing JSON names must be promoted by 0002");
    delete row.name; // Compare snapshots only; this does not mutate the database.
  }
  assert.deepEqual(after, before, "0002 may only add/backfill the nullable name column; all production-shaped data stays intact");
  console.log("PASS: late 0002 promoted existing config.adminName values without changing any existing public-table data");

  await health(false); // Same warm server: no negative-capability cache/restart.
  const builder = await fetch(new URL("/mohamedbdr/homepage", base), { headers: adminHeaders });
  assert.equal(builder.status, 200);
  await builder.text();
  const renamed = published.map((section) => section.name === probeName ? { ...section, name: "Native Migration Private Label" } : section);
  await post("save_draft", renamed);
  await post("publish", renamed);
  const nativeRows = (await pool.query("select name,config from page_sections where version='published' and name=$1", ["Native Migration Private Label"])).rows;
  assert.equal(nativeRows.length, 1);
  assert.ok(!Object.hasOwn(nativeRows[0].config, "adminName"), "native writes must keep name and config separate");
  const nativeHome = await fetch(new URL("/", base));
  assert.equal(nativeHome.status, 200);
  const nativeHtml = await nativeHome.text();
  assert.ok(nativeHtml.includes("OPTIONAL MIGRATION PUBLIC HEADING"));
  assert.ok(!nativeHtml.includes("Native Migration Private Label"));
  assert.ok(!nativeHtml.includes("adminName"));
  const complete = await snapshot();
  await applyPendingMigrations();
  assert.deepEqual(await snapshot(), complete, "repeated migration runs must be a no-op");
  console.log("PASS: warm-instance native rename/publish after migration; repeated migration is a no-op");
}

async function verifyRequired() {
  const state = await getMigrationReadiness(pool);
  assert.equal(state.ready, false);
  assert.ok(state.pendingMigrations.includes("0001_admin_dashboard"));
  const response = await fetch(new URL("/api/health", base));
  assert.equal(response.status, 500, "missing required 0001 must fail closed");
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.match(payload.databaseError, /Required committed migrations are not ready/);
  assert.ok(!JSON.stringify(payload).includes(database.href));
  const storefront = await fetch(new URL("/", base));
  assert.equal(storefront.status, 500, "the required schema cannot be bypassed on the storefront");
  await storefront.text();
  console.log("PASS: missing required 0001 fails closed on GET /api/health and GET / (500)");
}

async function main() {
  switch (process.argv[2]) {
    case "prepare": return prepare(2);
    case "prepare-required": return prepare(1);
    case "verify": return verify();
    case "verify-required": return verifyRequired();
    default: throw new Error("Unknown optional migration test mode");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Optional migration test failed");
  process.exitCode = 1;
}).finally(() => pool.end());
