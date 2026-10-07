/**
 * Applies committed Drizzle SQL migrations using DATABASE_URL.
 *
 * Safe to run more than once. Statements that remove tables, columns, or rows
 * are rejected so a deploy cannot wipe production data. The local fallback
 * URL in src/db/index.ts is intentionally not used here.
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
  // Vercel injects DATABASE_URL directly. A missing dotenv install must not crash startup.
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

function redact(value) {
  const text = value instanceof Error ? value.message : String(value);
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://***")
    .replace(/password=[^\s&'"]+/gi, "password=***");
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
  const dir = path.join(os.tmpdir(), "zavrune-drizzle-migrations");
  fs.rmSync(dir, { recursive: true, force: true });
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

async function forgetRecordedMigrations(pool, folder) {
  const journal = JSON.parse(
    fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")
  );
  const stamps = journal.entries.map((entry) => String(entry.when));
  await pool.query(
    "delete from drizzle.__drizzle_migrations where created_at = any($1::bigint[])",
    [stamps]
  );
}

async function assertSchema(pool, tables) {
  for (const [table, columns] of Object.entries(tables)) {
    const projection = columns.map(quoteIdent).join(", ");
    await pool.query(`select ${projection} from ${quoteIdent(table)} limit 0`);
  }

  // Same shape as the homepage query that currently 500s in production.
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to apply migrations. Refusing to use a local fallback."
    );
  }

  const folder = prepareMigrationsFolder();
  const { tables } = readMigrationSql(folder);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 20000,
    query_timeout: 60000,
  });

  try {
    const before = await migrationCount(pool);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: folder });
    try {
      await assertSchema(pool, tables);
    } catch (error) {
      try {
        await forgetRecordedMigrations(pool, folder);
      } catch (forgetError) {
        throw new Error(
          `${redact(error)} (also failed to reset the migration journal: ${redact(forgetError)})`
        );
      }
      throw error;
    }
    const after = await migrationCount(pool);
    if (after > before) {
      console.log(
        `[db] Applied ${after - before} migration(s). Required tables, including page_sections, are present.`
      );
    } else {
      console.log("[db] Database schema already up to date. page_sections is present.");
    }
  } finally {
    await pool.end();
  }
}

async function cli() {
  const ifConfigured = process.argv.includes("--if-configured");
  const bestEffort = process.argv.includes("--best-effort");

  try {
    const folder = prepareMigrationsFolder();
    readMigrationSql(folder);
  } catch (error) {
    console.error("[db] Migration files are invalid:", redact(error));
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    if (ifConfigured) {
      console.warn(
        "[db] DATABASE_URL is not set, so migrations were not applied. Server startup applies them when the variable is present."
      );
      return;
    }
    console.error(
      "[db] DATABASE_URL is required. Export it in the environment and rerun npm run db:migrate. Do not commit the connection string."
    );
    process.exit(1);
  }

  try {
    await applyPendingMigrations();
  } catch (error) {
    console.error("[db] Migration failed:", redact(error));
    if (bestEffort) {
      console.error("[db] Continuing the build. Server startup will retry the same migration.");
      return;
    }
    process.exit(1);
  }
}

if (require.main === module) {
  cli().catch((error) => {
    console.error("[db] Migration failed:", redact(error));
    process.exit(1);
  });
}

module.exports = { applyPendingMigrations, redact };
