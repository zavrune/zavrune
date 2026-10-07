import { ShopSortSelect } from "@/components/shop/ShopSortSelect";
import { ensureStorefrontReady, storefrontQuery } from "@/db/initialize";
import { db } from "@/db";
import { products, categories, collections, productVariants, navigation } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/product/ProductCard";
import { DirectOrderModal } from "@/components/checkout/DirectOrderModal";
import { SlidersHorizontal, X } from "lucide-react";

export const revalidate = 0;

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    collection?: string;
    search?: string;
    sort?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  await ensureStorefrontReady();
  const params = await searchParams;
  const selectedCategorySlug = params.category || "";
  const selectedCollectionSlug = params.collection || "";
  const searchQuery = params.search || "";
  const sortOption = params.sort || "newest";

  // Fetch Categories & Collections for filter sidebar/pills
  const allCategories = await storefrontQuery(db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.displayOrder)));

  const allCollections = await storefrontQuery(db
    .select()
    .from(collections)
    .where(eq(collections.isActive, true))
    .orderBy(asc(collections.displayOrder)));

  // Fetch Nav
  const navItems = await storefrontQuery(db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header")));

  // Fetch Products & Variants
  const rawProducts = await storefrontQuery(db
    .select()
    .from(products)
    .where(eq(products.status, "published"))
    .orderBy(sortOption === "price_asc" ? asc(products.price) : sortOption === "price_desc" ? desc(products.price) : desc(products.createdAt)));

  const allVariants = await storefrontQuery(db.select().from(productVariants));

  // Map variants to products
  let filteredProducts = rawProducts.map((p) => {
    const pVariants = allVariants.filter((v) => v.productId === p.id);
    const matchedCategory = allCategories.find((c) => c.id === p.categoryId);
    const matchedCollection = allCollections.find((c) => c.id === p.collectionId);

    return {
      ...p,
      categorySlug: matchedCategory?.slug || "",
      categoryName: matchedCategory?.nameEn || "",
      collectionSlug: matchedCollection?.slug || "",
      variants: pVariants.map((v) => ({
        id: v.id,
        color: v.color,
        size: v.size,
        stock: v.stock,
        price: v.price || p.price,
      })),
    };
  });

  // Apply filters
  if (selectedCategorySlug) {
    filteredProducts = filteredProducts.filter((p) => p.categorySlug === selectedCategorySlug);
  }

  if (selectedCollectionSlug) {
    filteredProducts = filteredProducts.filter((p) => p.collectionSlug === selectedCollectionSlug);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (p) =>
        p.nameEn.toLowerCase().includes(q) ||
        p.descriptionEn?.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
      <Header customNav={navItems as any} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Banner Header */}
        <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block mb-1">
              ZAVRUNE CATALOGUE
            </span>
            <h1 className="text-3xl sm:text-5xl font-black font-mono uppercase text-white tracking-tight">
              {selectedCategorySlug
                ? allCategories.find((c) => c.slug === selectedCategorySlug)?.nameEn
                : selectedCollectionSlug
                ? allCollections.find((c) => c.slug === selectedCollectionSlug)?.titleEn
                : "STREETWEAR COLLECTION"}
            </h1>
          </div>

          <div className="font-mono text-xs text-zinc-400">
            Showing <strong className="text-white">{filteredProducts.length}</strong> streetwear items
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono text-xs uppercase">
          <a
            href="/shop"
            className={`px-4 py-2 border whitespace-nowrap transition-all ${
              !selectedCategorySlug
                ? "bg-white text-black border-white font-bold"
                : "bg-[#121215] text-zinc-400 border-white/10 hover:border-white/30"
            }`}
          >
            All Items
          </a>

          {allCategories.map((cat) => (
            <a
              key={cat.id}
              href={`/shop?category=${cat.slug}${selectedCollectionSlug ? `&collection=${selectedCollectionSlug}` : ""}`}
              className={`px-4 py-2 border whitespace-nowrap transition-all ${
                selectedCategorySlug === cat.slug
                  ? "bg-white text-black border-white font-bold"
                  : "bg-[#121215] text-zinc-400 border-white/10 hover:border-white/30"
              }`}
            >
              {cat.nameEn}
            </a>
          ))}
        </div>

        {/* Active Filters Bar & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101014] border border-white/10 p-3 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter:
            </span>

            {selectedCategorySlug && (
              <a
                href={`/shop?${selectedCollectionSlug ? `collection=${selectedCollectionSlug}` : ""}`}
                className="inline-flex items-center gap-1 bg-zinc-800 text-white px-2 py-1 border border-white/20 hover:bg-zinc-700"
              >
                <span>Cat: {selectedCategorySlug}</span>
                <X className="w-3 h-3" />
              </a>
            )}

            {selectedCollectionSlug && (
              <a
                href={`/shop?${selectedCategorySlug ? `category=${selectedCategorySlug}` : ""}`}
                className="inline-flex items-center gap-1 bg-zinc-800 text-white px-2 py-1 border border-white/20 hover:bg-zinc-700"
              >
                <span>Col: {selectedCollectionSlug}</span>
                <X className="w-3 h-3" />
              </a>
            )}

            {searchQuery && (
              <a
                href="/shop"
                className="inline-flex items-center gap-1 bg-zinc-800 text-white px-2 py-1 border border-white/20 hover:bg-zinc-700"
              >
                <span>Query: &quot;{searchQuery}&quot;</span>
                <X className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 ml-auto">
            <ShopSortSelect sortOption={sortOption} />
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                nameEn={p.nameEn}
                nameAr={p.nameAr}
                nameFr={p.nameFr}
                sku={p.sku}
                price={p.price}
                compareAtPrice={p.compareAtPrice}
                badge={p.badge}
                categoryName={p.categoryName}
                images={p.images as any}
                variants={p.variants}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-4 bg-[#101014] border border-white/10 p-8">
            <h3 className="text-xl font-bold font-mono text-zinc-300 uppercase">
              NO PRODUCTS FOUND
            </h3>
            <p className="text-xs font-mono text-zinc-500">
              Try clearing your active filters or searching for something else.
            </p>
            <a
              href="/shop"
              className="inline-block px-6 py-2.5 bg-white text-black font-mono font-extrabold text-xs uppercase"
            >
              CLEAR FILTERS
            </a>
          </div>
        )}
      </main>

      <Footer />
      <DirectOrderModal />
    </div>
  );
}
