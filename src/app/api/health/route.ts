import { db, pool } from "@/db";
import { getMigrationReadiness } from "@/db/migration-state";
import {
  ensureDatabaseSchema,
  getDatabaseInitializationError,
} from "@/db/initialize";
import { formatDatabaseError } from "@/db/errors";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabaseSchema();
    // Probe live state even on a warm instance whose required readiness was
    // memoized. Health must show pending optional DDL and notice its completion.
    const readiness = await getMigrationReadiness(pool);
    if (!readiness.ready) throw new Error("Required committed migrations are not ready. Run npm run db:migrate.");
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      databaseInitialized: true,
      degraded: readiness.degraded,
      pendingMigrations: readiness.pendingMigrations,
    });
  } catch (error) {
    const databaseError =
      getDatabaseInitializationError() ??
      `ZAVRUNE_DB_ERROR: Database health check failed: ${formatDatabaseError(error)}`;

    return Response.json({ ok: false, databaseError }, { status: 500 });
  }
}
