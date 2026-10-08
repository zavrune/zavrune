import React from "react";
import { db } from "@/db";
import { categories, collections, pageSections, products, storefrontRevisions } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { AdminPage } from "@/components/admin/AdminPage";
import { HomepageBuilder } from "@/components/admin/HomepageBuilder";
import { normalizeSection } from "@/lib/homepage-sections";
import { FEATURED_KEY, NEW_DROP_KEY, getGroupProductIds } from "@/lib/product-groups";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  return (
    <AdminPage next="/mohamedbdr/homepage">
      <HomepageBuilderData />
    </AdminPage>
  );
}

async function HomepageBuilderData() {
  await ensureAdminReady();

  let draft = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.version, "draft"))
    .orderBy(asc(pageSections.displayOrder));

  if (draft.length === 0) {
    draft = await db
      .select()
      .from(pageSections)
      .where(eq(pageSections.version, "published"))
      .orderBy(asc(pageSections.displayOrder));
  }

  // Full product rows: the builder's live preview renders StorefrontSection,
  // which spreads each entry into ProductCard (price, sku, slug, images, ...).
  const productsList = await db
    .select()
    .from(products)
    .orderBy(asc(products.position), desc(products.createdAt))
    .limit(300);

  const categoriesList = await db.select().from(categories).orderBy(asc(categories.displayOrder));
  const collectionsList = await db.select().from(collections).orderBy(asc(collections.displayOrder));
  const [newDropProductIds, featuredProductIds] = await Promise.all([
    getGroupProductIds(NEW_DROP_KEY),
    getGroupProductIds(FEATURED_KEY),
  ]);

  const revisions = await db
    .select({
      id: storefrontRevisions.id,
      revisionName: storefrontRevisions.revisionName,
      createdAt: storefrontRevisions.createdAt,
    })
    .from(storefrontRevisions)
    .orderBy(desc(storefrontRevisions.createdAt))
    .limit(20);

  return (
    <HomepageBuilder
      initialSections={draft.map(normalizeSection)}
      initialRevisions={revisions.map((revision) => ({
        id: revision.id,
        revisionName: revision.revisionName,
        createdAt: new Date(revision.createdAt).toISOString(),
      }))}
      productsList={productsList.map((product) => ({
        id: product.id,
        slug: product.slug,
        nameEn: product.nameEn,
        nameAr: product.nameAr ?? undefined,
        nameFr: product.nameFr ?? undefined,
        sku: product.sku,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        badge: product.badge ?? undefined,
        categoryId: product.categoryId,
        collectionId: product.collectionId,
        featured: product.featured,
        createdAt: new Date(product.createdAt).toISOString(),
        images: Array.isArray(product.images)
          ? (product.images as { url: string; alt?: string; color?: string }[])
          : [],
      }))}
      categoriesList={categoriesList.map((category) => ({
        id: category.id,
        slug: category.slug,
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        nameFr: category.nameFr,
        imageUrl: category.imageUrl,
      }))}
      collectionsList={collectionsList.map((collection) => ({
        id: collection.id,
        slug: collection.slug,
        titleEn: collection.titleEn,
      }))}
      groupProductIds={{ new_drop: newDropProductIds, featured: featuredProductIds }}
    />
  );
}
