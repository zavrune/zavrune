import { db } from "@/db";
import { productOptionTypes, productOptionValues, productVariants, variantOptionValues } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export interface OptionValueInput {
  value: string;
  isEnabled?: boolean;
  colorHex?: string | null;
  imageUrl?: string | null;
}

export interface OptionTypeInput {
  name: string;
  isEnabled?: boolean;
  values: OptionValueInput[];
}

export interface VariantInput {
  id?: string | null;
  sku?: string | null;
  stock?: number | null;
  price?: number | null;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  status?: string | null;
  /** e.g. { Size: "M", Color: "Black" } — arbitrary option names are supported. */
  options?: Record<string, string> | null;
}

export interface VariantGraph {
  optionTypes: OptionTypeInput[];
  variants: VariantInput[];
}

export interface ProductOptionTypeView {
  id: string;
  name: string;
  slug: string;
  position: number;
  isEnabled: boolean;
  values: {
    id: string;
    value: string;
    position: number;
    isEnabled: boolean;
    colorHex: string | null;
    imageUrl: string | null;
  }[];
}

export interface ProductVariantView {
  id: string;
  sku: string;
  stock: number;
  price: number | null;
  compareAtPrice: number | null;
  imageUrl: string | null;
  status: string;
  position: number;
  color: string | null;
  size: string | null;
  options: Record<string, string>;
}

export function slugifyOption(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function combinationSignature(options: Record<string, string> | null | undefined): string {
  if (!options) return "";
  return Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim() !== "")
    .map(([key, value]) => `${key.trim().toLowerCase()}=${`${value}`.trim().toLowerCase()}`)
    .sort()
    .join("|");
}

function asPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.min(Math.round(numeric), 100_000_000);
}

function normalizeOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, val]) => typeof key === "string" && key.trim() && val !== null && val !== undefined && `${val}`.trim())
    .map(([key, val]) => [key.trim().slice(0, 60), `${val}`.trim().slice(0, 120)] as const);
  return Object.fromEntries(entries);
}

