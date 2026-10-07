import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import {
  jsonError,
  jsonOk,
  optionalString,
  readJsonBody,
  sanitizeMediaUrl,
  slugify,
  toBoolean,
  toNonNegativeInteger,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!existing) return jsonError("Category not found.", 404);

      const updates: Record<string, unknown> = {};
      if (body.nameEn !== undefined) updates.nameEn = optionalString(body.nameEn, 160) ?? existing.nameEn;
      if (body.nameAr !== undefined) updates.nameAr = optionalString(body.nameAr, 160) ?? existing.nameAr;
      if (body.nameFr !== undefined) updates.nameFr = optionalString(body.nameFr, 160) ?? existing.nameFr;
      if (body.descriptionEn !== undefined) updates.descriptionEn = optionalString(body.descriptionEn, 2000);
      if (body.descriptionAr !== undefined) updates.descriptionAr = optionalString(body.descriptionAr, 2000);
      if (body.descriptionFr !== undefined) updates.descriptionFr = optionalString(body.descriptionFr, 2000);
      if (body.imageUrl !== undefined) updates.imageUrl = sanitizeMediaUrl(body.imageUrl);
      if (body.isActive !== undefined) updates.isActive = toBoolean(body.isActive, existing.isActive);
      if (body.displayOrder !== undefined) updates.displayOrder = toNonNegativeInteger(body.displayOrder, existing.displayOrder);
      if (body.slug !== undefined) {
        const raw = optionalString(body.slug, 160);
        if (raw) updates.slug = slugify(raw) || existing.slug;
      }

      const [updated] = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();

      // Assigning products to a category from the category editor.
      if (Array.isArray(body.productIds)) {
        const ids = (body.productIds as string[]).filter((value) => typeof value === "string");
        if (ids.length > 0) {
          await db.update(products).set({ categoryId: id }).where(inArray(products.id, ids));
        }
      }

      await recordAdminAudit(session.admin, "admin.category.updated", { target: id, req });
      return jsonOk({ category: updated });
    },
    { context: "admin/category update failed" }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session, url) => {
      await ensureAdminReady();
      const { id } = await params;
      const reassignTo = url.searchParams.get("reassignTo");

      const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!existing) return jsonError("Category not found.", 404);

      const affected = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, id));

      if (affected.length > 0 && !reassignTo) {
        return jsonError(
          `This category still contains ${affected.length} product(s). Move them first or pass reassignTo.`,
          409
        );
      }

      if (affected.length > 0 && reassignTo) {
        await db.update(products).set({ categoryId: reassignTo }).where(eq(products.categoryId, id));
      }

      // Products keep existing: the foreign key is ON DELETE SET NULL.
      await db.delete(categories).where(eq(categories.id, id));
      await recordAdminAudit(session.admin, "admin.category.deleted", {
        target: id,
        detail: { movedProducts: affected.length },
        req,
      });

      return jsonOk({ deleted: id, movedProducts: affected.length });
    },
    { context: "admin/category delete failed" }
  );
}
