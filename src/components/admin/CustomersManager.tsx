"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, Spinner, adminFetch, formatDZD } from "@/components/admin/ui";
import { ArrowLeft, ArrowRight, Mail, MapPin, Phone, Search, Users } from "lucide-react";

interface CustomerRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  wilaya: string;
  commune: string;
  address: string;
  notes: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export function CustomersManager() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<{ customer: CustomerRow; orders: any[]; stats: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sort });
      if (search.trim()) params.set("q", search.trim());
      const data = await adminFetch<{ customers: CustomerRow[]; total: number; totalPages: number }>(
        `/api/admin/customers?${params.toString()}`
      );
      setCustomers(data.customers);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, sort]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      const data = await adminFetch<{ customer: CustomerRow; orders: any[]; stats: any }>(`/api/admin/customers/${id}`);
      setDetail(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="CUSTOMER DIRECTORY"
        title="Customers"
        icon={<Users className="w-7 h-7 text-sky-400" />}
        actions={<span className="text-xs text-zinc-400">{total} customers</span>}
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Search">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <Input
                value={search}
                placeholder="Name, phone, email, commune"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </Field>
          <Field label="Sort">
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner label="Loading customers..." />
        ) : customers.length === 0 ? (
          <EmptyState>No customers yet.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Contact</th>
                    <th className="p-2.5">Location</th>
                    <th className="p-2.5">Orders</th>
                    <th className="p-2.5">Total spent</th>
                    <th className="p-2.5">Last order</th>
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-white/5 align-top">
                      <td className="p-2.5">
                        <strong className="text-white block uppercase">{customer.fullName}</strong>
                        <span className="text-[10px] text-zinc-500">
                          Joined {new Date(customer.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {customer.phone}
                        </span>
                        {customer.email && (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-zinc-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {customer.wilaya}
                        </span>
                        <span className="text-[10px] text-zinc-500">{customer.commune}</span>
                      </td>
                      <td className="p-2.5">
                        <Badge tone={customer.orderCount > 0 ? "info" : "neutral"}>{customer.orderCount}</Badge>
                      </td>
                      <td className="p-2.5 text-emerald-400 font-bold">{formatDZD(customer.totalSpent)}</td>
                      <td className="p-2.5 text-zinc-400">
                        {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-2.5">
                        <Button variant="ghost" onClick={() => openDetail(customer.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3 text-xs text-zinc-400">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="disabled:opacity-40">
                <ArrowLeft className="w-4 h-4" />
              </button>
              Page {page} / {totalPages}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="disabled:opacity-40">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </Card>

      {detail && (
        <Modal open title={detail.customer.fullName} onClose={() => setDetail(null)} wide>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-black/50 border border-white/10 p-3">
              <span className="text-[10px] uppercase text-zinc-400 block">Orders</span>
              <strong className="text-white text-lg">{detail.stats.orderCount}</strong>
            </div>
            <div className="bg-black/50 border border-white/10 p-3">
              <span className="text-[10px] uppercase text-zinc-400 block">Total spent</span>
              <strong className="text-emerald-400 text-lg">{formatDZD(detail.stats.totalSpent)}</strong>
            </div>
            <div className="bg-black/50 border border-white/10 p-3">
              <span className="text-[10px] uppercase text-zinc-400 block">Delivered</span>
              <strong className="text-white text-lg">{detail.stats.deliveredCount}</strong>
            </div>
            <div className="bg-black/50 border border-white/10 p-3">
              <span className="text-[10px] uppercase text-zinc-400 block">Cancelled</span>
              <strong className="text-white text-lg">{detail.stats.cancelledCount}</strong>
            </div>
          </div>

          <div className="text-xs space-y-1 text-zinc-300">
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> {detail.customer.phone}
            </p>
            {detail.customer.email && (
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> {detail.customer.email}
              </p>
            )}
            <p className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> {detail.customer.wilaya} — {detail.customer.commune}
            </p>
            <p className="text-zinc-500">{detail.customer.address}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-bold text-zinc-400">Order history</h4>
            {detail.orders.length === 0 ? (
              <EmptyState>No orders.</EmptyState>
            ) : (
              detail.orders.map((order) => (
                <div key={order.id} className="border border-white/10 p-3 text-xs flex flex-wrap items-center gap-3">
                  <strong className="text-white">{order.orderNumber}</strong>
                  <Badge
                    tone={order.status === "Delivered" ? "success" : order.status === "Cancelled" ? "danger" : "info"}
                  >
                    {order.status}
                  </Badge>
                  <span className="text-zinc-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="text-zinc-400 flex-1 min-w-0 truncate">
                    {order.items.map((item: any) => `${item.productName} x${item.quantity}`).join(", ")}
                  </span>
                  <span className="text-emerald-400 font-bold">{formatDZD(order.totalAmount)}</span>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
