import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_STORE_SETTINGS,
  STORE_SETTINGS_KEY,
  normalizeStoreSettings,
  type StoreSettings,
} from "@/lib/store-settings.shared";

export {
  DEFAULT_STORE_SETTINGS,
  STORE_SETTINGS_KEY,
  asOptionalPrice,
  normalizeStoreSettings,
  publicStoreSettings,
} from "@/lib/store-settings.shared";
export type { SocialLinks, StoreSettings } from "@/lib/store-settings.shared";

export async function getStoreSettings(): Promise<StoreSettings> {
  const [record] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, STORE_SETTINGS_KEY))
    .limit(1);

  if (!record) return DEFAULT_STORE_SETTINGS;
  return normalizeStoreSettings({ ...DEFAULT_STORE_SETTINGS, ...(record.value as object) });
}

export async function saveStoreSettings(input: unknown): Promise<StoreSettings> {
  const next = normalizeStoreSettings(input);

  await db
    .insert(settings)
    .values({ key: STORE_SETTINGS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedAt: new Date() },
    });

  return next;
}

/** Never throws: storefront rendering falls back to defaults on a cold database. */
export async function getStoreSettingsSafe(): Promise<StoreSettings> {
  try {
    return await getStoreSettings();
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}
