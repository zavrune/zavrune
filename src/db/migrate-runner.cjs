/**
 * Applies the committed, additive Drizzle SQL migrations.
 *
 * Application queries always continue to use DATABASE_URL. Migrations prefer a
 * direct Neon endpoint because schema work is not safe through every pooler.
 * The migration SQL is deliberately limited to additive operations so a deploy
 * cannot remove production data.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { Pool } = require("pg");

try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
} catch {
  // Vercel injects environment variables directly. This is only a local convenience.
}

const PAGE_SECTION_COLUMNS = [
  "id",
  "page_id",
  "section_type",
  "display_order",
  "is_visible",
  "desktop_visible",
  "mobile_visible",
  "version",
  "config",
  "created_at",
  "updated_at",
];

const DESTRUCTIVE_SQL =
  /\b(drop\s+(table|schema|index|constraint|column)|truncate\b|delete\s+from)\b/i;

const { formatDatabaseError, redact } = require("./errors.cjs");
const { resolveDatabaseUrl, hasDatabaseUrl, environmentValue } = require("../lib/database-url.cjs");
// Two small indexed/catalog reads; no locks, DDL, seeds or table probes.
const { isMigrationStateCurrent } = require("./migration-state.cjs");

/**
 * Converts only an unambiguous Neon pooled endpoint such as
 * ep-example-pooler.us-east-2.aws.neon.tech to its direct counterpart.
 * Invalid URLs and non-Neon hosts are intentionally left unchanged.
 */
function deriveDirectNeonUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return undefined;
    }

    const match = url.hostname.match(
      /^(ep-[a-z0-9-]+)-pooler((?:\.[a-z0-9-]+)*\.neon\.tech)$/i
    );
    if (!match) return undefined;

    url.hostname = `${match[1]}${match[2]}`;
    return url.toString();
  } catch {
    return undefined;
  }
}

function resolveMigrationDatabaseUrl(environment = process.env) {
  const unpooled = environmentValue(environment, "DATABASE_URL_UNPOOLED");
  if (unpooled) {
    return { connectionString: unpooled, source: "DATABASE_URL_UNPOOLED" };
  }

  const nonPooling = environmentValue(environment, "POSTGRES_URL_NON_POOLING");
  if (nonPooling) {
    return { connectionString: nonPooling, source: "POSTGRES_URL_NON_POOLING" };
  }

  const application = resolveDatabaseUrl(environment);
  const databaseUrl = application.connectionString;

  const directNeonUrl = deriveDirectNeonUrl(databaseUrl);
  if (directNeonUrl) {
    return {
      connectionString: directNeonUrl,
      source: `${application.source} (derived Neon direct host)`,
    };
  }

  return { connectionString: databaseUrl, source: application.source };
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function assertSqlSafe(sqlText, label) {
  if (DESTRUCTIVE_SQL.test(stripSqlComments(sqlText))) {
    throw new Error(
      `Refusing to apply ${label} because it would remove tables, columns, or rows.`
    );
  }
}

function assertPageSectionsContract(sqlText) {
  const block = sqlText.match(/CREATE TABLE IF NOT EXISTS "page_sections" \([\s\S]*?\);/);
  if (!block) {
    throw new Error("Migration SQL does not create page_sections.");
  }
  for (const column of PAGE_SECTION_COLUMNS) {
    if (!block[0].includes(`"${column}"`)) {
      throw new Error(
        `page_sections migration is missing "${column}", which the homepage query selects.`
      );
    }
  }
}

function loadEmbedded() {
  return require("./embedded-migrations.json");
}

function diskMigrationsDir() {
  const candidates = [
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(__dirname, "../../drizzle"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta", "_journal.json"))) return dir;
  }
  return null;
}

function assertEmbedMatchesDisk(dir, embedded) {
  const expected = new Set(Object.keys(embedded.files));
  for (const rel of expected) {
    const diskPath = path.join(dir, rel);
    if (!fs.existsSync(diskPath)) {
      throw new Error(`Embedded migration ${rel} is missing from the drizzle folder.`);
    }
    const disk = fs.readFileSync(diskPath, "utf8");
    if (disk !== embedded.files[rel]) {
      throw new Error(
        `Migration file ${rel} does not match src/db/embedded-migrations.json. Run: node scripts/sync-migration-embed.cjs`
      );
    }
  }
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".sql") && !expected.has(name)) {
      throw new Error(
        `SQL migration ${name} is not embedded. Run: node scripts/sync-migration-embed.cjs`
      );
    }
  }
}

