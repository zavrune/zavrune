// Statically bundled journal: readiness works in serverless output without fs/DDL.
const embedded = require("./embedded-migrations.json");
const journal = JSON.parse(embedded.files["meta/_journal.json"]);

// An exact allowlist, not a prefix/range: every other (including future)
// migration remains required. The deploy/CLI runner still applies ALL entries.
const OPTIONAL_ADDITIVE_MIGRATIONS = Object.freeze(["0002_homepage_section_names"]);
const optionalMigrations = new Set(OPTIONAL_ADDITIVE_MIGRATIONS);
const LATEST_MIGRATION_TIMESTAMP = Math.max(...journal.entries.map((entry) => entry.when));
const REQUIRED_MIGRATION_TIMESTAMP = Math.max(
  ...journal.entries.filter((entry) => !optionalMigrations.has(entry.tag)).map((entry) => entry.when)
);

/** Two bounded, read-only queries. No DDL, locks, or automatic migrations. */
async function getMigrationReadiness(executor, queryTimeoutMs = 3000) {
  const exists = await executor.query({
    text: "select to_regclass('drizzle.__drizzle_migrations') as migration_table",
    query_timeout: queryTimeoutMs,
  });
  const hasLedger = Boolean(exists.rows[0]?.migration_table);
  let appliedThrough = 0;
  if (hasLedger) {
    const result = await executor.query({
      text: "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
      query_timeout: queryTimeoutMs,
    });
    const timestamp = Number(result.rows[0]?.created_at ?? 0);
    if (Number.isFinite(timestamp)) appliedThrough = timestamp;
  }

  // Drizzle applies the journal in timestamp order. Older instances tolerate a
  // newer additive schema during rolling deploys, as in the strict check below.
  const pendingMigrations = journal.entries
    .filter((entry) => entry.when > appliedThrough)
    .map((entry) => entry.tag);
  const ready = hasLedger && pendingMigrations.every((tag) => optionalMigrations.has(tag));
  return {
    ready,
    current: hasLedger && pendingMigrations.length === 0,
    degraded: ready && pendingMigrations.length > 0,
    pendingMigrations,
  };
}

/** Strict deploy/CLI check: optional at runtime does NOT mean skip its DDL. */
async function isMigrationStateCurrent(executor, queryTimeoutMs = 3000) {
  return (await getMigrationReadiness(executor, queryTimeoutMs)).current;
}

module.exports = {
  getMigrationReadiness,
  isMigrationStateCurrent,
  OPTIONAL_ADDITIVE_MIGRATIONS,
  LATEST_MIGRATION_TIMESTAMP,
  REQUIRED_MIGRATION_TIMESTAMP,
};
