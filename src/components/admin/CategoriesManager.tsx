"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Spinner, Toggle, adminFetch } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { ArrowDown, ArrowUp, Grid, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";

interface CategoryRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  nameFr: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ categories: CategoryRow[] }>("/api/admin/categories");
      setCategories(data.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const reorder = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    try {
      await adminFetch("/api/admin/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ categoryIds: next.map((category) => category.id) }),
      });
    } catch (err: any) {
      setError(err.message);
      load();
    }
  };

  const toggleActive = async (category: CategoryRow) => {
    try {
      await adminFetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      setCategories((prev) => prev.map((row) => (row.id === category.id ? { ...row, isActive: !row.isActive } : row)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (category: CategoryRow) => {
    if (category.productCount > 0) {
      setError(
        `"${category.nameEn}" still has ${category.productCount} product(s). Open the category and reassign them before deleting.`
      );
      return;
    }
    if (!confirm(`Delete category "${category.nameEn}"?`)) return;
    try {
      await adminFetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      setNotice(`Deleted "${category.nameEn}".`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="CATALOGUE STRUCTURE"
        title="Categories"
        icon={<Grid className="w-7 h-7 text-sky-400" />}
        actions={
          <Button onClick={() => setCreating(true)}>
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New category
            </span>
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        {loading ? (
          <Spinner label="Loading categories..." />
        ) : categories.length === 0 ? (
          <EmptyState>No categories yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2.5">Order</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Slug</th>
                  <th className="p-2.5">Products</th>
                  <th className="p-2.5">Active</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {categories.map((category, index) => (
                  <tr key={category.id} className="hover:bg-white/5">
                    <td className="p-2.5">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => reorder(index, -1)} className="text-zinc-500 hover:text-white" aria-label="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => reorder(index, 1)} className="text-zinc-500 hover:text-white" aria-label="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-3">
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt="" className="w-10 h-10 object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 bg-zinc-800 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                        <div>
                          <strong className="text-white uppercase block">{category.nameEn}</strong>
                          <span className="text-zinc-500 text-[10px] block">{category.nameAr}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5 text-zinc-500">{category.slug}</td>
                    <td className="p-2.5">
                      <Badge tone={category.productCount > 0 ? "success" : "warning"}>{category.productCount}</Badge>
                    </td>
                    <td className="p-2.5">
                      <Toggle checked={category.isActive} onChange={() => toggleActive(category)} label="" />
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(category)} className="p-1.5 text-zinc-300 hover:text-white" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(category)} className="p-1.5 text-zinc-400 hover:text-red-400" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CategoryModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          setNotice("Category created.");
          load();
        }}
      />

      {editing && (
        <CategoryModal
          open
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Category saved.");
            load();
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category?: CategoryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nameEn: category?.nameEn ?? "",
    nameAr: category?.nameAr ?? "",
    nameFr: category?.nameFr ?? "",
    imageUrl: category?.imageUrl ?? "",
    slug: category?.slug ?? "",
  });
  const [assignIds, setAssignIds] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (category) {
        await adminFetch(`/api/admin/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...form,
            productIds: assignIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          }),
        });
      } else {
        await adminFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(form) });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={category ? "Edit category" : "New category"} onClose={onClose}>
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name (English)">
          <Input required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name (Arabic)">
            <Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          </Field>
          <Field label="Name (French)">
            <Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
          </Field>
        </div>
        <Field label="Slug" hint="Used by /shop?category=<slug>">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>
        <Field label="Image">
          <div className="flex items-center gap-3">
            {form.imageUrl ? <img src={form.imageUrl} alt="" className="w-14 h-14 object-cover border border-white/10" /> : null}
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
              Choose / upload
            </Button>
            {form.imageUrl && (
              <Button type="button" variant="ghost" onClick={() => setForm({ ...form, imageUrl: "" })}>
                Clear
              </Button>
            )}
          </div>
        </Field>
        {category && (
          <Field label="Assign products by ID (comma separated)" hint="Optional bulk move of products into this category.">
            <Input value={assignIds} onChange={(e) => setAssignIds(e.target.value)} placeholder="uuid, uuid" />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(url) => setForm({ ...form, imageUrl: url })} folder="category" />
    </Modal>
  );
}
