import { db } from "@/db";
import { ensureStorefrontReady, storefrontQuery } from "@/db/initialize";
import { pageSections, products, categories, collections, navigation } from "@/db/schema";
import {
  FEATURED_KEY,
  NEW_DROP_KEY,
  getGroupProductIds,
  resolveSectionProducts,
  type SectionProductContext,
} from "@/lib/product-groups";
import { stripLegacyGeneratedLabels } from "@/lib/homepage-sections";
import { eq, asc, and, isNull } from "drizzle-orm";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StorefrontSection } from "@/components/sections/StorefrontSection";
import { DirectOrderModal } from "@/components/checkout/DirectOrderModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Desktop/mobile visibility is enforced with breakpoint classes so both flags
 * work independently on the live storefront (not just in the builder preview).
 */
function sectionVisibilityClass(section: { desktopVisible: boolean; mobileVisible: boolean }) {
  if (!section.desktopVisible && !section.mobileVisible) return "hidden";
  if (!section.desktopVisible) return "md:hidden";
  if (!section.mobileVisible) return "hidden md:block";
  return "";
}

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

  // Collections are only used to resolve "products from a collection" sources.
  const collectionsList = await storefrontQuery(db
    .select()
    .from(collections)
    .where(eq(collections.isActive, true))
    .orderBy(asc(collections.displayOrder)));

  // Fetch header navigation
  const navItems = await storefrontQuery(db
    .select()
    .from(navigation)
    .where(eq(navigation.location, "header")));

  // Managed groups are resolved once per request and shared by every section.
  const [newDropProductIds, featuredProductIds] = await storefrontQuery(
    Promise.all([getGroupProductIds(NEW_DROP_KEY), getGroupProductIds(FEATURED_KEY)])
  );

  const productContext: SectionProductContext = {
    categories: categoriesList.map((category) => ({ id: category.id, slug: category.slug })),
    collections: collectionsList.map((collection) => ({ id: collection.id, slug: collection.slug })),
    groupProductIds: { new_drop: newDropProductIds, featured: featuredProductIds },
  };

  // Filter visible sections
  const activeSections = sections.filter((s) => s.isVisible);

  // Each section independently chooses its products (auto, manual, New Drop,
  // Featured, newest...). Resolution happens on the server per section.
  const resolvedSections = await Promise.all(
    activeSections.map(async (section) => ({
      // Legacy rows may still store automatically generated labels as public
      // copy. They are dropped before rendering so they can never reach the
      // markup, the client payload or the customer.
      section: { ...section, config: stripLegacyGeneratedLabels((section.config ?? {}) as Record<string, any>) },
      products: await resolveSectionProducts(
        (section.config ?? {}) as any,
        productsList,
        Number((section.config as any)?.limit) || 8,
        productContext
      ),
    }))
  );

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 font-sans flex flex-col antialiased">
      <Header customNav={navItems as any} />

      <main className="flex-1 w-full">
        {activeSections.length > 0 ? (
          resolvedSections.map(({ section, products: sectionProducts }) => (
            <div key={section.id} data-section-id={section.id} data-section-type={section.sectionType} className={sectionVisibilityClass(section)}>
              <StorefrontSection
                sectionType={section.sectionType}
                config={section.config}
                productsList={sectionProducts}
                categoriesList={categoriesList}
              />
            </div>
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
