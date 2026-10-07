/** Child process used by tests/instrumentation.test.cjs to call the real hook. */
import { register } from "../src/instrumentation";

const BOUNDED_STARTUP_BUDGET_MS = 6000;

async function main(): Promise<void> {
  const started = Date.now();
  await register();
  const elapsedMs = Date.now() - started;
  if (elapsedMs > BOUNDED_STARTUP_BUDGET_MS) {
    throw new Error(`instrumentation register() was not bounded: ${elapsedMs}ms`);
  }
  console.log(`REGISTER_OK ${elapsedMs}`);
}

main().catch((error: unknown) => {
  console.error(`CASE_FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
