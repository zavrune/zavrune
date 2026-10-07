const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const caseFile = path.join(__dirname, "instrumentation-case.ts");

function runHook(env = {}) {
  const childEnv = { ...process.env, NODE_ENV: "production", ...env };
  for (const name of ["ZAVRUNE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
    if (!(name in env)) delete childEnv[name];
  }
  const started = Date.now();
  const result = spawnSync(process.execPath, ["--import", "tsx", caseFile], { cwd: root, env: childEnv, encoding: "utf8", timeout: 90000 });
  return { ...result, elapsedMs: Date.now() - started };
}

function source(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("the instrumentation hook never imports the migration runner", () => {
  const instrumentation = source("src/instrumentation.ts");
  assert.doesNotMatch(instrumentation, /applyPendingMigrations|migrate-runner|pg_advisory/);
  assert.ok(
    instrumentation.indexOf("ZAVRUNE_DB_WARMUP") < instrumentation.indexOf('import("./db")'),
    "the bounded warmup must be gated before the database module is imported"
  );
  assert.match(instrumentation, /catch\s*\{/, "every failure path must be swallowed");
  assert.match(instrumentation, /Promise\.race/, "the warmup must have its own deadline");
});

test("request readiness reads/polls migration state and owns no DDL", () => {
  const initialize = source("src/db/initialize.ts");
  assert.doesNotMatch(initialize, /applyPendingMigrations|migrate-runner|pg_advisory_lock/);
  assert.match(initialize, /isMigrationStateCurrent/);
  assert.match(initialize, /await import\(|from "\.\/index"/);
});

test("no source file uses a blocking advisory lock", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".cjs")) files.push(full);
    }
  };
  walk(path.join(root, "src"));
  assert.ok(files.length > 20, "expected to scan the whole source tree");
  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(contents, /pg_advisory_(xact_)?lock\s*\(/, `${file} uses a blocking advisory lock`);
    assert.doesNotMatch(contents, /pg_try_advisory_(xact_)?lock\s*\([^)]*\)\s*;\s*$[\s\S]{0,80}?pg_try_advisory/m);
  }
});

test("register() resolves when warmup is disabled, so it cannot crash the app", () => {
  const result = runHook({ DATABASE_URL: "postgresql://user:pass@127.0.0.1:1/app" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /REGISTER_OK/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Optional warmup/);
  assert.ok(result.elapsedMs < 10000);
});

test("an unreachable database during warmup is logged and swallowed", () => {
  const result = runHook({ ZAVRUNE_DB_WARMUP: "1", DATABASE_URL: "postgresql://user:pass@127.0.0.1:1/app" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /REGISTER_OK/);
  assert.match(`${result.stdout}${result.stderr}`, /Optional warmup did not complete/);
});

test("a hanging warmup is bounded and still resolves", () => {
  const result = runHook({ ZAVRUNE_DB_WARMUP: "1", DATABASE_URL: "postgresql://user:pass@192.0.2.1:5432/app" });
  assert.equal(result.status, 0, result.stderr);
  const elapsed = Number(result.stdout.match(/REGISTER_OK (\d+)/)?.[1] ?? "999999");
  assert.ok(elapsed < 6000, `warmup must not block startup: ${elapsed}ms`);
});

test("warmup with no configured URL fails closed without touching a database", () => {
  const result = runHook({ ZAVRUNE_DB_WARMUP: "1" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /REGISTER_OK/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /ECONNREFUSED|127\.0\.0\.1:5432/);
});
