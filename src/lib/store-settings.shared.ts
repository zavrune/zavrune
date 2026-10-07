/**
 * Client-safe half of the store settings module: types, defaults and normalizers.
 * Anything that touches the database lives in `store-settings.ts` so the
 * storefront client bundle never pulls `pg` in.
 */
export const STORE_SETTINGS_KEY = "store_settings";

export interface SocialLinks {
  instagram: string;
  tiktok: string;
  facebook: string;
  youtube: string;
  x: string;
  whatsapp: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socials: SocialLinks;
  currency: string;
  freeShippingThreshold: number | null;
  orderPrefix: string;
  orderThankYouNote: string;
  codEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryNote: string;
  musicUrl: string;
  musicEnabled: boolean;
  musicAutoplay: boolean;
  announcementText: string;
  metaTitle: string;
  metaDescription: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "ZAVRUNE",
  tagline: "BUILT FOR THE STREETS",
  logoUrl: "",
  faviconUrl: "",
  contactPhone: "",
  contactEmail: "",
  contactAddress: "",
  socials: { instagram: "", tiktok: "", facebook: "", youtube: "", x: "", whatsapp: "" },
  currency: "DZD",
  freeShippingThreshold: null,
  orderPrefix: "ZVR",
  orderThankYouNote: "Thank you for shopping with ZAVRUNE. We will call you shortly to confirm delivery.",
  codEnabled: true,
  deliveryEnabled: true,
  deliveryNote: "Payment on delivery (Cash on Delivery) across all 58 wilayas.",
  musicUrl: "",
  musicEnabled: false,
  musicAutoplay: false,
  announcementText: "",
  metaTitle: "ZAVRUNE • Built For The Streets",
  metaDescription:
    "ZAVRUNE Heavyweight Urban Streetwear Architecture. Algeria Express Delivery across 58 Wilayas. Direct Cash on Delivery.",
};

function asString(value: unknown, fallback: string, maxLength = 600): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, maxLength);
}

function asUrl(value: unknown, fallback = ""): string {
  const raw = asString(value, fallback, 1200);
  if (!raw) return "";
  // Allow site-relative paths and http(s) URLs only: no javascript: payloads.
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    return "";
  }
  return "";
}

export function asOptionalPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.min(Math.round(numeric), 100_000_000);
}

/** Whitelist + coerce: never persist arbitrary client keys into settings. */
export function normalizeStoreSettings(input: unknown): StoreSettings {
  const raw = (input ?? {}) as Record<string, unknown>;
  const socialsRaw = (raw.socials ?? {}) as Record<string, unknown>;

  return {
    storeName: asString(raw.storeName, DEFAULT_STORE_SETTINGS.storeName, 80) || DEFAULT_STORE_SETTINGS.storeName,
    tagline: asString(raw.tagline, DEFAULT_STORE_SETTINGS.tagline, 160),
    logoUrl: asUrl(raw.logoUrl),
    faviconUrl: asUrl(raw.faviconUrl),
    contactPhone: asString(raw.contactPhone, "", 60),
    contactEmail: asString(raw.contactEmail, "", 120),
    contactAddress: asString(raw.contactAddress, "", 240),
    socials: {
      instagram: asUrl(socialsRaw.instagram),
      tiktok: asUrl(socialsRaw.tiktok),
      facebook: asUrl(socialsRaw.facebook),
      youtube: asUrl(socialsRaw.youtube),
      x: asUrl(socialsRaw.x),
      whatsapp: asUrl(socialsRaw.whatsapp),
    },
    currency: asString(raw.currency, DEFAULT_STORE_SETTINGS.currency, 12) || "DZD",
    freeShippingThreshold: asOptionalPrice(raw.freeShippingThreshold),
    orderPrefix: (asString(raw.orderPrefix, "ZVR", 10) || "ZVR").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ZVR",
    orderThankYouNote: asString(raw.orderThankYouNote, DEFAULT_STORE_SETTINGS.orderThankYouNote, 600),
    codEnabled: raw.codEnabled === undefined ? true : Boolean(raw.codEnabled),
    deliveryEnabled: raw.deliveryEnabled === undefined ? true : Boolean(raw.deliveryEnabled),
    deliveryNote: asString(raw.deliveryNote, DEFAULT_STORE_SETTINGS.deliveryNote, 400),
    musicUrl: asUrl(raw.musicUrl),
    musicEnabled: Boolean(raw.musicEnabled),
    musicAutoplay: Boolean(raw.musicAutoplay),
    announcementText: asString(raw.announcementText, "", 300),
    metaTitle: asString(raw.metaTitle, DEFAULT_STORE_SETTINGS.metaTitle, 160),
    metaDescription: asString(raw.metaDescription, DEFAULT_STORE_SETTINGS.metaDescription, 400),
  };
}

/** Storefront-safe projection: no internal-only fields are exposed. */
export function publicStoreSettings(settingsValue: StoreSettings) {
  return {
    storeName: settingsValue.storeName,
    tagline: settingsValue.tagline,
    logoUrl: settingsValue.logoUrl,
    faviconUrl: settingsValue.faviconUrl,
    contactPhone: settingsValue.contactPhone,
    contactEmail: settingsValue.contactEmail,
    contactAddress: settingsValue.contactAddress,
    socials: settingsValue.socials,
    currency: settingsValue.currency,
    freeShippingThreshold: settingsValue.freeShippingThreshold,
    deliveryEnabled: settingsValue.deliveryEnabled,
    codEnabled: settingsValue.codEnabled,
    deliveryNote: settingsValue.deliveryNote,
    musicUrl: settingsValue.musicUrl,
    musicEnabled: settingsValue.musicEnabled,
    musicAutoplay: settingsValue.musicAutoplay,
    announcementText: settingsValue.announcementText,
    metaTitle: settingsValue.metaTitle,
    metaDescription: settingsValue.metaDescription,
  };
}
