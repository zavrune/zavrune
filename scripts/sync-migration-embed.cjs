/**
 * Copies drizzle SQL + journal into a JSON module that the serverless runtime
 * can bundle if the migrations folder is not on the deployed filesystem.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const drizzleDir = path.join(root, "drizzle");
const files = {};

files["meta/_journal.json"] = fs.readFileSync(
  path.join(drizzleDir, "meta", "_journal.json"),
  "utf8"
);

for (const name of fs.readdirSync(drizzleDir).filter((file) => file.endsWith(".sql")).sort()) {
  files[name] = fs.readFileSync(path.join(drizzleDir, name), "utf8");
}

const out = path.join(root, "src", "db", "embedded-migrations.json");
fs.writeFileSync(out, `${JSON.stringify({ files }, null, 2)}\n`);
console.log(`Synced ${Object.keys(files).length} migration files to src/db/embedded-migrations.json`);
