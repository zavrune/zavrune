"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectOrder } from "@/context/DirectOrderContext";
import { formatDZD } from "@/lib/translations";
import { Zap, Eye } from "lucide-react";

export interface ProductCardProps {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string;
  nameFr?: string;
  sku: string;
  price: number; // DZD
  compareAtPrice?: number | null;
  badge?: string | null;
  categoryName?: string;
  images: { url: string; alt?: string; color?: string }[];
  variants?: { id: string; color: string; size: string; stock: number; price?: number }[];
}

export function ProductCard({
  id,
  slug,
  nameEn,
  nameAr,
  nameFr,
  sku,
  price,
  compareAtPrice,
  badge,
  categoryName,
  images = [],
  variants = [],
}: ProductCardProps) {
  const { language, t } = useLanguage();
  const { openDirectOrder } = useDirectOrder();

  const [selectedColor, setSelectedColor] = useState<string>(
    variants[0]?.color || images[0]?.color || "Default"
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    variants[0]?.size || "M"
  );
  const [isHovered, setIsHovered] = useState(false);

  // Filter images by selected color if available
  const colorImages = images.filter(
    (img) => img.color?.toLowerCase() === selectedColor.toLowerCase()
  );

  const primaryImage = colorImages[0]?.url || images[0]?.url || "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80";
  const hoverImage = colorImages[1]?.url || images[1]?.url || primaryImage;

  const getProductName = () => {
    if (language === "ar") return nameAr || nameEn;
    if (language === "fr") return nameFr || nameEn;
    return nameEn;
  };

  // Get available unique colors and sizes
  const uniqueColors = Array.from(new Set(variants.map((v) => v.color)));
  const uniqueSizes = Array.from(new Set(variants.map((v) => v.size)));

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const matchedVariant = variants.find(
      (v) => v.color === selectedColor && v.size === selectedSize
    );

    openDirectOrder({
      productId: id,
      variantId: matchedVariant?.id,
      nameEn,
      nameAr: nameAr || nameEn,
      nameFr: nameFr || nameEn,
      sku,
      price: matchedVariant?.price || price,
      color: selectedColor,
      size: selectedSize,
      quantity: 1,
      imageUrl: primaryImage,
      availableStock: matchedVariant?.stock || 20,
    });
  };

  return (
    <div
      className="group relative bg-[#101014] border border-white/10 hover:border-white/30 transition-all flex flex-col justify-between overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge Overlay */}
      {badge && (
        <div className="absolute top-2.5 left-2.5 z-20 bg-white text-black font-mono text-[10px] font-black px-2 py-0.5 tracking-wider uppercase shadow-md">
          {badge}
        </div>
      )}

      {/* Image Gallery Container */}
      <a href={`/p/${slug}`} className="block relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
        <img
          src={isHovered ? hoverImage : primaryImage}
          alt={getProductName()}
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Quick View Link Icon */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="p-2.5 bg-black/80 border border-white/30 text-white rounded-full">
            <Eye className="w-5 h-5" />
          </span>
        </div>
      </a>

      {/* Product Information */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {categoryName && (
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">
              {categoryName}
            </span>
          )}

          <a href={`/p/${slug}`} className="block">
            <h3 className="text-sm font-bold text-white tracking-tight uppercase line-clamp-1 group-hover:text-zinc-300 transition-colors">
              {getProductName()}
            </h3>
          </a>

          {/* Color & Size Swatches */}
          {uniqueColors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {uniqueColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono border uppercase transition-all ${
                    selectedColor === color
                      ? "bg-white text-black border-white font-bold"
                      : "bg-black/50 text-zinc-400 border-white/20 hover:border-white/40"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          )}

          {uniqueSizes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {uniqueSizes.slice(0, 5).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`w-6 h-5 flex items-center justify-center text-[9px] font-mono border uppercase transition-all ${
                    selectedSize === size
                      ? "bg-white text-black border-white font-bold"
                      : "bg-black/30 text-zinc-400 border-white/10 hover:border-white/30"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Direct BUY NOW CTA */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-sm sm:text-base font-extrabold text-white">
              {formatDZD(price)}
            </span>
            {compareAtPrice && compareAtPrice > price && (
              <span className="text-xs text-zinc-500 line-through">
                {formatDZD(compareAtPrice)}
              </span>
            )}
          </div>

          {/* DIRECT BUY NOW BUTTON (NO CART AT ALL) */}
          <button
            onClick={handleBuyNow}
            className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black font-mono font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98]"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            <span>{t("buyNow")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