function materializeEmbedded(embedded) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zavrune-drizzle-migrations-"));
  for (const [rel, contents] of Object.entries(embedded.files)) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, contents);
  }
  return dir;
}

function prepareMigrationsFolder() {
  const embedded = loadEmbedded();
  const disk = diskMigrationsDir();
  if (disk) {
    assertEmbedMatchesDisk(disk, embedded);
    return disk;
  }
  return materializeEmbedded(embedded);
}

function readMigrationSql(folder) {
  const names = fs.readdirSync(folder).filter((name) => name.endsWith(".sql")).sort();
  if (names.length === 0) {
    throw new Error("No SQL migrations found.");
  }
  const parts = names.map((name) => {
    const sqlText = fs.readFileSync(path.join(folder, name), "utf8");
    assertSqlSafe(sqlText, name);
    return sqlText;
  });
  const combined = parts.join("\n");
  assertPageSectionsContract(combined);
  const tables = tableColumns(combined);
  if (!tables.page_sections) {
    throw new Error("page_sections is not created by the committed migrations.");
  }
  return { sqlText: combined, tables };
}

function tableColumns(sqlText) {
  const tables = {};
  const re = /CREATE TABLE IF NOT EXISTS "([a-z0-9_]+)" \(([\s\S]*?)\);/g;
  let match;
  while ((match = re.exec(sqlText))) {
    const columns = [];
    for (const line of match[2].split("\n")) {
      const column = line.trim().match(/^"([a-z0-9_]+)"\s+/);
      if (column) columns.push(column[1]);
    }
    if (columns.length === 0) {
      throw new Error(`Could not parse columns for ${match[1]}.`);
    }
    tables[match[1]] = columns;
  }
  return tables;
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unexpected identifier in migration: ${name}`);
  }
  return `"${name}"`;
}

async function assertSchema(pool, tables) {
  for (const [table, columns] of Object.entries(tables)) {
    const projection = columns.map(quoteIdent).join(", ");
    await pool.query(`select ${projection} from ${quoteIdent(table)} limit 0`);
  }

  // This is the same shape as the first homepage query that previously 500ed.
  await pool.query(
    `select "id", "page_id", "section_type", "display_order", "is_visible",
            "desktop_visible", "mobile_visible", "version", "config",
            "created_at", "updated_at"
     from "page_sections"
     where "page_sections"."version" = $1
     order by "page_sections"."display_order" asc
     limit 0`,
    ["published"]
  );
}

const MIGRATION_POOL_OPTIONS = Object.freeze({
  max: 1,
  min: 0,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  statement_timeout: 25000,
  query_timeout: 30000,
  lock_timeout: 5000,
  keepAlive: true,
  maxLifetimeSeconds: 120,
});
const LOCK_KEY = "zavrune-schema-initialization";

/** Applies the committed migrations on the connection that holds the lock. */
async function applyMigrationsOnClient(client, folder) {
  await migrate(drizzle(client), { migrationsFolder: folder });
}

/** Injectable pool/executor/clock make concurrency and timeout paths testable. */
async function applyPendingMigrations(options = {}) {
  const ownsPool = !options.pool;
  const pool = options.pool ?? new (options.Pool ?? Pool)({
    ...MIGRATION_POOL_OPTIONS,
    connectionString: resolveMigrationDatabaseUrl(options.environment).connectionString,
  });
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + (options.waitTimeoutMs ?? 15000);
  const checkState = options.checkState ?? isMigrationStateCurrent;
  const log = options.log ?? ((message) => console.log(message));
  const execute = options.executeMigrations ?? applyMigrationsOnClient;
  let folder;
  let tables;
  try {
    if (await checkState(pool)) {
      // Deployment/CLI runs stay visible; this path is never used by requests.
      log("[db] Database schema already up to date. No migrations, locks or DDL were needed.");
      return;
    }
    folder = prepareMigrationsFolder();
    ({ tables } = readMigrationSql(folder));
    while (now() < deadline) {
      let client;
      let locked = false;
      let destroy = false;
      try {
        client = await pool.connect();
        const result = await client.query("select pg_try_advisory_lock(hashtext($1)) as acquired", [LOCK_KEY]);
        locked = result.rows[0]?.acquired === true;
        if (locked) {
          // Another deployment may have finished between the first read and lock.
          if (await checkState(client)) return;
          await execute(client, folder);
          await assertSchema(client, tables);
          if (!(await checkState(client))) {
            throw new Error("Migrations completed but the committed migration state is still missing.");
          }
          log("[db] Pending additive migrations applied and schema verified.");
          return;
        }
      } catch (error) {
        // query_timeout does not cancel server work. Never reuse an uncertain
        // session (including a try-lock whose result was lost).
        destroy = true;
        throw error;
      } finally {
        if (client) {
          if (locked && !destroy) {
            try {
              const result = await client.query("select pg_advisory_unlock(hashtext($1)) as released", [LOCK_KEY]);
              if (result.rows[0]?.released !== true) {
                destroy = true;
                throw new Error("Migration advisory lock could not be released safely.");
              }
            } catch (error) {
              destroy = true;
              client.release(true);
              client = undefined;
              throw error;
            }
          }
          client?.release(destroy);
        }
      }
      // Contention never occupies a connection while sleeping. Readiness can
      // finish without taking the lock as soon as the other deployment commits.
      if (await checkState(pool)) return;
      const remaining = deadline - now();
      if (remaining > 0) await sleep(Math.min(options.pollIntervalMs ?? 250, remaining));
    }
    throw new Error("Schema migration is busy. Bounded retry deadline exceeded; retry npm run db:migrate.");
  } finally {
    if (ownsPool) await pool.end();
    // Serverless fallback materialization is temporary, never repository data.
    if (folder && path.dirname(folder) === os.tmpdir()) fs.rmSync(folder, { recursive: true, force: true });
  }
}

async function cli() {
  const ifConfigured = process.argv.includes("--if-configured");

  try {
    const folder = prepareMigrationsFolder();
    readMigrationSql(folder);
  } catch (error) {
    console.error(`ZAVRUNE_DB_ERROR: Migration files are invalid: ${formatDatabaseError(error)}`);
    process.exit(1);
  }

  if (!hasDatabaseUrl()) {
    if (ifConfigured) {
      console.warn(
        "[db] No application database URL configured; build skipped migrations. Database-backed routes fail closed until configured and npm run db:migrate has completed."
      );
      return;
    }
    console.error(
      "ZAVRUNE_DB_ERROR: Configure ZAVRUNE_DATABASE_URL, DATABASE_URL or POSTGRES_URL outside source control before running migrations."
    );
    process.exit(1);
  }

  try {
    await applyPendingMigrations();
  } catch (error) {
    console.error(`ZAVRUNE_DB_ERROR: Migration failed: ${formatDatabaseError(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  cli().catch((error) => {
    console.error(`ZAVRUNE_DB_ERROR: Migration failed: ${formatDatabaseError(error)}`);
    process.exit(1);
  });
}

module.exports = {
  applyPendingMigrations,
  applyMigrationsOnClient,
  MIGRATION_POOL_OPTIONS,
  assertSqlSafe,
  deriveDirectNeonUrl,
  formatDatabaseError,
  redact,
  resolveMigrationDatabaseUrl,
};
