/**
 * Typed facade over the CommonJS migration runner. Application requests must
 * never call this: the build (`npm run build`) and the CLI (`npm run db:migrate`)
 * own schema changes, so a serverless cold start never runs DDL.
 */
type MigrationExecutor = { query: (config: string | { text: string; query_timeout?: number }) => Promise<{ rows: Record<string, unknown>[] }> };

export interface MigrationOptions {
  /** Reuse a caller-owned pool instead of opening a dedicated migration pool. */
  pool?: MigrationExecutor;
  /** Injectable pool class so tests can prove pg is never constructed without a URL. */
  Pool?: unknown;
  environment?: Record<string, string | undefined>;
  /** Bounded wait for another instance that is currently applying migrations. */
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Injectable migration-state reader (must stay a cheap read). */
  checkState?: (executor: MigrationExecutor) => Promise<boolean>;
  /** Injectable DDL executor; the default applies the committed Drizzle migrations. */
  executeMigrations?: (client: unknown, folder: string) => Promise<void>;
}

type MigrationRunner = {
  applyPendingMigrations: (options?: MigrationOptions) => Promise<void>;
  applyMigrationsOnClient: (client: unknown, folder: string) => Promise<void>;
  formatDatabaseError: (error: unknown) => string;
};

// The runner is CommonJS so it can also be invoked directly with Node at build time.
const migrationRunner = require("./migrate-runner.cjs") as MigrationRunner;

export const applyPendingMigrations = migrationRunner.applyPendingMigrations;
export const applyMigrationsOnClient = migrationRunner.applyMigrationsOnClient;
export const formatDatabaseError = migrationRunner.formatDatabaseError;
