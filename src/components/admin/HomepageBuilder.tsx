"use client";

import React, { useEffect, useState } from "react";
import { StorefrontSection } from "@/components/sections/StorefrontSection";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Spinner, adminFetch } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Monitor,
  Tablet,
  Trash2,
} from "lucide-react";

const SECTION_TYPES = [
  { type: "announcement", label: "Announcement bar" },
  { type: "hero", label: "Hero banner" },
  { type: "marquee", label: "Marquee ticker" },
  { type: "featured_collection", label: "Featured products" },
  { type: "product_grid", label: "Product grid" },
  { type: "new_arrivals", label: "New arrivals" },
  { type: "best_sellers", label: "Best sellers" },
  { type: "category_showcase", label: "Category showcase" },
  { type: "drop_announcement", label: "Drop announcement" },
  { type: "brand_story", label: "Brand story" },
  { type: "newsletter", label: "Newsletter" },
  { type: "spacer", label: "Spacer" },
  { type: "divider", label: "Divider" },
];

const PRODUCT_SOURCES = [
  { value: "auto", label: "Automatic (catalogue order)" },
  { value: "manual", label: "Manually selected products" },
  { value: "new_drop", label: "Managed New Drop" },
  { value: "featured", label: "Managed Featured" },
  { value: "newest", label: "Newest products" },
  { value: "best_sellers", label: "Best sellers" },
];

interface Section {
  id?: string;
  sectionType: string;
  isVisible: boolean;
  desktopVisible: boolean;
  mobileVisible: boolean;
  config: Record<string, any>;
}

interface Revision {
  id: string;
  revisionName: string;
  createdAt: string;
}

