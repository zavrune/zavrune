import { db } from "@/db";
import { orders, products, productVariants, pageSections } from "@/db/schema";
import { count, sum, eq, lte, desc } from "drizzle-orm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { formatDZD } from "@/lib/translations";
import {
  TrendingUp,
  ClipboardList,
  Boxes,
  AlertTriangle,
  Layers,
  Activity,
  Plus,
  ArrowRight,
} from "lucide-react";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  // 1. Calculate Total Revenue in DZD
  const allOrdersList = await db.select().from(orders);
  const totalRevenue = allOrdersList.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalOrdersCount = allOrdersList.length;

  // 2. Fetch Low Stock Variants (stock <= 5)
  const lowStockVariants = await db
    .select()
    .from(productVariants)
    .where(lte(productVariants.stock, 5));

  // 3. Fetch Total Active Products
  const activeProducts = await db
    .select()
    .from(products)
    .where(eq(products.status, "published"));

  // 4. Fetch Recent 5 Orders
  const recentOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(5);

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
              ZAVRUNE METRICS
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight">
              ADMIN DASHBOARD
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/admin/builder"
              className="px-4 py-2 bg-white text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Storefront Builder</span>
            </a>

            <a
              href="/admin/health"
              className="px-4 py-2 bg-zinc-800 border border-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-zinc-700 transition-colors"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Health Scan</span>
            </a>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#121216] border border-white/10 p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase">Total Sales Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {formatDZD(totalRevenue)}
            </div>
            <span className="text-[10px] text-zinc-500 uppercase block">Currency: DZD</span>
          </div>

          <div className="bg-[#121216] border border-white/10 p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase">Direct Purchases</span>
              <ClipboardList className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {totalOrdersCount}
            </div>
            <span className="text-[10px] text-zinc-500 uppercase block">100% Direct Order Flow</span>
          </div>

          <div className="bg-[#121216] border border-white/10 p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase">Low Stock Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {lowStockVariants.length}
            </div>
            <span className="text-[10px] text-zinc-500 uppercase block">Variants &lt;= 5 stock</span>
          </div>

          <div className="bg-[#121216] border border-white/10 p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs uppercase">Active Products</span>
              <Boxes className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {activeProducts.length}
            </div>
            <span className="text-[10px] text-zinc-500 uppercase block">Streetwear catalog</span>
          </div>
        </div>

        {/* Recent Direct Orders */}
        <div className="bg-[#121216] border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              RECENT DIRECT ORDERS
            </h2>
            <a
              href="/admin/orders"
              className="text-xs text-zinc-400 hover:text-white uppercase flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-3">Order Number</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Wilaya</th>
                    <th className="p-3">Total (DZD)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{o.orderNumber}</td>
                      <td className="p-3 text-zinc-300">{o.customerName} ({o.customerPhone})</td>
                      <td className="p-3 text-zinc-400">{o.wilaya}</td>
                      <td className="p-3 font-bold text-emerald-400">{formatDZD(o.totalAmount)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-500/30 uppercase font-bold">
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-6">No orders placed yet.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
