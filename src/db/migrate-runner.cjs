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

function stringifyError(value) {
  if (value instanceof Error) return value.message;
  return String(value);
}

function redact(value) {
  return stringifyError(value)
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "postgresql://***")
    .replace(
      /\b(database_url(?:_unpooled)?|postgres_url_non_pooling|connection_string)\s*=\s*[^\s'"`]+/gi,
      "$1=***"
    )
    .replace(
      /\b(password|pass|pwd|token|secret)\s*([=:])\s*[^\s&,;'"`]+/gi,
      "$1$2***"
    );
}

function formatDatabaseError(error) {
  if (!error || typeof error !== "object") {
    return redact(error || "Unknown database error");
  }

  const databaseError = error;
  const parts = [];
  if (typeof databaseError.code === "string" && databaseError.code) {
    parts.push(`code ${databaseError.code}`);
  }
  for (const key of ["message", "detail", "hint"]) {
    if (typeof databaseError[key] === "string" && databaseError[key]) {
      parts.push(databaseError[key]);
    }
  }

  return redact(parts.length > 0 ? parts.join(": ") : "Unknown database error");
}

function environmentValue(environment, name) {
  const value = environment[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

  const databaseUrl = environmentValue(environment, "DATABASE_URL");
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for application queries and schema initialization. Refusing to use a local fallback."
    );
  }

  const directNeonUrl = deriveDirectNeonUrl(databaseUrl);
  if (directNeonUrl) {
    return {
      connectionString: directNeonUrl,
      source: "DATABASE_URL (derived Neon direct host)",
    };
  }

  return { connectionString: databaseUrl, source: "DATABASE_URL" };
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

async function migrationCount(pool) {
  const exists = await pool.query(
    `select 1 from information_schema.tables
     where table_schema = 'drizzle' and table_name = '__drizzle_migrations'`
  );
  if (exists.rowCount === 0) return 0;
  const result = await pool.query(
    "select count(*)::int as count from drizzle.__drizzle_migrations"
  );
  return result.rows[0].count;
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

async function applyPendingMigrations() {
  const migrationDatabase = resolveMigrationDatabaseUrl();
  const folder = prepareMigrationsFolder();
  const { tables } = readMigrationSql(folder);
  const pool = new Pool({
    connectionString: migrationDatabase.connectionString,
    max: 1,
    connectionTimeoutMillis: 20000,
    query_timeout: 60000,
  });

  let client;
  try {
    client = await pool.connect();
    // Multiple Vercel cold starts can reach this code at once. Hold the lock on
    // the same direct connection used by Drizzle so only one applies migrations.
    await client.query("select pg_advisory_lock(hashtext($1))", [
      "zavrune-schema-initialization",
    ]);

    console.log(`[db] Initializing schema with ${migrationDatabase.source}.`);
    const before = await migrationCount(client);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: folder });
    await assertSchema(client, tables);
    const after = await migrationCount(client);
    if (after > before) {
      console.log(
        `[db] Applied ${after - before} migration(s). Required tables, including page_sections, are present.`
      );
    } else {
      console.log("[db] Database schema already up to date. page_sections is present.");
    }
  } finally {
    // Ending this one-connection pool releases the session-scoped advisory lock.
    client?.release();
    await pool.end();
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

  if (!environmentValue(process.env, "DATABASE_URL")) {
    if (ifConfigured) {
      console.warn(
        "[db] DATABASE_URL is not set, so migrations were not applied during build. Runtime initialization will require DATABASE_URL before serving database-backed pages."
      );
      return;
    }
    console.error(
      "ZAVRUNE_DB_ERROR: DATABASE_URL is required. Configure it outside source control before running migrations."
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
  deriveDirectNeonUrl,
  formatDatabaseError,
  redact,
  resolveMigrationDatabaseUrl,
};
