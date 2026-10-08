import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { SizeGuidesManager } from "@/components/admin/SizeGuidesManager";

export const dynamic = "force-dynamic";

export default async function AdminSizeGuidesPage() {
  return (
    <AdminPage next="/mohamedbdr/size-guides">
      <SizeGuidesManager />
    </AdminPage>
  );
}
