import { cookies } from "next/headers";
import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq, gt } from "drizzle-orm";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("zavrune_admin_session")?.value;

  if (!sessionToken) return null;

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(
      eq(adminSessions.token, sessionToken)
    )
    .limit(1);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.id, session.adminId))
    .limit(1);

  return admin || null;
}
