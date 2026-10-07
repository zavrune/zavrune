import { db } from "@/db";
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
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, databaseInitialized: true });
  } catch (error) {
    const databaseError =
      getDatabaseInitializationError() ??
      `ZAVRUNE_DB_ERROR: Database health check failed: ${formatDatabaseError(error)}`;

    return Response.json({ ok: false, databaseError }, { status: 500 });
  }
}
