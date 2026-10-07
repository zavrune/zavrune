import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeProvider";
import { DirectOrderProvider } from "@/context/DirectOrderContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ZAVRUNE • Built For The Streets",
  description: "ZAVRUNE Heavyweight Urban Streetwear Architecture. Algeria Express Delivery across 58 Wilayas. Direct Cash on Delivery.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-[#08080A] text-zinc-100 antialiased min-h-screen selection:bg-white selection:text-black">
        <LanguageProvider>
          <ThemeProvider>
            <DirectOrderProvider>
              {children}
            </DirectOrderProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
