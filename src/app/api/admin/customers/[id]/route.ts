import { db } from "@/db";
import { customers, orderItems, orders } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, withAdmin } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const { id } = await params;

      const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      if (!customer) return jsonError("Customer not found.", 404);

      const history = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, id))
        .orderBy(desc(orders.createdAt));

      const items = history.length
        ? await db.select().from(orderItems).where(inArray(orderItems.orderId, history.map((order) => order.id)))
        : [];

      const totalSpent = history
        .filter((order) => order.status !== "Cancelled")
        .reduce((sum, order) => sum + order.totalAmount, 0);

      return jsonOk({
        customer,
        orders: history.map((order) => ({
          ...order,
          items: items.filter((item) => item.orderId === order.id),
        })),
        stats: {
          orderCount: history.length,
          totalSpent,
          deliveredCount: history.filter((order) => order.status === "Delivered").length,
          cancelledCount: history.filter((order) => order.status === "Cancelled").length,
        },
      });
    },
    { context: "admin/customer lookup failed" }
  );
}
