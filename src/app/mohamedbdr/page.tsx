import React from "react";
import Link from "next/link";
import { db } from "@/db";
import { customers, orderItems, orders, productVariants, products, pageSections, media } from "@/db/schema";
import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { AdminPage } from "@/components/admin/AdminPage";
import { getAdminSessionOrNull } from "@/lib/auth";
import { getStoreSettingsSafe } from "@/lib/store-settings";
import { AlertTriangle, Boxes, ClipboardList, TrendingUp, Users, Layers, Image as ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="bg-[#121216] border border-white/10 p-4 hover:border-white/30 transition-colors block">
      <div className="flex items-center justify-between text-zinc-400">
        <span className="text-[11px] uppercase font-bold">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-black text-white mt-2">{value}</p>
      {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // Guard first: no database access happens for anonymous visitors.
  const session = await getAdminSessionOrNull();
  return (
    <AdminPage next="/mohamedbdr">
      <DashboardContent adminName={session?.admin.name ?? ""} />
    </AdminPage>
  );
}

async function DashboardContent({ adminName }: { adminName: string }) {
  await ensureAdminReady();
  const settings = await getStoreSettingsSafe();

  const [orderTotals] = await db
    .select({
      total: count(),
      revenue: sql<number>`coalesce(sum(case when ${orders.status} = 'Delivered' then ${orders.totalAmount} else 0 end), 0)::int`,
      pending: sql<number>`coalesce(sum(case when ${orders.status} = 'Pending' then 1 else 0 end), 0)::int`,
    })
    .from(orders);

  const [productTotals] = await db
    .select({
      total: count(),
      published: sql<number>`coalesce(sum(case when ${products.status} = 'published' then 1 else 0 end), 0)::int`,
      drafts: sql<number>`coalesce(sum(case when ${products.status} <> 'published' then 1 else 0 end), 0)::int`,
    })
    .from(products);

  const [customerTotals] = await db.select({ total: count() }).from(customers);
  const [lowStock] = await db.select({ total: count() }).from(productVariants).where(lte(productVariants.stock, 5));
  const [mediaTotals] = await db.select({ total: count() }).from(media);
  const [publishedSections] = await db
    .select({ total: count() })
    .from(pageSections)
    .where(and(eq(pageSections.version, "published"), eq(pageSections.isVisible, true)));

  const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6);
  const recentItems = recentOrders.length
    ? await db.select().from(orderItems)
    : [];

  const topProducts = await db
    .select({
      name: orderItems.productName,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenue: sql<number>`coalesce(sum(${orderItems.totalPrice}), 0)::int`,
    })
    .from(orderItems)
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <header className="border-b border-white/10 pb-6">
        <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">CONTROL ROOM</span>
        <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight">
          {settings.storeName} ADMIN DASHBOARD
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          {adminName ? `Welcome back, ${adminName}. ` : ""}All figures are computed server-side.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Delivered revenue"
          value={`${Number(orderTotals?.revenue ?? 0).toLocaleString("en-US")} ${settings.currency}`}
          hint={`${Number(orderTotals?.total ?? 0)} orders total`}
          icon={<TrendingUp className="w-4 h-4" />}
          href="/mohamedbdr/orders"
        />
        <StatCard
          label="Pending orders"
          value={String(Number(orderTotals?.pending ?? 0))}
          hint="Awaiting confirmation call"
          icon={<ClipboardList className="w-4 h-4" />}
          href="/mohamedbdr/orders?status=Pending"
        />
        <StatCard
          label="Customers"
          value={String(Number(customerTotals?.total ?? 0))}
          hint="Unique buyers with order history"
          icon={<Users className="w-4 h-4" />}
          href="/mohamedbdr/customers"
        />
        <StatCard
          label="Low stock variants"
          value={String(Number(lowStock?.total ?? 0))}
          hint="5 units or fewer"
          icon={<AlertTriangle className="w-4 h-4" />}
          href="/mohamedbdr/inventory?lowStock=true"
        />
        <StatCard
          label="Products"
          value={String(Number(productTotals?.total ?? 0))}
          hint={`${Number(productTotals?.published ?? 0)} live • ${Number(productTotals?.drafts ?? 0)} draft`}
          icon={<Boxes className="w-4 h-4" />}
          href="/mohamedbdr/products"
        />
        <StatCard
          label="Live homepage sections"
          value={String(Number(publishedSections?.total ?? 0))}
          hint="Published and visible"
          icon={<Layers className="w-4 h-4" />}
          href="/mohamedbdr/homepage"
        />
        <StatCard
          label="Media items"
          value={String(Number(mediaTotals?.total ?? 0))}
          hint="Uploads and linked URLs"
          icon={<ImageIcon className="w-4 h-4" />}
          href="/mohamedbdr/media"
        />
        <StatCard
          label="Delivery"
          value="58 wilayas"
          hint="Home & stop-desk pricing"
          icon={<Boxes className="w-4 h-4" />}
          href="/mohamedbdr/delivery"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#121216] border border-white/10 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-bold uppercase text-white">Recent orders</h2>
            <Link href="/mohamedbdr/orders" className="text-[11px] text-zinc-400 hover:text-white uppercase">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-zinc-500 text-xs">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Order</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Items</th>
                    <th className="p-2.5">Total</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5">
                      <td className="p-2.5 font-bold text-white">
                        <Link href={`/mohamedbdr/orders?order=${order.id}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="p-2.5 text-zinc-300">
                        {order.customerName}
                        <span className="block text-zinc-500">{order.customerPhone}</span>
                      </td>
                      <td className="p-2.5 text-zinc-400">
                        {recentItems
                          .filter((item) => item.orderId === order.id)
                          .map((item) => `${item.productName} x${item.quantity}`)
                          .join(", ") || "—"}
                      </td>
                      <td className="p-2.5 text-emerald-400 font-bold">
                        {order.totalAmount.toLocaleString("en-US")} {order.currency}
                      </td>
                      <td className="p-2.5 text-zinc-300">{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#121216] border border-white/10 p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Best sellers</h2>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-zinc-500 text-xs">No sales recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-xs">
              {topProducts.map((row) => (
                <li key={row.name} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-200 truncate pr-2">{row.name}</span>
                  <span className="text-zinc-400 shrink-0">
                    {Number(row.units)} sold
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
