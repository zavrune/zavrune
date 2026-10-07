import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { HealthScanner } from "@/components/admin/HealthScanner";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  return (
    <AdminPage next="/mohamedbdr/health">
      <HealthScanner />
    </AdminPage>
  );
}
