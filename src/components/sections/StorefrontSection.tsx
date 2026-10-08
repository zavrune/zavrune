"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { ProductCard } from "@/components/product/ProductCard";
import { isLegacyGeneratedLabel } from "@/lib/homepage-sections";
import { ArrowRight, Flame, Sparkles } from "lucide-react";

export interface SectionProps {
  id?: string;
  /**
   * Internal renderer type. The admin-only section name is deliberately NOT a
   * prop: the storefront only ever renders what the section config contains.
   */
  sectionType: string;
  config: any;
  productsList?: any[];
  categoriesList?: any[];
}

/** Fixed Tailwind class names per column count (JIT needs literal classes). */
const MOBILE_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

const DESKTOP_COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2 lg:grid-cols-2",
  3: "sm:grid-cols-3 lg:grid-cols-3",
  4: "sm:grid-cols-3 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

export function StorefrontSection({ sectionType, config = {}, productsList = [], categoriesList = [] }: SectionProps) {
  const { language, t } = useLanguage();

  // Legacy rows may still hold automatically generated labels (built from the
  // internal section type) in their public config: those are hidden so
  // customers never read an internal section name as marketing copy.
  const publicText = (value: unknown) => (isLegacyGeneratedLabel(value) ? "" : value);

  const getLocalizedText = (keyEn: string, keyAr: string, keyFr: string, fallback: string = "") => {
    if (language === "ar" && publicText(config[keyAr])) return config[keyAr];
    if (language === "fr" && publicText(config[keyFr])) return config[keyFr];
    if (publicText(config[keyEn])) return config[keyEn];
    return fallback;
  };

  /** Accepts both fractions (0.55) and percentages (55) for overlay darkness. */
  const overlayValue = (value: unknown, fallback: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) return fallback;
    const fraction = value > 1 ? value / 100 : value;
    return Math.min(1, Math.max(0, fraction));
  };

  switch (sectionType) {
    case "announcement": {
      const text = getLocalizedText(
        "textEn",
        "textAr",
        "textFr",
        "FREE EXPRESS DELIVERY ACROSS ALGERIA FOR ORDERS OVER 15,000 DZD"
      );
      const link = typeof config.linkUrl === "string" ? config.linkUrl.trim() : "";
      return (
        <div
          className="w-full py-2.5 px-4 text-center text-xs font-mono font-bold uppercase tracking-wider overflow-hidden border-b border-white/10"
          style={{
            backgroundColor: config.bgColor || "#000000",
            color: config.textColor || "#FFFFFF",
          }}
        >
          {link ? (
            <a href={link} className="hover:underline">
              {text}
            </a>
          ) : (
            <span>{text}</span>
          )}
        </div>
      );
    }

    case "hero": {
      const badge = getLocalizedText("badgeEn", "badgeAr", "badgeFr", "WINTER '26 DROP");
      const title = getLocalizedText("titleEn", "titleAr", "titleFr", "BUILT FOR THE STREETS");
      const subtitle = getLocalizedText(
        "subtitleEn",
        "subtitleAr",
        "subtitleFr",
        "Heavyweight silhouettes engineered with raw minimalism and uncompromised detail."
      );
      const cta1Text = getLocalizedText("ctaPrimaryTextEn", "ctaPrimaryTextAr", "ctaPrimaryTextFr", "SHOP NEW DROP");
      const cta2Text = getLocalizedText("ctaSecondaryTextEn", "ctaSecondaryTextAr", "ctaSecondaryTextFr", "ALL PRODUCTS");

      const heightClass =
        config.sectionHeight === "small"
          ? "min-h-[400px]"
          : config.sectionHeight === "large"
          ? "min-h-[650px] sm:min-h-[750px]"
          : config.sectionHeight === "full"
          ? "min-h-[85vh]"
          : "min-h-[500px] sm:min-h-[600px]";

      const bgImage = config.bgImageDesktop || "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=85";
      const mobileBgImage = config.bgImageMobile || bgImage;
      const overlayOpacity = overlayValue(config.overlayOpacity, 0.55);

      const alignment: string =
        config.textAlignment === "left" ? "text-left" : config.textAlignment === "right" ? "text-right" : "text-center";
      const justifyClass =
        config.textAlignment === "left" ? "justify-start" : config.textAlignment === "right" ? "justify-end" : "justify-center";

      const videoUrl = typeof config.videoUrl === "string" ? config.videoUrl.trim() : "";
      const videoEmbed = videoUrl ? toVideoEmbedUrl(videoUrl) : null;

      return (
        <div className={`relative w-full ${heightClass} flex items-center justify-center bg-black overflow-hidden border-b border-white/10`}>
          {/* Background media: a dedicated mobile image keeps small screens light. */}
          <div
            className="absolute inset-0 hidden md:block bg-cover bg-center transition-transform duration-1000"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div
            className="absolute inset-0 md:hidden bg-cover bg-center transition-transform duration-1000"
            style={{ backgroundImage: `url(${mobileBgImage})` }}
          />

          {videoEmbed ? (
            <iframe
              src={videoEmbed}
              title={title}
              className="absolute inset-0 w-full h-full pointer-events-none"
              allow="autoplay; encrypted-media; picture-in-picture"
            />
          ) : videoUrl ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : null}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />

          {/* Hero Content */}
          <div className={`relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-white space-y-6 w-full ${alignment}`}>
            {badge && (
              <span className="inline-block px-3 py-1 bg-white text-black font-mono text-xs font-black tracking-widest uppercase">
                {badge}
              </span>
            )}

            <h1 className="text-3xl sm:text-6xl md:text-7xl font-black tracking-tight uppercase font-mono leading-none">
              {title}
            </h1>

            {subtitle && (
              <p className="text-sm sm:text-lg text-zinc-300 max-w-2xl mx-auto font-mono leading-relaxed">
                {subtitle}
              </p>
            )}

            <div className={`flex flex-col sm:flex-row items-center gap-4 pt-4 ${justifyClass}`}>
              {cta1Text && (
                <a
                  href={config.ctaPrimaryUrl || "/shop"}
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-black font-mono font-extrabold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <span>{cta1Text}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}

              {cta2Text && (
                <a
                  href={config.ctaSecondaryUrl || "/shop"}
                  className="w-full sm:w-auto px-8 py-3.5 bg-black/60 border border-white/30 text-white font-mono font-bold text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                >
                  {cta2Text}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    case "marquee": {
      const items: string[] = Array.isArray(config.items) && config.items.length > 0
        ? config.items
        : [
            "ZAVRUNE",
            "HEAVYWEIGHT FABRICS",
            "ALGERIA WIDE SHIPPING",
            "LIMITED DROPS",
            "PREMIUM STREETWEAR",
          ];
      const duration = config.speed === "slow" ? "45s" : config.speed === "fast" ? "12s" : "25s";
      const direction = config.direction === "right" ? "reverse" : "normal";
      return (
        <div
          className="w-full border-y border-white/10 py-3 overflow-hidden font-mono text-xs font-black uppercase tracking-widest"
          style={{
            backgroundColor: config.bgColor || "#121215",
            color: config.textColor || "#FFFFFF",
          }}
        >
          <div
            className="flex gap-8 whitespace-nowrap animate-marquee"
            style={{ animationDuration: duration, animationDirection: direction }}
          >
            {[...items, ...items, ...items, ...items].map((item, idx) => (
              <div key={idx} className="flex items-center gap-6">
                <span>{item}</span>
                <span className="text-zinc-600">•</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "featured_collection":
    case "product_grid":
    case "new_arrivals":
    case "best_sellers": {
      const title = getLocalizedText("titleEn", "titleAr", "titleFr", "FEATURED DROP");
      const subtitle = getLocalizedText("subtitleEn", "subtitleAr", "subtitleFr", "Strictly limited quantities.");
      const limit = config.limit || 6;
      const displayProducts = productsList.slice(0, limit);
      const ctaLabel = getLocalizedText("ctaTextEn", "ctaTextAr", "ctaTextFr", t("allCategories"));
      const ctaUrl = config.ctaUrl || "/shop";

      return (
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-white" />
                <h2 className="text-xl sm:text-3xl font-black uppercase font-mono tracking-tight text-white">
                  {title}
                </h2>
              </div>
              {subtitle && (
                <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
                  {subtitle}
                </p>
              )}
            </div>

            <a
              href={ctaUrl}
              className="text-xs font-mono font-bold text-white hover:text-zinc-400 transition-colors uppercase tracking-widest flex items-center gap-1 shrink-0"
            >
              <span>{ctaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {displayProducts.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        </section>
      );
    }

    case "category_showcase": {
      const title = getLocalizedText("titleEn", "titleAr", "titleFr", "BROWSE CATEGORIES");
      const subtitle = getLocalizedText("subtitleEn", "subtitleAr", "subtitleFr", "");
      const columnsDesktop = DESKTOP_COLUMNS[Number(config.columnsDesktop)] ?? DESKTOP_COLUMNS[6];
      const columnsMobile = MOBILE_COLUMNS[Number(config.columnsMobile)] ?? MOBILE_COLUMNS[2];
      const wanted: string[] = Array.isArray(config.categoriesToShow) ? config.categoriesToShow.filter(Boolean) : [];

      const available = categoriesList.length > 0 ? categoriesList : [
        { slug: "hoodies", nameEn: "Hoodies", imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80" },
        { slug: "t-shirts", nameEn: "T-Shirts", imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80" },
        { slug: "sweatpants", nameEn: "Sweatpants", imageUrl: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80" },
        { slug: "jackets", nameEn: "Jackets", imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80" },
        { slug: "sneakers", nameEn: "Sneakers", imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80" },
        { slug: "accessories", nameEn: "Accessories", imageUrl: "https://images.unsplash.com/photo-1611591475777-233ca70be7df?w=800&q=80" },
      ];

      // The admin's selection and order wins; no selection means every category.
      const cats = wanted.length > 0
        ? wanted
            .map((slug) => available.find((category: any) => category.slug === slug))
            .filter(Boolean)
        : available;

      const ctaLabel = getLocalizedText("ctaTextEn", "ctaTextAr", "ctaTextFr", "");

      return (
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-xl sm:text-3xl font-black uppercase font-mono tracking-tight text-white">
              {title}
            </h2>
            {subtitle && <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">{subtitle}</p>}
          </div>

          <div className={`grid ${columnsMobile} ${columnsDesktop} gap-3 sm:gap-4`}>
            {cats.map((cat: any) => {
              const catName = language === "ar" ? cat.nameAr || cat.nameEn : language === "fr" ? cat.nameFr || cat.nameEn : cat.nameEn;
              return (
                <a
                  key={cat.slug}
                  href={`/shop?category=${cat.slug}`}
                  className="group relative aspect-square overflow-hidden bg-zinc-900 border border-white/10 hover:border-white/40 transition-all block"
                >
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={catName}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-70 group-hover:opacity-90"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-3">
                    <span className="text-xs font-mono font-extrabold uppercase text-white tracking-wider group-hover:translate-x-1 transition-transform">
                      {catName}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          {ctaLabel && (
            <div className="flex justify-center">
              <a
                href={config.ctaUrl || "/shop"}
                className="px-8 py-3.5 bg-white text-black font-mono font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
              >
                {ctaLabel}
              </a>
            </div>
          )}
        </section>
      );
    }

    case "drop_announcement": {
      const badge = getLocalizedText("badgeEn", "badgeAr", "badgeFr", "LIMITED EDITION");
      const title = getLocalizedText("titleEn", "titleAr", "titleFr", "HEAVYWEIGHT FLEECE SERIES");
      const description = getLocalizedText(
        "descriptionEn",
        "descriptionAr",
        "descriptionFr",
        "Crafted from custom 500 GSM combed cotton. Built to endure seasons."
      );
      const ctaText = getLocalizedText("ctaTextEn", "ctaTextAr", "ctaTextFr", "EXPLORE DROP");

      return (
        <section className="my-12 sm:my-16 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative bg-[#121216] border border-white/15 overflow-hidden grid grid-cols-1 md:grid-cols-2 items-center">
            <div className="p-8 sm:p-12 space-y-6">
              {badge && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-black font-mono text-xs font-black uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  {badge}
                </span>
              )}

              <h2 className="text-2xl sm:text-4xl font-black font-mono uppercase text-white tracking-tight">
                {title}
              </h2>

              <p className="text-sm text-zinc-300 font-mono leading-relaxed">
                {description}
              </p>

              <a
                href={config.ctaUrl || "/shop"}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-mono font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
              >
                <span>{ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="relative h-64 sm:h-96 md:h-full bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10">
              <img
                src={config.imageUrl || "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80"}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>
      );
    }

    case "brand_story":
    case "manifesto": {
      const badge = getLocalizedText("badgeEn", "badgeAr", "badgeFr", "OUR MANIFESTO");
      const heading = getLocalizedText(
        "headingEn",
        "headingAr",
        "headingFr",
        "NO FICTION. NO FAST FASHION. JUST PURE STREETWEAR ARCHITECTURE."
      );
      const text = getLocalizedText(
        "textEn",
        "textAr",
        "textFr",
        "ZAVRUNE was engineered to dismantle cheap streetwear trends. Every garment features custom heavyweight knits and oversized relaxed proportions."
      );
      const ctaText = getLocalizedText("ctaTextEn", "ctaTextAr", "ctaTextFr", "");

      return (
        <section className="py-16 sm:py-24 bg-[#0A0A0D] border-y border-white/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <span className="text-xs font-mono font-black text-zinc-400 tracking-widest uppercase">
              {badge}
            </span>

            <h2 className="text-2xl sm:text-5xl font-black font-mono uppercase text-white tracking-tight leading-tight">
              {heading}
            </h2>

            <p className="text-sm sm:text-base text-zinc-400 font-mono leading-relaxed max-w-3xl mx-auto">
              {text}
            </p>

            {config.imageUrl && (
              <img
                src={config.imageUrl}
                alt=""
                className="w-full max-w-3xl mx-auto aspect-[16/9] object-cover border border-white/10"
              />
            )}

            {ctaText && (
              <div>
                <a
                  href={config.ctaUrl || "/shop"}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-mono font-extrabold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </section>
      );
    }

    case "newsletter": {
      const title = getLocalizedText("titleEn", "titleAr", "titleFr", "GET ACCESS TO SECRET DROPS");
      const subtitle = getLocalizedText(
        "subtitleEn",
        "subtitleAr",
        "subtitleFr",
        "Enter your phone number or email to receive private drop alerts."
      );
      const buttonText = getLocalizedText("buttonTextEn", "buttonTextAr", "buttonTextFr", "JOIN THE CLUB");

      return (
        <section className="py-12 sm:py-16 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-[#121215] border border-white/15 p-8 sm:p-12 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white uppercase tracking-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono max-w-lg mx-auto">
              {subtitle}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert(language === "ar" ? "شكراً لانضمامك إلى قائمة ZAVRUNE!" : "Thank you for joining ZAVRUNE!");
              }}
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            >
              <input
                type="text"
                required
                placeholder="0550 00 00 00 / email@zavrune.com"
                className="w-full bg-black border border-white/20 px-4 py-3 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-black font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-colors shrink-0"
              >
                {buttonText}
              </button>
            </form>
          </div>
        </section>
      );
    }

    case "spacer":
      return <div style={{ height: `${config.height || 40}px` }} />;

    case "divider":
      return <div className="max-w-7xl mx-auto my-8 border-b border-white/10" />;

    default:
      return null;
  }
}

/** YouTube/Vimeo links become embeds; direct media files are played by <video>. */
function toVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "https://local.invalid");
    if (parsed.hostname.endsWith("youtube.com") || parsed.hostname === "youtu.be") {
      const id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&playlist=${id}`;
      return null;
    }
    if (parsed.hostname.endsWith("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`;
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
