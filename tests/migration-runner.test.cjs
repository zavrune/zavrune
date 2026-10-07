const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  applyPendingMigrations,
  MIGRATION_POOL_OPTIONS,
  assertSqlSafe,
  resolveMigrationDatabaseUrl,
  deriveDirectNeonUrl,
  formatDatabaseError,
} = require("../src/db/migrate-runner.cjs");
const { REQUIRED_MIGRATION_TIMESTAMP } = require("../src/db/migration-state.cjs");

const textOf = (config) => (typeof config === "string" ? config : config.text);
const BLOCKING_LOCK = /(?:^|[^_a-zA-Z])pg_advisory_lock\s*\(/;
const TRY_LOCK = /pg_try_advisory_lock/;
// Mirrors the runner guard: dropping a NOT NULL constraint and FK ON DELETE behaviour are additive.
const DESTRUCTIVE_SQL = /\b(drop\s+(table|schema|index|constraint|column)|truncate\b|delete\s+from)\b/i;
const UPDATED = { migration_table: "drizzle.__drizzle_migrations" };
const CURRENT_ROWS = [{ created_at: String(REQUIRED_MIGRATION_TIMESTAMP + 1000) }];

test("migrations prefer explicit direct URLs without changing the query URL", () => {
  const environment = {
    DATABASE_URL: "postgresql://local/app",
    DATABASE_URL_UNPOOLED: "postgresql://direct/app",
    POSTGRES_URL_NON_POOLING: "postgresql://alternate/app",
  };
  assert.equal(resolveMigrationDatabaseUrl(environment).source, "DATABASE_URL_UNPOOLED");
  assert.equal(
    resolveMigrationDatabaseUrl({ DATABASE_URL: environment.DATABASE_URL, POSTGRES_URL_NON_POOLING: environment.POSTGRES_URL_NON_POOLING }).source,
    "POSTGRES_URL_NON_POOLING"
  );
  assert.equal(environment.DATABASE_URL, "postgresql://local/app");
  assert.throws(() => resolveMigrationDatabaseUrl({}), /ZAVRUNE_DB_ERROR/);
});

test("the central resolver order is used when no direct URL is configured", () => {
  assert.deepEqual(resolveMigrationDatabaseUrl({ POSTGRES_URL: "postgresql://p/db" }), {
    connectionString: "postgresql://p/db",
    source: "POSTGRES_URL",
  });
  assert.equal(resolveMigrationDatabaseUrl({ ZAVRUNE_DATABASE_URL: "postgresql://z/db" }).source, "ZAVRUNE_DATABASE_URL");
});

test("only Neon pooled hosts are converted to direct hosts", () => {
  assert.equal(new URL(deriveDirectNeonUrl("postgresql://user:pass@ep-test-pooler.us-east-2.aws.neon.tech/app")).hostname, "ep-test.us-east-2.aws.neon.tech");
  assert.equal(deriveDirectNeonUrl("postgresql://local/app"), undefined);
  assert.equal(deriveDirectNeonUrl("not a URL"), undefined);
});

test("database errors redact credentials in messages, detail and hints", () => {
  const message = formatDatabaseError({ code: "TEST", message: "postgresql://user:private@host/app", detail: "DATABASE_URL=postgresql://user:private@host/app", hint: "password=private" });
  assert(message.includes("TEST"));
  assert(!message.includes("private"));
});

test("migration pool options are bounded for serverless", () => {
  assert.equal(MIGRATION_POOL_OPTIONS.max, 1);
  assert.equal(MIGRATION_POOL_OPTIONS.min, 0);
  assert.ok(MIGRATION_POOL_OPTIONS.connectionTimeoutMillis <= 5000);
  assert.ok(MIGRATION_POOL_OPTIONS.statement_timeout <= 30000);
  assert.ok(MIGRATION_POOL_OPTIONS.query_timeout <= 30000);
  assert.ok(MIGRATION_POOL_OPTIONS.lock_timeout <= 5000);
});

test("an already up-to-date database only performs cheap state reads and never connects", async () => {
  const statements = [];
  let connects = 0;
  const pool = {
    query: async (config) => {
      const text = textOf(config);
      statements.push(text);
      if (/to_regclass/.test(text)) return { rows: [UPDATED], rowCount: 1 };
      if (/order by created_at/.test(text)) return { rows: CURRENT_ROWS, rowCount: 1 };
      throw new Error(`unexpected query in the fast path: ${text}`);
    },
    connect: async () => {
      connects += 1;
      throw new Error("a ready database must not open a dedicated migration connection");
    },
  };
  await applyPendingMigrations({ pool });
  assert.equal(connects, 0);
  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement, /^select\s/i);
    assert.doesNotMatch(statement, DESTRUCTIVE_SQL);
    assert.doesNotMatch(statement, BLOCKING_LOCK);
  }
});

