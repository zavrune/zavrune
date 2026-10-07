import React from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth";

/**
 * Server-side gate for every admin screen. The session is verified before any
 * child (and therefore any database query) runs, so anonymous visitors never
 * receive admin data.
 */
export async function AdminPage({ children, next }: { children: React.ReactNode; next: string }) {
  const session = await requireAdminPage(next);
  return <AdminShell adminName={session.admin.name}>{children}</AdminShell>;
}
