"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Spinner, Toggle, adminFetch, formatDZD } from "@/components/admin/ui";
import { ArrowDown, ArrowUp, Flame, Plus, Search, Star, Trash2 } from "lucide-react";

interface GroupData {
  key: string;
  titleEn: string | null;
  titleAr: string | null;
  titleFr: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  subtitleFr: string | null;
  isEnabled: boolean;
  productIds: string[];
}

interface ProductLite {
  id: string;
  nameEn: string;
  price: number;
  status: string;
  images: { url: string }[];
}

/**
 * Ordered product selection used by both the managed New Drop and the
 * independent Featured collection.
 */
export function GroupManager({ groupKey, heading, eyebrow }: { groupKey: string; heading: string; eyebrow: string }) {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ group: GroupData }>(`/api/admin/groups/${groupKey}`);
      setGroup(data.group);

      const catalogue = await adminFetch<{ products: ProductLite[] }>(`/api/admin/products?pageSize=100&sort=position`);
      setProducts(catalogue.products);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [groupKey]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const save = async (patch: Partial<GroupData> & { productIds?: string[] }) => {
    if (!group) return;
    setSaving(true);
    setError("");
    try {
      const { productIds, ...fields } = patch;
      if (Object.keys(fields).length > 0) {
        await adminFetch(`/api/admin/groups/${groupKey}`, { method: "PATCH", body: JSON.stringify(fields) });
      }
      if (productIds) {
        await adminFetch(`/api/admin/groups/${groupKey}`, { method: "PUT", body: JSON.stringify({ productIds }) });
      }
      setGroup({ ...group, ...patch });
      setNotice("Saved.");
      setTimeout(() => setNotice(""), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="p-8">
        <Spinner label="Loading..." />
      </div>
    );
  }

  const selected = group.productIds
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean) as ProductLite[];

  const candidates = products.filter(
    (product) => !group.productIds.includes(product.id) && product.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= group.productIds.length) return;
    const next = [...group.productIds];
    [next[index], next[target]] = [next[target], next[index]];
    save({ productIds: next });
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={heading}
        icon={groupKey === "featured" ? <Star className="w-7 h-7 text-amber-400" /> : <Flame className="w-7 h-7 text-orange-400" />}
        actions={
          <Toggle
            checked={group.isEnabled}
            onChange={(value) => save({ isEnabled: value })}
            label={group.isEnabled ? "Section enabled" : "Section disabled"}
          />
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Titles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Title (English)">
            <Input value={group.titleEn ?? ""} onChange={(e) => setGroup({ ...group, titleEn: e.target.value })} />
          </Field>
          <Field label="Title (Arabic)">
            <Input dir="rtl" value={group.titleAr ?? ""} onChange={(e) => setGroup({ ...group, titleAr: e.target.value })} />
          </Field>
          <Field label="Title (French)">
            <Input value={group.titleFr ?? ""} onChange={(e) => setGroup({ ...group, titleFr: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Subtitle (English)">
            <Input value={group.subtitleEn ?? ""} onChange={(e) => setGroup({ ...group, subtitleEn: e.target.value })} />
          </Field>
          <Field label="Subtitle (Arabic)">
            <Input dir="rtl" value={group.subtitleAr ?? ""} onChange={(e) => setGroup({ ...group, subtitleAr: e.target.value })} />
          </Field>
          <Field label="Subtitle (French)">
            <Input value={group.subtitleFr ?? ""} onChange={(e) => setGroup({ ...group, subtitleFr: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={saving}
            onClick={() =>
              save({
                titleEn: group.titleEn,
                titleAr: group.titleAr,
                titleFr: group.titleFr,
                subtitleEn: group.subtitleEn,
                subtitleAr: group.subtitleAr,
                subtitleFr: group.subtitleFr,
              })
            }
          >
            {saving ? "Saving..." : "Save text"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">
            Selected products ({selected.length}) — order matters
          </h2>
          {selected.length === 0 ? (
            <EmptyState>Nothing selected yet. Add products from the right.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {selected.map((product, index) => (
                <li key={product.id} className="flex items-center gap-3 border border-white/10 bg-black/40 p-2">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt="" className="w-9 h-11 object-cover border border-white/10" />
                  ) : (
                    <div className="w-9 h-11 bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-white truncate block uppercase">{product.nameEn}</span>
                    <span className="text-[10px] text-zinc-500">{formatDZD(product.price)}</span>
                  </div>
                  {product.status !== "published" && <Badge tone="warning">{product.status}</Badge>}
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(index, -1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move up">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(index, 1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move down">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => save({ productIds: group.productIds.filter((id) => id !== product.id) })}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Add products</h2>
          <Field label="Search catalogue">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product name" />
            </div>
          </Field>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {candidates.length === 0 ? (
              <EmptyState>No matching products.</EmptyState>
            ) : (
              candidates.map((product) => (
                <button
                  key={product.id}
                  onClick={() => save({ productIds: [...group.productIds, product.id] })}
                  className="w-full flex items-center gap-3 border border-white/10 bg-black/40 p-2 hover:border-white/30 text-left"
                >
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt="" className="w-9 h-11 object-cover border border-white/10" />
                  ) : (
                    <div className="w-9 h-11 bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-white truncate block uppercase">{product.nameEn}</span>
                    <span className="text-[10px] text-zinc-500">{formatDZD(product.price)}</span>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
