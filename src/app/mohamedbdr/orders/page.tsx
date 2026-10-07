import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { OrdersManager } from "@/components/admin/OrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminPage next="/mohamedbdr/orders">
      <OrdersManager
        initialOrderId={typeof params?.order === "string" ? params.order : undefined}
        initialStatus={typeof params?.status === "string" ? params.status : undefined}
      />
    </AdminPage>
  );
}