export function HomepageBuilder({
  initialSections,
  initialRevisions,
  productsList,
  categoriesList,
}: {
  initialSections: Section[];
  initialRevisions: Revision[];
  productsList: { id: string; nameEn: string; images: { url: string }[] }[];
  categoriesList: any[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState<null | "image" | "mobileImage" | "video">(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Keep the inspector pointed at a real row even after deletes/rollbacks.
  const safeSelectedIndex = sections.length === 0 ? 0 : Math.min(selectedIndex, sections.length - 1);

  const selected = sections[safeSelectedIndex] ?? null;
  const usesProducts = ["featured_collection", "product_grid", "new_arrivals", "best_sellers", "drop_announcement"].includes(
    selected?.sectionType ?? ""
  );

  const update = (patch: Partial<Section>) => {
    setSections((prev) => prev.map((section, index) => (index === safeSelectedIndex ? { ...section, ...patch } : section)));
  };

  const updateConfig = (key: string, value: any) => {
    setSections((prev) =>
      prev.map((section, index) =>
        index === safeSelectedIndex ? { ...section, config: { ...section.config, [key]: value } } : section
      )
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    setSelectedIndex(target);
  };

  const duplicate = (index: number) => {
    const next = [...sections];
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(sections[index])));
    setSections(next);
    setSelectedIndex(index + 1);
  };

  const remove = (index: number) => {
    if (sections.length <= 1) {
      setError("At least one section must remain.");
      return;
    }
    setSections((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(Math.max(0, index - 1));
  };

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    try {
      await adminFetch("/api/admin/sections", { method: "POST", body: JSON.stringify({ action: "save_draft", sections }) });
      setNotice("Draft saved. The live storefront is unchanged until you publish.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!confirm("Publish these sections to the live storefront?")) return;
    setBusy(true);
    setError("");
    try {
      const data = await adminFetch<{ message: string }>("/api/admin/sections", {
        method: "POST",
        body: JSON.stringify({ action: "publish", sections }),
      });
      setNotice(data.message ?? "Published.");
      await refreshRevisions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (revisionId?: string) => {
    if (!confirm(revisionId ? "Restore this revision to the live storefront?" : "Restore the most recent revision?")) return;
    setBusy(true);
    setError("");
    try {
      const data = await adminFetch<{ message: string }>("/api/admin/sections", {
        method: "POST",
        body: JSON.stringify({ action: "rollback", revisionId }),
      });
      setNotice(data.message ?? "Rolled back.");
      const refreshed = await adminFetch<{ sections: Section[]; revisions: Revision[] }>("/api/admin/sections?version=draft");
      setSections(refreshed.sections.map(normalizeSection));
      setRevisions(refreshed.revisions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshRevisions = async () => {
    const data = await adminFetch<{ revisions: Revision[] }>("/api/admin/sections?version=draft");
    setRevisions(data.revisions);
  };

  const toggleProduct = (productId: string) => {
    const current: string[] = Array.isArray(selected?.config?.productIds) ? selected!.config.productIds : [];
    const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
    updateConfig("productIds", next);
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="VISUAL STOREFRONT"
        title="Homepage Builder"
        icon={<Layers className="w-7 h-7 text-emerald-400" />}
        actions={
          <>
            <Button variant="ghost" onClick={saveDraft} disabled={busy}>
              <span className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5" /> Save draft
              </span>
            </Button>
            <Button onClick={publish} disabled={busy}>
              <span className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5" /> Publish live
              </span>
            </Button>
            <Button variant="subtle" onClick={() => rollback()} disabled={busy}>
              <span className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" /> Rollback
              </span>
            </Button>
          </>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-4">
        {/* Sections list */}
        <Card className="lg:max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs font-bold uppercase text-white">Sections ({sections.length})</h2>
            <button onClick={() => setAddOpen(true)} className="text-zinc-300 hover:text-white" aria-label="Add section">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {sections.map((section, index) => (
              <li key={index}>
                <button
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full text-left px-2 py-2 text-[11px] uppercase flex items-center justify-between gap-2 border ${
                    index === safeSelectedIndex ? "bg-white text-black border-white" : "bg-black/40 text-zinc-300 border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="truncate">{section.config?.titleEn || section.sectionType}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {!section.isVisible && <EyeOff className="w-3 h-3" />}
                    <span className="text-[9px] opacity-60">{index + 1}</span>
                  </span>
                </button>
                <div className="flex items-center gap-1 px-1 py-1">
                  <button onClick={() => move(index, -1)} className="text-zinc-500 hover:text-white p-0.5" aria-label="Move up">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => move(index, 1)} className="text-zinc-500 hover:text-white p-0.5" aria-label="Move down">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => duplicate(index)} className="text-zinc-500 hover:text-white p-0.5" aria-label="Duplicate">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setSections((prev) => prev.map((s, i) => (i === index ? { ...s, isVisible: !s.isVisible } : s)))}
                    className="text-zinc-500 hover:text-white p-0.5"
                    aria-label="Toggle visibility"
                  >
                    {section.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button onClick={() => remove(index)} className="text-zinc-500 hover:text-red-400 p-0.5 ml-auto" aria-label="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <h3 className="text-[10px] uppercase font-bold text-zinc-400">Revisions ({revisions.length})</h3>
            {revisions.slice(0, 6).map((revision) => (
              <button
                key={revision.id}
                onClick={() => rollback(revision.id)}
                className="w-full text-left text-[10px] text-zinc-400 hover:text-white border border-white/10 px-2 py-1 truncate"
              >
                {revision.revisionName}
                <span className="block text-[9px] text-zinc-600">{new Date(revision.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Preview */}
        <div className="bg-[#0E0E12] border border-white/10 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-zinc-400">Live preview (draft)</span>
            <div className="flex items-center gap-1">
              {[
                { key: "desktop" as const, icon: Monitor },
                { key: "tablet" as const, icon: Tablet },
                { key: "mobile" as const, icon: Smartphone },
              ].map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewport(key)}
                  className={`p-1.5 border ${viewport === key ? "bg-white text-black border-white" : "border-white/15 text-zinc-400"}`}
                  aria-label={`${key} preview`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className={`bg-black border border-white/10 overflow-y-auto ${
                viewport === "mobile"
                  ? "w-[375px] h-[620px]"
                  : viewport === "tablet"
                  ? "w-[768px] max-w-full h-[620px]"
                  : "w-full h-[620px]"
              }`}
            >
              {sections
                .filter((section) => (viewport === "mobile" ? section.mobileVisible : section.desktopVisible))
                .map((section, index) => (
                  <div
                    key={index}
                    className={`relative ${!section.isVisible ? "opacity-40" : ""}`}
                    onClick={() => setSelectedIndex(sections.indexOf(section))}
                  >
                    <StorefrontSection
                      sectionType={section.sectionType}
                      config={section.config}
                      productsList={productsList}
                      categoriesList={categoriesList}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <Card className="lg:max-h-[75vh] overflow-y-auto">
          <h2 className="text-xs font-bold uppercase text-white border-b border-white/10 pb-3">Inspector</h2>
          {!selected ? (
            <p className="text-xs text-zinc-500">Select a section.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge tone="info">{selected.sectionType}</Badge>
                <button onClick={() => setShowRawJson((value) => !value)} className="text-[10px] text-zinc-400 hover:text-white uppercase">
                  {showRawJson ? "Hide" : "Advanced"} JSON
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1 text-[10px] uppercase text-zinc-300">
                  <input type="checkbox" checked={selected.isVisible} onChange={(e) => update({ isVisible: e.target.checked })} />
                  Visible
                </label>
                <label className="flex items-center gap-1 text-[10px] uppercase text-zinc-300">
                  <input type="checkbox" checked={selected.desktopVisible} onChange={(e) => update({ desktopVisible: e.target.checked })} />
                  Desktop
                </label>
                <label className="flex items-center gap-1 text-[10px] uppercase text-zinc-300">
                  <input type="checkbox" checked={selected.mobileVisible} onChange={(e) => update({ mobileVisible: e.target.checked })} />
                  Mobile
                </label>
              </div>

              {showRawJson ? (
                <Field label="Section config (JSON)">
                  <textarea
                    rows={14}
                    value={JSON.stringify(selected.config ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        update({ config: JSON.parse(e.target.value) });
                        setError("");
                      } catch {
                        setError("Invalid JSON — fix it before saving.");
                      }
                    }}
                    className="w-full bg-black border border-white/20 p-2 text-[10px] text-white font-mono"
                  />
                </Field>
              ) : (
                <>
                  <Field label="Title (English)">
                    <Input value={selected.config?.titleEn ?? ""} onChange={(e) => updateConfig("titleEn", e.target.value)} />
                  </Field>
                  <Field label="Title (Arabic)">
                    <Input dir="rtl" value={selected.config?.titleAr ?? ""} onChange={(e) => updateConfig("titleAr", e.target.value)} />
                  </Field>
                  <Field label="Title (French)">
                    <Input value={selected.config?.titleFr ?? ""} onChange={(e) => updateConfig("titleFr", e.target.value)} />
                  </Field>
                  <Field label="Subtitle (English)">
                    <Input value={selected.config?.subtitleEn ?? ""} onChange={(e) => updateConfig("subtitleEn", e.target.value)} />
                  </Field>
                  <Field label="Subtitle (Arabic)">
                    <Input dir="rtl" value={selected.config?.subtitleAr ?? ""} onChange={(e) => updateConfig("subtitleAr", e.target.value)} />
                  </Field>
                  <Field label="Body text (English)">
                    <textarea
                      rows={3}
                      value={selected.config?.textEn ?? ""}
                      onChange={(e) => updateConfig("textEn", e.target.value)}
                      className="w-full bg-black border border-white/20 p-2 text-xs text-white"
                    />
                  </Field>

                  <Field label="Image">
                    <div className="flex items-center gap-2">
                      {selected.config?.imageUrl ? (
                        <img src={selected.config.imageUrl} alt="" className="w-12 h-12 object-cover border border-white/10" />
                      ) : (
                        <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}
                      <Button variant="ghost" onClick={() => setPicker("image")}>
                        Choose
                      </Button>
                      {selected.config?.imageUrl && (
                        <Button variant="ghost" onClick={() => updateConfig("imageUrl", "")}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </Field>

                  <Field label="Mobile image (optional)">
                    <div className="flex items-center gap-2">
                      {selected.config?.mobileImageUrl ? (
                        <img src={selected.config.mobileImageUrl} alt="" className="w-12 h-12 object-cover border border-white/10" />
                      ) : (
                        <div className="w-12 h-12 bg-zinc-800" />
                      )}
                      <Button variant="ghost" onClick={() => setPicker("mobileImage")}>
                        Choose
                      </Button>
                    </div>
                  </Field>

                  <Field label="Video URL (optional)">
                    <div className="flex items-center gap-2">
                      <Input value={selected.config?.videoUrl ?? ""} onChange={(e) => updateConfig("videoUrl", e.target.value)} />
                      <Button variant="ghost" onClick={() => setPicker("video")}>
                        Pick
                      </Button>
                    </div>
                  </Field>

                  <Field label="Primary button text">
                    <Input value={selected.config?.ctaPrimaryTextEn ?? ""} onChange={(e) => updateConfig("ctaPrimaryTextEn", e.target.value)} />
                  </Field>
                  <Field label="Primary button link">
                    <Input value={selected.config?.ctaPrimaryUrl ?? ""} onChange={(e) => updateConfig("ctaPrimaryUrl", e.target.value)} />
                  </Field>
                  <Field label="Secondary button text">
                    <Input
                      value={selected.config?.ctaSecondaryTextEn ?? ""}
                      onChange={(e) => updateConfig("ctaSecondaryTextEn", e.target.value)}
                    />
                  </Field>
                  <Field label="Secondary button link">
                    <Input value={selected.config?.ctaSecondaryUrl ?? ""} onChange={(e) => updateConfig("ctaSecondaryUrl", e.target.value)} />
                  </Field>

                  {usesProducts && (
                    <>
                      <Field label="Product source">
                        <Select
                          value={selected.config?.productSource ?? "auto"}
                          onChange={(e) => updateConfig("productSource", e.target.value)}
                        >
                          {PRODUCT_SOURCES.map((source) => (
                            <option key={source.value} value={source.value}>
                              {source.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Max products">
                        <Input
                          type="number"
                          value={selected.config?.limit ?? 8}
                          onChange={(e) => updateConfig("limit", Number(e.target.value) || 8)}
                        />
                      </Field>
                      {selected.config?.productSource === "manual" && (
                        <div className="space-y-1">
                          <span className="text-[11px] uppercase text-zinc-300 font-bold">Selected products</span>
                          <div className="max-h-48 overflow-y-auto border border-white/10 divide-y divide-white/5">
                            {productsList.map((product) => {
                              const chosen: string[] = Array.isArray(selected.config?.productIds) ? selected.config.productIds : [];
                              return (
                                <label key={product.id} className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={chosen.includes(product.id)}
                                    onChange={() => toggleProduct(product.id)}
                                  />
                                  <span className="truncate uppercase">{product.nameEn}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <Field label="Background colour">
                    <Input
                      type="color"
                      value={selected.config?.backgroundColor ?? "#08080A"}
                      onChange={(e) => updateConfig("backgroundColor", e.target.value)}
                      className="h-9 w-full p-1"
                    />
                  </Field>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={addOpen} title="Add section" onClose={() => setAddOpen(false)}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SECTION_TYPES.map((type) => (
            <button
              key={type.type}
              onClick={() => {
                setSections((prev) => [
                  ...prev,
                  {
                    sectionType: type.type,
                    isVisible: true,
                    desktopVisible: true,
                    mobileVisible: true,
                    config: {
                      titleEn: type.label.toUpperCase(),
                      subtitleEn: "",
                      productSource: "auto",
                      limit: 8,
                    },
                  },
                ]);
                setSelectedIndex(sections.length);
                setAddOpen(false);
              }}
              className="border border-white/15 bg-black/40 hover:border-white/40 px-3 py-3 text-[11px] uppercase text-zinc-200 text-left"
            >
              {type.label}
            </button>
          ))}
        </div>
      </Modal>

      <MediaPicker
        open={picker !== null}
        accept={picker === "video" ? "video" : "image"}
        folder="homepage"
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "image") updateConfig("imageUrl", url);
          else if (picker === "mobileImage") updateConfig("mobileImageUrl", url);
          else if (picker === "video") updateConfig("videoUrl", url);
        }}
      />
    </div>
  );
}

export function normalizeSection(row: any): Section {
  return {
    id: row.id,
    sectionType: row.sectionType,
    isVisible: row.isVisible ?? true,
    desktopVisible: row.desktopVisible ?? true,
    mobileVisible: row.mobileVisible ?? true,
    config: row.config ?? {},
  };
}
