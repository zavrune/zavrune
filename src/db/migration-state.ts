import type { Pool } from "pg";

export type MigrationReadiness = {
  ready: boolean;
  current: boolean;
  degraded: boolean;
  pendingMigrations: string[];
};

const state = require("./migration-state.cjs") as {
  getMigrationReadiness: (executor: Pick<Pool, "query">, queryTimeoutMs?: number) => Promise<MigrationReadiness>;
  isMigrationStateCurrent: (executor: Pick<Pool, "query">, queryTimeoutMs?: number) => Promise<boolean>;
};
export const getMigrationReadiness = state.getMigrationReadiness;
export const isMigrationStateCurrent = state.isMigrationStateCurrent;
