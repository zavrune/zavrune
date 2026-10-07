import { db } from "@/db";
import { inventoryEvents, productVariants, products } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, optionalString, parsePagination, readJsonBody, toInteger, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { adjustVariantStock } from "@/lib/variants";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { page, pageSize, offset, search } = parsePagination(url, { defaultPageSize: 50 });
      const lowStockOnly = url.searchParams.get("lowStock") === "true";

      const filters = [];
      if (search) {
        filters.push(or(ilike(productVariants.sku, `%${search}%`), ilike(productVariants.color, `%${search}%`), ilike(productVariants.size, `%${search}%`))!);
      }
      if (lowStockOnly) filters.push(lte(productVariants.stock, 5));

      const where = filters.length ? and(...filters) : undefined;

      const [totalRow] = await db.select({ value: count() }).from(productVariants).where(where);
      const variants = await db
        .select({
          variant: productVariants,
          productName: products.nameEn,
          productSku: products.sku,
        })
        .from(productVariants)
        .leftJoin(products, eq(products.id, productVariants.productId))
        .where(where)
        .orderBy(asc(productVariants.stock), desc(productVariants.createdAt))
        .limit(pageSize)
        .offset(offset);

      const events = await db
        .select()
        .from(inventoryEvents)
        .orderBy(desc(inventoryEvents.createdAt))
        .limit(25);

      const [lowStockRow] = await db
        .select({ value: count() })
        .from(productVariants)
        .where(lte(productVariants.stock, 5));

      const [outOfStockRow] = await db
        .select({ value: count() })
        .from(productVariants)
        .where(eq(productVariants.stock, 0));

      return jsonOk({
        variants: variants.map((row) => ({
          ...row.variant,
          productName: row.productName,
          productSku: row.productSku,
        })),
        events,
        total: Number(totalRow?.value ?? 0),
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(Number(totalRow?.value ?? 0) / pageSize)),
        lowStockCount: Number(lowStockRow?.value ?? 0),
        outOfStockCount: Number(outOfStockRow?.value ?? 0),
      });
    },
    { context: "admin/inventory request failed" }
  );
}

/** Stock adjustment (set absolute value or apply a delta). */
export async function PATCH(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const variantId = typeof body.variantId === "string" ? body.variantId : null;
      if (!variantId) return jsonError("variantId is required.", 400);

      const setStock = toInteger(body.stock, null);
      const delta = toInteger(body.delta, null);
      if (setStock === null && delta === null) return jsonError("Provide either stock or delta.", 400);

      const result = await adjustVariantStock(variantId, {
        setStock,
        delta,
        type: optionalString(body.type, 40) ?? "adjustment",
        notes: optionalString(body.notes, 300),
      });

      if (!result) return jsonError("Variant not found.", 404);

      await recordAdminAudit(session.admin, "admin.inventory.adjusted", {
        target: variantId,
        detail: { stock: result.stock },
        req,
      });

      return jsonOk({ variant: result });
    },
    { context: "admin/inventory update failed" }
  );
}
