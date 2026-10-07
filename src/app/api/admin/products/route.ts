import { db } from "@/db";
import { categories, productGroupItems, products, productVariants } from "@/db/schema";
import { ensureAdminReady } from "@/db/initialize";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
  toUuidOrNull,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { getProductVariantGraph, syncProductVariantGraph, type VariantGraph } from "@/lib/variants";
import {
  applyGroups,
  normalizeImages,
  normalizeStatus,
  uniqueProductSlug,
  uniqueValues,
} from "@/lib/admin-product-helpers";
import { FEATURED_KEY, NEW_DROP_KEY } from "@/lib/product-groups";

export const runtime = "nodejs";

/** Serializes the admin product list shape (product + variants + group keys). */
function shapeProduct(product: typeof products.$inferSelect, variants: any[], groupKeys: string[]) {
  return {
    ...product,
    images: Array.isArray(product.images) ? product.images : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    variants,
    groupKeys,
  };
}

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { page, pageSize, offset, search } = parsePagination(url);
      const status = url.searchParams.get("status");
      const categoryId = toUuidOrNull(url.searchParams.get("categoryId"));
      const group = url.searchParams.get("group");
      const featuredOnly = url.searchParams.get("featured") === "true";
      const sort = url.searchParams.get("sort") ?? "position";
      const includeUnpublished = url.searchParams.get("all") === "true";

      const filters = [];
      if (!includeUnpublished && status && ["published", "draft", "archived"].includes(status)) {
        filters.push(eq(products.status, status));
      } else if (status && ["published", "draft", "archived", "hidden"].includes(status)) {
        filters.push(eq(products.status, status === "hidden" ? "draft" : status));
      }
      if (categoryId) filters.push(eq(products.categoryId, categoryId));
      if (featuredOnly) filters.push(eq(products.featured, true));
      if (search) {
        filters.push(
          or(
            ilike(products.nameEn, `%${search}%`),
            ilike(products.nameAr, `%${search}%`),
            ilike(products.nameFr, `%${search}%`),
            ilike(products.sku, `%${search}%`),
            ilike(products.slug, `%${search}%`)
          )!
        );
      }

      if (group) {
        const groupRows = await db
          .select({ productId: productGroupItems.productId })
          .from(productGroupItems)
          .where(eq(productGroupItems.groupKey, group));
        const ids = groupRows.map((row) => row.productId);
        if (ids.length === 0) {
          return jsonOk({ products: [], total: 0, page, pageSize, totalPages: 0, groups: await groupMembershipMap() });
        }
        filters.push(inArray(products.id, ids));
      }

      const whereClause = filters.length ? and(...filters) : undefined;

      const orderBy =
        sort === "name"
          ? asc(products.nameEn)
          : sort === "price"
          ? desc(products.price)
          : sort === "newest"
          ? desc(products.createdAt)
          : asc(products.position);

      const [totalRow] = await db.select({ value: count() }).from(products).where(whereClause);
      const total = Number(totalRow?.value ?? 0);

      const rows = await db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(orderBy, desc(products.createdAt))
        .limit(pageSize)
        .offset(offset);

      const productIds = rows.map((row) => row.id);

      const variantRows = productIds.length
        ? await db
            .select()
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
            .orderBy(asc(productVariants.position))
        : [];

      const groupRows = productIds.length
        ? await db.select().from(productGroupItems).where(inArray(productGroupItems.productId, productIds))
        : [];

      const categoryRows = await db.select().from(categories).orderBy(asc(categories.displayOrder));

      return jsonOk({
        products: rows.map((product) =>
          shapeProduct(
            product,
            variantRows.filter((variant) => variant.productId === product.id),
            groupRows.filter((link) => link.productId === product.id).map((link) => link.groupKey)
          )
        ),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        categories: categoryRows,
      });
    },
    { context: "admin/products request failed" }
  );
}