/** Reads the full option/variant graph for one product. */
export async function getProductVariantGraph(productId: string): Promise<{
  optionTypes: ProductOptionTypeView[];
  variants: ProductVariantView[];
}> {
  const types = await db
    .select()
    .from(productOptionTypes)
    .where(eq(productOptionTypes.productId, productId))
    .orderBy(asc(productOptionTypes.position), asc(productOptionTypes.createdAt));

  const typeIds = types.map((type) => type.id);

  const values = typeIds.length
    ? await db
        .select()
        .from(productOptionValues)
        .where(inArray(productOptionValues.optionTypeId, typeIds))
        .orderBy(asc(productOptionValues.position), asc(productOptionValues.createdAt))
    : [];

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.position), asc(productVariants.createdAt));

  return {
    optionTypes: types.map((type) => ({
      id: type.id,
      name: type.name,
      slug: type.slug,
      position: type.position,
      isEnabled: type.isEnabled,
      values: values
        .filter((value) => value.optionTypeId === type.id)
        .map((value) => ({
          id: value.id,
          value: value.value,
          position: value.position,
          isEnabled: value.isEnabled,
          colorHex: value.colorHex,
          imageUrl: value.imageUrl,
        })),
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      stock: variant.stock,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      imageUrl: variant.imageUrl,
      status: variant.status,
      position: variant.position,
      color: variant.color,
      size: variant.size,
      options: normalizeOptions(variant.optionCombination),
    })),
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Declarative, atomic sync of the whole option/variant graph:
 * add, edit, enable/disable, reorder and delete all happen in one transaction so
 * a partially saved catalogue is impossible.
 */
export async function syncProductVariantGraph(
  productId: string,
  graph: VariantGraph,
  options: { baseSku: string; basePrice: number | null }
): Promise<{ created: number; updated: number; deleted: number }> {
  const incomingTypes = (graph.optionTypes ?? [])
    .filter((type) => type && typeof type.name === "string" && type.name.trim())
    .map((type, index) => ({
      name: type.name.trim().slice(0, 60),
      slug: slugifyOption(type.name) || `option-${index + 1}`,
      isEnabled: type.isEnabled ?? true,
      position: index,
      values: (type.values ?? [])
        .filter((value) => value && typeof value.value === "string" && value.value.trim())
        .map((value, valueIndex) => ({
          value: value.value.trim().slice(0, 120),
          isEnabled: value.isEnabled ?? true,
          position: valueIndex,
          colorHex: typeof value.colorHex === "string" && value.colorHex.trim() ? value.colorHex.trim().slice(0, 20) : null,
          imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim() ? value.imageUrl.trim().slice(0, 1200) : null,
        })),
    }));

  const incomingVariants = (graph.variants ?? []).map((variant, index) => ({
    id: variant.id ?? null,
    sku: typeof variant.sku === "string" ? variant.sku.trim().slice(0, 120) : "",
    stock: Math.max(0, Math.round(Number(variant.stock ?? 0)) || 0),
    price: asPrice(variant.price),
    compareAtPrice: asPrice(variant.compareAtPrice),
    imageUrl: typeof variant.imageUrl === "string" && variant.imageUrl.trim() ? variant.imageUrl.trim().slice(0, 1200) : null,
    status: variant.status === "inactive" ? "inactive" : "active",
    position: index,
    options: normalizeOptions(variant.options),
  }));

  return db.transaction(async (tx) => {
    const existingTypes = await tx.select().from(productOptionTypes).where(eq(productOptionTypes.productId, productId));
    const existingTypeIds = existingTypes.map((type) => type.id);
    const existingValues = existingTypeIds.length
      ? await tx.select().from(productOptionValues).where(inArray(productOptionValues.optionTypeId, existingTypeIds))
      : [];
    const existingVariants = await tx.select().from(productVariants).where(eq(productVariants.productId, productId));
    const existingLinks = existingVariants.length
      ? await tx
          .select()
          .from(variantOptionValues)
          .where(inArray(variantOptionValues.variantId, existingVariants.map((variant) => variant.id)))
      : [];

    // 1. Option types + values (upsert, then prune what the admin removed).
    const valueIdByKey = new Map<string, string>();
    const keptTypeIds: string[] = [];
    const keptValueIds: string[] = [];

    for (const type of incomingTypes) {
      const existingType = existingTypes.find((row) => row.slug === type.slug);
      let typeId: string;

      if (existingType) {
        typeId = existingType.id;
        await tx
          .update(productOptionTypes)
          .set({ name: type.name, position: type.position, isEnabled: type.isEnabled, updatedAt: new Date() })
          .where(eq(productOptionTypes.id, typeId));
      } else {
        const [inserted] = await tx
          .insert(productOptionTypes)
          .values({ productId, name: type.name, slug: type.slug, position: type.position, isEnabled: type.isEnabled })
          .returning();
        typeId = inserted.id;
      }
      keptTypeIds.push(typeId);

      for (const value of type.values) {
        const identity = `${typeId}:${value.value.toLowerCase()}`;
        const existingValue = existingValues.find(
          (row) => row.optionTypeId === typeId && row.value.toLowerCase() === value.value.toLowerCase()
        );

        if (existingValue) {
          await tx
            .update(productOptionValues)
            .set({
              value: value.value,
              position: value.position,
              isEnabled: value.isEnabled,
              colorHex: value.colorHex,
              imageUrl: value.imageUrl,
            })
            .where(eq(productOptionValues.id, existingValue.id));
          valueIdByKey.set(identity, existingValue.id);
          keptValueIds.push(existingValue.id);
        } else {
          const [inserted] = await tx
            .insert(productOptionValues)
            .values({
              optionTypeId: typeId,
              value: value.value,
              position: value.position,
              isEnabled: value.isEnabled,
              colorHex: value.colorHex,
              imageUrl: value.imageUrl,
            })
            .returning();
          valueIdByKey.set(identity, inserted.id);
          keptValueIds.push(inserted.id);
        }
      }
    }

    const obsoleteValues = existingValues.filter((row) => !keptValueIds.includes(row.id));
    if (obsoleteValues.length) {
      await tx.delete(productOptionValues).where(inArray(productOptionValues.id, obsoleteValues.map((row) => row.id)));
    }
    const obsoleteTypes = existingTypes.filter((row) => !keptTypeIds.includes(row.id));
    if (obsoleteTypes.length) {
      await tx.delete(productOptionTypes).where(inArray(productOptionTypes.id, obsoleteTypes.map((row) => row.id)));
    }

    // 2. Variants (match by explicit id, then by option combination).
    const keptVariantIds: string[] = [];
    let created = 0;
    let updated = 0;

    for (const variant of incomingVariants) {
      const signature = combinationSignature(variant.options);
      const match =
        existingVariants.find((row) => variant.id && row.id === variant.id) ??
        existingVariants.find((row) => combinationSignature(normalizeOptions(row.optionCombination)) === signature && signature !== "");

      const color = variant.options["Color"] ?? variant.options["color"] ?? null;
      const size = variant.options["Size"] ?? variant.options["size"] ?? null;
      const sku = variant.sku || `${options.baseSku}-${slugifyOption(signature) || "DEFAULT"}`;

      let variantId: string;
      if (match) {
        variantId = match.id;
        await tx
          .update(productVariants)
          .set({
            sku,
            stock: variant.stock,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            imageUrl: variant.imageUrl,
            status: variant.status,
            position: variant.position,
            optionCombination: variant.options,
            color,
            size,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, variantId));
        updated += 1;
      } else {
        const [inserted] = await tx
          .insert(productVariants)
          .values({
            productId,
            sku,
            stock: variant.stock,
            price: variant.price ?? options.basePrice,
            compareAtPrice: variant.compareAtPrice,
            imageUrl: variant.imageUrl,
            status: variant.status,
            position: variant.position,
            optionCombination: variant.options,
            color,
            size,
          })
          .returning();
        variantId = inserted.id;
        created += 1;
      }

      await tx.delete(variantOptionValues).where(eq(variantOptionValues.variantId, variantId));

      const linkIds: string[] = [];
      for (const [typeName, typeValue] of Object.entries(variant.options)) {
        const type = incomingTypes.find(
          (candidate) => candidate.name.toLowerCase() === typeName.trim().toLowerCase()
        );
        if (!type) continue;
        const existingType = existingTypes.find((row) => row.slug === type.slug);
        const typeId =
          existingType?.id ??
          (await tx
            .select({ id: productOptionTypes.id })
            .from(productOptionTypes)
            .where(and(eq(productOptionTypes.productId, productId), eq(productOptionTypes.slug, type.slug)))
            .limit(1))[0]?.id;
        if (!typeId) continue;

        const valueId = valueIdByKey.get(`${typeId}:${typeValue.toLowerCase()}`);
        if (valueId) linkIds.push(valueId);
      }

      const uniqueLinkIds = Array.from(new Set(linkIds));
      if (uniqueLinkIds.length) {
        await tx.insert(variantOptionValues).values(uniqueLinkIds.map((optionValueId) => ({ variantId, optionValueId })));
      }

      keptVariantIds.push(variantId);
    }

    const obsoleteVariants = existingVariants.filter((row) => !keptVariantIds.includes(row.id));
    if (obsoleteVariants.length) {
      await tx.delete(productVariants).where(inArray(productVariants.id, obsoleteVariants.map((row) => row.id)));
    }

    // A product must always have at least one purchasable variant row.
    if (keptVariantIds.length === 0) {
      await tx.insert(productVariants).values({
        productId,
        sku: `${options.baseSku}-DEFAULT`,
        stock: 0,
        price: options.basePrice,
        status: "active",
        optionCombination: {},
        position: 0,
      });
      created += 1;
    }

    return { created, updated, deleted: obsoleteVariants.length };
  });
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .limit(1);
  if (!existing) return false;

  await db.delete(productVariants).where(eq(productVariants.id, variantId));
  return true;
}

/** Stock adjustments write an inventory event so the ledger stays complete. */
export async function adjustVariantStock(
  variantId: string,
  options: { setStock?: number | null; delta?: number | null; type: string; notes?: string | null; referenceId?: string | null }
) {
  const { setStock, delta, type, notes, referenceId } = options;

  return db.transaction(async (tx) => {
    const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) return null;

    const nextStock =
      typeof setStock === "number" && Number.isFinite(setStock)
        ? Math.max(0, Math.round(setStock))
        : Math.max(0, variant.stock + Math.round(delta ?? 0));

    const changeQty = nextStock - variant.stock;

    await tx
      .update(productVariants)
      .set({ stock: nextStock, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));

    const { inventoryEvents } = await import("@/db/schema");
    await tx.insert(inventoryEvents).values({
      variantId,
      changeQty,
      type,
      notes: notes ?? null,
      referenceId: referenceId ?? null,
    });

    return { ...variant, stock: nextStock };
  });
}
