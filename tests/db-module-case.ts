/** Child process used by tests/db-module.test.cjs to observe real module behaviour. */
import { sql } from "drizzle-orm";
import { APPLICATION_POOL_OPTIONS, db, getApplicationPool } from "../src/db/index";

const mode = process.argv[2] ?? "options";

async function options(): Promise<void> {
  console.log(JSON.stringify({ options: APPLICATION_POOL_OPTIONS }));
}

async function noUrl(): Promise<void> {
  const started = Date.now();
  let poolCreated = false;
  let poolError = "";
  try {
    getApplicationPool();
    poolCreated = true;
  } catch (error) {
    poolError = error instanceof Error ? error.message : String(error);
  }

  let queryError = "";
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    queryError = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify({ poolCreated, poolError, queryError, elapsedMs: Date.now() - started }));
}

async function main(): Promise<void> {
  if (mode === "no-url") {
    await noUrl();
    return;
  }
  if (mode === "import-only") {
    console.log(JSON.stringify({ imported: true }));
    return;
  }
  await options();
}

main().catch((error: unknown) => {
  console.error(`CASE_FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
