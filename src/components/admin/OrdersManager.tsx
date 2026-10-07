"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, Spinner, adminFetch, formatDZD } from "@/components/admin/ui";
import { ArrowLeft, ArrowRight, ClipboardList, MapPin, Phone, Printer, Save, Search } from "lucide-react";

const STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"];

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  wilaya: string;
  wilayaCode: string | null;
  commune: string;
  address: string;
  deliveryType: string;
  deliverySnapshot: any;
  shippingMethodName: string;
  shippingPrice: number;
  itemsSubtotal: number;
  totalAmount: number;
  currency: string;
  status: string;
  adminNotes: string | null;
  restockedAt: string | null;
  createdAt: string;
  items: any[];
}

export function OrdersManager({ initialOrderId, initialStatus }: { initialOrderId?: string; initialStatus?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sort });
      if (search.trim()) params.set("q", search.trim());
      if (status !== "all") params.set("status", status);

      const data = await adminFetch<{
        orders: OrderRow[];
        total: number;
        totalPages: number;
        statusTotals: Record<string, number>;
      }>(`/api/admin/orders?${params.toString()}`);

      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setStatusTotals(data.statusTotals ?? {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, sort]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const data = await adminFetch<{ order: OrderRow; items: any[] }>(`/api/admin/orders/${id}`);
      setDetail({ ...data.order, items: data.items });
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Deep link support: /mohamedbdr/orders?order=<id> opens the detail panel.
  useEffect(() => {
    if (!initialOrderId) return;
    queueMicrotask(() => {
      void openDetail(initialOrderId);
    });
  }, [initialOrderId, openDetail]);

  const updateOrder = async (id: string, patch: Record<string, unknown>) => {
    try {
      const data = await adminFetch<{ order: OrderRow; items: any[] }>(`/api/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setDetail({ ...data.order, items: data.items });
      setNotice("Order updated.");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="DIRECT PURCHASES"
        title="Orders"
        icon={<ClipboardList className="w-7 h-7 text-emerald-400" />}
        actions={<span className="text-xs text-zinc-400">{total} orders</span>}
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setStatus("all");
            setPage(1);
          }}
          className={`px-2.5 py-1.5 text-[10px] uppercase font-bold border ${
            status === "all" ? "bg-white text-black border-white" : "border-white/15 text-zinc-300"
          }`}
        >
          All ({total})
        </button>
        {STATUSES.map((entry) => (
          <button
            key={entry}
            onClick={() => {
              setStatus(entry);
              setPage(1);
            }}
            className={`px-2.5 py-1.5 text-[10px] uppercase font-bold border ${
              status === entry ? "bg-white text-black border-white" : "border-white/15 text-zinc-300"
            }`}
          >
            {entry} ({statusTotals[entry] ?? 0})
          </button>
        ))}
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Search">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <Input
                value={search}
                placeholder="Order number, name, phone, commune"
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
              <option value="oldest">Oldest first</option>
              <option value="total_desc">Highest value</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner label="Loading orders..." />
        ) : orders.length === 0 ? (
          <EmptyState>No orders match these filters.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Order</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Delivery</th>
                    <th className="p-2.5">Items</th>
                    <th className="p-2.5">Total</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5 align-top">
                      <td className="p-2.5">
                        <strong className="text-white block">{order.orderNumber}</strong>
                        <span className="text-[10px] text-zinc-500">{new Date(order.createdAt).toLocaleString()}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-white block uppercase">{order.customerName}</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {order.customerPhone}
                        </span>
                      </td>
                      <td className="p-2.5 text-zinc-300">
                        <span className="flex items-center gap-1 text-white">
                          <MapPin className="w-3 h-3" />
                          {order.wilaya} — {order.commune}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {order.deliveryType === "bureau" ? "Stop desk" : "Home"} • {formatDZD(order.shippingPrice)}
                        </span>
                      </td>
                      <td className="p-2.5 text-zinc-300 max-w-[220px]">
                        {order.items.map((item) => (
                          <span key={item.id} className="block truncate">
                            {item.productName} {item.optionLabel ? `(${item.optionLabel})` : ""} x{item.quantity}
                          </span>
                        ))}
                      </td>
                      <td className="p-2.5 text-emerald-400 font-bold">{formatDZD(order.totalAmount)}</td>
                      <td className="p-2.5">
                        <Badge
                          tone={
                            order.status === "Delivered"
                              ? "success"
                              : order.status === "Cancelled"
                              ? "danger"
                              : order.status === "Pending"
                              ? "warning"
                              : "info"
                          }
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <Button variant="ghost" onClick={() => openDetail(order.id)}>
                          Open
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

      <OrderDetailModal
        order={detail}
        onClose={() => setDetail(null)}
        onUpdate={updateOrder}
        onRestock={(id) => updateOrder(id, { status: "Cancelled", restock: true, note: "Cancelled and restocked by admin." })}
      />
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onUpdate,
  onRestock,
}: {
  order: OrderRow | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onRestock: (id: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(order?.adminNotes ?? "");
  const [status, setStatus] = useState(order?.status ?? "Pending");
  const [busy, setBusy] = useState(false);

  const orderKey = `${order?.id ?? ""}:${order?.adminNotes ?? ""}:${order?.status ?? ""}`;
  const [lastKey, setLastKey] = useState(orderKey);
  if (orderKey !== lastKey) {
    // Reset the form when a different order (or refreshed values) arrives.
    setLastKey(orderKey);
    setNotes(order?.adminNotes ?? "");
    setStatus(order?.status ?? "Pending");
  }

  if (!order) return null;

  return (
    <Modal open title={`Order ${order.orderNumber}`} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase font-bold text-zinc-400">Customer</h4>
          <p className="text-white uppercase">{order.customerName}</p>
          <p className="text-emerald-400">{order.customerPhone}</p>
          {order.customerEmail && <p className="text-zinc-400">{order.customerEmail}</p>}
        </div>
        <div className="space-y-2">
          <h4 className="text-[10px] uppercase font-bold text-zinc-400">Delivery</h4>
          <p className="text-white">
            {order.wilaya}
            {order.wilayaCode ? ` (${order.wilayaCode})` : ""} — {order.commune}
          </p>
          <p className="text-zinc-400">{order.address}</p>
          <p className="text-zinc-400">{order.deliveryType === "bureau" ? "Stop desk / Bureau" : "Home delivery"}</p>
          <p className="text-zinc-500">{order.shippingMethodName}</p>
        </div>
      </div>

      <div className="border border-white/10 divide-y divide-white/5">
        {order.items.map((item) => (
          <div key={item.id} className="p-3 flex items-center gap-3 text-xs">
            {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-10 h-12 object-cover border border-white/10" /> : null}
            <div className="flex-1 min-w-0">
              <span className="text-white block truncate">{item.productName}</span>
              <span className="text-[10px] text-zinc-500 block">
                SKU {item.variantSku}
                {item.optionLabel ? ` • ${item.optionLabel}` : ""}
              </span>
            </div>
            <span className="text-zinc-400">x{item.quantity}</span>
            <span className="text-emerald-400 font-bold">{formatDZD(item.totalPrice)}</span>
          </div>
        ))}
      </div>

      <div className="bg-black/50 border border-white/10 p-3 text-xs space-y-1">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatDZD(order.itemsSubtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Delivery</span>
          <span>{formatDZD(order.shippingPrice)}</span>
        </div>
        <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1">
          <span>Total (snapshot)</span>
          <span className="text-emerald-400">{formatDZD(order.totalAmount)}</span>
        </div>
        {order.deliverySnapshot?.capturedAt && (
          <p className="text-[10px] text-zinc-500">
            Delivery price locked at {new Date(order.deliverySnapshot.capturedAt).toLocaleString()}
            {order.deliverySnapshot.freeShippingApplied ? " • free shipping applied" : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Internal note (not visible to the customer)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              setBusy(true);
              await onUpdate(order.id, { status, adminNotes: notes });
              setBusy(false);
            }}
            disabled={busy}
          >
            <span className="flex items-center gap-2">
              <Save className="w-3.5 h-3.5" /> Save status & note
            </span>
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <span className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" /> Print
            </span>
          </Button>
          {order.restockedAt ? (
            <Badge tone="success">Restocked {new Date(order.restockedAt).toLocaleDateString()}</Badge>
          ) : (
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Cancel this order and return the items to stock?")) return;
                setBusy(true);
                await onRestock(order.id);
                setBusy(false);
              }}
            >
              Cancel & restock
            </Button>
          )}
        </div>
        <span className="text-[10px] text-zinc-500">Placed {new Date(order.createdAt).toLocaleString()}</span>
      </div>
    </Modal>
  );
}
