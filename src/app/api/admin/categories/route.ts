import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import {
  jsonOk,
  optionalString,
  parsePagination,
  readJsonBody,
  requireString,
  sanitizeMediaUrl,
  slugify,
  toBoolean,
  toNonNegativeInteger,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { search } = parsePagination(url, { defaultPageSize: 200 });

      const where = search
        ? or(ilike(categories.nameEn, `%${search}%`), ilike(categories.nameAr, `%${search}%`), ilike(categories.slug, `%${search}%`))
        : undefined;

      const rows = await db
        .select()
        .from(categories)
        .where(where)
        .orderBy(asc(categories.displayOrder), asc(categories.nameEn));

      // Product counts let the admin see which categories are empty.
      const counts = await db
        .select({ categoryId: products.categoryId, value: count() })
        .from(products)
        .groupBy(products.categoryId);

      const countMap = new Map(counts.map((row) => [row.categoryId, Number(row.value)]));

      return jsonOk({
        categories: rows.map((row) => ({ ...row, productCount: countMap.get(row.id) ?? 0 })),
        total: rows.length,
      });
    },
    { context: "admin/categories request failed" }
  );
}

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const nameEn = requireString(body.nameEn, "Category name (English)", 160);
      const base = slugify(nameEn) || "category";

      const [maxOrder] = await db
        .select({ value: sql<number>`coalesce(max(${categories.displayOrder}), 0)` })
        .from(categories);

      const [created] = await db
        .insert(categories)
        .values({
          slug: `${base}-${Math.floor(100 + Math.random() * 900)}`,
          nameEn,
          nameAr: optionalString(body.nameAr, 160) ?? nameEn,
          nameFr: optionalString(body.nameFr, 160) ?? nameEn,
          descriptionEn: optionalString(body.descriptionEn, 2000),
          descriptionAr: optionalString(body.descriptionAr, 2000),
          descriptionFr: optionalString(body.descriptionFr, 2000),
          imageUrl: sanitizeMediaUrl(body.imageUrl),
          displayOrder: Number(maxOrder?.value ?? 0) + 1,
          isActive: toBoolean(body.isActive, true),
        })
        .returning();

      await recordAdminAudit(session.admin, "admin.category.created", { target: created.id, req });
      return jsonOk({ category: created }, 201);
    },
    { context: "admin/categories create failed" }
  );
}
