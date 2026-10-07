import { db } from "@/db";
import { ensureStorefrontReady, storefrontQuery } from "@/db/initialize";
import { pageSections, products, categories, navigation } from "@/db/schema";
import { resolveSectionProducts } from "@/lib/product-groups";
import { eq, asc, and, isNull } from "drizzle-orm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StorefrontSection } from "@/components/sections/StorefrontSection";
import { DirectOrderModal } from "@/components/checkout/DirectOrderModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  // This route must not issue a storefront query until the additive schema is ready.
  await ensureStorefrontReady();

  // Fetch published sections for homepage
  const sections = await storefrontQuery(db
    .select()
    .from(pageSections)
    .where(and(isNull(pageSections.pageId), eq(pageSections.version, "published")))
    .orderBy(asc(pageSections.displayOrder)));

  // Fetch products and categories for sections
  const productsList = await storefrontQuery(db
    .select()
    .from(products)
    .where(eq(products.status, "published"))
    .orderBy(asc(products.createdAt)));

  const categoriesList = await storefrontQuery(db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.displayOrder)));

  // Fetch header navigation
  const navItems = await storefrontQuery(db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header")));

  // Filter visible sections
  const activeSections = sections.filter((s) => s.isVisible);

  // Each section independently chooses its products (auto, manual, New Drop,
  // Featured, newest...). Resolution happens on the server per section.
  const resolvedSections = await Promise.all(
    activeSections.map(async (section) => ({
      section,
      products: await resolveSectionProducts(
        (section.config ?? {}) as any,
        productsList,
        Number((section.config as any)?.limit) || 8
      ),
    }))
  );

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 font-sans flex flex-col antialiased">
      <Header customNav={navItems as any} />

      <main className="flex-1 w-full">
        {activeSections.length > 0 ? (
          resolvedSections.map(({ section, products: sectionProducts }) => (
            <StorefrontSection
              key={section.id}
              sectionType={section.sectionType}
              config={section.config}
              productsList={sectionProducts}
              categoriesList={categoriesList}
            />
          ))
        ) : (
          <div className="py-24 text-center space-y-4">
            <h1 className="text-3xl font-black font-mono uppercase">ZAVRUNE STOREFRONT</h1>
            <p className="text-zinc-400 font-mono text-sm">
              Use Admin → Storefront Builder to add your custom layout sections.
            </p>
          </div>
        )}
      </main>

      <Footer />
      <DirectOrderModal />
    </div>
  );
}
