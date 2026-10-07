import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

/** Persists a manual catalogue ordering (array of product ids). */
export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.productIds) ? body.productIds.filter((id) => typeof id === "string") : [];

      if (ids.length === 0) return jsonError("productIds must be a non-empty array.", 400);

      await db.transaction(async (tx) => {
        for (let index = 0; index < ids.length; index += 1) {
          await tx
            .update(products)
            .set({ position: index, updatedAt: new Date() })
            .where(eq(products.id, ids[index] as string));
        }
      });

      await recordAdminAudit(session.admin, "admin.products.reordered", { detail: { count: ids.length }, req });
      return jsonOk({ updated: ids.length });
    },
    { context: "admin/products reorder failed" }
  );
}
