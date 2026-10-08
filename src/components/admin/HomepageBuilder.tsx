"use client";

import React, { useMemo, useState } from "react";
import { StorefrontSection } from "@/components/sections/StorefrontSection";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Textarea, Toggle, adminFetch } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import {
  SECTION_TYPES,
  defaultSectionConfig,
  localizedConfigKey,
  normalizeSection,
  sectionAdminLabel,
  sectionEditorFields,
  sectionTypeLabel,
  suggestSectionName,
  uniqueSectionName,
  type Section,
  type SectionField,
} from "@/lib/homepage-sections";
import { selectSectionProducts, type SectionProductContext } from "@/lib/section-products";
import {
  ArrowDown,
  ArrowUp,
  Code,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Languages,
  Monitor,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";

interface Revision {
  id: string;
  revisionName: string;
  createdAt: string;
}

interface BuilderProduct {
  id: string;
  slug?: string;
  nameEn: string;
  nameAr?: string;
  nameFr?: string;
  sku?: string;
  price?: number;
  compareAtPrice?: number | null;
  badge?: string | null;
  images: { url: string; alt?: string; color?: string }[];
  categoryId?: string | null;
  collectionId?: string | null;
  featured?: boolean;
  createdAt?: string | null;
}

interface BuilderCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  nameFr?: string | null;
  imageUrl?: string | null;
}

interface BuilderCollection {
  id: string;
  slug: string;
  titleEn: string;
}

type Pane = "sections" | "preview" | "edit";

const PANES: { key: Pane; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "sections", label: "Sections", icon: Layers },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "edit", label: "Edit", icon: Pencil },
];

