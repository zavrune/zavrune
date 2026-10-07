import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { getProductVariantGraph, syncProductVariantGraph } from "@/lib/variants";
import { uniqueProductSlug } from "@/lib/admin-product-helpers";

export const runtime = "nodejs";

/** Duplicates a product with its full option/variant graph (as a draft). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;

      const [source] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!source) return jsonError("Product not found.", 404);

      const graph = await getProductVariantGraph(id);
      const nameEn = `${source.nameEn} (Copy)`.slice(0, 200);

      const [created] = await db
        .insert(products)
        .values({
          slug: await uniqueProductSlug(`${source.slug}-copy`),
          nameEn,
          nameAr: source.nameAr ? `${source.nameAr} (نسخة)` : nameEn,
          nameFr: source.nameFr ? `${source.nameFr} (Copie)` : nameEn,
          descriptionEn: source.descriptionEn,
          descriptionAr: source.descriptionAr,
          descriptionFr: source.descriptionFr,
          shortDescriptionEn: source.shortDescriptionEn,
          shortDescriptionAr: source.shortDescriptionAr,
          shortDescriptionFr: source.shortDescriptionFr,
          price: source.price,
          compareAtPrice: source.compareAtPrice,
          sku: `${source.sku}-COPY`.slice(0, 120),
          categoryId: source.categoryId,
          collectionId: source.collectionId,
          sizeGuideId: source.sizeGuideId,
          tags: (source.tags ?? []) as string[],
          images: (source.images ?? []) as object[],
          mobileImages: (source.mobileImages ?? []) as object[],
          videoUrl: source.videoUrl,
          // Copies start as drafts so nothing goes live by accident.
          status: "draft",
          featured: false,
          badge: source.badge,
          seoTitle: source.seoTitle,
          seoDescription: source.seoDescription,
          position: source.position + 1,
        })
        .returning();

      await syncProductVariantGraph(
        created.id,
        {
          optionTypes: graph.optionTypes.map((type) => ({
            name: type.name,
            isEnabled: type.isEnabled,
            values: type.values.map((value) => ({
              value: value.value,
              isEnabled: value.isEnabled,
              colorHex: value.colorHex,
              imageUrl: value.imageUrl,
            })),
          })),
          variants: graph.variants.map((variant) => ({
            sku: `${variant.sku}-COPY`.slice(0, 120),
            stock: variant.stock,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            imageUrl: variant.imageUrl,
            status: variant.status,
            options: variant.options,
          })),
        },
        { baseSku: `${source.sku}-COPY`.slice(0, 120), basePrice: source.price }
      );

      await recordAdminAudit(session.admin, "admin.product.duplicated", { target: created.id, detail: { from: id }, req });

      return jsonOk({ product: created }, 201);
    },
    { context: "admin/product duplicate failed" }
  );
}
