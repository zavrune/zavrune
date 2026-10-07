import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";

export default async function AdminProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage next={`/mohamedbdr/products/${id}`}>
      <ProductEditor productId={id} />
    </AdminPage>
  );
}
