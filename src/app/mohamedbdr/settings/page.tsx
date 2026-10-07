import React from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { AdminPage } from "@/components/admin/AdminPage";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { DEFAULT_STORE_SETTINGS, STORE_SETTINGS_KEY, normalizeStoreSettings } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

export default async function AdminStoreSettingsPage() {
  return (
    <AdminPage next="/mohamedbdr/settings">
      <StoreSettingsData />
    </AdminPage>
  );
}

async function StoreSettingsData() {
  await ensureAdminReady();
  const [record] = await db.select().from(settings).where(eq(settings.key, STORE_SETTINGS_KEY)).limit(1);
  const value = record
    ? normalizeStoreSettings({ ...DEFAULT_STORE_SETTINGS, ...(record.value as Record<string, unknown>) })
    : DEFAULT_STORE_SETTINGS;

  return <StoreSettingsForm initial={value} />;
}
