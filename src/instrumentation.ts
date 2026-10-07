export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Startup is not a schema deployment step. Never import the migration runner.
  if (process.env.ZAVRUNE_DB_WARMUP !== "1") return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { pool } = await import("./db");
    await Promise.race([
      pool.query("select 1"),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Database warmup deadline exceeded")), 1500);
      }),
    ]);
  } catch {
    // Includes missing config, failed imports, network/query failures and timeout.
    // Warmup is optional and must never crash unrelated Next.js routes.
    console.warn("[db] Optional warmup did not complete; database-backed requests will check readiness.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
