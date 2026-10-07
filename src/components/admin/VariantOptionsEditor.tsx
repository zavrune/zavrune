"use client";

import React, { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Select, Toggle, adminFetch, formatDZD } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Image as ImageIcon, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";

export interface EditorOptionValue {
  id?: string;
  value: string;
  isEnabled: boolean;
  colorHex: string;
  imageUrl: string;
}

export interface EditorOptionType {
  id?: string;
  name: string;
  isEnabled: boolean;
  values: EditorOptionValue[];
}

export interface EditorVariant {
  id?: string;
  sku: string;
  stock: number;
  price: string;
  compareAtPrice: string;
  imageUrl: string;
  status: "active" | "inactive";
  options: Record<string, string>;
}

const COMMON_OPTIONS = ["Size", "Color", "Material", "Fit", "Style"];

function emptyValue(): EditorOptionValue {
  return { value: "", isEnabled: true, colorHex: "", imageUrl: "" };
}

/** Cartesian product of the enabled values of every enabled option type. */
function buildCombinations(optionTypes: EditorOptionType[]): Record<string, string>[] {
  const axes = optionTypes
    .filter((type) => type.isEnabled && type.name.trim())
    .map((type) => ({
      name: type.name.trim(),
      values: type.values.filter((value) => value.isEnabled && value.value.trim()).map((value) => value.value.trim()),
    }))
    .filter((axis) => axis.values.length > 0);

  if (axes.length === 0) return [];

  return axes.reduce<Record<string, string>[]>((acc, axis) => {
    const next: Record<string, string>[] = [];
    for (const combination of acc) {
      for (const value of axis.values) {
        next.push({ ...combination, [axis.name]: value });
      }
    }
    return next;
  }, [{}]);
}

function combinationKey(options: Record<string, string>) {
  return Object.entries(options)
    .map(([key, value]) => `${key.toLowerCase()}=${value.toLowerCase()}`)
    .sort()
    .join("|");
}

