function redact(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://***")
    .replace(/password=[^\s&'"]+/gi, "password=***");
}

export async function register() {
  // Edge cannot open a pg pool. An unset runtime is the Node server.
  if (process.env.NEXT_RUNTIME === "edge") return;
  // next build loads instrumentation while compiling. Do not connect there.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;

  try {
    const { applyPendingMigrations } = await import("./db/migrate");
    await applyPendingMigrations();
  } catch (error) {
    console.error("[db] Startup migration failed:", redact(error));
  }
}
