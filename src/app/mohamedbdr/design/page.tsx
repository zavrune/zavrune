import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { DesignSystemForm } from "@/components/admin/DesignSystemForm";

export const dynamic = "force-dynamic";

export default async function AdminDesignPage() {
  return (
    <AdminPage next="/mohamedbdr/design">
      <DesignSystemForm />
    </AdminPage>
  );
}
