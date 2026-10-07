// @ts-expect-error Plain CommonJS runner so `node src/db/migrate-runner.cjs` works without a TypeScript loader.
export { applyPendingMigrations } from "./migrate-runner.cjs";
