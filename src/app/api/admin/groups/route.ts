import { ensureAdminReady } from "@/db/initialize";
import { jsonOk, withAdmin } from "@/lib/api";
import { getGroupProductIds, listProductGroups } from "@/lib/product-groups";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const groups = await listProductGroups();
      const withItems = [];
      for (const group of groups) {
        withItems.push({ ...group, productIds: await getGroupProductIds(group.key) });
      }
      return jsonOk({ groups: withItems });
    },
    { context: "admin/groups request failed" }
  );
}
