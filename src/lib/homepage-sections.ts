/**
 * Homepage builder section shapes, admin naming and per-type editor fields.
 *
 * This module must stay free of "use client": the admin homepage server page
 * normalises database rows before passing them to the client builder, and
 * calling a function exported from a client module on the server is a render
 * error (HTTP 500).
 *
 * Three concepts are kept strictly apart:
 *   - sectionType: internal renderer type (`hero`, `product_grid`, ...).
 *   - name:        editable admin label, shown only inside the builder.
 *   - config:      public storefront content (heading, description, media, ...).
 */

export interface Section {
  id?: string;
  sectionType: string;
  /** Admin-only label. Never rendered on the storefront. */
  name?: string | null;
  isVisible: boolean;
  desktopVisible: boolean;
  mobileVisible: boolean;
  config: Record<string, any>;
}

export function normalizeSection(row: any): Section {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return {
    id: row.id,
    sectionType: row.sectionType,
    name: name || null,
    isVisible: row.isVisible ?? true,
    desktopVisible: row.desktopVisible ?? true,
    mobileVisible: row.mobileVisible ?? true,
    config: row.config ?? {},
  };
}

export interface SectionTypeMeta {
  type: string;
  /** Human label used inside the admin builder. */
  label: string;
  /** Admin name suggested when the section is created. */
  defaultName: string;
}

export const SECTION_TYPES: SectionTypeMeta[] = [
  { type: "announcement", label: "Announcement bar", defaultName: "Announcement Bar" },
  { type: "hero", label: "Hero banner", defaultName: "Hero" },
  { type: "marquee", label: "Marquee ticker", defaultName: "Marquee" },
  { type: "featured_collection", label: "Featured products", defaultName: "Featured Collection" },
  { type: "product_grid", label: "Product grid", defaultName: "Product Grid" },
  { type: "new_arrivals", label: "New arrivals", defaultName: "New Arrivals" },
  { type: "best_sellers", label: "Best sellers", defaultName: "Best Sellers" },
  { type: "category_showcase", label: "Category showcase", defaultName: "Category Showcase" },
  { type: "drop_announcement", label: "Drop announcement", defaultName: "New Drop" },
  { type: "brand_story", label: "Brand story", defaultName: "Brand Story" },
  { type: "newsletter", label: "Newsletter", defaultName: "Newsletter" },
  { type: "spacer", label: "Spacer", defaultName: "Spacer" },
  { type: "divider", label: "Divider", defaultName: "Divider" },
  { type: "footer", label: "Footer", defaultName: "Footer" },
];

const SECTION_TYPES_BY_KEY = new Map(SECTION_TYPES.map((meta) => [meta.type, meta]));

export function sectionTypeMeta(sectionType: string): SectionTypeMeta | undefined {
  return SECTION_TYPES_BY_KEY.get(sectionType);
}

/** Human-readable admin label for an internal renderer type. */
export function sectionTypeLabel(sectionType: string): string {
  const meta = sectionTypeMeta(sectionType);
  if (meta) return meta.label;
  return humanizeSectionType(sectionType);
}

