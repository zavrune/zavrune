import { ensureStorefrontReady, storefrontQuery } from "@/db/initialize";
import { db } from "@/db";
import { products, productVariants, categories, sizeGuides, sizeGuideMeasurements, navigation, productOptionTypes, productOptionValues } from "@/db/schema";
import { eq, inArray, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { ProductCard } from "@/components/product/ProductCard";
import { DirectOrderModal } from "@/components/checkout/DirectOrderModal";

export const revalidate = 0;

interface PDPProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: PDPProps) {
  await ensureStorefrontReady();
  const { slug } = await params;

  // 1. Fetch Product
  const [product] = await storefrontQuery(db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1));

  if (!product || product.status === "archived") {
    notFound();
  }

  // 2. Fetch Product Variants
  const variants = await storefrontQuery(db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id)));

  // 2b. Flexible option types + values for this product
  const optionTypeRows = await storefrontQuery(db
    .select()
    .from(productOptionTypes)
    .where(eq(productOptionTypes.productId, product.id)));

  const optionTypeIds = optionTypeRows.map((type) => type.id);
  const optionValueRows = optionTypeIds.length
    ? await storefrontQuery(db.select().from(productOptionValues).where(inArray(productOptionValues.optionTypeId, optionTypeIds)))
    : [];

  const optionTypes = optionTypeRows
    .filter((type) => type.isEnabled)
    .sort((a, b) => a.position - b.position)
    .map((type) => ({
      name: type.name,
      values: optionValueRows
        .filter((value) => value.optionTypeId === type.id && value.isEnabled)
        .sort((a, b) => a.position - b.position)
        .map((value) => ({ value: value.value, colorHex: value.colorHex, imageUrl: value.imageUrl })),
    }))
    .filter((type) => type.values.length > 0);

  // 3. Fetch Category
  let categoryName = "";
  if (product.categoryId) {
    const [cat] = await storefrontQuery(db
      .select()
      .from(categories)
      .where(eq(categories.id, product.categoryId))
      .limit(1));
    categoryName = cat?.nameEn || "";
  }

  // 4. Fetch Size Guide if available
  let sizeGuideData: any = null;
  if (product.sizeGuideId) {
    const [sg] = await storefrontQuery(db
      .select()
      .from(sizeGuides)
      .where(eq(sizeGuides.id, product.sizeGuideId))
      .limit(1));

    if (sg) {
      const measurements = await storefrontQuery(db
        .select()
        .from(sizeGuideMeasurements)
        .where(eq(sizeGuideMeasurements.sizeGuideId, sg.id)));

      sizeGuideData = {
        name: sg.name,
        description: sg.description,
        measurements,
      };
    }
  }

  // 5. Fetch Related Products
  const relatedProducts = await storefrontQuery(db
    .select()
    .from(products)
    .where(ne(products.id, product.id))
    .limit(4));

  // 6. Navigation
  const navItems = await storefrontQuery(db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header")));

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col font-sans antialiased">
      <Header customNav={navItems as any} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
        <ProductDetailView
          product={product as any}
          variants={variants as any}
          optionTypes={optionTypes}
          categoryName={categoryName}
          sizeGuide={sizeGuideData}
        />

        {/* Related Streetwear Items */}
        {relatedProducts.length > 0 && (
          <section className="pt-8 border-t border-white/10 space-y-6">
            <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-white">
              YOU MAY ALSO LIKE
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
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
                  images={p.images as any}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
      <DirectOrderModal />
    </div>
  );
}
