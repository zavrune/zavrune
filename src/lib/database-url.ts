/**
 * Server-only facade over the shared CommonJS resolver. Never import this from a
 * client component: it exposes the database credentials of the deployment.
 */
type DatabaseEnvironment = Record<string, string | undefined>;

const resolver = require("./database-url.cjs") as {
  resolveDatabaseUrl: (environment?: DatabaseEnvironment) => { connectionString: string; source: string };
  hasDatabaseUrl: (environment?: DatabaseEnvironment) => boolean;
};

/** ZAVRUNE_DATABASE_URL -> DATABASE_URL -> POSTGRES_URL, or a clear fail-closed error. */
export const resolveDatabaseUrl = resolver.resolveDatabaseUrl;
export const hasDatabaseUrl = resolver.hasDatabaseUrl;
