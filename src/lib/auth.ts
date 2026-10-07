import { ensureDatabaseSchema } from "@/db/initialize";
import { cookies } from "next/headers";
import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("zavrune_admin_session")?.value;

  // Reject legacy sessions issued by the old login without password validation.
  // No production rows need to be removed; admins simply sign in again.
  if (!sessionToken || !/^zvr_secure_[a-f0-9]{64}$/.test(sessionToken)) return null;

  await ensureDatabaseSchema();

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
