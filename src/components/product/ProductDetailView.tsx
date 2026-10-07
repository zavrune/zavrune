"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectOrder } from "@/context/DirectOrderContext";
import { formatDZD } from "@/lib/translations";
import { Zap, ShieldCheck, Truck, RotateCcw, Ruler, Check, AlertCircle } from "lucide-react";

export interface ProductDetailViewProps {
  product: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr?: string;
    nameFr?: string;
    descriptionEn?: string;
    descriptionAr?: string;
    descriptionFr?: string;
    price: number;
    compareAtPrice?: number | null;
    sku: string;
    badge?: string | null;
    images: { url: string; alt?: string; color?: string }[];
  };
  variants: {
    id: string;
    color: string;
    colorHex?: string;
    size: string;
    stock: number;
    price?: number | null;
  }[];
  categoryName?: string;
  sizeGuide?: {
    name: string;
    description?: string;
    measurements: {
      sizeLabel: string;
      chest?: string;
      waist?: string;
      hip?: string;
      length?: string;
      sleeve?: string;
    }[];
  } | null;
}

export function ProductDetailView({
  product,
  variants = [],
  categoryName,
  sizeGuide,
}: ProductDetailViewProps) {
  const { language, t, dir } = useLanguage();
  const { openDirectOrder } = useDirectOrder();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>(
    variants[0]?.color || product.images[0]?.color || "Default"
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    variants[0]?.size || "M"
  );
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Extract unique colors & sizes
  const uniqueColors = Array.from(new Set(variants.map((v) => v.color)));
  const uniqueSizes = Array.from(new Set(variants.map((v) => v.size)));

  // Matched Variant
  const matchedVariant = variants.find(
    (v) => v.color === selectedColor && v.size === selectedSize
  ) || variants[0];

  const currentPrice = matchedVariant?.price || product.price;
  const currentStock = matchedVariant?.stock ?? 10;

  const images = product.images.length > 0 ? product.images : [
    { url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1000&q=80" },
  ];

  const getProductName = () => {
    if (language === "ar") return product.nameAr || product.nameEn;
    if (language === "fr") return product.nameFr || product.nameEn;
    return product.nameEn;
  };

  const getProductDescription = () => {
    if (language === "ar") return product.descriptionAr || product.descriptionEn;
    if (language === "fr") return product.descriptionFr || product.descriptionEn;
    return product.descriptionEn;
  };

  const handleBuyNow = () => {
    openDirectOrder({
      productId: product.id,
      variantId: matchedVariant?.id,
      nameEn: product.nameEn,
      nameAr: product.nameAr || product.nameEn,
      nameFr: product.nameFr || product.nameEn,
      sku: matchedVariant?.id ? matchedVariant.id : product.sku,
      price: currentPrice,
      color: selectedColor,
      size: selectedSize,
      quantity,
      imageUrl: images[activeImageIndex]?.url || images[0]?.url,
      availableStock: currentStock,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" dir={dir}>
      {/* High Resolution Photography Gallery */}
      <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4">
        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto max-h-[550px] shrink-0 scrollbar-none">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-16 h-20 border shrink-0 bg-zinc-900 overflow-hidden transition-all ${
                  activeImageIndex === idx
                    ? "border-white ring-1 ring-white"
                    : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img.url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Main Display Image */}
        <div className="relative flex-1 aspect-[3/4] bg-zinc-900 border border-white/15 overflow-hidden group">
          {product.badge && (
            <span className="absolute top-4 left-4 z-10 px-3 py-1 bg-white text-black font-mono text-xs font-black uppercase tracking-wider">
              {product.badge}
            </span>
          )}

          <img
            src={images[activeImageIndex]?.url || images[0]?.url}
            alt={getProductName()}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Product Details & Direct Purchase Form */}
      <div className="lg:col-span-5 space-y-6 bg-[#0E0E12] border border-white/10 p-6 sm:p-8 font-sans">
        <div>
          {categoryName && (
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block mb-1">
              {categoryName}
            </span>
          )}

          <h1 className="text-2xl sm:text-3xl font-black uppercase text-white font-mono tracking-tight leading-snug">
            {getProductName()}
          </h1>

          <div className="text-xs font-mono text-zinc-500 mt-1">
            SKU: {product.sku}
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-3 pt-2 border-t border-white/10 font-mono">
          <span className="text-2xl sm:text-3xl font-black text-white">
            {formatDZD(currentPrice)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > currentPrice && (
            <span className="text-base text-zinc-500 line-through">
              {formatDZD(product.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {currentStock > 5 ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {t("inStock")} ({currentStock} available)
            </span>
          ) : currentStock > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold bg-amber-950/60 border border-amber-500/30 px-2.5 py-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {t("lowStock")} (Only {currentStock} left!)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-red-400 font-bold bg-red-950/60 border border-red-500/30 px-2.5 py-1">
              {t("outOfStock")}
            </span>
          )}
        </div>

        {/* Color Swatches */}
        {uniqueColors.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-zinc-300 block">
              {t("color")}: <strong className="text-white">{selectedColor}</strong>
            </label>
            <div className="flex flex-wrap gap-2">
              {uniqueColors.map((col) => {
                const colorHex = variants.find((v) => v.color === col)?.colorHex;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    className={`px-3 py-1.5 border text-xs font-mono uppercase transition-all flex items-center gap-2 ${
                      selectedColor === col
                        ? "bg-white text-black border-white font-bold"
                        : "bg-black text-zinc-300 border-white/20 hover:border-white/40"
                    }`}
                  >
                    {colorHex && (
                      <span
                        className="w-3 h-3 rounded-full border border-black/50"
                        style={{ backgroundColor: colorHex }}
                      />
                    )}
                    <span>{col}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size Selection */}
        {uniqueSizes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-zinc-300">
                {t("size")}: <strong className="text-white">{selectedSize}</strong>
              </label>

              {sizeGuide && (
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="text-xs font-mono text-zinc-400 hover:text-white underline flex items-center gap-1"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{t("sizeGuide")}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {uniqueSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`min-w-[42px] h-10 px-3 border text-xs font-mono uppercase font-bold transition-all flex items-center justify-center ${
                    selectedSize === sz
                      ? "bg-white text-black border-white shadow-md"
                      : "bg-black text-zinc-300 border-white/20 hover:border-white/40"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Picker */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase text-zinc-300 block">
            {t("quantity")}
          </label>
          <div className="flex items-center border border-white/20 bg-black w-36">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-2 hover:bg-white/10 text-white font-mono text-sm font-bold"
            >
              -
            </button>
            <span className="flex-1 text-center font-mono text-sm font-bold text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
              className="px-3 py-2 hover:bg-white/10 text-white font-mono text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* DIRECT BUY NOW CTA (STRICT RULE: NO ADD TO CART) */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <button
            onClick={handleBuyNow}
            disabled={currentStock <= 0}
            className="w-full py-4 bg-white text-black hover:bg-zinc-200 font-mono font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] disabled:opacity-50"
          >
            <Zap className="w-5 h-5 fill-black" />
            <span>{t("buyNow")} • {formatDZD(currentPrice * quantity)}</span>
          </button>

          <p className="text-[11px] text-center font-mono text-zinc-400">
            🚚 Fast Express Shipping Across 58 Wilayas • Cash on Delivery
          </p>
        </div>

        {/* Product Description */}
        {getProductDescription() && (
          <div className="pt-4 border-t border-white/10 space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              {t("description")}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              {getProductDescription()}
            </p>
          </div>
        )}
      </div>

      {/* Size Guide Modal Drawer */}
      {sizeGuideOpen && sizeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121215] border border-white/20 max-w-2xl w-full p-6 text-white space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold uppercase">{sizeGuide.name}</h3>
              <button
                onClick={() => setSizeGuideOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {sizeGuide.description && (
              <p className="text-zinc-400">{sizeGuide.description}</p>
            )}

            <div className="overflow-x-auto border border-white/10">
              <table className="w-full text-left">
                <thead className="bg-black text-zinc-300 font-bold border-b border-white/10">
                  <tr>
                    <th className="p-2.5">SIZE</th>
                    {sizeGuide.measurements[0]?.chest && <th className="p-2.5">CHEST</th>}
                    {sizeGuide.measurements[0]?.waist && <th className="p-2.5">WAIST</th>}
                    {sizeGuide.measurements[0]?.length && <th className="p-2.5 font-bold">LENGTH</th>}
                    {sizeGuide.measurements[0]?.sleeve && <th className="p-2.5">SLEEVE</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sizeGuide.measurements.map((m, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-2.5 font-bold text-white">{m.sizeLabel}</td>
                      {m.chest && <td className="p-2.5 text-zinc-300">{m.chest}</td>}
                      {m.waist && <td className="p-2.5 text-zinc-300">{m.waist}</td>}
                      {m.length && <td className="p-2.5 text-zinc-300 font-bold">{m.length}</td>}
                      {m.sleeve && <td className="p-2.5 text-zinc-300">{m.sleeve}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setSizeGuideOpen(false)}
              className="w-full py-2.5 bg-white text-black font-bold uppercase hover:bg-zinc-200"
            >
              CLOSE SIZE GUIDE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
