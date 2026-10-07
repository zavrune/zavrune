"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { ShieldCheck, Truck, RotateCcw, Lock } from "lucide-react";

export function Footer({ customConfig }: { customConfig?: any }) {
  const { language, t, dir } = useLanguage();

  const brandName = customConfig?.brandName || "ZAVRUNE";
  const tagline = customConfig?.taglineEn || "PREMIUM URBAN STREETWEAR ARCHITECTURE";
  const copyrightText = customConfig?.copyrightTextEn || "© 2026 ZAVRUNE. All Rights Reserved. Algerian Dinar (DZD)";

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
              <li><a href="/pages/size-guide" className="hover:text-white transition-colors">Size Guide & Fit</a></li>
              <li><a href="/pages/shipping" className="hover:text-white transition-colors">Shipping & Wilayas Rates</a></li>
              <li><a href="/pages/contact" className="hover:text-white transition-colors">Direct Contact & WhatsApp</a></li>
              <li><a href="/pages/faq" className="hover:text-white transition-colors">Frequently Asked Questions</a></li>
            </ul>
          </div>

          {/* Admin & Info */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Store Identity
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              ZAVRUNE Algerian Streetwear Architecture. Built for heavy drape and minimal street aesthetics.
            </p>
            <a
              href="/admin"
              className="inline-block px-3 py-1.5 border border-white/20 text-xs font-bold text-zinc-300 hover:text-white hover:border-white transition-colors uppercase"
            >
              Admin Dashboard
            </a>
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
