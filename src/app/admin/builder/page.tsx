import { db } from "@/db";
import { pageSections, products, categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StorefrontBuilder } from "@/components/admin/StorefrontBuilder";

export const revalidate = 0;

export default async function BuilderPage() {
  // Fetch draft sections for builder editing
  let draftSections = await db
    .select()
    .from(pageSections)
    .where(eq(pageSections.version, "draft"))
    .orderBy(asc(pageSections.displayOrder));

  // If no draft sections, fall back to published
  if (draftSections.length === 0) {
    draftSections = await db
      .select()
      .from(pageSections)
      .where(eq(pageSections.version, "published"))
      .orderBy(asc(pageSections.displayOrder));
  }

  const productsList = await db.select().from(products);
  const categoriesList = await db.select().from(categories);

  return (
    <AdminLayout>
      <StorefrontBuilder
        initialSections={draftSections as any}
        productsList={productsList}
        categoriesList={categoriesList}
      />
    </AdminLayout>
  );
}
