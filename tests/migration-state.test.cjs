const assert = require("node:assert/strict");
const test = require("node:test");
const { isMigrationStateCurrent, REQUIRED_MIGRATION_TIMESTAMP } = require("../src/db/migration-state.cjs");
const embedded = require("../src/db/embedded-migrations.json");

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

test("an empty database is reported as not current using cheap read-only catalog reads", async () => {
  const { statements, executor } = recordingExecutor(() => [{ migration_table: null }]);
  assert.equal(await isMigrationStateCurrent(executor), false);
  assert.equal(statements.length, 1, "a missing migration table needs exactly one read");
  assert.match(statements[0].text, READ_ONLY);
  assert.doesNotMatch(statements[0].text, FORBIDDEN);
  assert.ok(statements[0].query_timeout <= 3000, "state reads must be bounded");
});

test("an up-to-date database needs two bounded reads and no DDL, lock or seed", async () => {
  const { statements, executor } = recordingExecutor((text) =>
    /to_regclass/.test(text)
      ? [{ migration_table: "drizzle.__drizzle_migrations" }]
      : [{ created_at: String(REQUIRED_MIGRATION_TIMESTAMP + 1000) }]
  );
  assert.equal(await isMigrationStateCurrent(executor), true);
  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement.text, READ_ONLY);
    assert.doesNotMatch(statement.text, FORBIDDEN);
    assert.ok(statement.query_timeout <= 3000);
  }
});

test("pending migrations are detected from the committed journal", async () => {
  const { executor } = recordingExecutor((text) =>
    /to_regclass/.test(text)
      ? [{ migration_table: "drizzle.__drizzle_migrations" }]
      : [{ created_at: String(REQUIRED_MIGRATION_TIMESTAMP - 1) }]
  );
  assert.equal(await isMigrationStateCurrent(executor), false);
});

test("a newer additive schema from a newer instance still counts as ready (rolling deploys)", async () => {
  const { executor } = recordingExecutor((text) =>
    /to_regclass/.test(text)
      ? [{ migration_table: "drizzle.__drizzle_migrations" }]
      : [{ created_at: String(REQUIRED_MIGRATION_TIMESTAMP + 60000) }]
  );
  assert.equal(await isMigrationStateCurrent(executor), true);
});

test("the required state is the newest committed migration in the bundled journal", () => {
  const journal = JSON.parse(embedded.files["meta/_journal.json"]);
  const timestamps = journal.entries.map((entry) => entry.when);
  assert.ok(timestamps.length >= 1);
  assert.equal(REQUIRED_MIGRATION_TIMESTAMP, Math.max(...timestamps));
  for (const name of Object.keys(embedded.files)) {
    if (!name.endsWith(".sql")) continue;
    assert.doesNotMatch(embedded.files[name], /\b(drop\s+(table|schema|index|constraint|column)|truncate|delete\s+from)\b/i);
  }
});
