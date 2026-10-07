/** Production HTTP smoke checks against an isolated local verification database. */
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { pool } from "../src/db";

const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
const base = new URL(process.env.TEST_BASE_URL || "http://127.0.0.1:3000");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
assert(database.pathname.startsWith("/zavrune_test_"));
assert(["localhost", "127.0.0.1"].includes(base.hostname));
const seedUrl = new URL("/api/seed", base);
async function post(path: string, body: unknown) {
  return fetch(new URL(path, base), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
async function main() {
  const before = (await pool.query("select count(*) from products")).rows;
  assert.equal((await fetch(seedUrl)).status, 200);
  assert.deepEqual((await pool.query("select count(*) from products")).rows, before, "GET seed cannot mutate");
  assert.equal((await fetch(seedUrl, { method: "POST" })).status, 401);
  assert.deepEqual((await pool.query("select count(*) from products")).rows, before);

  const homepage = await fetch(new URL("/", base));
  assert.equal(homepage.status, 200);
  assert((await homepage.text()).includes("NEW DROP ARRIVALS"));
  for (const path of ["/shop?category=hoodies", "/shop?category=hoodies&sort=price_asc", "/shop?category=hoodies&sort=price_desc", "/p/zavrune-heavyweight-oversized-hoodie", "/pages/size-guide", "/pages/shipping", "/pages/contact"]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    if (path.startsWith("/shop") || path.startsWith("/p/")) assert(html.includes("ZAVRUNE Heavyweight Oversized Hoodie"));
  }
  const categories = await (await fetch(new URL("/api/categories", base))).json();
  assert.equal(categories.categories.length, 16);
  const products = await (await fetch(new URL("/api/admin/products", base))).json();
  assert.equal(products.products.length, 6);
  assert(products.products.every((p: { variants: unknown[] }) => p.variants.length > 0));
  assert.equal((await fetch(new URL("/api/settings/design", base))).status, 200);
  assert.equal((await fetch(new URL("/api/health", base))).status, 200);

  // Test-only authentication fixtures in the guarded local database, never seed data.
  const password = randomBytes(24).toString("hex");
  const [admin] = (await pool.query("insert into admins(email,password_hash,name,role) values ($1,$2,'Test admin','admin') returning id", [`test-${randomBytes(8).toString("hex")}@example.invalid`, await hash(password, 10)])).rows;
  const email = (await pool.query("select email from admins where id=$1", [admin.id])).rows[0].email;
  assert.equal((await post("/api/admin/login", { email, password: "wrong-password" })).status, 401);
  assert.equal(Number((await pool.query("select count(*) from admin_sessions")).rows[0].count), 0);
  const legacyToken = `zvr_sess_${randomBytes(8).toString("hex")}`;
  await pool.query("insert into admin_sessions(admin_id,token,expires_at) values ($1,$2,now()+interval '1 day')", [admin.id, legacyToken]);
  assert.equal((await fetch(seedUrl, { method: "POST", headers: { Cookie: `zavrune_admin_session=${legacyToken}` } })).status, 401);
  const login = await post("/api/admin/login", { email, password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  assert(cookie.startsWith("zavrune_admin_session=zvr_secure_"));
  assert.equal((await fetch(seedUrl, { method: "POST", headers: { Cookie: cookie } })).status, 200);
  assert.equal((await fetch(seedUrl, { method: "POST", headers: { Cookie: cookie, Origin: "https://example.invalid" } })).status, 403);
  console.log("PASS: production storefront routes, read-only GET seed, admin authentication, and origin checks");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Smoke test failed"); process.exitCode = 1; }).finally(() => pool.end());
