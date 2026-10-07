import { createHash } from "node:crypto";
import { db } from "@/db";
import { media, mediaObjects } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import {
  jsonError,
  jsonOk,
  optionalString,
  parsePagination,
  sanitizeMediaUrl,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES, mediaKind } from "@/lib/media-limits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { page, pageSize, offset, search } = parsePagination(url, { defaultPageSize: 60, maxPageSize: 200 });
      const folder = url.searchParams.get("folder");
      const kind = url.searchParams.get("kind");

      const filters = [];
      if (search) filters.push(or(ilike(media.filename, `%${search}%`), ilike(media.altText, `%${search}%`))!);
      if (folder && folder !== "all") filters.push(eq(media.folder, folder));

      const where = filters.length ? and(...filters) : undefined;

      const [totalRow] = await db.select({ value: count() }).from(media).where(where);
      const rows = await db
        .select()
        .from(media)
        .where(where)
        .orderBy(asc(media.position), desc(media.createdAt))
        .limit(pageSize)
        .offset(offset);

      const filtered = kind
        ? rows.filter((row) => mediaKind(row.fileType) === kind)
        : rows;

      return jsonOk({
        media: filtered,
        total: Number(totalRow?.value ?? 0),
        page,
        pageSize,
        limits: { maxUploadBytes: MAX_UPLOAD_BYTES, images: ALLOWED_IMAGE_TYPES, videos: ALLOWED_VIDEO_TYPES },
      });
    },
    { context: "admin/media request failed" }
  );
}

/**
 * Uploads a file. Bytes are stored in Postgres (media_objects) rather than the
 * Vercel filesystem, which is read-only and ephemeral; the file is then served
 * from /api/media/<id>. Images may also be registered by URL.
 */
export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();

      const contentType = req.headers.get("content-type") ?? "";

      if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        const file = form.get("file");
        const folder = optionalString(form.get("folder"), 40) ?? "general";
        const altText = optionalString(form.get("altText"), 200);

        if (!(file instanceof File)) return jsonError("A file is required.", 400);
        if (file.size === 0) return jsonError("The uploaded file is empty.", 400);
        if (file.size > MAX_UPLOAD_BYTES) {
          return jsonError(`Files must be smaller than ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`, 413);
        }

        const mimeType = (file.type || "application/octet-stream").toLowerCase();
        const allowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
        if (!allowed.includes(mimeType)) {
          return jsonError(`Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WEBP, AVIF, GIF, SVG, MP4, WEBM, MOV.`, 415);
        }

        const arrayBuffer = await file.arrayBuffer();
        const bytes = Buffer.from(arrayBuffer);
        const checksum = createHash("sha256").update(bytes).digest("hex");

        const [object] = await db
          .insert(mediaObjects)
          .values({
            filename: file.name.slice(0, 200) || "upload",
            mimeType,
            fileSize: bytes.byteLength,
            checksum,
            bytes,
          })
          .returning();

        const [record] = await db
          .insert(media)
          .values({
            url: `/api/media/${object.id}`,
            filename: file.name.slice(0, 200) || "upload",
            fileType: mimeType,
            fileSize: bytes.byteLength,
            source: "upload",
            objectId: object.id,
            folder: folder.slice(0, 40),
            altText: altText,
            position: 0,
          })
          .returning();

        await recordAdminAudit(session.admin, "admin.media.uploaded", {
          target: record.id,
          detail: { filename: record.filename, size: bytes.byteLength, mimeType },
          req,
        });

        return jsonOk({ media: record }, 201);
      }

      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      const url = sanitizeMediaUrl(body?.url);
      if (!url) return jsonError("A valid media URL is required.", 400);

      const [record] = await db
        .insert(media)
        .values({
          url,
          filename: optionalString(body?.filename, 200) ?? url.split("/").pop()?.slice(0, 200) ?? "external",
          fileType: optionalString(body?.fileType, 80) ?? "image/jpeg",
          fileSize: 0,
          source: "url",
          folder: optionalString(body?.folder, 40) ?? "general",
          altText: optionalString(body?.altText, 200),
          position: 0,
        })
        .returning();

      await recordAdminAudit(session.admin, "admin.media.linked", { target: record.id, detail: { url }, req });
      return jsonOk({ media: record }, 201);
    },
    { context: "admin/media upload failed" }
  );
}
