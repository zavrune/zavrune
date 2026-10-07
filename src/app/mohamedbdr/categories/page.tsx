import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  return (
    <AdminPage next="/mohamedbdr/categories">
      <CategoriesManager />
    </AdminPage>
  );
}