/** "brand_story" -> "Brand Story". Admin-only fallback for unknown types. */
export function humanizeSectionType(sectionType: string): string {
  const words = String(sectionType || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "Section";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/**
 * Admin label of a section. Legacy rows without a custom name fall back to a
 * human-readable type label; the raw snake_case type is never shown as a name.
 */
export function sectionAdminLabel(section: Pick<Section, "name" | "sectionType">): string {
  const name = typeof section.name === "string" ? section.name.trim() : "";
  return name || sectionTypeLabel(section.sectionType);
}

/** Suggested admin name for a brand-new section of the given type. */
export function suggestSectionName(sectionType: string, existing: { name?: string | null }[] = []): string {
  const base = sectionTypeMeta(sectionType)?.defaultName ?? humanizeSectionType(sectionType);
  const taken = new Set(
    existing.map((section) => (typeof section.name === "string" ? section.name.trim().toLowerCase() : "")).filter(Boolean)
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/** Keeps section names unique inside the builder (used when duplicating). */
export function uniqueSectionName(base: string, existing: { name?: string | null }[] = []): string {
  const trimmed = String(base ?? "").trim() || "Section";
  const taken = new Set(
    existing.map((section) => (typeof section.name === "string" ? section.name.trim().toLowerCase() : "")).filter(Boolean)
  );
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${trimmed} ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

/** Public copy of a brand-new section: empty, never the admin name. */
export function defaultSectionConfig(): Record<string, any> {
  return {};
}

/** config key for a localized field, e.g. localizedConfigKey("title", "ar") -> "titleAr". */
export function localizedConfigKey(baseKey: string, language: "en" | "ar" | "fr"): string {
  return `${baseKey}${language === "en" ? "En" : language === "ar" ? "Ar" : "Fr"}`;
}

export type SectionFieldKind =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "select"
  | "range"
  | "color"
  | "checkbox"
  | "image"
  | "video"
  | "list"
  | "products"
  | "categories";

export interface SectionField {
  /** Base config key. Localized fields expand to `<key>En`, `<key>Ar`, `<key>Fr`. */
  key: string;
  label: string;
  kind: SectionFieldKind;
  localized?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** Show this field only when the section config matches (e.g. manual products). */
  visibleWhen?: { key: string; equals: string };
}

export const PRODUCT_SOURCE_OPTIONS = [
  { value: "auto", label: "Automatic (catalogue order)" },
  { value: "manual", label: "Manually selected products" },
  { value: "new_drop", label: "Managed New Drop" },
  { value: "featured", label: "Managed Featured" },
  { value: "newest", label: "Newest products" },
  { value: "best_sellers", label: "Best sellers" },
  { value: "category", label: "Products from a category" },
  { value: "collection", label: "Products from a collection" },
];

const ALIGNMENT_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const HEIGHT_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "full", label: "Full screen" },
];

const SPEED_OPTIONS = [
  { value: "slow", label: "Slow" },
  { value: "medium", label: "Medium" },
  { value: "fast", label: "Fast" },
];

const PRODUCT_FIELDS: SectionField[] = [
  { key: "title", label: "Public heading", kind: "text", localized: true },
  { key: "subtitle", label: "Description", kind: "textarea", localized: true },
  { key: "productSource", label: "Product source", kind: "select", options: PRODUCT_SOURCE_OPTIONS },
  {
    key: "productIds",
    label: "Selected products",
    kind: "products",
    hint: "Tick the products to show, in catalogue order.",
    visibleWhen: { key: "productSource", equals: "manual" },
  },
  {
    key: "categoryId",
    label: "Category",
    kind: "select",
    visibleWhen: { key: "productSource", equals: "category" },
  },
  {
    key: "collectionId",
    label: "Collection",
    kind: "select",
    visibleWhen: { key: "productSource", equals: "collection" },
  },
  { key: "limit", label: "Product limit", kind: "number", min: 1, max: 48 },
  { key: "ctaText", label: "Button text", kind: "text", localized: true },
  { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "/shop" },
];

export const SECTION_EDITOR_FIELDS: Record<string, SectionField[]> = {
  hero: [
    { key: "badge", label: "Badge", kind: "text", localized: true },
    { key: "title", label: "Heading", kind: "text", localized: true },
    { key: "subtitle", label: "Description / subtitle", kind: "textarea", localized: true },
    { key: "ctaPrimaryText", label: "Primary button text", kind: "text", localized: true },
    { key: "ctaPrimaryUrl", label: "Primary button link", kind: "url", placeholder: "/shop" },
    { key: "ctaSecondaryText", label: "Secondary button text", kind: "text", localized: true },
    { key: "ctaSecondaryUrl", label: "Secondary button link", kind: "url", placeholder: "/shop" },
    { key: "bgImageDesktop", label: "Background image", kind: "image" },
    { key: "bgImageMobile", label: "Mobile background image", kind: "image" },
    { key: "videoUrl", label: "Video URL", kind: "video" },
    { key: "overlayOpacity", label: "Overlay darkness", kind: "range", min: 0, max: 100, step: 5, hint: "0 = no overlay, 100 = black." },
    { key: "textAlignment", label: "Alignment", kind: "select", options: ALIGNMENT_OPTIONS },
    { key: "sectionHeight", label: "Height", kind: "select", options: HEIGHT_OPTIONS },
  ],
  featured_collection: PRODUCT_FIELDS,
  product_grid: PRODUCT_FIELDS,
  new_arrivals: PRODUCT_FIELDS,
  best_sellers: PRODUCT_FIELDS,
  product_carousel: PRODUCT_FIELDS,
  collection_showcase: PRODUCT_FIELDS,
  category_showcase: [
    { key: "title", label: "Public heading", kind: "text", localized: true },
    { key: "subtitle", label: "Description", kind: "textarea", localized: true },
    { key: "categoriesToShow", label: "Categories", kind: "categories", hint: "Leave empty to show every active category." },
    {
      key: "columnsDesktop",
      label: "Columns (desktop)",
      kind: "select",
      options: [2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: String(value) })),
    },
    {
      key: "columnsMobile",
      label: "Columns (mobile)",
      kind: "select",
      options: [1, 2, 3].map((value) => ({ value: String(value), label: String(value) })),
    },
    { key: "ctaText", label: "Button text", kind: "text", localized: true },
    { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "/shop" },
  ],
  drop_announcement: [
    { key: "badge", label: "Badge", kind: "text", localized: true },
    { key: "title", label: "Heading", kind: "text", localized: true },
    { key: "description", label: "Body", kind: "textarea", localized: true },
    { key: "ctaText", label: "Button text", kind: "text", localized: true },
    { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "/shop" },
    { key: "imageUrl", label: "Image", kind: "image" },
  ],
  brand_story: [
    { key: "badge", label: "Badge", kind: "text", localized: true },
    { key: "heading", label: "Heading", kind: "text", localized: true },
    { key: "text", label: "Body", kind: "textarea", localized: true },
    { key: "imageUrl", label: "Image", kind: "image" },
    { key: "ctaText", label: "Button text", kind: "text", localized: true },
    { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "/shop" },
  ],
  manifesto: [
    { key: "badge", label: "Badge", kind: "text", localized: true },
    { key: "heading", label: "Heading", kind: "text", localized: true },
    { key: "text", label: "Body", kind: "textarea", localized: true },
    { key: "imageUrl", label: "Image", kind: "image" },
    { key: "ctaText", label: "Button text", kind: "text", localized: true },
    { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "/shop" },
  ],
  announcement: [
    { key: "text", label: "Text", kind: "text", localized: true },
    { key: "linkUrl", label: "Link", kind: "url", placeholder: "/shop" },
    { key: "bgColor", label: "Background colour", kind: "color" },
    { key: "textColor", label: "Text colour", kind: "color" },
  ],
  marquee: [
    { key: "items", label: "Items", kind: "list", hint: "One item per line." },
    { key: "speed", label: "Speed", kind: "select", options: SPEED_OPTIONS },
    {
      key: "direction",
      label: "Direction",
      kind: "select",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
    },
    { key: "bgColor", label: "Background colour", kind: "color" },
    { key: "textColor", label: "Text colour", kind: "color" },
  ],
  newsletter: [
    { key: "title", label: "Heading", kind: "text", localized: true },
    { key: "subtitle", label: "Description", kind: "textarea", localized: true },
    { key: "buttonText", label: "Button text", kind: "text", localized: true },
  ],
  spacer: [{ key: "height", label: "Height (px)", kind: "number", min: 0, max: 400 }],
  divider: [],
  footer: [
    { key: "brandName", label: "Brand name", kind: "text" },
    { key: "tagline", label: "Tagline", kind: "text", localized: true },
    { key: "copyrightText", label: "Copyright", kind: "text", localized: true },
  ],
};

/** Generic fallback editor for section types without a dedicated field list. */
export const GENERIC_SECTION_FIELDS: SectionField[] = [
  { key: "title", label: "Public heading", kind: "text", localized: true },
  { key: "subtitle", label: "Description", kind: "textarea", localized: true },
  { key: "imageUrl", label: "Image", kind: "image" },
];

export function sectionEditorFields(sectionType: string): SectionField[] {
  return SECTION_EDITOR_FIELDS[sectionType] ?? GENERIC_SECTION_FIELDS;
}

/**
 * Legacy automatic labels that must never be published as storefront marketing
 * content (they were generated from the internal section type).
 */
export const FORBIDDEN_PUBLIC_LABELS = [
  "NEW HERO",
  "NEW PRODUCT GRID",
  "NEW FEATURED COLLECTION",
  "NEW CATEGORY SHOWCASE",
  "NEW BRAND STORY",
  "NEW ANNOUNCEMENT",
  "NEW MARQUEE",
  "Custom streetwear section content.",
];

const FORBIDDEN_PUBLIC_LABELS_SET = new Set(FORBIDDEN_PUBLIC_LABELS.map((label) => label.toUpperCase()));

/**
 * True when a stored config value is one of the legacy automatically generated
 * labels (e.g. a lost implementation wrote `titleEn: "NEW HERO"`). Such values
 * are hidden from customers and the section falls back to its built-in default.
 */
export function isLegacyGeneratedLabel(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return FORBIDDEN_PUBLIC_LABELS_SET.has(value.trim().toUpperCase());
}

/**
 * Returns a copy of a section config with legacy generated labels removed.
 * The storefront uses this before rendering so such values are absent from the
 * markup, from the client payload and from the customer's view — while the
 * stored database value stays untouched for the admin to edit.
 */
export function stripLegacyGeneratedLabels(config: Record<string, any>): Record<string, any> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      cleaned[key] = isLegacyGeneratedLabel(value) ? "" : value;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.filter((entry) => !isLegacyGeneratedLabel(entry));
    } else if (value && typeof value === "object") {
      cleaned[key] = stripLegacyGeneratedLabels(value as Record<string, any>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
