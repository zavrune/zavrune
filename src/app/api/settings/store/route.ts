import { getStoreSettingsSafe } from "@/lib/store-settings";
import { ensureDatabaseSchema } from "@/db/initialize";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabaseSchema();
    const settings = await getStoreSettingsSafe();
    return Response.json(
      { success: true, settings },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ success: false, error: "Settings unavailable" }, { status: 500 });
  }
}
