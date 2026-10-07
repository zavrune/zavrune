"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { formatDZD } from "@/lib/translations";
import { ClipboardList, Phone, MapPin, Printer } from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {
      alert("Failed to update order status");
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
              DIRECT PURCHASES LOG
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-emerald-400" />
              <span>DIRECT ORDERS MANAGEMENT</span>
            </h1>
          </div>
        </div>

        <div className="bg-[#121216] border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-4">
            Orders ({orders.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">
              Loading direct orders...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 font-bold uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3">Order Ref</th>
                    <th className="p-3">Customer & Contact</th>
                    <th className="p-3">Wilaya & Address</th>
                    <th className="p-3">Items Purchased</th>
                    <th className="p-3">Total (DZD)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">
                        {o.orderNumber}
                        <span className="text-[10px] text-zinc-500 block">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <strong className="text-white block uppercase">{o.customerName}</strong>
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <Phone className="w-3 h-3" />
                          {o.customerPhone}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-300">
                        <strong className="text-white block">{o.wilaya} — {o.commune}</strong>
                        <span className="text-zinc-500 text-[11px] block">{o.address}</span>
                      </td>
                      <td className="p-3">
                        {o.items?.map((item: any) => (
                          <div key={item.id} className="text-zinc-200">
                            <strong>{item.productName}</strong> ({item.color}/{item.size}) x{item.quantity}
                          </div>
                        ))}
                      </td>
                      <td className="p-3 font-bold text-emerald-400 text-sm">
                        {formatDZD(o.totalAmount)}
                      </td>
                      <td className="p-3">
                        <select
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          className="bg-black border border-white/20 text-white p-1 text-xs focus:outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
