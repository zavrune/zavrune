export async function register() {
  // Edge cannot open a pg pool. An unset runtime is the Node server.
  if (process.env.NEXT_RUNTIME === "edge") return;
  // next build loads instrumentation while compiling. Do not connect there.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;

  // This is an early warm-up only. Database-backed routes also await the same
  // initializer, so schema readiness never depends solely on instrumentation.
  const { ensureDatabaseSchema } = await import("./db/initialize");
  await ensureDatabaseSchema();
}