export function VariantOptionsEditor({
  productId,
  baseSku,
  basePrice,
  initialOptionTypes,
  initialVariants,
  onSaved,
}: {
  productId: string;
  baseSku: string;
  basePrice: number;
  initialOptionTypes: EditorOptionType[];
  initialVariants: EditorVariant[];
  onSaved?: (message: string) => void;
}) {
  const [optionTypes, setOptionTypes] = useState<EditorOptionType[]>(initialOptionTypes);
  const [variants, setVariants] = useState<EditorVariant[]>(initialVariants);
  const [newOptionName, setNewOptionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerFor, setPickerFor] = useState<{ kind: "variant"; index: number } | { kind: "value"; typeIndex: number; valueIndex: number } | null>(null);

  const updateType = (index: number, patch: Partial<EditorOptionType>) => {
    setOptionTypes((prev) => prev.map((type, i) => (i === index ? { ...type, ...patch } : type)));
  };

  const moveType = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= optionTypes.length) return;
    const next = [...optionTypes];
    [next[index], next[target]] = [next[target], next[index]];
    setOptionTypes(next);
  };

  const removeType = (index: number) => {
    if (!confirm("Remove this option type and its values? Matching variants are removed on save.")) return;
    setOptionTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const addValue = (typeIndex: number, value: string) => {
    if (!value.trim()) return;
    setOptionTypes((prev) =>
      prev.map((type, i) => (i === typeIndex ? { ...type, values: [...type.values, { ...emptyValue(), value: value.trim() }] } : type))
    );
  };

  const updateValue = (typeIndex: number, valueIndex: number, patch: Partial<EditorOptionValue>) => {
    setOptionTypes((prev) =>
      prev.map((type, i) =>
        i === typeIndex ? { ...type, values: type.values.map((value, j) => (j === valueIndex ? { ...value, ...patch } : value)) } : type
      )
    );
  };

  const removeValue = (typeIndex: number, valueIndex: number) => {
    setOptionTypes((prev) =>
      prev.map((type, i) => (i === typeIndex ? { ...type, values: type.values.filter((_, j) => j !== valueIndex) } : type))
    );
  };

  /** Generates the variant matrix, keeping stock/prices of matching rows. */
  const generateVariants = () => {
    const combinations = buildCombinations(optionTypes);
    if (combinations.length === 0) {
      setError("Add at least one enabled option type with enabled values first.");
      return;
    }

    setVariants((prev) => {
      const byKey = new Map(prev.map((variant) => [combinationKey(variant.options), variant]));
      return combinations.map((options, index) => {
        const existing = byKey.get(combinationKey(options));
        if (existing) return existing;
        const suffix = Object.values(options)
          .map((value) => value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase())
          .join("-");
        return {
          sku: `${baseSku}-${suffix || index + 1}`.slice(0, 120),
          stock: 0,
          price: String(basePrice),
          compareAtPrice: "",
          imageUrl: "",
          status: "active" as const,
          options,
        };
      });
    });
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        optionTypes: optionTypes
          .filter((type) => type.name.trim())
          .map((type) => ({
            id: type.id,
            name: type.name.trim(),
            isEnabled: type.isEnabled,
            values: type.values
              .filter((value) => value.value.trim())
              .map((value) => ({
                id: value.id,
                value: value.value.trim(),
                isEnabled: value.isEnabled,
                colorHex: value.colorHex || null,
                imageUrl: value.imageUrl || null,
              })),
          })),
        variants: variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          stock: Number(variant.stock) || 0,
          price: variant.price === "" ? null : Number(variant.price),
          compareAtPrice: variant.compareAtPrice === "" ? null : Number(variant.compareAtPrice),
          imageUrl: variant.imageUrl || null,
          status: variant.status,
          options: variant.options,
        })),
      };

      const data = await adminFetch<{ graph: any; result: { created: number; updated: number; deleted: number } }>(
        `/api/admin/products/${productId}/variants`,
        { method: "PUT", body: JSON.stringify(payload) }
      );

      setOptionTypes(
        data.graph.optionTypes.map((type: any) => ({
          id: type.id,
          name: type.name,
          isEnabled: type.isEnabled,
          values: type.values.map((value: any) => ({
            id: value.id,
            value: value.value,
            isEnabled: value.isEnabled,
            colorHex: value.colorHex ?? "",
            imageUrl: value.imageUrl ?? "",
          })),
        }))
      );
      setVariants(
        data.graph.variants.map((variant: any) => ({
          id: variant.id,
          sku: variant.sku,
          stock: variant.stock,
          price: variant.price === null ? "" : String(variant.price),
          compareAtPrice: variant.compareAtPrice === null ? "" : String(variant.compareAtPrice),
          imageUrl: variant.imageUrl ?? "",
          status: variant.status === "inactive" ? "inactive" : "active",
          options: variant.options ?? {},
        }))
      );

      onSaved?.(`Saved ${data.graph.variants.length} variant(s).`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="text-sm font-bold uppercase text-white">Option types & values</h2>
          <span className="text-[10px] text-zinc-500">Size, Color, Material, Fit, Style — or any custom name.</span>
        </div>

        {optionTypes.length === 0 && <EmptyState>No option types yet. Add one below (for example “Material”).</EmptyState>}

        {optionTypes.map((type, typeIndex) => (
          <div key={typeIndex} className="border border-white/10 bg-black/40 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={type.name}
                onChange={(e) => updateType(typeIndex, { name: e.target.value })}
                placeholder="Option name e.g. Material"
                className="max-w-[240px]"
              />
              <Toggle checked={type.isEnabled} onChange={(value) => updateType(typeIndex, { isEnabled: value })} label="Enabled" />
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => moveType(typeIndex, -1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move up">▲</button>
                <button onClick={() => moveType(typeIndex, 1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move down">▼</button>
                <button onClick={() => removeType(typeIndex)} className="text-zinc-500 hover:text-red-400 p-1" aria-label="Delete option type">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {type.values.map((value, valueIndex) => (
                <div key={valueIndex} className="flex flex-wrap items-center gap-2">
                  <Input
                    value={value.value}
                    onChange={(e) => updateValue(typeIndex, valueIndex, { value: e.target.value })}
                    placeholder="Value e.g. Cotton"
                    className="max-w-[200px]"
                  />
                  {type.name.toLowerCase() === "color" && (
                    <Input
                      type="color"
                      value={value.colorHex || "#000000"}
                      onChange={(e) => updateValue(typeIndex, valueIndex, { colorHex: e.target.value })}
                      className="w-14 h-9 p-1"
                      title="Swatch colour"
                    />
                  )}
                  <button
                    onClick={() => setPickerFor({ kind: "value", typeIndex, valueIndex })}
                    className="p-1.5 text-zinc-400 hover:text-white"
                    title="Value image"
                  >
                    {value.imageUrl ? (
                      <img src={value.imageUrl} alt="" className="w-8 h-8 object-cover border border-white/20" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </button>
                  <Toggle
                    checked={value.isEnabled}
                    onChange={(checked) => updateValue(typeIndex, valueIndex, { isEnabled: checked })}
                    label="Enabled"
                  />
                  <button
                    onClick={() => removeValue(typeIndex, valueIndex)}
                    className="ml-auto text-zinc-500 hover:text-red-400 p-1"
                    aria-label="Delete value"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <AddValueRow onAdd={(value) => addValue(typeIndex, value)} />
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
          <Field label="Add option type" className="w-56">
            <Input
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder="Material, Fit, Style..."
              list="common-options"
            />
          </Field>
          <datalist id="common-options">
            {COMMON_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <Button
            variant="subtle"
            onClick={() => {
              if (!newOptionName.trim()) return;
              setOptionTypes((prev) => [...prev, { name: newOptionName.trim(), isEnabled: true, values: [emptyValue()] }]);
              setNewOptionName("");
            }}
          >
            <span className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Add option type
            </span>
          </Button>
          <Button variant="ghost" onClick={generateVariants}>
            <span className="flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate variant combinations
            </span>
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-sm font-bold uppercase text-white">Variants ({variants.length})</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="subtle"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  { sku: `${baseSku}-${prev.length + 1}`, stock: 0, price: String(basePrice), compareAtPrice: "", imageUrl: "", status: "active", options: {} },
                ])
              }
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add variant
              </span>
            </Button>
            <Button variant="ghost" onClick={generateVariants} title="Rebuild from option values">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {variants.length === 0 ? (
          <EmptyState>No variants yet. Generate combinations from your option values.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="p-2">Combination</th>
                  <th className="p-2">SKU</th>
                  <th className="p-2 w-20">Stock</th>
                  <th className="p-2 w-24">Price</th>
                  <th className="p-2 w-24">Sale price</th>
                  <th className="p-2">Image</th>
                  <th className="p-2">Availability</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {variants.map((variant, index) => (
                  <tr key={index} className="hover:bg-white/5">
                    <td className="p-2">
                      {Object.keys(variant.options).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(variant.options).map(([key, value]) => (
                            <Badge key={key} tone="info">
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-500">default</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Input
                        value={variant.sku}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, sku: e.target.value } : row)))
                        }
                        className="text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={variant.stock}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, stock: Number(e.target.value) } : row)))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={variant.price}
                        placeholder="base"
                        onChange={(e) =>
                          setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, price: e.target.value } : row)))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={variant.compareAtPrice}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, compareAtPrice: e.target.value } : row)))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <button onClick={() => setPickerFor({ kind: "variant", index })} title="Variant image" className="p-1">
                        {variant.imageUrl ? (
                          <img src={variant.imageUrl} alt="" className="w-9 h-11 object-cover border border-white/20" />
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <ImageIcon className="w-3.5 h-3.5" /> add
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="p-2">
                      <Select
                        value={variant.status}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, status: e.target.value as "active" | "inactive" } : row))
                          )
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Disabled</option>
                      </Select>
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => setVariants((prev) => prev.filter((_, i) => i !== index))}
                        className="text-zinc-500 hover:text-red-400 p-1"
                        aria-label="Delete variant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-[10px] text-zinc-500">
            Saving replaces the option graph atomically. Combos removed here are deleted; stock, prices and images of kept combos are
            preserved. Base price {formatDZD(basePrice)}.
          </p>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving variants..." : "Save options & variants"}
          </Button>
        </div>
      </Card>

      <MediaPicker
        open={pickerFor !== null}
        accept="image"
        folder="product"
        onClose={() => setPickerFor(null)}
        onSelect={(url) => {
          if (!pickerFor) return;
          if (pickerFor.kind === "variant") {
            setVariants((prev) => prev.map((row, i) => (i === pickerFor.index ? { ...row, imageUrl: url } : row)));
          } else {
            updateValue(pickerFor.typeIndex, pickerFor.valueIndex, { imageUrl: url });
          }
        }}
      />
    </div>
  );
}

function AddValueRow({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add value"
        className="max-w-[200px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd(value);
            setValue("");
          }
        }}
      />
      <Button
        variant="ghost"
        onClick={() => {
          onAdd(value);
          setValue("");
        }}
      >
        <span className="flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add value
        </span>
      </Button>
    </div>
  );
}
