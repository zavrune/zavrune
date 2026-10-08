"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  Textarea,
  adminFetch,
} from "@/components/admin/ui";
import { ArrowDown, ArrowUp, Pencil, Plus, Ruler, Trash2 } from "lucide-react";

interface MeasurementRow {
  sizeLabel: string;
  chest: string;
  waist: string;
  hip: string;
  length: string;
  sleeve: string;
  inseam: string;
  customMeasurements?: unknown;
}

interface GuideRow {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  productCount: number;
  measurements: MeasurementRow[];
}

interface CategoryOption {
  id: string;
  nameEn: string;
}

const MEASUREMENT_FIELDS = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "length", label: "Length" },
  { key: "sleeve", label: "Sleeve" },
  { key: "inseam", label: "Inseam" },
] as const;

function toEditableRow(row: any): MeasurementRow {
  return {
    sizeLabel: row.sizeLabel ?? "",
    chest: row.chest ?? "",
    waist: row.waist ?? "",
    hip: row.hip ?? "",
    length: row.length ?? "",
    sleeve: row.sleeve ?? "",
    inseam: row.inseam ?? "",
    customMeasurements: row.customMeasurements ?? null,
  };
}

export function SizeGuidesManager() {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<GuideRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [guideData, categoryData] = await Promise.all([
        adminFetch<{ guides: GuideRow[] }>("/api/admin/size-guides"),
        adminFetch<{ categories: CategoryOption[] }>("/api/admin/categories"),
      ]);
      setGuides(guideData.guides.map((guide) => ({ ...guide, measurements: guide.measurements.map(toEditableRow) })));
      setCategories(categoryData.categories.map((category) => ({ id: category.id, nameEn: category.nameEn })));
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

  const remove = async (guide: GuideRow) => {
    const linked = guide.productCount > 0 ? ` ${guide.productCount} product(s) will lose the guide link.` : "";
    if (!confirm(`Delete size guide "${guide.name}"?${linked}`)) return;
    try {
      const data = await adminFetch<{ affectedProducts: number }>(`/api/admin/size-guides/${guide.id}`, { method: "DELETE" });
      setNotice(
        data.affectedProducts > 0
          ? `Deleted "${guide.name}". ${data.affectedProducts} product(s) had the guide cleared.`
          : `Deleted "${guide.name}".`
      );
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="FITMENT ARCHITECTURE"
        title="Size Guides"
        icon={<Ruler className="w-7 h-7 text-cyan-400" />}
        actions={
          <Button onClick={() => setCreating(true)}>
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New guide
            </span>
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      {loading ? (
        <Card>
          <Spinner label="Loading size guides..." />
        </Card>
      ) : guides.length === 0 ? (
        <Card>
          <EmptyState>No size guides yet. Create the first one to map garment measurements to sizes.</EmptyState>
        </Card>
      ) : (
        guides.map((guide) => (
          <Card key={guide.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white uppercase">{guide.name}</h2>
                {guide.description && <p className="text-[11px] text-zinc-400">{guide.description}</p>}
                <div className="flex items-center gap-2 pt-1">
                  {guide.categoryName && <Badge tone="info">{guide.categoryName}</Badge>}
                  <Badge tone={guide.productCount > 0 ? "success" : "neutral"}>{guide.productCount} product(s)</Badge>
                  <Badge tone="neutral">{guide.measurements.length} size(s)</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => setEditing(guide)}>
                  <span className="flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </span>
                </Button>
                <Button variant="danger" onClick={() => remove(guide)}>
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </span>
                </Button>
              </div>
            </div>
            <MeasurementTable rows={guide.measurements} />
          </Card>
        ))
      )}

      <SizeGuideModal
        open={creating}
        categories={categories}
        onClose={() => setCreating(false)}
        onSaved={(message) => {
          setCreating(false);
          setNotice(message);
          load();
        }}
      />

      {editing && (
        <SizeGuideModal
          open
          guide={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            load();
          }}
        />
      )}
    </div>
  );
}

function MeasurementTable({ rows }: { rows: MeasurementRow[] }) {
  const visibleFields = MEASUREMENT_FIELDS.filter((field) => rows.some((row) => (row[field.key] ?? "").trim()));
  return (
    <div className="overflow-x-auto border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-black text-zinc-300 uppercase border-b border-white/10">
          <tr>
            <th className="p-2.5">Size</th>
            {visibleFields.map((field) => (
              <th key={field.key} className="p-2.5">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td className="p-2.5 text-zinc-500" colSpan={1 + visibleFields.length}>
                No measurement rows yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                <td className="p-2.5 font-bold text-white">{row.sizeLabel}</td>
                {visibleFields.map((field) => (
                  <td key={field.key} className="p-2.5 text-zinc-300">
                    {row[field.key] || "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SizeGuideModal({
  open,
  guide,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  guide?: GuideRow;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(guide?.name ?? "");
  const [description, setDescription] = useState(guide?.description ?? "");
  const [categoryId, setCategoryId] = useState(guide?.categoryId ?? "");
  const [rows, setRows] = useState<MeasurementRow[]>(
    guide ? guide.measurements.map((row) => ({ ...row })) : [{ sizeLabel: "", chest: "", waist: "", hip: "", length: "", sleeve: "", inseam: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateRow = (index: number, patch: Partial<MeasurementRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name,
        description,
        categoryId: categoryId || null,
        measurements: rows.map((row) => ({
          sizeLabel: row.sizeLabel,
          chest: row.chest,
          waist: row.waist,
          hip: row.hip,
          length: row.length,
          sleeve: row.sleeve,
          inseam: row.inseam,
          customMeasurements: row.customMeasurements ?? null,
        })),
      };
      if (guide) {
        await adminFetch(`/api/admin/size-guides/${guide.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        onSaved(`Saved "${name}".`);
      } else {
        await adminFetch("/api/admin/size-guides", { method: "POST", body: JSON.stringify(payload) });
        onSaved(`Created "${name}".`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={guide ? "Edit size guide" : "New size guide"} onClose={onClose} wide>
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Streetwear Oversized Tops" />
          </Field>
          <Field label="Category (optional)" hint="Groups the guide with a product category.">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— No category —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameEn}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Measurements in cm. Designed for a relaxed, oversized drop-shoulder aesthetic." />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-[11px] uppercase text-zinc-300 font-bold">Measurements</span>
            <Button
              type="button"
              variant="subtle"
              onClick={() =>
                setRows((prev) => [...prev, { sizeLabel: "", chest: "", waist: "", hip: "", length: "", sleeve: "", inseam: "" }])
              }
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add size row
              </span>
            </Button>
          </div>
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-300 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2">Order</th>
                  <th className="p-2">Size</th>
                  {MEASUREMENT_FIELDS.map((field) => (
                    <th key={field.key} className="p-2">
                      {field.label}
                    </th>
                  ))}
                  <th className="p-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="p-1.5">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveRow(index, -1)} className="text-zinc-500 hover:text-white" aria-label="Move row up">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => moveRow(index, 1)} className="text-zinc-500 hover:text-white" aria-label="Move row down">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-1.5">
                      <Input required value={row.sizeLabel} onChange={(e) => updateRow(index, { sizeLabel: e.target.value })} placeholder="M" />
                    </td>
                    {MEASUREMENT_FIELDS.map((field) => (
                      <td key={field.key} className="p-1.5">
                        <Input
                          value={row[field.key]}
                          onChange={(e) => updateRow(index, { [field.key]: e.target.value } as Partial<MeasurementRow>)}
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="p-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        className="p-1.5 text-zinc-400 hover:text-red-400"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-500">
            Leave a measurement blank to skip that column. Rows keep the order shown here on the storefront size guide.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : guide ? "Save guide" : "Create guide"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
