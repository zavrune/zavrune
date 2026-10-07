import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { GroupManager } from "@/components/admin/GroupManager";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedPage() {
  return (
    <AdminPage next="/mohamedbdr/featured">
      <GroupManager groupKey="featured" heading="Featured" eyebrow="INDEPENDENT FEATURED COLLECTION" />
    </AdminPage>
  );
}