export function HomepageBuilder({
  initialSections,
  initialRevisions,
  productsList,
  categoriesList,
  collectionsList = [],
  groupProductIds = {},
}: {
  initialSections: Section[];
  initialRevisions: Revision[];
  productsList: BuilderProduct[];
  categoriesList: BuilderCategory[];
  collectionsList?: BuilderCollection[];
  groupProductIds?: { new_drop?: string[]; featured?: string[] };
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Mobile-only pane switcher: Sections | Preview | Edit. On large screens all
  // three panes are always visible, so the value only affects small layouts.
  const [pane, setPane] = useState<Pane>("sections");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState<{ accept: "image" | "video"; field: string } | null>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Keep the inspector pointed at a real row even after deletes/rollbacks.
  const safeSelectedIndex = sections.length === 0 ? 0 : Math.min(selectedIndex, sections.length - 1);

  const selected = sections[safeSelectedIndex] ?? null;

  const productContext: SectionProductContext = useMemo(
    () => ({
      categories: categoriesList.map((category) => ({ id: category.id, slug: category.slug })),
      collections: collectionsList.map((collection) => ({ id: collection.id, slug: collection.slug })),
      groupProductIds,
    }),
    [categoriesList, collectionsList, groupProductIds]
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

  const selectSection = (index: number) => {
    setSelectedIndex(index);
    setShowAdvanced(false);
    // Selecting a section opens its editor (the mobile pane switcher decides
    // whether that means visual focus on small screens).
    setPane("edit");
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
    const source = sections[index];
    const copy: Section = {
      ...JSON.parse(JSON.stringify(source)),
      id: undefined,
      name: uniqueSectionName(source.name ?? sectionTypeLabel(source.sectionType), sections),
    };
    next.splice(index + 1, 0, copy);
    setSections(next);
    setSelectedIndex(index + 1);
    setPane("edit");
  };

  const remove = (index: number) => {
    if (sections.length <= 1) {
      setError("At least one section must remain.");
      return;
    }
    setSections((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(Math.max(0, index - 1));
  };

  const addSection = (sectionType: string) => {
    const created: Section = {
      sectionType,
      // A sensible admin name, never public marketing copy: the new section
      // config starts empty so nothing generated here can reach customers.
      name: suggestSectionName(sectionType, sections),
      isVisible: true,
      desktopVisible: true,
      mobileVisible: true,
      config: defaultSectionConfig(),
    };
    setSections((prev) => [...prev, created]);
    setSelectedIndex(sections.length);
    setShowAdvanced(false);
    setAddOpen(false);
    setPane("edit");
    setNotice(`"${created.name}" added. It is a draft until you publish.`);
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

  const previewSections = sections.filter((section) => (viewport === "mobile" ? section.mobileVisible : section.desktopVisible));

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-5">
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

      {/* Mobile pane switcher (Sections | Preview | Edit). The three areas stay
          reachable on phones instead of being hidden. */}
      <div className="lg:hidden sticky top-14 z-30 -mx-4 px-3 py-2 bg-[#08080A]/95 backdrop-blur border-y border-white/10">
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Homepage builder panes">
          {PANES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              onClick={() => setPane(key)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] uppercase font-bold border ${
                pane === key ? "bg-white text-black border-white" : "bg-black/40 text-zinc-300 border-white/15"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] gap-4">
        {/* Sections list */}
        <Card className={`${pane === "sections" ? "block" : "hidden"} lg:block lg:max-h-[75vh] lg:overflow-y-auto`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs font-bold uppercase text-white">Sections ({sections.length})</h2>
            <button onClick={() => setAddOpen(true)} className="text-zinc-300 hover:text-white" aria-label="Add section">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <ul className="space-y-2">
            {sections.map((section, index) => (
              <li key={section.id ?? `${section.sectionType}-${index}`} className="border border-white/10">
                <button
                  onClick={() => selectSection(index)}
                  className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 border-b border-white/5 ${
                    index === safeSelectedIndex ? "bg-white text-black" : "bg-black/40 text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold uppercase truncate">
                      {sectionAdminLabel(section)}
                    </span>
                    <span className={`block text-[9px] uppercase tracking-wide ${index === safeSelectedIndex ? "text-black/60" : "text-zinc-500"}`}>
                      {sectionTypeLabel(section.sectionType)}
                      {!section.mobileVisible && " · mobile off"}
                      {!section.desktopVisible && " · desktop off"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0 pt-0.5">
                    {!section.isVisible && <EyeOff className="w-3 h-3" />}
                    <span className="text-[9px] opacity-60">{index + 1}</span>
                  </span>
                </button>

                <div className="flex items-center gap-1 px-1.5 py-1.5">
                  <button onClick={() => move(index, -1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move up">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(index, 1)} className="text-zinc-500 hover:text-white p-1" aria-label="Move down">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => duplicate(index)} className="text-zinc-500 hover:text-white p-1" aria-label="Duplicate">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSections((prev) => prev.map((s, i) => (i === index ? { ...s, isVisible: !s.isVisible } : s)))}
                    className="text-zinc-500 hover:text-white p-1"
                    aria-label="Toggle visibility"
                  >
                    {section.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => remove(index)} className="text-zinc-500 hover:text-red-400 p-1 ml-auto" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
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
        <div className={`${pane === "preview" ? "block" : "hidden"} lg:block bg-[#0E0E12] border border-white/10 p-3 space-y-3`}>
          <div className="flex items-center justify-between gap-2">
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
              className={`bg-black border border-white/10 overflow-y-auto w-full ${
                viewport === "mobile"
                  ? "max-w-[375px] h-[560px] sm:h-[620px]"
                  : viewport === "tablet"
                  ? "max-w-[768px] h-[620px]"
                  : "h-[620px]"
              }`}
            >
              {previewSections.length === 0 && (
                <p className="p-6 text-center text-[11px] uppercase text-zinc-500">
                  No section is enabled for this viewport.
                </p>
              )}
              {previewSections.map((section) => (
                <div
                  key={section.id ?? section.sectionType}
                  className={`relative cursor-pointer ${!section.isVisible ? "opacity-40" : ""}`}
                  onClick={() => selectSection(sections.indexOf(section))}
                >
                  <StorefrontSection
                    sectionType={section.sectionType}
                    config={section.config}
                    productsList={selectSectionProducts(
                      section.config ?? {},
                      productsList,
                      Number(section.config?.limit) || 8,
                      productContext
                    )}
                    categoriesList={categoriesList}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector / editor */}
        <Card className={`${pane === "edit" ? "block" : "hidden"} lg:block lg:max-h-[75vh] lg:overflow-y-auto`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs font-bold uppercase text-white">Section editor</h2>
            <button
              onClick={() => setPane("sections")}
              className="lg:hidden text-zinc-400 hover:text-white"
              aria-label="Close editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!selected ? (
            <p className="text-xs text-zinc-500">Select a section.</p>
          ) : (
            <div className="space-y-4">
              {/* Technical type (read-only) + admin name (editable) */}
              <div className="space-y-2 border border-white/10 p-3 bg-black/30">
                <Field label="Section type (read-only)" hint="Internal renderer. It never changes when you rename the section and is never shown to customers.">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{sectionTypeLabel(selected.sectionType)}</Badge>
                    <code className="text-[10px] text-zinc-400">{selected.sectionType}</code>
                  </div>
                </Field>

                <Field label="Section name" hint="Admin label only — customers never see it.">
                  <Input
                    value={selected.name ?? ""}
                    placeholder={sectionTypeLabel(selected.sectionType)}
                    onChange={(e) => update({ name: e.target.value })}
                    aria-label="Section name"
                  />
                </Field>
              </div>

              <div className="space-y-2 border border-white/10 p-3">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">Visibility</span>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <Toggle checked={selected.isVisible} onChange={(value) => update({ isVisible: value })} label="Enabled" />
                  <Toggle checked={selected.desktopVisible} onChange={(value) => update({ desktopVisible: value })} label="Desktop" />
                  <Toggle checked={selected.mobileVisible} onChange={(value) => update({ mobileVisible: value })} label="Mobile" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Public content</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowTranslations((value) => !value)}
                    className={`flex items-center gap-1 text-[10px] uppercase px-1.5 py-1 border ${
                      showTranslations ? "border-white text-white" : "border-white/15 text-zinc-400"
                    }`}
                  >
                    <Languages className="w-3 h-3" /> AR / FR
                  </button>
                  <button
                    onClick={() => setShowAdvanced((value) => !value)}
                    className={`flex items-center gap-1 text-[10px] uppercase px-1.5 py-1 border ${
                      showAdvanced ? "border-white text-white" : "border-white/15 text-zinc-400"
                    }`}
                  >
                    <Code className="w-3 h-3" /> JSON
                  </button>
                </div>
              </div>

              {showAdvanced ? (
                <AdvancedJsonEditor
                  // Remounting on selection change resets the text buffer without an effect.
                  key={selected.id ?? `${selected.sectionType}-${safeSelectedIndex}`}
                  value={selected.config ?? {}}
                  onApply={(next) => update({ config: next })}
                  onError={setError}
                />
              ) : (
                <div className="space-y-3">
                  <SectionFieldEditor
                    fields={sectionEditorFields(selected.sectionType)}
                    config={selected.config ?? {}}
                    showTranslations={showTranslations}
                    categories={categoriesList}
                    collections={collectionsList}
                    products={productsList}
                    onChange={updateConfig}
                    onPickMedia={(field, accept) => setPicker({ field, accept })}
                  />
                  {sectionEditorFields(selected.sectionType).length === 0 && (
                    <p className="text-[10px] text-zinc-500">
                      This section has no content fields. Use the advanced JSON editor for custom keys.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={addOpen} title="Add section" onClose={() => setAddOpen(false)}>
        <p className="text-[11px] text-zinc-400">
          Pick what the section renders. It is created as a draft with a sensible admin name and empty public content.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SECTION_TYPES.map((type) => (
            <button
              key={type.type}
              onClick={() => addSection(type.type)}
              className="border border-white/15 bg-black/40 hover:border-white/40 px-3 py-3 text-[11px] uppercase text-zinc-200 text-left"
            >
              {type.label}
              <span className="mt-1 block text-[9px] normal-case text-zinc-500">
                Default name: {type.defaultName}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <MediaPicker
        open={picker !== null}
        accept={picker?.accept ?? "image"}
        folder="homepage"
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker) updateConfig(picker.field, url);
          setPicker(null);
        }}
      />
    </div>
  );
}

/** Like Field, but a <div>: avoids nested <label> controls for pickers. */
function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="block space-y-1">
      <span className="block text-[11px] uppercase text-zinc-300 font-bold">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-zinc-500">{hint}</span>}
    </div>
  );
}

function SectionFieldEditor({
  fields,
  config,
  showTranslations,
  categories,
  collections,
  products,
  onChange,
  onPickMedia,
}: {
  fields: SectionField[];
  config: Record<string, any>;
  showTranslations: boolean;
  categories: BuilderCategory[];
  collections: BuilderCollection[];
  products: BuilderProduct[];
  onChange: (key: string, value: any) => void;
  onPickMedia: (field: string, accept: "image" | "video") => void;
}) {
  return (
    <>
      {fields.map((field) => {
        if (field.visibleWhen && String(config[field.visibleWhen.key] ?? "") !== field.visibleWhen.equals) {
          return null;
        }

        if (field.localized) {
          const primaryKey = localizedConfigKey(field.key, "en");
          return (
            <React.Fragment key={field.key}>
              <Field label={field.label}>
                {field.kind === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={config[primaryKey] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(primaryKey, e.target.value)}
                  />
                ) : (
                  <Input
                    value={config[primaryKey] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(primaryKey, e.target.value)}
                  />
                )}
              </Field>

              {showTranslations &&
                (["ar", "fr"] as const).map((language) => {
                  const key = localizedConfigKey(field.key, language);
                  return (
                    <Field key={key} label={`${field.label} (${language === "ar" ? "Arabic" : "French"})`}>
                      {field.kind === "textarea" ? (
                        <Textarea
                          rows={3}
                          dir={language === "ar" ? "rtl" : "ltr"}
                          value={config[key] ?? ""}
                          onChange={(e) => onChange(key, e.target.value)}
                        />
                      ) : (
                        <Input
                          dir={language === "ar" ? "rtl" : "ltr"}
                          value={config[key] ?? ""}
                          onChange={(e) => onChange(key, e.target.value)}
                        />
                      )}
                    </Field>
                  );
                })}
            </React.Fragment>
          );
        }

        const complex = field.kind === "products" || field.kind === "categories";
        const control = renderSimpleField({ field, config, categories, collections, products, onChange, onPickMedia });
        return complex ? (
          <FieldBlock key={field.key} label={field.label} hint={field.hint}>
            {control}
          </FieldBlock>
        ) : (
          <Field key={field.key} label={field.label} hint={field.hint}>
            {control}
          </Field>
        );
      })}
    </>
  );
}

function renderSimpleField({
  field,
  config,
  categories,
  collections,
  products,
  onChange,
  onPickMedia,
}: {
  field: SectionField;
  config: Record<string, any>;
  categories: BuilderCategory[];
  collections: BuilderCollection[];
  products: BuilderProduct[];
  onChange: (key: string, value: any) => void;
  onPickMedia: (field: string, accept: "image" | "video") => void;
}) {
  const value = config[field.key];

  switch (field.kind) {
    case "textarea":
      return <Textarea rows={4} value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} />;

    case "number":
      return (
        <Input
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? value : value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value === "" ? "" : Number(e.target.value))}
        />
      );

    case "range": {
      const raw = typeof value === "number" && Number.isFinite(value) ? value : 55;
      const percent = raw > 1 ? raw : Math.round(raw * 100);
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 5}
            value={percent}
            onChange={(e) => onChange(field.key, Number(e.target.value) / 100)}
            className="w-full accent-white"
          />
          <span className="text-[10px] text-zinc-400 w-10 text-right">{percent}%</span>
        </div>
      );
    }

    case "color":
      return (
        <Input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="h-9 w-full p-1"
        />
      );

    case "select": {
      const options =
        field.key === "categoryId"
          ? categories.map((category) => ({ value: category.id, label: category.nameEn }))
          : field.key === "collectionId"
          ? collections.map((collection) => ({ value: collection.id, label: collection.titleEn }))
          : field.options ?? [];
      return (
        <Select value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)}>
          <option value="">{field.key === "categoryId" || field.key === "collectionId" ? "— Select —" : "— Default —"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    case "image":
    case "video":
      return (
        <div className="flex items-center gap-2">
          {field.kind === "image" && value ? (
            <img src={value} alt="" className="w-12 h-12 object-cover border border-white/10" />
          ) : (
            <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-zinc-600" />
            </div>
          )}
          <Input value={value ?? ""} onChange={(e) => onChange(field.key, e.target.value)} placeholder="https://" />
          <Button variant="ghost" onClick={() => onPickMedia(field.key, field.kind === "video" ? "video" : "image")}>
            Pick
          </Button>
          {value ? (
            <Button variant="ghost" onClick={() => onChange(field.key, "")}>
              Clear
            </Button>
          ) : null}
        </div>
      );

    case "list": {
      const items: string[] = Array.isArray(value) ? value : [];
      return (
        <textarea
          rows={5}
          value={items.join("\n")}
          onChange={(e) =>
            onChange(
              field.key,
              e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            )
          }
          className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
        />
      );
    }

    case "products":
      return <ProductSelector products={products} selected={Array.isArray(value) ? value : []} categories={categories} onChange={(ids) => onChange(field.key, ids)} />;

    case "categories":
      return (
        <CategorySelector
          categories={categories}
          selected={Array.isArray(value) ? value : []}
          onChange={(slugs) => onChange(field.key, slugs)}
        />
      );

    case "url":
    default:
      return <Input value={value ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(field.key, e.target.value)} />;
  }
}

function ProductSelector({
  products,
  selected,
  categories,
  onChange,
}: {
  products: BuilderProduct[];
  selected: string[];
  categories: BuilderCategory[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const filtered = products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (!query) return true;
    return product.nameEn.toLowerCase().includes(query.toLowerCase());
  });

  const toggle = (productId: string) => {
    onChange(selected.includes(productId) ? selected.filter((id) => id !== productId) : [...selected, productId]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nameEn}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
        <span>{selected.length} selected</span>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="hover:text-white uppercase">
            Clear
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto border border-white/10 divide-y divide-white/5">
        {filtered.length === 0 && <p className="p-3 text-[10px] text-zinc-500">No products match.</p>}
        {filtered.map((product) => (
          <label key={product.id} className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300">
            <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
            <span className="truncate uppercase">{product.nameEn}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CategorySelector({
  categories,
  selected,
  onChange,
}: {
  categories: BuilderCategory[];
  selected: string[];
  onChange: (slugs: string[]) => void;
}) {
  const toggle = (slug: string) => {
    onChange(selected.includes(slug) ? selected.filter((value) => value !== slug) : [...selected, slug]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
        <span>{selected.length === 0 ? "All categories" : `${selected.length} selected`}</span>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="hover:text-white uppercase">
            Clear
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto border border-white/10 divide-y divide-white/5">
        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300">
            <input type="checkbox" checked={selected.includes(category.slug)} onChange={() => toggle(category.slug)} />
            <span className="truncate uppercase">{category.nameEn}</span>
          </label>
        ))}
        {categories.length === 0 && <p className="p-3 text-[10px] text-zinc-500">No categories yet.</p>}
      </div>
    </div>
  );
}

/** Optional advanced editing: the normal editor never requires JSON. */
function AdvancedJsonEditor({
  value,
  onApply,
  onError,
}: {
  value: Record<string, any>;
  onApply: (next: Record<string, any>) => void;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));

  return (
    <Field label="Section config (advanced JSON)" hint="Optional power-user editing of the raw public config.">
      <textarea
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full bg-black border border-white/20 p-2 text-[10px] text-white font-mono"
      />
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            try {
              const parsed = JSON.parse(text);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("Config must be a JSON object.");
              }
              onApply(parsed as Record<string, any>);
              onError("");
            } catch (err: any) {
              onError(err?.message ?? "Invalid JSON — fix it before applying.");
            }
          }}
        >
          Apply JSON
        </Button>
        <span className="text-[10px] text-zinc-500">Invalid JSON never overwrites the section.</span>
      </div>
    </Field>
  );
}
