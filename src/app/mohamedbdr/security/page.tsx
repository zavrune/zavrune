import React from "react";
import { AdminPage } from "@/components/admin/AdminPage";
import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { countAdminSessions, requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await requireAdminPage("/mohamedbdr/security");
  const activeSessions = await countAdminSessions(session.admin.id);

  return (
    <AdminPage next="/mohamedbdr/security">
      <SecurityPanel adminEmail={session.admin.email} initialActiveSessions={activeSessions} />
    </AdminPage>
  );
}
