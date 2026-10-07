import { db } from "@/db";
import { media, mediaObjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, optionalString, readJsonBody, sanitizeMediaUrl, toNonNegativeInteger, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const [existing] = await db.select().from(media).where(eq(media.id, id)).limit(1);
      if (!existing) return jsonError("Media item not found.", 404);

      const updates: Record<string, unknown> = {};
      if (body.altText !== undefined) updates.altText = optionalString(body.altText, 200);
      if (body.folder !== undefined) updates.folder = optionalString(body.folder, 40) ?? existing.folder;
      if (body.filename !== undefined) updates.filename = optionalString(body.filename, 200) ?? existing.filename;
      if (body.position !== undefined) updates.position = toNonNegativeInteger(body.position, existing.position);
      if (body.url !== undefined && existing.source === "url") {
        const url = sanitizeMediaUrl(body.url);
        if (url) updates.url = url;
      }

      const [updated] = await db.update(media).set(updates).where(eq(media.id, id)).returning();
      await recordAdminAudit(session.admin, "admin.media.updated", { target: id, req });
      return jsonOk({ media: updated });
    },
    { context: "admin/media update failed" }
  );
}

/** Deletes the library entry and the stored bytes it owns. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;

      const [existing] = await db.select().from(media).where(eq(media.id, id)).limit(1);
      if (!existing) return jsonError("Media item not found.", 404);

      await db.delete(media).where(eq(media.id, id));
      if (existing.objectId) {
        await db.delete(mediaObjects).where(eq(mediaObjects.id, existing.objectId));
      }

      await recordAdminAudit(session.admin, "admin.media.deleted", { target: id, detail: { filename: existing.filename }, req });
      return jsonOk({ deleted: id });
    },
    { context: "admin/media delete failed" }
  );
}
