import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.categoryIds) ? (body.categoryIds as string[]).filter((id) => typeof id === "string") : [];
      if (ids.length === 0) return jsonError("categoryIds must be a non-empty array.", 400);

      await db.transaction(async (tx) => {
        for (let index = 0; index < ids.length; index += 1) {
          await tx.update(categories).set({ displayOrder: index }).where(eq(categories.id, ids[index]));
        }
      });

      await recordAdminAudit(session.admin, "admin.categories.reordered", { detail: { count: ids.length }, req });
      return jsonOk({ updated: ids.length });
    },
    { context: "admin/categories reorder failed" }
  );
}
