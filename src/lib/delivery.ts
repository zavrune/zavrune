import { db } from "@/db";
import { deliveryRates } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { ALGERIA_WILAYAS } from "@/lib/wilayas";

export type DeliveryMethod = "home" | "bureau";

export interface DeliveryRateInput {
  wilayaCode: string;
  homePrice: number | null;
  deskPrice: number | null;
  homeEnabled?: boolean;
  deskEnabled?: boolean;
}

/**
 * Official launch pricing in DZD. `null` means the method is not offered in that
 * wilaya. Admins can edit every value afterwards from Admin → Delivery.
 */
const RATE_TABLE: Record<string, [number | null, number | null]> = {
  "01": [1100, 600],
  "02": [700, 400],
  "03": [900, 500],
  "04": [650, 400],
  "05": [700, 500],
  "06": [700, 400],
  "07": [900, 500],
  "08": [1100, 600],
  "09": [500, 250],
  "10": [700, 400],
  "11": [1300, 600],
  "12": [700, 400],
  "13": [800, 500],
  "14": [800, 400],
  "15": [700, 400],
  "16": [500, 250],
  "17": [900, 500],
  "18": [600, 400],
  "19": [700, 400],
  "20": [800, 400],
  "21": [600, 400],
  "22": [700, 400],
  "23": [700, 400],
  "24": [600, 400],
  "25": [500, 350],
  "26": [700, 400],
  "27": [700, 400],
  "28": [800, 500],
  "29": [700, 400],
  "30": [900, 500],
  "31": [800, 400],
  "32": [800, 500],
  "33": [1300, 600],
  "34": [700, 400],
  "35": [700, 400],
  "36": [700, 400],
  "37": [1300, 600],
  "38": [800, 400],
  "39": [900, 500],
  "40": [700, 500],
  "41": [700, 500],
  "42": [700, 400],
  "43": [600, 400],
  "44": [700, 400],
  "45": [800, 500],
  "46": [800, 400],
  "47": [1000, 500],
  "48": [700, 400],
  "49": [1100, 600],
  "50": [null, null],
  "51": [900, 500],
  "52": [1100, null],
  "53": [1300, 600],
  "54": [null, null],
  "55": [900, 500],
  "56": [1100, null],
  "57": [900, null],
  "58": [1100, 500],
};

function stripCodePrefix(name: string): string {
  return name.replace(/^\s*\d+\s*-\s*/, "").trim();
}

export const DEFAULT_DELIVERY_RATES: DeliveryRateInput[] = ALGERIA_WILAYAS.map((wilaya, index) => {
  const [homePrice, deskPrice] = RATE_TABLE[wilaya.code] ?? [null, null];
  return {
    wilayaCode: wilaya.code,
    homePrice,
    deskPrice,
    homeEnabled: homePrice !== null,
    deskEnabled: deskPrice !== null,
    position: index,
  };
});

export function wilayaName(code: string, language: "en" | "ar" | "fr" = "en"): string {
  const wilaya = ALGERIA_WILAYAS.find((w) => w.code === code);
  if (!wilaya) return code;
  if (language === "ar") return stripCodePrefix(wilaya.nameAr);
  return stripCodePrefix(wilaya.nameEn);
}

/** Full display label, e.g. "16 - Alger" / "16 - الجزائر العاصمة". */
export function wilayaLabel(code: string, language: "en" | "ar" | "fr" = "en"): string {
  const wilaya = ALGERIA_WILAYAS.find((w) => w.code === code);
  if (!wilaya) return code;
  return language === "ar" ? wilaya.nameAr : wilaya.nameEn;
}

/**
 * Idempotent: inserts any wilaya that has no row yet and never overwrites a rate
 * an admin has already edited.
 */
