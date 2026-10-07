import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import { DirectOrderProvider } from "@/context/DirectOrderContext";
import { StoreMusic } from "@/components/layout/StoreMusic";
import { StoreSettingsProvider } from "@/context/StoreSettingsContext";
import { getStoreSettingsSafe } from "@/lib/store-settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const dynamic = "force-dynamic";

/** Metadata is driven by Admin → Store Settings (logo, favicon, SEO). */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettingsSafe();
  return {
    title: settings.metaTitle || `${settings.storeName} • ${settings.tagline}`,
    description: settings.metaDescription,
    icons: {
      icon: settings.faviconUrl || "/favicon.ico",
    },
    openGraph: {
      title: settings.metaTitle || settings.storeName,
      description: settings.metaDescription,
      ...(settings.logoUrl ? { images: [{ url: settings.logoUrl }] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getStoreSettingsSafe();

  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-[#08080A] text-zinc-100 antialiased min-h-screen selection:bg-white selection:text-black">
        <StoreSettingsProvider settings={settings}>
          <LanguageProvider>
            <ThemeProvider>
              <DirectOrderProvider>
                {children}
                {settings.musicEnabled && settings.musicUrl ? (
                  <StoreMusic url={settings.musicUrl} autoplay={settings.musicAutoplay} />
                ) : null}
              </DirectOrderProvider>
            </ThemeProvider>
          </LanguageProvider>
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
