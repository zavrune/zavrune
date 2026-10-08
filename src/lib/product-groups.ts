import { db } from "@/db";
import { productGroupItems, productGroups, products, productVariants } from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  FEATURED_KEY,
  NEW_DROP_KEY,
  selectSectionProducts,
  type SectionProductConfig,
  type SectionProductContext,
} from "./section-products";

// The pure selection helpers stay dependency-free for client (builder preview)
// use; they are re-exported here so existing server imports keep working.
export { FEATURED_KEY, NEW_DROP_KEY, selectSectionProducts };
export type { ProductSource, SectionProductConfig, SectionProductContext } from "./section-products";

export interface ProductGroupRecord {
  id: string;
  key: string;
  titleEn: string | null;
  titleAr: string | null;
  titleFr: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  subtitleFr: string | null;
  isEnabled: boolean;
  config: Record<string, unknown>;
  updatedAt: Date;
}

export const MANAGED_GROUP_DEFAULTS = [
  {
    key: NEW_DROP_KEY,
    titleEn: "NEW DROP",
    titleAr: "التشكيلة الجديدة",
    titleFr: "NOUVEAUTÉS",
    subtitleEn: "Fresh out of the studio. Strictly limited quantities.",
    subtitleAr: "وصلت حديثاً. كميات محدودة.",
    subtitleFr: "Tout juste sorti du studio. Quantités limitées.",
  },
  {
    key: FEATURED_KEY,
    titleEn: "FEATURED",
    titleAr: "مختارات",
    titleFr: "SÉLECTION",
    subtitleEn: "Hand-picked pieces from the ZAVRUNE archive.",
    subtitleAr: "قطع مختارة بعناية من أرشيف زافرون.",
    subtitleFr: "Pièces sélectionnées dans l'archive ZAVRUNE.",
  },
];

/** Idempotent: reads the two managed keys and inserts only what is missing. */
export async function ensureProductGroups(): Promise<void> {
  const keys = MANAGED_GROUP_DEFAULTS.map((group) => group.key);
  const existing = await db.select({ key: productGroups.key }).from(productGroups).where(inArray(productGroups.key, keys));
  const present = new Set(existing.map((row) => row.key));
  const missing = MANAGED_GROUP_DEFAULTS.filter((group) => !present.has(group.key));
  if (missing.length === 0) return;

  await db.insert(productGroups).values(missing).onConflictDoNothing({ target: productGroups.key });
}

export async function listProductGroups(): Promise<ProductGroupRecord[]> {
  const rows = await db.select().from(productGroups).orderBy(asc(productGroups.key));
  return rows.map((row) => ({
    ...row,
    config: (row.config ?? {}) as Record<string, unknown>,
    updatedAt: new Date(row.updatedAt),
  }));
}

export async function getProductGroup(key: string) {
  const [row] = await db.select().from(productGroups).where(eq(productGroups.key, key)).limit(1);
  if (!row) return undefined;
  return { ...row, config: (row.config ?? {}) as Record<string, unknown>, updatedAt: new Date(row.updatedAt) };
}

export async function updateProductGroup(
  key: string,
  data: {
    titleEn?: string | null;
    titleAr?: string | null;
    titleFr?: string | null;
    subtitleEn?: string | null;
    subtitleAr?: string | null;
    subtitleFr?: string | null;
    isEnabled?: boolean;
  }
) {
  await ensureProductGroups();
  const [updated] = await db
    .update(productGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(productGroups.key, key))
    .returning();
  return updated;
}

/** Replaces the ordered product selection for a group. */
export async function setProductGroupItems(key: string, productIds: string[]): Promise<void> {
  await ensureProductGroups();
  await db.transaction(async (tx) => {
    await tx.delete(productGroupItems).where(eq(productGroupItems.groupKey, key));
    if (productIds.length === 0) return;
    const unique = Array.from(new Set(productIds.filter(Boolean)));
    const values = unique.map((productId, index) => ({ groupKey: key, productId, position: index }));
    await tx.insert(productGroupItems).values(values);
  });
}

export async function getProductGroupItems(key: string) {
  return db
    .select()
    .from(productGroupItems)
    .where(eq(productGroupItems.groupKey, key))
    .orderBy(asc(productGroupItems.position));
}

export async function getGroupProductIds(key: string): Promise<string[]> {
  const items = await getProductGroupItems(key);
  return items.map((item) => item.productId);
}

/** Ordered, published products for a managed group (used by the storefront). */
export async function getGroupProducts(key: string, limit = 24) {
  const items = await getProductGroupItems(key);
  if (items.length === 0) return [];

  const ids = items.map((item) => item.productId).slice(0, limit);
  const rows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.status, "published")));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
}

export async function getGroupForProduct(productId: string): Promise<string[]> {
  const rows = await db.select().from(productGroupItems).where(eq(productGroupItems.productId, productId));
  return rows.map((row) => row.groupKey);
}

/**
 * Server-side resolution: fills managed-group membership from the database when
 * the caller did not provide it, then delegates to the pure selector.
 */
export async function resolveSectionProducts(
  config: SectionProductConfig,
  allProducts: any[],
  limit = 8,
  context: SectionProductContext = {}
) {
  const source = (config?.productSource as string) || "auto";
  let groupProductIds = context.groupProductIds;
  if (
    !groupProductIds &&
    (source === NEW_DROP_KEY || source === "new_drop" || source === FEATURED_KEY || source === "featured")
  ) {
    const [newDrop, featured] = await Promise.all([getGroupProductIds(NEW_DROP_KEY), getGroupProductIds(FEATURED_KEY)]);
    groupProductIds = { new_drop: newDrop, featured };
  }
  return selectSectionProducts(config, allProducts, limit, { ...context, groupProductIds });
}

/** Variants with their option values, grouped per product (storefront needs this). */
export async function getVariantsForProducts(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, any[]>();
  const rows = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .orderBy(asc(productVariants.position), asc(productVariants.createdAt));

  const map = new Map<string, any[]>();
  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row);
    map.set(row.productId, list);
  }
  return map;
}

export async function countGroupItems(): Promise<number> {
  const rows = await db.select({ id: productGroupItems.id }).from(productGroupItems);
  return rows.length;
}

export const productOrdering = { column: products.position, fallback: desc(products.createdAt) };
