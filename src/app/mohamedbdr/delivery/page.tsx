import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { DeliverySettings } from "@/components/admin/DeliverySettings";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  return (
    <AdminPage next="/mohamedbdr/delivery">
      <DeliverySettings />
    </AdminPage>
  );
}
