import { jsonError, jsonOk, readJsonBody, requireString, withAdmin } from "@/lib/api";
import {
  changeAdminPassword,
  createAdminSession,
  recordAdminAudit,
  requireSameOrigin,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await requireSameOrigin(req);
      const body = await readJsonBody(req);

      const currentPassword = requireString(body.currentPassword, "Current password", 200);
      const newPassword = requireString(body.newPassword, "New password", 200);

      const result = await changeAdminPassword({
        adminId: session.admin.id,
        currentPassword,
        newPassword,
      });

      if (!result.ok) {
        await recordAdminAudit(session.admin, "admin.password.change_failed", {
          detail: { reason: result.error },
          req,
        });
        return jsonError(result.error ?? "Password change failed.", 400);
      }

      // All previous sessions are gone; issue a fresh one for this device only.
      const { token, expiresAt } = await createAdminSession(session.admin.id, req);
      await setSessionCookie(token, expiresAt);
      await recordAdminAudit(session.admin, "admin.password.changed", { req });

      return jsonOk({ message: "Password updated. All other devices were signed out." });
    },
    { context: "Admin password change failed" }
  );
}
