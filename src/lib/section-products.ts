/**
 * Pure, dependency-free section → product selection.
 *
 * This module is imported by the admin builder preview (a client component) and
 * by the server storefront, so it must never import the database or Node APIs.
 * The database-backed helpers live in `src/lib/product-groups.ts`.
 */

export const NEW_DROP_KEY = "new_drop";
export const FEATURED_KEY = "featured";

export type ProductSource =
  | "auto"
  | "manual"
  | "new_drop"
  | "featured"
  | "newest"
  | "best_sellers"
  | "category"
  | "collection";

export interface SectionProductConfig {
  productSource?: ProductSource | string;
  productIds?: string[];
  limit?: number;
  order?: "manual" | "newest" | "price_asc" | "price_desc";
  categoryId?: string | null;
  categorySlug?: string | null;
  collectionId?: string | null;
  collectionSlug?: string | null;
}

/** Read-only lookup data so section resolution works without extra queries. */
export interface SectionProductContext {
  categories?: { id: string; slug: string }[];
  collections?: { id: string; slug: string }[];
  /** Managed group membership resolved once per request (new_drop / featured). */
  groupProductIds?: { new_drop?: string[]; featured?: string[] };
}

function pickByIds(allProducts: any[], ids: string[]) {
  const byId = new Map(allProducts.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function newestFirst(allProducts: any[]) {
  return [...allProducts].sort((a, b) => {
    const left = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return right - left;
  });
}

/**
 * Resolves which products a homepage section shows. Manual selections preserve
 * the admin's exact order; the fallbacks keep the storefront populated.
 */
export function selectSectionProducts(
  config: SectionProductConfig,
  allProducts: any[],
  limit = 8,
  context: SectionProductContext = {}
) {
  const products = Array.isArray(allProducts) ? allProducts : [];
  const take = (list: any[]) => list.slice(0, Math.max(0, limit));
  const source = (config?.productSource as string) || "auto";

  if (source === "manual") {
    const ids = Array.isArray(config?.productIds) ? config.productIds.filter(Boolean) : [];
    if (ids.length === 0) return [];
    return take(pickByIds(products, ids));
  }

  if (source === NEW_DROP_KEY || source === "new_drop") {
    const grouped = pickByIds(products, context.groupProductIds?.new_drop ?? []);
    if (grouped.length > 0) return take(grouped);
    return take(products);
  }

  if (source === FEATURED_KEY || source === "featured") {
    const grouped = pickByIds(products, context.groupProductIds?.featured ?? []);
    if (grouped.length > 0) return take(grouped);
    const flagged = products.filter((product) => product.featured);
    return take(flagged.length > 0 ? flagged : products);
  }

  if (source === "category") {
    const categoryId =
      config?.categoryId ||
      context.categories?.find((category) => category.slug === config?.categorySlug)?.id ||
      null;
    if (!categoryId) return take(products);
    return take(products.filter((product) => product.categoryId === categoryId));
  }

  if (source === "collection") {
    const collectionId =
      config?.collectionId ||
      context.collections?.find((collection) => collection.slug === config?.collectionSlug)?.id ||
      null;
    if (!collectionId) return take(products);
    return take(products.filter((product) => product.collectionId === collectionId));
  }

  if (source === "newest") {
    return take(newestFirst(products));
  }

  if (source === "best_sellers") {
    return take(products);
  }

  // "auto" (and any legacy source): explicit selections and price ordering are
  // still honoured before falling back to catalogue order.
  if (Array.isArray(config?.productIds) && config.productIds.length > 0) {
    const selected = pickByIds(products, config.productIds);
    if (selected.length > 0) return take(selected);
  }

  if (config?.order === "price_asc") {
    return take([...products].sort((a, b) => a.price - b.price));
  }
  if (config?.order === "price_desc") {
    return take([...products].sort((a, b) => b.price - a.price));
  }

  return take(products);
}