export async function ensureDeliveryRates(): Promise<void> {
  // Cheap fast path: one indexed read. Complete tables are never rewritten.
  const existing = await db.select({ wilayaCode: deliveryRates.wilayaCode }).from(deliveryRates);
  if (existing.length >= ALGERIA_WILAYAS.length) return;
  const present = new Set(existing.map((row) => row.wilayaCode));
  const missing = ALGERIA_WILAYAS.filter((wilaya) => !present.has(wilaya.code));
  if (missing.length === 0) return;

  const rows = missing.map((wilaya) => {
    const [homePrice, deskPrice] = RATE_TABLE[wilaya.code] ?? [null, null];
    return {
      wilayaCode: wilaya.code,
      wilayaNameEn: stripCodePrefix(wilaya.nameEn),
      wilayaNameAr: stripCodePrefix(wilaya.nameAr),
      homePrice,
      deskPrice,
      homeEnabled: homePrice !== null,
      deskEnabled: deskPrice !== null,
      // Keep the official ordering for rows that are still missing only.
      position: ALGERIA_WILAYAS.findIndex((entry) => entry.code === wilaya.code),
    };
  });

  await db.insert(deliveryRates).values(rows).onConflictDoNothing({ target: deliveryRates.wilayaCode });
}

/** Backfills any wilaya row that appears while the process is warm. */
export async function listDeliveryRates() {
  const existing = await db.select().from(deliveryRates).orderBy(asc(deliveryRates.position));
  if (existing.length >= ALGERIA_WILAYAS.length) return existing;

  await ensureDeliveryRates();
  return db.select().from(deliveryRates).orderBy(asc(deliveryRates.position));
}

export async function getDeliveryRate(wilayaCode: string) {
  const normalized = normalizeWilayaCode(wilayaCode);
  if (!normalized) return undefined;

  const [rate] = await db
    .select()
    .from(deliveryRates)
    .where(eq(deliveryRates.wilayaCode, normalized))
    .limit(1);

  return rate;
}

/** Accepts "9", "09", "09 - Blida" or a wilaya name and returns "09". */
export function normalizeWilayaCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  const numeric = trimmed.match(/^(\d{1,2})(?:\D|$)/);
  if (numeric) {
    const code = Number(numeric[1]);
    if (code >= 1 && code <= 58) return String(code).padStart(2, "0");
  }
  const lowered = trimmed.toLowerCase();
  const byName = ALGERIA_WILAYAS.find(
    (w) =>
      stripCodePrefix(w.nameEn).toLowerCase() === lowered ||
      stripCodePrefix(w.nameAr).toLowerCase() === lowered
  );
  return byName ? byName.code : null;
}

export interface DeliveryQuote {
  method: DeliveryMethod;
  price: number;
  freeShippingApplied: boolean;
  wilayaCode: string;
  wilayaName: string;
  label: string;
}

export class DeliveryError extends Error {}

/**
 * Server-side delivery pricing. The client is never trusted for a price: the
 * wilaya + method are re-validated and the amount is derived here.
 */
export async function quoteDelivery(options: {
  wilayaCode: string;
  method: DeliveryMethod;
  itemsSubtotal: number;
  freeShippingThreshold?: number | null;
}): Promise<DeliveryQuote> {
  const { wilayaCode, method, itemsSubtotal, freeShippingThreshold } = options;
  const code = normalizeWilayaCode(wilayaCode);
  if (!code) throw new DeliveryError("A valid wilaya is required for delivery.");

  await ensureDeliveryRates();
  const [rate] = await db
    .select()
    .from(deliveryRates)
    .where(eq(deliveryRates.wilayaCode, code))
    .limit(1);

  if (!rate) throw new DeliveryError("Delivery is not configured for this wilaya.");

  const name = wilayaName(code);
  const enabled = method === "home" ? rate.homeEnabled : rate.deskEnabled;
  const basePrice = method === "home" ? rate.homePrice : rate.deskPrice;
  const label = method === "home" ? "Domicile (Home)" : "Stop Desk (Bureau)";

  if (!enabled || basePrice === null) {
    throw new DeliveryError(
      `${label} delivery is currently unavailable in ${name}. Please choose another method or wilaya.`
    );
  }

  const threshold = typeof freeShippingThreshold === "number" && freeShippingThreshold > 0
    ? freeShippingThreshold
    : null;

  if (threshold !== null && itemsSubtotal >= threshold) {
    return {
      method,
      price: 0,
      freeShippingApplied: true,
      wilayaCode: code,
      wilayaName: name,
      label,
    };
  }

  return {
    method,
    price: basePrice,
    freeShippingApplied: false,
    wilayaCode: code,
    wilayaName: name,
    label,
  };
}

/** Row count is only used by the admin dashboard. */
export async function countDeliveryRates(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(deliveryRates);
  return row?.count ?? 0;
}
