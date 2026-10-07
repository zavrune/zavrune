"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Select,
  Spinner,
  Toggle,
  adminFetch,
  formatDZD,
} from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Copy, Flame, Image as ImageIcon, Pencil, Plus, ShoppingBag, Star, Trash2, ArrowLeft, ArrowRight } from "lucide-react";

interface VariantRow {
  id: string;
  sku: string;
  stock: number;
  price: number | null;
  color: string | null;
  size: string | null;
  status: string;
  optionCombination?: Record<string, string>;
}

interface ProductRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  status: string;
  featured: boolean;
  position: number;
  images: { url: string; alt?: string }[];
  variants: VariantRow[];
  groupKeys: string[];
  categoryId: string | null;
}

interface CategoryRow {
  id: string;
  nameEn: string;
  isActive: boolean;
}

export function ProductsManager({ initialSearch = "" }: { initialSearch?: string }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("position");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sort });
      if (search.trim()) params.set("q", search.trim());
      if (status !== "all") params.set("status", status);
      if (categoryId) params.set("categoryId", categoryId);

      const data = await adminFetch<{ products: ProductRow[]; categories?: CategoryRow[]; total: number; totalPages: number }>(
        `/api/admin/products?${params.toString()}`
      );
      setProducts(data.products);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.categories) setCategories(data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, categoryId, sort]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const reorder = async (id: string, direction: -1 | 1) => {
    const index = products.findIndex((product) => product.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= products.length) return;

    const next = [...products];
    [next[index], next[target]] = [next[target], next[index]];
    setProducts(next);
    try {
      await adminFetch("/api/admin/products/reorder", {
        method: "POST",
        body: JSON.stringify({ productIds: next.map((product) => product.id) }),
      });
    } catch (err: any) {
      setError(err.message);
      load();
    }
  };

  const toggleGroup = async (product: ProductRow, key: "new_drop" | "featured") => {
    setBusyId(product.id);
    try {
      const next = product.groupKeys.includes(key)
        ? product.groupKeys.filter((group) => group !== key)
        : [...product.groupKeys, key];
      await adminFetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ groupKeys: next }),
      });
      setProducts((prev) =>
        prev.map((row) => (row.id === product.id ? { ...row, groupKeys: next, featured: next.includes("featured") } : row))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (product: ProductRow) => {
    setBusyId(product.id);
    try {
      await adminFetch(`/api/admin/products/${product.id}/duplicate`, { method: "POST" });
      setNotice(`Duplicated "${product.nameEn}" as a draft.`);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (product: ProductRow) => {
    if (!confirm(`Delete "${product.nameEn}"? Variants and option values are removed. Past orders keep their snapshots.`)) return;
    setBusyId(product.id);
    try {
      await adminFetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      setNotice(`Deleted "${product.nameEn}".`);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="STREETWEAR CATALOGUE"
        title="Products & Variants"
        icon={<ShoppingBag className="w-7 h-7 text-purple-400" />}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New product
            </span>
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Search">
            <Input
              value={search}
              placeholder="Name, SKU or slug"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft / hidden</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort">
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="position">Manual order</option>
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="price">Price high → low</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
          <h2 className="font-bold uppercase text-white">Products ({total})</h2>
          <div className="flex items-center gap-2 text-zinc-400">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="disabled:opacity-40">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="disabled:opacity-40">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading catalogue..." />
        ) : products.length === 0 ? (
          <EmptyState>No products match these filters.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2.5">Order</th>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5">Price</th>
                  <th className="p-2.5">Variants & stock</th>
                  <th className="p-2.5">Flags</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((product) => {
                  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                  return (
                    <tr key={product.id} className="hover:bg-white/5 align-top">
                      <td className="p-2.5">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => reorder(product.id, -1)} className="text-zinc-500 hover:text-white" aria-label="Move up">▲</button>
                          <button onClick={() => reorder(product.id, 1)} className="text-zinc-500 hover:text-white" aria-label="Move down">▼</button>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-3">
                          {product.images?.[0]?.url ? (
                            <img src={product.images[0].url} alt="" className="w-10 h-12 object-cover border border-white/10" />
                          ) : (
                            <div className="w-10 h-12 bg-zinc-800 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-zinc-600" />
                            </div>
                          )}
                          <div>
                            <strong className="text-white block uppercase">{product.nameEn}</strong>
                            <span className="text-zinc-500 text-[10px] block">{product.sku}</span>
                            <span className="text-zinc-600 text-[10px] block">/{product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span className="text-emerald-400 font-bold block">{formatDZD(product.price)}</span>
                        {product.compareAtPrice ? (
                          <span className="text-zinc-500 line-through text-[10px]">{formatDZD(product.compareAtPrice)}</span>
                        ) : null}
                      </td>
                      <td className="p-2.5 max-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {product.variants.slice(0, 6).map((variant) => (
                            <span key={variant.id} className="bg-zinc-800 px-1.5 py-0.5 border border-white/10 text-[10px] text-zinc-300">
                              {Object.values(variant.optionCombination ?? {}).join("/") ||
                                [variant.color, variant.size].filter(Boolean).join("/") ||
                                "default"}
                              : <strong className="text-white">{variant.stock}</strong>
                            </span>
                          ))}
                          {product.variants.length > 6 && <span className="text-[10px] text-zinc-500">+{product.variants.length - 6} more</span>}
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-1">Total stock: {stock}</span>
                      </td>
                      <td className="p-2.5 space-y-1">
                        <button
                          onClick={() => toggleGroup(product, "featured")}
                          disabled={busyId === product.id}
                          className={`flex items-center gap-1 text-[10px] uppercase font-bold ${
                            product.groupKeys.includes("featured") ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Star className="w-3 h-3" /> Featured
                        </button>
                        <button
                          onClick={() => toggleGroup(product, "new_drop")}
                          disabled={busyId === product.id}
                          className={`flex items-center gap-1 text-[10px] uppercase font-bold ${
                            product.groupKeys.includes("new_drop") ? "text-orange-300" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Flame className="w-3 h-3" /> New drop
                        </button>
                      </td>
                      <td className="p-2.5">
                        <Badge tone={product.status === "published" ? "success" : product.status === "draft" ? "warning" : "neutral"}>
                          {product.status}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/mohamedbdr/products/${product.id}`}
                            className="p-1.5 text-zinc-300 hover:text-white"
                            title="Edit product & variants"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => duplicate(product)}
                            disabled={busyId === product.id}
                            className="p-1.5 text-zinc-300 hover:text-white"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(product)}
                            disabled={busyId === product.id}
                            className="p-1.5 text-zinc-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateProductModal
        open={createOpen}
        categories={categories}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setNotice("Product created. Use the editor to configure options, variants and media.");
          load();
        }}
      />
    </div>
  );
}

function CreateProductModal({
  open,
  onClose,
  onCreated,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  categories: CategoryRow[];
}) {
  const [form, setForm] = useState({
    nameEn: "",
    nameAr: "",
    nameFr: "",
    price: "5900",
    compareAtPrice: "",
    sku: "",
    categoryId: "",
    badge: "NEW DROP",
    descriptionEn: "",
    status: "published",
    featured: false,
    newDrop: true,
  });
  const [image, setImage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await adminFetch<{ product: { id: string } }>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          nameEn: form.nameEn,
          nameAr: form.nameAr || form.nameEn,
          nameFr: form.nameFr || form.nameEn,
          price: Number(form.price) || 0,
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
          sku: form.sku || undefined,
          categoryId: form.categoryId || null,
          badge: form.badge,
          descriptionEn: form.descriptionEn,
          status: form.status,
          featured: form.featured,
          images: image ? [{ url: image, alt: form.nameEn }] : [],
          variantsGraph: {
            optionTypes: [{ name: "Size", values: [{ value: "S" }, { value: "M" }, { value: "L" }, { value: "XL" }] }],
            variants: ["S", "M", "L", "XL"].map((size) => ({
              sku: `${(form.sku || form.nameEn.slice(0, 8)).toUpperCase()}-${size}`,
              stock: 0,
              price: Number(form.price) || 0,
              options: { Size: size },
            })),
          },
          groupKeys: [form.newDrop ? "new_drop" : null, form.featured ? "featured" : null].filter(Boolean),
        }),
      });
      void created;
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Create product" onClose={onClose} wide>
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name (English)">
            <Input required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </Field>
          <Field label="Name (Arabic)">
            <Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          </Field>
          <Field label="Name (French)">
            <Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Price (DZD)">
            <Input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Sale / compare price">
            <Input type="number" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="auto" />
          </Field>
          <Field label="Badge">
            <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="published">Published (live)</option>
              <option value="draft">Draft / hidden</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>

        <Field label="Description (English)">
          <textarea
            rows={3}
            value={form.descriptionEn}
            onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-[11px] uppercase text-zinc-300 font-bold">Main image</span>
          <div className="flex items-center gap-3">
            {image ? <img src={image} alt="" className="w-16 h-20 object-cover border border-white/10" /> : <div className="w-16 h-20 bg-zinc-800" />}
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
              Choose / upload
            </Button>
            {image && (
              <Button type="button" variant="ghost" onClick={() => setImage("")}>
                Remove
              </Button>
            )}
          </div>
          {image && <Input value={image} onChange={(e) => setImage(e.target.value)} className="text-[10px]" />}
        </div>

        <div className="flex flex-wrap gap-4">
          <Toggle checked={form.newDrop} onChange={(value) => setForm({ ...form, newDrop: value })} label="Add to New Drop" />
          <Toggle checked={form.featured} onChange={(value) => setForm({ ...form, featured: value })} label="Add to Featured" />
        </div>

        <p className="text-[10px] text-zinc-500">
          Creates a Size option type with S/M/L/XL variants and zero stock. Open the product editor to add colours, materials or any
          other option type and to set stock.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create product"}
          </Button>
        </div>
      </form>

      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setImage} folder="product" />
    </Modal>
  );
}
