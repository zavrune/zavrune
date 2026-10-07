import { db } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { products } from "@/db/schema";
import { sanitizeMediaUrl, slugify } from "@/lib/api";
import {
  FEATURED_KEY,
  NEW_DROP_KEY,
  getGroupProductIds,
  setProductGroupItems,
} from "@/lib/product-groups";

/**
 * Product helpers shared by the admin product routes. They live here rather than
 * in a route module because Next.js only allows route handlers to be exported
 * from App Router route files.
 */

/** Coerces arbitrary client input into a supported product status. */
export function normalizeStatus(value: unknown): "published" | "draft" | "archived" {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "published" || raw === "active") return "published";
  if (raw === "draft" || raw === "hidden") return "draft";
  if (raw === "archived" || raw === "deleted") return "archived";
  return "draft";
}

/** Normalizes an image array into `{ url, alt?, color? }` records. */
export function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        const url = sanitizeMediaUrl(entry);
        return url ? { url } : null;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const url = sanitizeMediaUrl(record.url);
        if (!url) return null;
        return {
          url,
          ...(record.alt ? { alt: String(record.alt).slice(0, 160) } : {}),
          ...(record.color ? { color: String(record.color).slice(0, 60) } : {}),
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 20);
}

/** Distinct, non-empty string values for one key across legacy variant rows. */
export function uniqueValues(rows: unknown, key: string): string[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = (row as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 80);
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen);
}

/** Generates a URL-safe slug that is unique across products. */
export async function uniqueProductSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || `product-${Date.now().toString(36)}`;
  let candidate = root;
  let suffix = 1;

  for (;;) {
    const where = excludeId
      ? and(eq(products.slug, candidate), ne(products.id, excludeId))
      : eq(products.slug, candidate);
    const [existing] = await db.select({ id: products.id }).from(products).where(where).limit(1);

    if (!existing) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}

/** Keeps a product's New Drop / Featured membership in sync with the checkboxes. */
export async function applyGroups(productId: string, groupKeys: string[]) {
  const wanted = new Set(
    Array.isArray(groupKeys)
      ? groupKeys.filter((key): key is string => typeof key === "string" && (key === NEW_DROP_KEY || key === FEATURED_KEY))
      : []
  );

  for (const key of [NEW_DROP_KEY, FEATURED_KEY] as const) {
    const current = await getGroupProductIds(key);
    const without = current.filter((id) => id !== productId);
    const next = wanted.has(key) ? [...without, productId] : without;
    // Skip the write when nothing changed so we do not churn order rows.
    if (next.length === current.length && next.every((id, index) => id === current[index])) continue;
    await setProductGroupItems(key, next);
  }

  await db.update(products).set({ featured: wanted.has(FEATURED_KEY) }).where(eq(products.id, productId));
}
