"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useStoreSettings } from "@/context/StoreSettingsContext";
import { ShieldCheck, Truck, RotateCcw, Lock } from "lucide-react";

export function Footer({ customConfig }: { customConfig?: any }) {
  const { language, t, dir } = useLanguage();
  const settings = useStoreSettings();
  const socials = settings.socials;

  const brandName = customConfig?.brandName || settings.storeName;
  const tagline = customConfig?.taglineEn || settings.tagline || "PREMIUM URBAN STREETWEAR ARCHITECTURE";
  const copyrightText =
    customConfig?.copyrightTextEn || `© 2026 ${settings.storeName}. All Rights Reserved. Algerian Dinar (${settings.currency})`;

  return (
    <footer className="bg-[#050507] border-t border-white/10 text-zinc-300 font-mono py-12 px-4 sm:px-6 mt-auto" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Value Proposition Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-8 border-b border-white/10 text-xs">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <strong className="block text-white uppercase font-bold">58 Wilayas Express</strong>
              <span className="text-zinc-500 text-[11px]">Direct Cash on Delivery</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <strong className="block text-white uppercase font-bold">500 GSM Heavyweight</strong>
              <span className="text-zinc-500 text-[11px]">Uncompromised Quality</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <strong className="block text-white uppercase font-bold">Size Exchange Guaranteed</strong>
              <span className="text-zinc-500 text-[11px]">Easy phone confirmation</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <strong className="block text-white uppercase font-bold">Currency: DZD (دج)</strong>
              <span className="text-zinc-500 text-[11px]">Official Algerian Dinar</span>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <span className="text-2xl font-black tracking-widest text-white uppercase">
              {brandName}
            </span>
            <p className="text-xs text-zinc-500 leading-relaxed uppercase">
              {tagline}
            </p>
          </div>

          {/* Quick Categories */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Categories
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><a href="/shop?category=hoodies" className="hover:text-white transition-colors">Hoodies & Sweats</a></li>
              <li><a href="/shop?category=t-shirts" className="hover:text-white transition-colors">Heavyweight T-Shirts</a></li>
              <li><a href="/shop?category=sweatpants" className="hover:text-white transition-colors">Tactical Cargos & Sweatpants</a></li>
              <li><a href="/shop?category=jackets" className="hover:text-white transition-colors">Jackets & Outerwear</a></li>
              <li><a href="/shop?category=sneakers" className="hover:text-white transition-colors">Sneakers & Accessories</a></li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Customer Support
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li><Link href="/pages/size-guide" className="hover:text-white transition-colors">Size Guide & Fit</Link></li>
              <li><Link href="/pages/shipping" className="hover:text-white transition-colors">Shipping & Wilayas Rates</Link></li>
              <li><Link href="/pages/contact" className="hover:text-white transition-colors">Direct Contact & WhatsApp</Link></li>
              <li><Link href="/pages/faq" className="hover:text-white transition-colors">Frequently Asked Questions</Link></li>
            </ul>
          </div>

          {/* Contact & social */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Contact
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              {settings.contactPhone && (
                <li>
                  <a href={`tel:${settings.contactPhone}`} className="hover:text-white transition-colors">
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-white transition-colors">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.contactAddress && <li>{settings.contactAddress}</li>}
            </ul>

            {(socials.instagram ||
              socials.tiktok ||
              socials.facebook ||
              socials.youtube ||
              socials.x ||
              socials.whatsapp) && (
              <div className="flex flex-wrap gap-3 mt-4 text-[11px] uppercase">
                {socials.instagram && (
                  <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Instagram
                  </a>
                )}
                {socials.tiktok && (
                  <a href={socials.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    TikTok
                  </a>
                )}
                {socials.facebook && (
                  <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Facebook
                  </a>
                )}
                {socials.youtube && (
                  <a href={socials.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    YouTube
                  </a>
                )}
                {socials.x && (
                  <a href={socials.x} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    X
                  </a>
                )}
                {socials.whatsapp && (
                  <a href={socials.whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-4">
          <p>{copyrightText}</p>
          <div className="flex gap-4">
            <span>Algeria Wide Delivery</span>
            <span>•</span>
            <span>DZD Currency</span>
            <span>•</span>
            <span>No Cart Direct Checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
