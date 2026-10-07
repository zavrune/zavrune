import { db } from "@/db";
import { customers, inventoryEvents, orderEvents, orderItems, orders, productVariants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, optionalString, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/order-statuses";

export const runtime = "nodejs";

async function loadOrder(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, id));
  const customer = order.customerId
    ? (await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1))[0] ?? null
    : null;

  return { order, items, events, customer };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const { id } = await params;
      const detail = await loadOrder(id);
      if (!detail) return jsonError("Order not found.", 404);
      return jsonOk(detail);
    },
    { context: "admin/order lookup failed" }
  );
}

/**
 * Status changes, internal notes, and cancel-with-restock. Every transition is
 * appended to the immutable order event history.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const { id } = await params;
      const body = await readJsonBody(req);

      const detail = await loadOrder(id);
      if (!detail) return jsonError("Order not found.", 404);
      const { order, items } = detail;

      const nextStatus = typeof body.status === "string" ? body.status : null;
      const shouldRestock = body.restock === true;
      const note = optionalString(body.note, 500);

      if (nextStatus && !(ORDER_STATUSES as readonly string[]).includes(nextStatus)) {
        return jsonError("Unknown order status.", 400);
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (nextStatus) updates.status = nextStatus;
      if (body.adminNotes !== undefined) updates.adminNotes = optionalString(body.adminNotes, 4000);

      const cancelling = nextStatus === "Cancelled";

      await db.transaction(async (tx) => {
        if (cancelling && shouldRestock && !order.restockedAt) {
          for (const item of items) {
            if (!item.variantId) continue;
            const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
            if (!variant) continue;

            await tx
              .update(productVariants)
              .set({ stock: variant.stock + item.quantity, updatedAt: new Date() })
              .where(eq(productVariants.id, variant.id));

            await tx.insert(inventoryEvents).values({
              variantId: variant.id,
              changeQty: item.quantity,
              type: "cancellation",
              referenceId: order.orderNumber,
              notes: `Restocked after cancelling ${order.orderNumber}`,
            });
          }
          updates.restockedAt = new Date();
        }

        if (cancelling) updates.cancelledAt = new Date();

        await tx.update(orders).set(updates).where(eq(orders.id, id));

        if (nextStatus) {
          await tx.insert(orderEvents).values({
            orderId: id,
            status: nextStatus,
            note: note ?? `Status updated to ${nextStatus} by ${session.admin.name || "Admin"}.`,
            createdBy: session.admin.email,
          });
        } else if (note || body.adminNotes !== undefined) {
          await tx.insert(orderEvents).values({
            orderId: id,
            status: order.status,
            note: note ?? "Internal note updated.",
            createdBy: session.admin.email,
          });
        }
      });

      const refreshed = await loadOrder(id);
      await recordAdminAudit(session.admin, "admin.order.updated", {
        target: id,
        detail: { status: nextStatus, restocked: Boolean(updates.restockedAt) },
        req,
      });

      return jsonOk(refreshed ?? {});
    },
    { context: "admin/order update failed" }
  );
}
