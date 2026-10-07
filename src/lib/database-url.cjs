/** Shared by the server-only TS facade and the Node migration CLI. No pg defaults. */
const DATABASE_URL_NAMES = ["ZAVRUNE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"];
function environmentValue(environment, name) {
  const value = environment[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function hasDatabaseUrl(environment = process.env) {
  return DATABASE_URL_NAMES.some((name) => environmentValue(environment, name));
}
function resolveDatabaseUrl(environment = process.env) {
  for (const source of DATABASE_URL_NAMES) {
    const connectionString = environmentValue(environment, source);
    if (connectionString) return { connectionString, source };
  }
  throw new Error("ZAVRUNE_DB_ERROR: ZAVRUNE_DATABASE_URL, DATABASE_URL or POSTGRES_URL is required. Refusing to use a localhost database fallback.");
}
module.exports = { resolveDatabaseUrl, hasDatabaseUrl, environmentValue };
