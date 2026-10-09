const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  getMigrationReadiness,
  isMigrationStateCurrent,
  OPTIONAL_ADDITIVE_MIGRATIONS,
  LATEST_MIGRATION_TIMESTAMP,
  REQUIRED_MIGRATION_TIMESTAMP,
} = require("../src/db/migration-state.cjs");
const embedded = require("../src/db/embedded-migrations.json");
const journal = JSON.parse(embedded.files["meta/_journal.json"]);

const READ_ONLY = /^select\s/i;
const FORBIDDEN = /\b(insert|update|delete|create|alter|drop|truncate|lock)\b/i;

function recordingExecutor(rowsFor) {
  const statements = [];
  return {
    statements,
    executor: {
      query: async (config) => {
        const text = typeof config === "string" ? config : config.text;
        statements.push(typeof config === "string" ? { text } : config);
        return { rows: rowsFor(text), rowCount: 1 };
      },
    },
  };
}

function stateAt(timestamp) {
  return recordingExecutor((text) =>
    /to_regclass/.test(text)
      ? [{ migration_table: "drizzle.__drizzle_migrations" }]
      : [{ created_at: String(timestamp) }]
  );
}

test("an empty database fails closed using one cheap read-only catalog read", async () => {
  const { statements, executor } = recordingExecutor(() => [{ migration_table: null }]);
  const state = await getMigrationReadiness(executor);
  assert.equal(state.ready, false);
  assert.equal(state.current, false);
  assert.equal(state.degraded, false);
  assert.deepEqual(state.pendingMigrations, journal.entries.map((entry) => entry.tag));
  assert.equal(statements.length, 1, "a missing migration table needs exactly one read");
  assert.match(statements[0].text, READ_ONLY);
  assert.doesNotMatch(statements[0].text, FORBIDDEN);
  assert.ok(statements[0].query_timeout <= 3000, "state reads must be bounded");
});

test("an up-to-date database needs two bounded reads and no DDL, lock or seed", async () => {
  const { statements, executor } = stateAt(LATEST_MIGRATION_TIMESTAMP);
  assert.deepEqual(await getMigrationReadiness(executor, 1500), {
    ready: true, current: true, degraded: false, pendingMigrations: [],
  });
  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement.text, READ_ONLY);
    assert.doesNotMatch(statement.text, FORBIDDEN);
    assert.equal(statement.query_timeout, 1500);
  }
});

test("ONLY pending 0002 is optional for requests, but still pending for the migration runner", async () => {
  const { executor, statements } = stateAt(REQUIRED_MIGRATION_TIMESTAMP);
  assert.deepEqual(await getMigrationReadiness(executor), {
    ready: true,
    current: false,
    degraded: true,
    pendingMigrations: ["0002_homepage_section_names"],
  });
  assert.equal(await isMigrationStateCurrent(executor), false, "the deploy runner must still apply 0002");
  assert.equal(statements.length, 4, "two bounded reads per check, without polling optional DDL");
  for (const statement of statements) assert.doesNotMatch(statement.text, FORBIDDEN);
});

test("all older required migrations fail closed, including an empty migration ledger", async () => {
  for (const timestamp of [0, journal.entries[0].when - 1, journal.entries[0].when, REQUIRED_MIGRATION_TIMESTAMP - 1]) {
    const { executor } = stateAt(timestamp);
    const state = await getMigrationReadiness(executor);
    assert.equal(state.ready, false, `required migrations must not be optional at ${timestamp}`);
    assert.equal(state.current, false);
    assert.equal(state.degraded, false);
    assert.ok(state.pendingMigrations.some((tag) => tag !== "0002_homepage_section_names"));
  }
});

test("a newer additive schema still counts as ready during rolling deploys", async () => {
  const { executor } = stateAt(LATEST_MIGRATION_TIMESTAMP + 60000);
  assert.equal(await isMigrationStateCurrent(executor), true);
  assert.deepEqual(await getMigrationReadiness(executor), {
    ready: true, current: true, degraded: false, pendingMigrations: [],
  });
});

test("health-style probes observe optional migration completion without a process restart", async () => {
  let appliedThrough = REQUIRED_MIGRATION_TIMESTAMP;
  const { executor } = recordingExecutor((text) =>
    /to_regclass/.test(text)
      ? [{ migration_table: "drizzle.__drizzle_migrations" }]
      : [{ created_at: appliedThrough }]
  );
  assert.equal((await getMigrationReadiness(executor)).degraded, true);
  appliedThrough = LATEST_MIGRATION_TIMESTAMP;
  assert.deepEqual(await getMigrationReadiness(executor), {
    ready: true, current: true, degraded: false, pendingMigrations: [],
  });
});

test("future migrations and similarly named tags are required by default", async () => {
  // Load the real classifier with a future committed journal, not a different
  // allowlist. An additive-looking name must never silently become optional.
  for (const tag of ["0003_additive_field", "0002_homepage_section_names_extra"]) {
    const futureJournal = {
      ...journal,
      entries: [...journal.entries, { tag, when: LATEST_MIGRATION_TIMESTAMP + 1000 }],
    };
    const context = {
      module: { exports: {} },
      require: () => ({ files: { "meta/_journal.json": JSON.stringify(futureJournal) } }),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/db/migration-state.cjs"), "utf8"), context);
    const { executor } = stateAt(LATEST_MIGRATION_TIMESTAMP);
    const state = await context.module.exports.getMigrationReadiness(executor);
    assert.equal(state.ready, false);
    assert.equal(state.current, false);
    assert.equal(state.pendingMigrations[0], tag);
  }
});

test("the exact allowlist and required/latest timestamps match the committed additive journal", () => {
  assert.deepEqual(OPTIONAL_ADDITIVE_MIGRATIONS, ["0002_homepage_section_names"]);
  assert.equal(LATEST_MIGRATION_TIMESTAMP, Math.max(...journal.entries.map((entry) => entry.when)));
  assert.equal(REQUIRED_MIGRATION_TIMESTAMP, Math.max(...journal.entries.filter((entry) => entry.tag !== "0002_homepage_section_names").map((entry) => entry.when)));
  for (const name of Object.keys(embedded.files)) {
    if (!name.endsWith(".sql")) continue;
    assert.doesNotMatch(embedded.files[name], /\b(drop\s+(table|schema|index|constraint|column)|truncate|delete\s+from)\b/i);
  }
});
