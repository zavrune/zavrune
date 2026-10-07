import {
  jsonError,
  jsonOk,
  optionalString,
  readJsonBody,
  toBoolean,
  withAdmin,
} from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { ensureAdminReady } from "@/db/initialize";
import {
  getGroupProductIds,
  getProductGroup,
  setProductGroupItems,
  updateProductGroup,
} from "@/lib/product-groups";
import { db } from "@/db";
import { productGroupItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const ALLOWED_GROUPS = /^[a-z0-9_]{2,40}$/;

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const { key } = await params;
      const group = await getProductGroup(key);
      if (!group) return jsonError("Group not found.", 404);
      return jsonOk({ group: { ...group, productIds: await getGroupProductIds(key) } });
    },
    { context: "admin/group lookup failed" }
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { key } = await params;
      if (!ALLOWED_GROUPS.test(key)) return jsonError("Invalid group key.", 400);

      const body = await readJsonBody(req);
      const updated = await updateProductGroup(key, {
        ...(body.titleEn !== undefined ? { titleEn: optionalString(body.titleEn, 160) } : {}),
        ...(body.titleAr !== undefined ? { titleAr: optionalString(body.titleAr, 160) } : {}),
        ...(body.titleFr !== undefined ? { titleFr: optionalString(body.titleFr, 160) } : {}),
        ...(body.subtitleEn !== undefined ? { subtitleEn: optionalString(body.subtitleEn, 400) } : {}),
        ...(body.subtitleAr !== undefined ? { subtitleAr: optionalString(body.subtitleAr, 400) } : {}),
        ...(body.subtitleFr !== undefined ? { subtitleFr: optionalString(body.subtitleFr, 400) } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: toBoolean(body.isEnabled, true) } : {}),
      });

      await recordAdminAudit(session.admin, `admin.group.updated`, { target: key, req });
      return jsonOk({ group: updated });
    },
    { context: "admin/group update failed" }
  );
}

/** Replaces the ordered product selection for a managed group. */
export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { key } = await params;
      if (!ALLOWED_GROUPS.test(key)) return jsonError("Invalid group key.", 400);

      const body = await readJsonBody(req);
      const productIds = Array.isArray(body.productIds) ? (body.productIds as string[]).filter((id) => typeof id === "string") : [];

      await setProductGroupItems(key, productIds);

      // Sync the legacy `products.featured` flag for the Featured group.
      if (key === "featured") {
        const { products } = await import("@/db/schema");
        await db.update(products).set({ featured: false }).where(eq(products.featured, true));
        if (productIds.length > 0) {
          const { inArray } = await import("drizzle-orm");
          await db.update(products).set({ featured: true }).where(inArray(products.id, productIds));
        }
      }

      await recordAdminAudit(session.admin, "admin.group.items_saved", {
        target: key,
        detail: { count: productIds.length },
        req,
      });

      return jsonOk({ productIds });
    },
    { context: "admin/group items save failed" }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { key } = await params;
      await db.delete(productGroupItems).where(eq(productGroupItems.groupKey, key));
      await recordAdminAudit(session.admin, "admin.group.items_cleared", { target: key, req });
      return jsonOk({ cleared: key });
    },
    { context: "admin/group clear failed" }
  );
}
