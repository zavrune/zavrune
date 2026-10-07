import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  return (
    <AdminPage next="/mohamedbdr/media">
      <MediaLibrary />
    </AdminPage>
  );
}
