/**
 * Fresh-store admin checks against an isolated local verification database.
 * Requires DATABASE_URL (zavrune_test_*) and TEST_BASE_URL pointing at the app.
 * The database must be migrated but NOT seeded: proves /mohamedbdr and
 * /api/admin/login work on a brand-new deployment without any bootstrap writes.
 */
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");

const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
const base = new URL(process.env.TEST_BASE_URL || "http://127.0.0.1:3117");
assert(["localhost", "127.0.0.1"].includes(database.hostname), "use a disposable local database");
assert(database.pathname.startsWith("/zavrune_test_"), "use a zavrune_test_* database");
assert(["localhost", "127.0.0.1"].includes(base.hostname));

const email = process.env.ZAVRUNE_ADMIN_EMAIL;
const password = process.env.ZAVRUNE_ADMIN_PASSWORD;
assert(email && password, "the app must be started with admin provisioning variables");

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

/** Browser-like same-origin POST: state-changing routes require origin data. */
async function login(body) {
  return fetch(new URL("/api/admin/login", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base.origin, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify(body),
  });
}

async function main() {
  // 1. The very first request to a fresh deployment must already work.
  const loginPage = await fetch(new URL("/mohamedbdr/login", base));
  assert.equal(loginPage.status, 200, "the admin login page must render on a fresh database");
  assert((await loginPage.text()).includes("ZAVRUNE ADMIN"));

  // 2. Anonymous admin access fails closed without touching storefront data.
  const anonymous = await fetch(new URL("/mohamedbdr", base), { redirect: "manual" });
  assert([302, 303, 307, 308].includes(anonymous.status), `expected a redirect to the login page, saw ${anonymous.status}`);
  assert((anonymous.headers.get("location") || "").includes("/mohamedbdr/login"));
  assert.equal((await fetch(new URL("/api/admin/products", base))).status, 401);

  // 3. A bad password is rejected and creates no session.
  assert.equal((await login({ email, password: `${password}x` })).status, 401);
  assert.equal(Number((await pool.query("select count(*) from admin_sessions")).rows[0].count), 0);

  // 4. The first admin is provisioned from the environment on first use.
  const response = await login({ email, password });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie && cookie.startsWith("zavrune_admin_session=zvr_secure_"));
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
  assert.match(response.headers.get("set-cookie") || "", /SameSite=Strict/i);

  const admins = await pool.query("select email, password_hash from admins");
  assert.equal(admins.rowCount, 1, "exactly one admin may be provisioned");
  assert.equal(admins.rows[0].email, email.toLowerCase());
  assert.match(admins.rows[0].password_hash, /^\$2[aby]\$/, "the password must be stored as a bcrypt hash");
  assert(!admins.rows[0].password_hash.includes(password), "the plaintext password must never be stored");

  // 5. The authenticated admin area and its APIs work.
  const dashboard = await fetch(new URL("/mohamedbdr", base), { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200, "the admin dashboard must render for a signed-in admin");
  const products = await fetch(new URL("/api/admin/products", base), { headers: { Cookie: cookie } });
  assert.equal(products.status, 200);
  assert.equal((await products.json()).products.length, 0, "a fresh store has no products until it is seeded");

  // 6. Cross-site state-changing admin requests stay blocked.
  const blocked = await fetch(new URL("/api/admin/products", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.invalid" },
    body: JSON.stringify({ nameEn: "Injected" }),
  });
  assert.equal(blocked.status, 403, "cross-origin writes must be rejected");

  // 7. The storefront seeds itself on first view and serves real data.
  const homepage = await fetch(new URL("/", base));
  assert.equal(homepage.status, 200);
  assert((await homepage.text()).includes("NEW DROP ARRIVALS"));
  const categories = await (await fetch(new URL("/api/categories", base))).json();
  assert.equal(categories.categories.length, 16);

  console.log("PASS: fresh store admin login, provisioning, guard rails and storefront bootstrap");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin fresh store checks failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
