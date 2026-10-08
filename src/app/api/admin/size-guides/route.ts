import { db } from "@/db";
import { categories, products, sizeGuideMeasurements, sizeGuides } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, optionalString, readJsonBody, requireString, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { loadMeasurementRows, normalizeCategoryId, normalizeMeasurements } from "@/lib/size-guides";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();

      const guides = await db.select().from(sizeGuides).orderBy(asc(sizeGuides.createdAt), asc(sizeGuides.name));
      const guideIds = guides.map((guide) => guide.id);

      const rowsByGuide = await loadMeasurementRows(guideIds);

      const [categoryRows, productCounts] = await Promise.all([
        db.select({ id: categories.id, nameEn: categories.nameEn }).from(categories),
        guideIds.length > 0
          ? db.select({ id: products.id, sizeGuideId: products.sizeGuideId }).from(products).where(inArray(products.sizeGuideId, guideIds))
          : Promise.resolve([]),
      ]);

      const categoryMap = new Map(categoryRows.map((row) => [row.id, row.nameEn]));
      const countMap = new Map<string, number>();
      for (const row of productCounts as { sizeGuideId: string | null }[]) {
        if (!row.sizeGuideId) continue;
        countMap.set(row.sizeGuideId, (countMap.get(row.sizeGuideId) ?? 0) + 1);
      }

      return jsonOk({
        guides: guides.map((guide) => ({
          id: guide.id,
          name: guide.name,
          description: guide.description,
          categoryId: guide.categoryId,
          categoryName: guide.categoryId ? categoryMap.get(guide.categoryId) ?? null : null,
          createdAt: guide.createdAt,
          productCount: countMap.get(guide.id) ?? 0,
          measurements: rowsByGuide.get(guide.id) ?? [],
        })),
      });
    },
    { context: "admin/size-guides list failed" }
  );
}

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const name = requireString(body.name, "Size guide name", 160);
      const description = optionalString(body.description, 2000);
      const categoryId = normalizeCategoryId(body.categoryId) ?? null;
      const measurements = normalizeMeasurements(body.measurements ?? []);

      if (categoryId) {
        const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
        if (!category) return jsonError("Category not found.", 404);
      }

      const guide = await db.transaction(async (tx) => {
        const [created] = await tx.insert(sizeGuides).values({ name, description, categoryId }).returning();
        if (measurements.length > 0) {
          await tx.insert(sizeGuideMeasurements).values(
            measurements.map((row) => ({
              sizeGuideId: created.id,
              sizeLabel: row.sizeLabel,
              chest: row.chest,
              waist: row.waist,
              hip: row.hip,
              length: row.length,
              sleeve: row.sleeve,
              inseam: row.inseam,
              customMeasurements: row.customMeasurements,
            }))
          );
        }
        return created;
      });

      await recordAdminAudit(session.admin, "admin.size_guide.created", {
        target: guide.id,
        detail: { name, measurementRows: measurements.length },
        req,
      });

      return jsonOk({ guide: { ...guide, measurements }, productCount: 0 }, 201);
    },
    { context: "admin/size-guide create failed" }
  );
}
