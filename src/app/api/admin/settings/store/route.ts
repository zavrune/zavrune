import { ensureAdminReady } from "@/db/initialize";
import { jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { getStoreSettings, saveStoreSettings } from "@/lib/store-settings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      return jsonOk({ settings: await getStoreSettings() });
    },
    { context: "admin/store settings request failed" }
  );
}

export async function PUT(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const saved = await saveStoreSettings(body);
      await recordAdminAudit(session.admin, "admin.store_settings.updated", { req });
      return jsonOk({ settings: saved });
    },
    { context: "admin/store settings update failed" }
  );
}
