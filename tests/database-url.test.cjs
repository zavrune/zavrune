const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveDatabaseUrl, hasDatabaseUrl } = require("../src/lib/database-url.cjs");

test("resolution order is ZAVRUNE_DATABASE_URL -> DATABASE_URL -> POSTGRES_URL", () => {
  const all = {
    ZAVRUNE_DATABASE_URL: "postgresql://primary/db",
    DATABASE_URL: "postgresql://secondary/db",
    POSTGRES_URL: "postgresql://tertiary/db",
  };
  assert.deepEqual(resolveDatabaseUrl(all), { connectionString: "postgresql://primary/db", source: "ZAVRUNE_DATABASE_URL" });
  assert.deepEqual(resolveDatabaseUrl({ DATABASE_URL: all.DATABASE_URL, POSTGRES_URL: all.POSTGRES_URL }), {
    connectionString: "postgresql://secondary/db",
    source: "DATABASE_URL",
  });
  assert.equal(resolveDatabaseUrl({ POSTGRES_URL: all.POSTGRES_URL }).source, "POSTGRES_URL");
  assert.equal(all.ZAVRUNE_DATABASE_URL, "postgresql://primary/db", "resolution must not mutate the environment");
});

test("blank values count as unset and never fall back to a localhost database", () => {
  assert.equal(hasDatabaseUrl({}), false);
  assert.equal(hasDatabaseUrl({ DATABASE_URL: "   ", POSTGRES_URL: "\t" }), false);
  assert.equal(hasDatabaseUrl({ ZAVRUNE_DATABASE_URL: "postgresql://x/db" }), true);
  assert.throws(() => resolveDatabaseUrl({}), /ZAVRUNE_DB_ERROR/);
  assert.throws(() => resolveDatabaseUrl({ DATABASE_URL: "  " }), /Refusing to use a localhost database fallback/);
});

test("explicitly configured local URLs are still honoured (tests and local dev)", () => {
  const resolved = resolveDatabaseUrl({ DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55433/zavrune_test_app" });
  assert.equal(resolved.source, "DATABASE_URL");
  assert.equal(new URL(resolved.connectionString).hostname, "127.0.0.1");
});
