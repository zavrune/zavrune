// Statically bundled journal: readiness works in serverless output without fs/DDL.
const embedded = require("./embedded-migrations.json");
const journal = JSON.parse(embedded.files["meta/_journal.json"]);
const REQUIRED_MIGRATION_TIMESTAMP = Math.max(...journal.entries.map((entry) => entry.when));

async function isMigrationStateCurrent(executor, queryTimeoutMs = 3000) {
  const exists = await executor.query({
    text: "select to_regclass('drizzle.__drizzle_migrations') as migration_table",
    query_timeout: queryTimeoutMs,
  });
  if (!exists.rows[0]?.migration_table) return false;
  const result = await executor.query({
    text: "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    query_timeout: queryTimeoutMs,
  });
  // Older instances must tolerate a newer additive schema during rolling deploys.
  return Number(result.rows[0]?.created_at ?? 0) >= REQUIRED_MIGRATION_TIMESTAMP;
}
module.exports = { isMigrationStateCurrent, REQUIRED_MIGRATION_TIMESTAMP };
