"use client";

import React, { createContext, useContext } from "react";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/lib/store-settings.shared";

const StoreSettingsContext = createContext<StoreSettings>(DEFAULT_STORE_SETTINGS);

/** Store identity/contact/social settings, hydrated server-side from Admin → Store Settings. */
export function StoreSettingsProvider({
  settings,
  children,
}: {
  settings: StoreSettings;
  children: React.ReactNode;
}) {
  return <StoreSettingsContext.Provider value={settings}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings(): StoreSettings {
  return useContext(StoreSettingsContext);
}
