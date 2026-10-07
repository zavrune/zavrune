type MigrationRunner = {
  applyPendingMigrations: () => Promise<void>;
  formatDatabaseError: (error: unknown) => string;
};

// The runner is CommonJS so it can also be invoked directly with Node at build time.
const migrationRunner = require("./migrate-runner.cjs") as MigrationRunner;

export const applyPendingMigrations = migrationRunner.applyPendingMigrations;
export const formatDatabaseError = migrationRunner.formatDatabaseError;