async function groupMembershipMap() {
  const rows = await db.select().from(productGroupItems);
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    map[row.productId] = [...(map[row.productId] ?? []), row.groupKey];
  }
  return map;
}

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);

      const nameEn = requireString(body.nameEn, "Product name (English)", 200);
      const price = toNonNegativeInteger(body.price, 0);

      const slugBase = slugify(nameEn) || "product";
      const slug = await uniqueProductSlug(slugBase);
      const sku = optionalString(body.sku, 120) || slugBase.toUpperCase().slice(0, 40);

      const [maxPosition] = await db.select({ value: sql<number>`coalesce(max(${products.position}), 0)` }).from(products);

      const [created] = await db
        .insert(products)
        .values({
          slug,
          nameEn,
          nameAr: optionalString(body.nameAr, 200) ?? nameEn,
          nameFr: optionalString(body.nameFr, 200) ?? nameEn,
          descriptionEn: optionalString(body.descriptionEn, 8000),
          descriptionAr: optionalString(body.descriptionAr, 8000),
          descriptionFr: optionalString(body.descriptionFr, 8000),
          shortDescriptionEn: optionalString(body.shortDescriptionEn, 500),
          shortDescriptionAr: optionalString(body.shortDescriptionAr, 500),
          shortDescriptionFr: optionalString(body.shortDescriptionFr, 500),
          price,
          compareAtPrice:
            body.compareAtPrice === null || body.compareAtPrice === undefined || body.compareAtPrice === ""
              ? null
              : toNonNegativeInteger(body.compareAtPrice, 0),
          sku,
          categoryId: toUuidOrNull(body.categoryId),
          collectionId: toUuidOrNull(body.collectionId),
          sizeGuideId: toUuidOrNull(body.sizeGuideId),
          tags: Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string").slice(0, 30) : [],
          images: normalizeImages(body.images),
          mobileImages: normalizeImages(body.mobileImages),
          videoUrl: sanitizeMediaUrl(body.videoUrl),
          status: normalizeStatus(body.status),
          featured: toBoolean(body.featured, false),
          badge: optionalString(body.badge, 60),
          seoTitle: optionalString(body.seoTitle, 200),
          seoDescription: optionalString(body.seoDescription, 400),
          position: Number(maxPosition?.value ?? 0) + 1,
        })
        .returning();

      const graph = (body.variantsGraph ?? null) as VariantGraph | null;
      if (graph && (graph.optionTypes?.length || graph.variants?.length)) {
        await syncProductVariantGraph(created.id, graph, { baseSku: sku, basePrice: price });
      } else if (Array.isArray(body.variants) && body.variants.length > 0) {
        // Legacy simple shape: [{ color, size, stock, price }]
        const legacy: VariantGraph = {
          optionTypes: [
            { name: "Color", values: uniqueValues(body.variants, "color").map((value) => ({ value })) },
            { name: "Size", values: uniqueValues(body.variants, "size").map((value) => ({ value })) },
          ].filter((type) => type.values.length > 0),
          variants: (body.variants as any[]).map((variant) => ({
            sku: optionalString(variant.sku, 120) ?? undefined,
            stock: toNonNegativeInteger(variant.stock, 0),
            price: variant.price ?? price,
            options: {
              ...(variant.color ? { Color: String(variant.color) } : {}),
              ...(variant.size ? { Size: String(variant.size) } : {}),
            },
          })),
        };
        await syncProductVariantGraph(created.id, legacy, { baseSku: sku, basePrice: price });
      } else {
        await syncProductVariantGraph(
          created.id,
          { optionTypes: [], variants: [{ sku: `${sku}-DEFAULT`, stock: 0, price, options: {} }] },
          { baseSku: sku, basePrice: price }
        );
      }

      if (Array.isArray(body.groupKeys)) {
        await applyGroups(created.id, body.groupKeys as string[]);
      }

      await recordAdminAudit(session.admin, "admin.product.created", { target: created.id, detail: { name: nameEn }, req });

      return jsonOk({ product: created }, 201);
    },
    { context: "admin/products create failed" }
  );
}
