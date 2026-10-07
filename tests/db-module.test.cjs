const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const caseFile = path.join(__dirname, "db-module-case.ts");

/** Runs the real database module in a child process with a controlled environment. */
function runCase(mode, overrides = {}) {
  const env = { ...process.env, NODE_ENV: "production", ...overrides };
  for (const name of [
    "ZAVRUNE_DATABASE_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "PGHOST",
    "PGPORT",
    "PGUSER",
    "PGPASSWORD",
    "PGDATABASE",
    "PGSSLMODE",
  ]) {
    if (!(name in overrides)) delete env[name];
  }
  const result = spawnSync(process.execPath, ["--import", "tsx", caseFile, mode], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 90000,
  });
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const payload = lines.length > 0 && lines[lines.length - 1].startsWith("{") ? JSON.parse(lines[lines.length - 1]) : null;
  return { ...result, payload };
}

test("without any configured URL the pool is never constructed, so pg cannot fall back to localhost", () => {
  const { status, payload, stdout, stderr } = runCase("no-url");
  assert.equal(status, 0, stderr);
  assert.ok(payload, `expected JSON output, saw: ${stdout}`);
  assert.equal(payload.poolCreated, false);
  assert.match(payload.poolError, /ZAVRUNE_DB_ERROR/);
  assert.match(payload.poolError, /Refusing to use a localhost database fallback/);
  assert.match(payload.queryError, /ZAVRUNE_DB_ERROR/);
  assert.ok(payload.elapsedMs < 3000, `fail-closed must be immediate, took ${payload.elapsedMs}ms`);
  assert.doesNotMatch(`${stdout}${stderr}`, /ECONNREFUSED|127\.0\.0\.1:5432|::1:5432/);
});

test("the shared pool uses bounded serverless settings and no implicit host defaults", () => {
  const { status, payload, stderr } = runCase("options", { ZAVRUNE_DATABASE_URL: "postgresql://user:pass@db.example.invalid:5432/app" });
  assert.equal(status, 0, stderr);
  const options = payload.options;
  assert.equal(options.max, 3);
  assert.equal(options.min, 0);
  assert.ok(options.connectionTimeoutMillis <= 5000 && options.connectionTimeoutMillis > 0);
  assert.ok(options.idleTimeoutMillis <= 15000 && options.idleTimeoutMillis > 0);
  assert.ok(options.statement_timeout <= 30000 && options.statement_timeout > 0);
  assert.ok(options.query_timeout <= 30000 && options.query_timeout > 0);
  assert.ok(options.lock_timeout <= 5000 && options.lock_timeout > 0);
  assert.ok(options.maxLifetimeSeconds > 0);
  assert.equal(options.keepAlive, true);
  for (const implicit of ["host", "port", "user", "password", "database", "connectionString"]) {
    assert.ok(!(implicit in options), `pool options must not load pg defaults for ${implicit}`);
  }
});

test("importing the database module opens no connection on its own", () => {
  const { status, stdout, stderr } = runCase("import-only", { DATABASE_URL: "postgresql://user:pass@127.0.0.1:1/app" });
  assert.equal(status, 0, stderr);
  assert.match(stdout, /"imported":true/);
  assert.doesNotMatch(stderr, /ECONNREFUSED|connect ECONN|Cannot find module/);
});
