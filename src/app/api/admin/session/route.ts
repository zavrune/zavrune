import { jsonOk, withAdmin } from "@/lib/api";
import { countAdminSessions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      const activeSessions = await countAdminSessions(session.admin.id);
      return jsonOk({
        admin: { email: session.admin.email, name: session.admin.name, role: session.admin.role },
        session: {
          id: session.sessionId,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        },
        activeSessions,
      });
    },
    { context: "admin session lookup failed" }
  );
}
