import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { GroupManager } from "@/components/admin/GroupManager";

export const dynamic = "force-dynamic";

export default async function AdminNewDropPage() {
  return (
    <AdminPage next="/mohamedbdr/drops">
      <GroupManager groupKey="new_drop" heading="New Drop" eyebrow="MANAGED DROP" />
    </AdminPage>
  );
}
