import { AdminApiError } from "@/lib/auth";
import { optionalString, requireString, toUuidOrNull } from "@/lib/api";
import { db } from "@/db";
import { sizeGuideMeasurements } from "@/db/schema";
import { inArray } from "drizzle-orm";

/**
 * Size guide helpers shared by the admin size-guide routes. Server-only: this
 * module is used by route handlers, never by client code.
 */

export const MAX_MEASUREMENT_ROWS = 80;

/**
 * Loads measurement rows for the given guides and groups them per guide.
 * Rows are read back without an explicit ordering, matching the insertion
 * order the editor saves them in (the same behaviour the storefront has
 * always relied on).
 */
export async function loadMeasurementRows(guideIds: string[]): Promise<Map<string, any[]>> {
  if (guideIds.length === 0) return new Map<string, any[]>();
  const rows = await db
    .select()
    .from(sizeGuideMeasurements)
    .where(inArray(sizeGuideMeasurements.sizeGuideId, guideIds));
  const byGuide = new Map<string, any[]>();
  for (const row of rows) {
    const list = byGuide.get(row.sizeGuideId) ?? [];
    list.push(row);
    byGuide.set(row.sizeGuideId, list);
  }
  return byGuide;
}

export interface SizeGuideMeasurementInput {
  sizeLabel: string;
  chest: string | null;
  waist: string | null;
  hip: string | null;
  length: string | null;
  sleeve: string | null;
  inseam: string | null;
  customMeasurements: unknown;
}

/** Validates a measurement row array and preserves its order (top to bottom). */
export function normalizeMeasurements(value: unknown): SizeGuideMeasurementInput[] {
  if (!Array.isArray(value)) {
    throw new AdminApiError("measurements must be an array of rows.", 400);
  }
  if (value.length > MAX_MEASUREMENT_ROWS) {
    throw new AdminApiError(`A size guide can hold at most ${MAX_MEASUREMENT_ROWS} measurement rows.`, 400);
  }

  const seen = new Set<string>();
  return value.map((entry: any, index: number) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AdminApiError(`Measurement row ${index + 1} must be an object.`, 400);
    }
    const sizeLabel = requireString(entry.sizeLabel, `Size label (row ${index + 1})`, 40);
    const key = sizeLabel.toLowerCase();
    if (seen.has(key)) {
      throw new AdminApiError(`Duplicate size label "${sizeLabel}". Each size must appear once.`, 400);
    }
    seen.add(key);
    return {
      sizeLabel,
      chest: optionalString(entry.chest, 120),
      waist: optionalString(entry.waist, 120),
      hip: optionalString(entry.hip, 120),
      length: optionalString(entry.length, 120),
      sleeve: optionalString(entry.sleeve, 120),
      inseam: optionalString(entry.inseam, 120),
      customMeasurements:
        entry.customMeasurements && typeof entry.customMeasurements === "object" && !Array.isArray(entry.customMeasurements)
          ? entry.customMeasurements
          : null,
    };
  });
}

/**
 * Normalises the optional category link. Returns `undefined` when the payload
 * does not mention the category (partial updates), `null` to clear it, or a
 * validated uuid to link it.
 */
export function normalizeCategoryId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const uuid = toUuidOrNull(value);
  if (!uuid) throw new AdminApiError("Category must be a valid id or null.", 400);
  return uuid;
}
