"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Spinner, adminFetch } from "@/components/admin/ui";
import { AlertTriangle, Boxes, Search } from "lucide-react";

interface VariantRow {
  id: string;
  sku: string;
  stock: number;
  price: number | null;
  color: string | null;
  size: string | null;
  status: string;
  optionCombination: Record<string, string>;
  productName: string | null;
  productSku: string | null;
}

export function InventoryManager({ initialLowStock = false }: { initialLowStock?: boolean }) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(initialLowStock);
  const [counts, setCounts] = useState({ low: 0, out: 0 });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search.trim()) params.set("q", search.trim());
      if (lowStock) params.set("lowStock", "true");
      const data = await adminFetch<{
        variants: VariantRow[];
        events: any[];
        lowStockCount: number;
        outOfStockCount: number;
      }>(`/api/admin/inventory?${params.toString()}`);
      setVariants(data.variants);
      setEvents(data.events);
      setCounts({ low: data.lowStockCount, out: data.outOfStockCount });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, lowStock]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const adjust = async (variant: VariantRow, mode: "set" | "delta", value: number) => {
    try {
      await adminFetch("/api/admin/inventory", {
        method: "PATCH",
        body: JSON.stringify(
          mode === "set" ? { variantId: variant.id, stock: value } : { variantId: variant.id, delta: value, type: "restock" }
        ),
      });
      setNotice(`${variant.sku} updated.`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variant.id];
        return next;
      });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="STOCK CONTROL"
        title="Inventory"
        icon={<Boxes className="w-7 h-7 text-amber-400" />}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <Badge tone="warning">{counts.low} low stock</Badge>
            <Badge tone="danger">{counts.out} out of stock</Badge>
          </div>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Field label="Search variants">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, colour, size" />
            </div>
          </Field>
          <Field label="Filter">
            <Select value={lowStock ? "low" : "all"} onChange={(e) => setLowStock(e.target.value === "low")}>
              <option value="all">All variants</option>
              <option value="low">Low stock (≤ 5)</option>
            </Select>
          </Field>
          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Every adjustment is written to the inventory ledger.
          </p>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner label="Loading inventory..." />
        ) : variants.length === 0 ? (
          <EmptyState>No variants match this view.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2">Variant</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Adjust</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {variants.map((variant) => (
                  <tr key={variant.id} className="hover:bg-white/5">
                    <td className="p-2 text-white uppercase">{variant.productName ?? "—"}</td>
                    <td className="p-2">
                      <span className="text-zinc-300 block">{variant.sku}</span>
                      <span className="text-[10px] text-zinc-500">
                        {Object.values(variant.optionCombination ?? {}).join(" / ") ||
                          [variant.color, variant.size].filter(Boolean).join(" / ") ||
                          "default"}
                      </span>
                    </td>
                    <td className="p-2 text-base font-black text-white">{variant.stock}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" onClick={() => adjust(variant, "delta", 1)}>+1</Button>
                        <Button variant="ghost" onClick={() => adjust(variant, "delta", -1)} disabled={variant.stock === 0}>-1</Button>
                        <Input
                          type="number"
                          min={0}
                          value={drafts[variant.id] ?? ""}
                          placeholder="set"
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                          className="w-20"
                        />
                        <Button
                          variant="subtle"
                          disabled={drafts[variant.id] === undefined || drafts[variant.id] === ""}
                          onClick={() => adjust(variant, "set", Number(drafts[variant.id]))}
                        >
                          Set
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">
                      {variant.stock > 5 ? (
                        <Badge tone="success">In stock</Badge>
                      ) : variant.stock > 0 ? (
                        <Badge tone="warning">Low stock</Badge>
                      ) : (
                        <Badge tone="danger">Out of stock</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Recent inventory movements</h2>
        {events.length === 0 ? (
          <EmptyState>No movements recorded yet.</EmptyState>
        ) : (
          <ul className="space-y-2 text-xs">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-2">
                <Badge tone={event.changeQty >= 0 ? "success" : "danger"}>
                  {event.changeQty >= 0 ? `+${event.changeQty}` : event.changeQty}
                </Badge>
                <span className="text-zinc-300 uppercase">{event.type}</span>
                <span className="text-zinc-500">{event.referenceId ?? "—"}</span>
                <span className="text-zinc-600 text-[10px] ml-auto">{new Date(event.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
