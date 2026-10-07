import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { getProductVariantGraph, syncProductVariantGraph, type VariantGraph } from "@/lib/variants";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const { id } = await params;
      const graph = await getProductVariantGraph(id);
      return jsonOk({ graph });
    },
    { context: "admin/variants lookup failed" }
  );
}

/**
 * Declarative save of option types, option values and variants in one atomic
 * transaction: add, edit, enable/disable, reorder and delete.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!product) return jsonError("Product not found.", 404);

      const graph: VariantGraph = {
        optionTypes: Array.isArray(body.optionTypes) ? (body.optionTypes as VariantGraph["optionTypes"]) : [],
        variants: Array.isArray(body.variants) ? (body.variants as VariantGraph["variants"]) : [],
      };

      const result = await syncProductVariantGraph(id, graph, {
        baseSku: product.sku,
        basePrice: product.price,
      });

      const saved = await getProductVariantGraph(id);
      await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, id));
      await recordAdminAudit(session.admin, "admin.product.variants_saved", {
        target: id,
        detail: result,
        req,
      });

      return jsonOk({ graph: saved, result });
    },
    { context: "admin/variants save failed" }
  );
}
