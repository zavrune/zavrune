import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AdminApiError,
  SESSION_COOKIE,
  clearSessionCookie,
  destroySession,
  getAdminSession,
  recordAdminAudit,
  requireSameOrigin,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getAdminSession();

  // Delete the server-side row first: logout must be effective even if the
  // browser ignores the expiry cookie.
  await destroySession(rawToken);
  await clearSessionCookie();

  if (session) {
    await recordAdminAudit({ id: session.admin.id, email: session.admin.email }, "admin.logout", { req });
  }

  return NextResponse.json({ success: true });
}
