import { db } from "@/db";
import { customers, orderItems, orders } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonOk, parsePagination, withAdmin } from "@/lib/api";
import { ORDER_STATUSES } from "@/lib/order-statuses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { page, pageSize, offset, search } = parsePagination(url, { defaultPageSize: 25 });

      const status = url.searchParams.get("status");
      const sort = url.searchParams.get("sort") ?? "newest";
      const wilaya = url.searchParams.get("wilaya");

      const filters = [];
      if (status && status !== "all" && (ORDER_STATUSES as readonly string[]).includes(status)) {
        filters.push(eq(orders.status, status));
      }
      if (wilaya) filters.push(eq(orders.wilayaCode, wilaya));
      if (search) {
        filters.push(
          or(
            ilike(orders.orderNumber, `%${search}%`),
            ilike(orders.customerName, `%${search}%`),
            ilike(orders.customerPhone, `%${search}%`),
            ilike(orders.commune, `%${search}%`)
          )!
        );
      }

      const where = filters.length ? and(...filters) : undefined;

      const orderBy =
        sort === "oldest" ? asc(orders.createdAt) : sort === "total_desc" ? desc(orders.totalAmount) : desc(orders.createdAt);

      const [totalRow] = await db.select({ value: count() }).from(orders).where(where);
      const total = Number(totalRow?.value ?? 0);

      const rows = await db.select().from(orders).where(where).orderBy(orderBy).limit(pageSize).offset(offset);
      const orderIds = rows.map((row) => row.id);

      const items = orderIds.length
        ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
        : [];

      const statusTotals = await db
        .select({ status: orders.status, value: count() })
        .from(orders)
        .groupBy(orders.status);

      const [revenueRow] = await db
        .select({ value: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
        .from(orders)
        .where(eq(orders.status, "Delivered"));

      return jsonOk({
        orders: rows.map((order) => ({
          ...order,
          items: items.filter((item) => item.orderId === order.id),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        statusTotals: Object.fromEntries(statusTotals.map((row) => [row.status, Number(row.value)])),
        deliveredRevenue: Number(revenueRow?.value ?? 0),
      });
    },
    { context: "admin/orders request failed" }
  );
}
