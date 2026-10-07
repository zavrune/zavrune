import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { CustomersManager } from "@/components/admin/CustomersManager";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  return (
    <AdminPage next="/mohamedbdr/customers">
      <CustomersManager />
    </AdminPage>
  );
}
