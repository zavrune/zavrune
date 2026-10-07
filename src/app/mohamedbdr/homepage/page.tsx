import React from "react";
import { db } from "@/db";
import { categories, pageSections, products, storefrontRevisions } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { AdminPage } from "@/components/admin/AdminPage";
import { HomepageBuilder, normalizeSection } from "@/components/admin/HomepageBuilder";

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

  const productsList = await db
    .select({ id: products.id, nameEn: products.nameEn, images: products.images })
    .from(products)
    .orderBy(asc(products.position), desc(products.createdAt))
    .limit(300);

  const categoriesList = await db.select().from(categories).orderBy(asc(categories.displayOrder));

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
        nameEn: product.nameEn,
        images: Array.isArray(product.images) ? (product.images as { url: string }[]) : [],
      }))}
      categoriesList={categoriesList}
    />
  );
}
