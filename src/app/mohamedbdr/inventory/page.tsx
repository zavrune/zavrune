import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { InventoryManager } from "@/components/admin/InventoryManager";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ lowStock?: string }> }) {
  const params = await searchParams;
  return (
    <AdminPage next="/mohamedbdr/inventory">
      <InventoryManager initialLowStock={params?.lowStock === "true"} />
    </AdminPage>
  );
}
