import { clearSessionCookie, listAdminSessions, recordAdminAudit, requireSameOrigin } from "@/lib/auth";
import { revokeAdminSessions } from "@/lib/admin-bootstrap";
import { jsonOk, withAdmin } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      const sessions = await listAdminSessions(session.admin.id);
      return jsonOk({
        sessions: sessions.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          lastSeenAt: entry.lastSeenAt.toISOString(),
          expiresAt: entry.expiresAt.toISOString(),
          isCurrent: entry.id === session.sessionId,
        })),
      });
    },
    { context: "Admin session listing failed" }
  );
}

/** Signs out every other device, or every device including this one. */
export async function DELETE(req: Request) {
  return withAdmin(
    req,
    async (session, url) => {
      await requireSameOrigin(req);
      const mode = url.searchParams.get("mode") === "all" ? "all" : "others";

      if (mode === "all") {
        await revokeAdminSessions(session.admin.id);
        await clearSessionCookie();
      } else {
        await revokeAdminSessions(session.admin.id, session.sessionId);
      }

      await recordAdminAudit(session.admin, `admin.sessions.revoked.${mode}`, { req });

      return jsonOk({
        message:
          mode === "all"
            ? "Signed out of all devices, including this one."
            : "Signed out of all other devices.",
        signedOutSelf: mode === "all",
      });
    },
    { context: "Admin session revocation failed" }
  );
}
