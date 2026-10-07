import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import {
  jsonError,
  jsonOk,
  optionalString,
  readJsonBody,
  sanitizeMediaUrl,
  toBoolean,
  toNonNegativeInteger,
  toUuidOrNull,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { getProductVariantGraph } from "@/lib/variants";
import {
  applyGroups,
  normalizeImages,
  normalizeStatus,
  uniqueProductSlug,
} from "@/lib/admin-product-helpers";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const { id } = await params;
      const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!product) return jsonError("Product not found.", 404);

      const graph = await getProductVariantGraph(id);
      return jsonOk({ product, graph });
    },
    { context: "admin/product lookup failed" }
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!existing) return jsonError("Product not found.", 404);

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (typeof body.nameEn === "string" && body.nameEn.trim()) {
        updates.nameEn = body.nameEn.trim().slice(0, 200);
        if (body.slug === undefined) {
          // Keep the URL stable unless the admin explicitly changes it.
        }
      }
      if (body.slug !== undefined) {
        const raw = optionalString(body.slug, 120);
        if (raw) updates.slug = await uniqueProductSlug(raw, id);
      }
      if (body.nameAr !== undefined) updates.nameAr = optionalString(body.nameAr, 200) ?? updates.nameEn ?? existing.nameEn;
      if (body.nameFr !== undefined) updates.nameFr = optionalString(body.nameFr, 200) ?? updates.nameEn ?? existing.nameEn;
      if (body.descriptionEn !== undefined) updates.descriptionEn = optionalString(body.descriptionEn, 8000);
      if (body.descriptionAr !== undefined) updates.descriptionAr = optionalString(body.descriptionAr, 8000);
      if (body.descriptionFr !== undefined) updates.descriptionFr = optionalString(body.descriptionFr, 8000);
      if (body.shortDescriptionEn !== undefined) updates.shortDescriptionEn = optionalString(body.shortDescriptionEn, 500);
      if (body.shortDescriptionAr !== undefined) updates.shortDescriptionAr = optionalString(body.shortDescriptionAr, 500);
      if (body.shortDescriptionFr !== undefined) updates.shortDescriptionFr = optionalString(body.shortDescriptionFr, 500);
      if (body.price !== undefined) updates.price = toNonNegativeInteger(body.price, existing.price);
      if (body.compareAtPrice !== undefined) {
        updates.compareAtPrice =
          body.compareAtPrice === null || body.compareAtPrice === "" ? null : toNonNegativeInteger(body.compareAtPrice, 0);
      }
      if (body.sku !== undefined) updates.sku = optionalString(body.sku, 120) ?? existing.sku;
      if (body.categoryId !== undefined) updates.categoryId = toUuidOrNull(body.categoryId);
      if (body.collectionId !== undefined) updates.collectionId = toUuidOrNull(body.collectionId);
      if (body.sizeGuideId !== undefined) updates.sizeGuideId = toUuidOrNull(body.sizeGuideId);
      if (body.tags !== undefined) {
        updates.tags = Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string").slice(0, 30) : [];
      }
      if (body.images !== undefined) updates.images = normalizeImages(body.images);
      if (body.mobileImages !== undefined) updates.mobileImages = normalizeImages(body.mobileImages);
      if (body.videoUrl !== undefined) updates.videoUrl = sanitizeMediaUrl(body.videoUrl);
      if (body.status !== undefined) updates.status = normalizeStatus(body.status);
      if (body.featured !== undefined) updates.featured = toBoolean(body.featured, existing.featured);
      if (body.badge !== undefined) updates.badge = optionalString(body.badge, 60);
      if (body.seoTitle !== undefined) updates.seoTitle = optionalString(body.seoTitle, 200);
      if (body.seoDescription !== undefined) updates.seoDescription = optionalString(body.seoDescription, 400);
      if (body.position !== undefined) updates.position = toNonNegativeInteger(body.position, existing.position);

      const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();

      if (Array.isArray(body.groupKeys)) {
        await applyGroups(id, body.groupKeys as string[]);
      }

      await recordAdminAudit(session.admin, "admin.product.updated", {
        target: id,
        detail: { fields: Object.keys(updates) },
        req,
      });

      return jsonOk({ product: updated });
    },
    { context: "admin/product update failed" }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;

      const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!existing) return jsonError("Product not found.", 404);

      // Variants, option types and group links cascade. Historical order items
      // keep their own immutable snapshot and only lose the foreign key.
      await db.delete(products).where(eq(products.id, id));
      await recordAdminAudit(session.admin, "admin.product.deleted", {
        target: id,
        detail: { name: existing.nameEn },
        req,
      });

      return jsonOk({ deleted: id });
    },
    { context: "admin/product delete failed" }
  );
}