test("lock contention uses pg_try_advisory_lock with bounded retries and never a blocking lock", async () => {
  const statements = [];
  let connects = 0;
  const pool = {
    query: async (config) => {
      const text = textOf(config);
      statements.push(text);
      if (/to_regclass/.test(text)) return { rows: [{ migration_table: null }], rowCount: 1 };
      throw new Error(`unexpected pool query: ${text}`);
    },
    connect: async () => {
      connects += 1;
      return {
        query: async (config) => {
          const text = textOf(config);
          statements.push(text);
          if (TRY_LOCK.test(text)) return { rows: [{ acquired: false }], rowCount: 1 };
          throw new Error(`unexpected client query: ${text}`);
        },
        release: () => {},
      };
    },
  };

  await assert.rejects(
    applyPendingMigrations({ pool, waitTimeoutMs: 1200, pollIntervalMs: 100 }),
    /Schema migration is busy/
  );

  assert.ok(connects >= 2, `expected bounded retries, saw ${connects} connection attempt(s)`);
  assert.ok(statements.some((text) => TRY_LOCK.test(text)));
  assert.ok(!statements.some((text) => BLOCKING_LOCK.test(text)), "no blocking advisory lock may be used");
  assert.equal(statements.filter((text) => TRY_LOCK.test(text)).length, connects, "each attempt uses exactly one non-blocking try-lock");
  assert.ok(!statements.some((text) => /\b(create|alter)\b/i.test(text)), "a contended run must not run DDL");
});

test("pending migrations apply exactly once and the state is double-checked after the lock", async () => {
  const statements = [];
  const releases = [];
  let checks = 0;
  let applied = 0;
  let migrated = false;
  const client = {
    query: async (config) => {
      const text = textOf(config);
      statements.push(text);
      if (TRY_LOCK.test(text)) return { rows: [{ acquired: true }], rowCount: 1 };
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ released: true }], rowCount: 1 };
      if (/^select "id"/.test(text) || /from "/.test(text)) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected client query: ${text}`);
    },
    release: (...args) => releases.push(args),
  };
  // Stale until the migration really runs: this forces the double check to be a no-op.
  const checkState = async () => {
    checks += 1;
    return migrated;
  };
  const pool = { connect: async () => client };

  await applyPendingMigrations({
    pool,
    checkState,
    executeMigrations: async (session, folder) => {
      applied += 1;
      assert.equal(session, client, "migrations must run on the session that owns the lock");
      assert.ok(fs.existsSync(path.join(folder, "meta", "_journal.json")), "the committed migration folder is used");
      migrated = true;
    },
  });
  // A second instance now sees the committed state and never migrates again.
  await applyPendingMigrations({ pool, checkState });

  assert.equal(applied, 1, "pending migrations must run exactly once");
  assert.equal(checks, 4, "initial read, double check after the lock, verification after migrating, then the reuse read");
  assert.ok(statements.some((text) => /from "page_sections"/.test(text)), "the schema contract is verified after migrating");
  assert.equal(releases.length, 1);
  assert.deepEqual(releases[0], [false], "a clean run returns the session to the pool");
  assert.ok(!statements.some((text) => BLOCKING_LOCK.test(text)));
});

test("a failed migration destroys the uncertain session instead of reusing it", async () => {
  const statements = [];
  const releases = [];
  const client = {
    query: async (config) => {
      const text = textOf(config);
      statements.push(text);
      if (TRY_LOCK.test(text)) return { rows: [{ acquired: true }], rowCount: 1 };
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ released: true }], rowCount: 1 };
      throw new Error(`unexpected client query: ${text}`);
    },
    release: (...args) => releases.push(args),
  };

  await assert.rejects(
    applyPendingMigrations({
      pool: { connect: async () => client },
      checkState: async () => false,
      executeMigrations: async () => {
        throw new Error("injected migration failure");
      },
    }),
    /injected migration failure/
  );

  assert.deepEqual(releases, [[true]], "failed sessions must be destroyed so the session lock cannot linger");
  assert.ok(!statements.some((text) => /pg_advisory_unlock/.test(text)), "an uncertain session must not be reused for the unlock");
});

test("no database URL fails closed without constructing a pool", async () => {
  let constructed = 0;
  class NeverPool {
    constructor() {
      constructed += 1;
      throw new Error("a pool must never be constructed without a configured URL");
    }
  }
  await assert.rejects(
    applyPendingMigrations({ Pool: NeverPool, waitTimeoutMs: 500 }),
    /ZAVRUNE_DB_ERROR/
  );
  assert.equal(constructed, 0, "pg must never be constructed so it cannot default to localhost");
});

test("the committed migration SQL is additive and refuses destructive statements", () => {
  const drizzleDir = path.resolve(__dirname, "../drizzle");
  const files = fs.readdirSync(drizzleDir).filter((name) => name.endsWith(".sql"));
  assert.ok(files.length >= 2, "committed migrations must exist");
  for (const name of files) {
    const sqlText = fs.readFileSync(path.join(drizzleDir, name), "utf8");
    assert.doesNotThrow(() => assertSqlSafe(sqlText, name), `${name} must stay additive`);
    const withoutComments = sqlText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
    assert.doesNotMatch(withoutComments, DESTRUCTIVE_SQL, `${name} must not remove tables, columns or rows`);
    // "drop not null" only relaxes a constraint; it is explicitly allowed.
    assert.ok(withoutComments.length > 0);
  }
  assert.throws(() => assertSqlSafe('drop table "products";', "injected"), /Refusing to apply/);
  assert.throws(() => assertSqlSafe("truncate table products;", "injected"), /Refusing to apply/);
  assert.throws(() => assertSqlSafe("delete from products;", "injected"), /Refusing to apply/);
  assert.doesNotThrow(() => assertSqlSafe("-- drop table legacy_notes\ncreate table if not exists notes(id uuid);", "comment"));
});

test("the build applies committed migrations before compiling the app", () => {
  const scripts = require("../package.json").scripts;
  assert.match(scripts.build, /migrate-runner\.cjs --if-configured && next build/);
  assert.equal(scripts["db:migrate"], "node src/db/migrate-runner.cjs");
  assert.ok(scripts.test.includes("tests/migration-runner.test.cjs"));
});
