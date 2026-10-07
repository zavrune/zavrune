"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useStoreSettings } from "@/context/StoreSettingsContext";
import { Search, Globe, Menu, X, ArrowRight } from "lucide-react";

interface NavigationItem {
  id: string;
  labelEn: string;
  labelAr: string;
  labelFr: string;
  url: string;
}

export function Header({ customNav }: { customNav?: NavigationItem[] }) {
  const { language, setLanguage, t, dir } = useLanguage();
  const settings = useStoreSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const defaultNav: NavigationItem[] = [
    { id: "1", labelEn: "HOME", labelAr: "الرئيسية", labelFr: "ACCUEIL", url: "/" },
    { id: "2", labelEn: "NEW DROP", labelAr: "التشكيلة الجديدة", labelFr: "NOUVEAUTÉS", url: "/shop?collection=new-drop" },
    { id: "3", labelEn: "HOODIES", labelAr: "هوديز", labelFr: "SWEATS", url: "/shop?category=hoodies" },
    { id: "4", labelEn: "PANTS & CARGOS", labelAr: "بناطيل", labelFr: "PANTALONS", url: "/shop?category=sweatpants" },
    { id: "5", labelEn: "SHOP ALL", labelAr: "المتجر", labelFr: "BOUTIQUE", url: "/shop" },
  ];

  const navItems = customNav && customNav.length > 0 ? customNav : defaultNav;

  const getNavLabel = (item: NavigationItem) => {
    if (language === "ar") return item.labelAr || item.labelEn;
    if (language === "fr") return item.labelFr || item.labelEn;
    return item.labelEn;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery.trim())}`;
      setSearchOpen(false);
    }
  };

  return (
    <>
      {settings.announcementText && (
        <div className="w-full bg-white text-black text-center font-mono text-[10px] sm:text-xs font-extrabold uppercase tracking-widest py-1.5 px-4">
          {settings.announcementText}
        </div>
      )}

      <header className="sticky top-0 z-40 w-full bg-[#08080A]/95 backdrop-blur-md border-b border-white/10 text-white transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 text-zinc-300 hover:text-white transition-colors"
            aria-label="Open Mobile Navigation"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Store Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.storeName} className="h-8 sm:h-10 w-auto object-contain" />
            ) : (
              <span className="text-2xl sm:text-3xl font-black tracking-widest font-mono text-white group-hover:text-zinc-300 transition-colors uppercase">
                {settings.storeName}
              </span>
            )}
            <span className="hidden sm:inline-block text-[9px] font-mono tracking-wider px-1.5 py-0.5 bg-white text-black font-extrabold uppercase">
              {settings.currency}
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 font-mono text-xs font-bold tracking-widest uppercase">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.url}
                className="text-zinc-300 hover:text-white transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-white hover:after:w-full after:transition-all"
              >
                {getNavLabel(item)}
              </a>
            ))}
          </nav>

          {/* Header Controls (NO CART BUTTON HERE - STRICT RULE) */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors rounded-none"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Language Switcher Selector */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/15 bg-black/60 text-xs font-mono text-zinc-300 hover:text-white hover:border-white/30 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="uppercase font-bold">{language}</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-[#121215] border border-white/20 shadow-2xl z-50 py-1 font-mono text-xs">
                  <button
                    onClick={() => {
                      setLanguage("en");
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/10 ${
                      language === "en" ? "text-white font-bold bg-white/5" : "text-zinc-400"
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => {
                      setLanguage("ar");
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/10 ${
                      language === "ar" ? "text-white font-bold bg-white/5" : "text-zinc-400"
                    }`}
                  >
                    العربية (RTL)
                  </button>
                  <button
                    onClick={() => {
                      setLanguage("fr");
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/10 ${
                      language === "fr" ? "text-white font-bold bg-white/5" : "text-zinc-400"
                    }`}
                  >
                    Français
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inline Search Bar Drawer */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-[#0E0E12] py-3 px-4 animate-fadeIn">
            <form onSubmit={handleSearchSubmit} className="max-w-3xl mx-auto flex items-center gap-2">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-zinc-500 font-mono text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-white text-black font-mono text-xs font-bold hover:bg-zinc-200 transition-colors uppercase shrink-0"
              >
                Search
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex" dir={dir}>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-4/5 max-w-sm bg-[#0A0A0D] border-r border-white/15 h-full p-6 text-white flex flex-col justify-between z-10 animate-slideRight">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <span className="text-2xl font-black font-mono tracking-widest uppercase">
                  ZAVRUNE
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="mt-8 flex flex-col gap-5 font-mono text-sm font-bold uppercase tracking-wider">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between py-2 text-zinc-300 hover:text-white border-b border-white/5"
                  >
                    <span>{getNavLabel(item)}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                  </a>
                ))}
              </nav>
            </div>

            {/* Mobile Footer Language & Admin */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-400 uppercase">Language:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage("en")}
                    className={`px-2 py-1 border ${
                      language === "en" ? "bg-white text-black border-white" : "border-white/20 text-zinc-400"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage("ar")}
                    className={`px-2 py-1 border ${
                      language === "ar" ? "bg-white text-black border-white" : "border-white/20 text-zinc-400"
                    }`}
                  >
                    AR
                  </button>
                  <button
                    onClick={() => setLanguage("fr")}
                    className={`px-2 py-1 border ${
                      language === "fr" ? "bg-white text-black border-white" : "border-white/20 text-zinc-400"
                    }`}
                  >
                    FR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
