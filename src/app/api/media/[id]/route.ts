import { db } from "@/db";
import { mediaObjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDatabaseSchema } from "@/db/initialize";

export const runtime = "nodejs";

// Uploaded media is public storefront content. Only immutable bytes are served;
// no admin session or private data is reachable through this route.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await ensureDatabaseSchema();
    const [object] = await db.select().from(mediaObjects).where(eq(mediaObjects.id, id)).limit(1);
    if (!object) return new Response("Not found", { status: 404 });

    const bytes = object.bytes as unknown as Buffer;
    const body = new Uint8Array(bytes);

    return new Response(body, {
      headers: {
        "Content-Type": object.mimeType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${object.filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
