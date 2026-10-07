import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { ProductsManager } from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  return (
    <AdminPage next="/mohamedbdr/products">
      <ProductsManager initialSearch={typeof params?.q === "string" ? params.q : ""} />
    </AdminPage>
  );
}
