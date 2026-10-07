import type { Pool } from "pg";
const state = require("./migration-state.cjs") as {
  isMigrationStateCurrent: (executor: Pick<Pool, "query">, queryTimeoutMs?: number) => Promise<boolean>;
};
export const isMigrationStateCurrent = state.isMigrationStateCurrent;
