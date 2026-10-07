import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonOk, parsePagination, withAdmin } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const { page, pageSize, offset, search } = parsePagination(url, { defaultPageSize: 25 });
      const wilaya = url.searchParams.get("wilaya");
      const sort = url.searchParams.get("sort") ?? "newest";

      const filters = [];
      if (search) {
        filters.push(
          or(
            ilike(customers.fullName, `%${search}%`),
            ilike(customers.phone, `%${search}%`),
            ilike(customers.email, `%${search}%`),
            ilike(customers.commune, `%${search}%`)
          )!
        );
      }
      if (wilaya) filters.push(eq(customers.wilaya, wilaya));

      const where = filters.length ? and(...filters) : undefined;

      const [totalRow] = await db.select({ value: count() }).from(customers).where(where);
      const total = Number(totalRow?.value ?? 0);

      const rows = await db
        .select()
        .from(customers)
        .where(where)
        .orderBy(sort === "name" ? asc(customers.fullName) : desc(customers.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Aggregates for the listed page only (keeps the query bounded).
      const aggregateRows = await db
        .select({
          customerId: orders.customerId,
          orderCount: count(),
          totalSpent: sql<number>`coalesce(sum(case when ${orders.status} <> 'Cancelled' then ${orders.totalAmount} else 0 end), 0)::int`,
          lastOrderAt: sql<Date>`max(${orders.createdAt})`,
        })
        .from(orders)
        .groupBy(orders.customerId);

      const aggregateMap = new Map(aggregateRows.map((row) => [row.customerId, row]));

      return jsonOk({
        customers: rows.map((customer) => {
          const aggregate = aggregateMap.get(customer.id);
          return {
            ...customer,
            orderCount: Number(aggregate?.orderCount ?? 0),
            totalSpent: Number(aggregate?.totalSpent ?? 0),
            lastOrderAt: aggregate?.lastOrderAt ?? null,
          };
        }),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    },
    { context: "admin/customers request failed" }
  );
}
