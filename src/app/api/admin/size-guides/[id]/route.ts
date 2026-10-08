import { db } from "@/db";
import { categories, products, sizeGuideMeasurements, sizeGuides } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, optionalString, readJsonBody, requireString, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { loadMeasurementRows, normalizeCategoryId, normalizeMeasurements } from "@/lib/size-guides";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const [existing] = await db.select().from(sizeGuides).where(eq(sizeGuides.id, id)).limit(1);
      if (!existing) return jsonError("Size guide not found.", 404);

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = requireString(body.name, "Size guide name", 160);
      if (body.description !== undefined) updates.description = optionalString(body.description, 2000);

      const categoryId = normalizeCategoryId(body.categoryId);
      if (categoryId !== undefined) {
        if (categoryId !== null) {
          const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
          if (!category) return jsonError("Category not found.", 404);
        }
        updates.categoryId = categoryId;
      }

      const measurements = body.measurements !== undefined ? normalizeMeasurements(body.measurements) : undefined;

      await db.transaction(async (tx) => {
        if (Object.keys(updates).length > 0) {
          await tx.update(sizeGuides).set(updates).where(eq(sizeGuides.id, id));
        }
        if (measurements) {
          // Replace-all keeps the admin's row order as the saved order.
          await tx.delete(sizeGuideMeasurements).where(eq(sizeGuideMeasurements.sizeGuideId, id));
          if (measurements.length > 0) {
            await tx.insert(sizeGuideMeasurements).values(
              measurements.map((row) => ({
                sizeGuideId: id,
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
        }
      });

      await recordAdminAudit(session.admin, "admin.size_guide.updated", {
        target: id,
        detail: {
          fields: Object.keys(updates),
          measurementRows: measurements ? measurements.length : undefined,
        },
        req,
      });

      const rowsByGuide = await loadMeasurementRows([id]);
      const linked = await db.select({ id: products.id }).from(products).where(eq(products.sizeGuideId, id));

      return jsonOk({
        guide: {
          ...existing,
          ...updates,
          measurements: rowsByGuide.get(id) ?? [],
        },
        productCount: linked.length,
      });
    },
    { context: "admin/size-guide update failed" }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;

      const [existing] = await db.select().from(sizeGuides).where(eq(sizeGuides.id, id)).limit(1);
      if (!existing) return jsonError("Size guide not found.", 404);

      const linked = await db.select({ id: products.id }).from(products).where(eq(products.sizeGuideId, id));

      // Measurement rows are removed by the ON DELETE CASCADE foreign key;
      // products keep selling with the link cleared (ON DELETE SET NULL).
      await db.delete(sizeGuides).where(eq(sizeGuides.id, id));

      await recordAdminAudit(session.admin, "admin.size_guide.deleted", {
        target: id,
        detail: { name: existing.name, clearedProductLinks: linked.length },
        req,
      });

      return jsonOk({ deleted: id, affectedProducts: linked.length });
    },
    { context: "admin/size-guide delete failed" }
  );
}
