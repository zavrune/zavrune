/**
 * Unit coverage for the homepage section model:
 *   - sectionType / admin name / public config stay separate;
 *   - every supported type ships a normal (non-JSON) editor;
 *   - the storefront never renders the admin name or a generated label.
 *
 * Run with: node --import tsx --test tests/homepage-sections.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  FORBIDDEN_PUBLIC_LABELS,
  isLegacyGeneratedLabel,
  stripLegacyGeneratedLabels,
  SECTION_TYPES,
  defaultSectionConfig,
  humanizeSectionType,
  normalizeSection,
  sectionAdminLabel,
  sectionEditorFields,
  sectionTypeLabel,
  suggestSectionName,
  uniqueSectionName,
  type SectionField,
} from "../src/lib/homepage-sections";
import { selectSectionProducts } from "../src/lib/section-products";

const ROOT = path.resolve(__dirname, "..");
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

test("an admin name is stored next to — never instead of — the section type and config", () => {
  const section = normalizeSection({
    id: "row-1",
    sectionType: "hero",
    name: "  Winter 26 Hero  ",
    isVisible: true,
    desktopVisible: false,
    mobileVisible: true,
    config: { titleEn: "WINTER '26 DROP" },
  });

  assert.equal(section.sectionType, "hero");
  assert.equal(section.name, "Winter 26 Hero");
  assert.equal(section.config.titleEn, "WINTER '26 DROP");
  assert.equal(section.desktopVisible, false);
});

test("legacy rows without a custom name keep working and get a human-readable admin fallback", () => {
  const legacy = normalizeSection({ id: "row-2", sectionType: "brand_story", config: {} });
  assert.equal(legacy.name, null);
  assert.equal(sectionAdminLabel(legacy).toLowerCase(), "brand story");
  assert.doesNotMatch(sectionAdminLabel(legacy), /brand_story/);

  assert.equal(sectionTypeLabel("hero"), "Hero banner");
  assert.equal(humanizeSectionType("my_custom_block"), "My Custom Block");
  assert.equal(humanizeSectionType(""), "Section");
  // The raw internal type is never surfaced as an admin label.
  assert.notEqual(sectionAdminLabel({ sectionType: "category_showcase", name: "" }), "category_showcase");
});

test("new sections get a sensible admin name and empty public content", () => {
  assert.equal(suggestSectionName("hero"), "Hero");
  assert.equal(suggestSectionName("product_grid"), "Product Grid");
  assert.equal(suggestSectionName("drop_announcement"), "New Drop");
  assert.equal(suggestSectionName("hero", [{ name: "Hero" }]), "Hero 2");

  const config = defaultSectionConfig();
  assert.deepEqual(config, {});
  const serialized = JSON.stringify(config);
  for (const forbidden of FORBIDDEN_PUBLIC_LABELS) {
    assert.ok(!serialized.includes(forbidden), `new sections must not contain "${forbidden}"`);
  }
});

test("duplicating a section yields a distinct admin name", () => {
  assert.equal(uniqueSectionName("Hero", [{ name: "Hero" }]), "Hero 2");
  assert.equal(uniqueSectionName("Hero", [{ name: "Hero" }, { name: "Hero 2" }]), "Hero 3");
  assert.equal(uniqueSectionName("Winter Hero", []), "Winter Hero");
  assert.equal(uniqueSectionName("", []), "Section");
});

test("every section type the builder offers has an admin label and a default name", () => {
  assert.ok(SECTION_TYPES.length >= 8);
  for (const meta of SECTION_TYPES) {
    assert.ok(meta.label.trim().length > 0, `${meta.type} needs an admin label`);
    assert.ok(meta.defaultName.trim().length > 0, `${meta.type} needs a default admin name`);
    assert.ok(!/^NEW [A-Z ']+$/.test(meta.defaultName), `${meta.type} must not use a legacy generated label`);
    assert.equal(sectionTypeLabel(meta.type), meta.label);
  }
});

test("per-type editors expose normal editable fields instead of a JSON-only experience", () => {
  const keys = (fields: SectionField[], type: string) => {
    assert.ok(fields.length > 0, `${type} must have editor fields`);
    for (const field of fields) {
      assert.ok(field.key && field.label, `${type} has an invalid field`);
      assert.notEqual(field.kind, undefined);
    }
    return fields.map((field) => field.key);
  };

  const hero = keys(sectionEditorFields("hero"), "hero");
  for (const expected of [
    "title",
    "subtitle",
    "ctaPrimaryText",
    "ctaPrimaryUrl",
    "ctaSecondaryText",
    "ctaSecondaryUrl",
    "bgImageDesktop",
    "videoUrl",
    "overlayOpacity",
    "textAlignment",
    "sectionHeight",
  ]) {
    assert.ok(hero.includes(expected), `hero is missing the "${expected}" field`);
  }

  for (const productType of ["product_grid", "featured_collection", "new_arrivals", "best_sellers"]) {
    const fields = keys(sectionEditorFields(productType), productType);
    for (const expected of ["title", "subtitle", "productSource", "limit", "ctaText", "ctaUrl"]) {
      assert.ok(fields.includes(expected), `${productType} is missing the "${expected}" field`);
    }
  }

  const categories = keys(sectionEditorFields("category_showcase"), "category_showcase");
  for (const expected of ["title", "subtitle", "categoriesToShow", "columnsDesktop", "columnsMobile", "ctaText"]) {
    assert.ok(categories.includes(expected), `category_showcase is missing the "${expected}" field`);
  }
  assert.equal(sectionEditorFields("category_showcase").find((field) => field.key === "categoriesToShow")?.kind, "categories");

  const brandStory = keys(sectionEditorFields("brand_story"), "brand_story");
  for (const expected of ["badge", "heading", "text", "imageUrl", "ctaText", "ctaUrl"]) {
    assert.ok(brandStory.includes(expected), `brand_story is missing the "${expected}" field`);
  }

  const announcement = keys(sectionEditorFields("announcement"), "announcement");
  for (const expected of ["text", "linkUrl"]) {
    assert.ok(announcement.includes(expected), `announcement is missing the "${expected}" field`);
  }

  const marquee = keys(sectionEditorFields("marquee"), "marquee");
  for (const expected of ["items", "speed", "direction"]) {
    assert.ok(marquee.includes(expected), `marquee is missing the "${expected}" field`);
  }

  const newsletter = keys(sectionEditorFields("newsletter"), "newsletter");
  for (const expected of ["title", "subtitle", "buttonText"]) {
    assert.ok(newsletter.includes(expected), `newsletter is missing the "${expected}" field`);
  }

  assert.deepEqual(
    sectionEditorFields("spacer").map((field) => field.key),
    ["height"]
  );
});

test("the storefront renders public config only — never the admin name or generated labels", () => {
  const storefront = read("src/components/sections/StorefrontSection.tsx");
  const homepage = read("src/app/page.tsx");

  for (const forbidden of FORBIDDEN_PUBLIC_LABELS) {
    assert.ok(!storefront.includes(forbidden), `StorefrontSection must not contain "${forbidden}"`);
    assert.ok(!homepage.includes(forbidden), `the public homepage must not contain "${forbidden}"`);
  }
  assert.ok(
    !/section\.name/.test(homepage) && !/section\.name/.test(storefront),
    "the public storefront must not read the admin section name"
  );

  const sectionJsx = homepage.slice(homepage.indexOf("<StorefrontSection"));
  const props = sectionJsx.slice(0, sectionJsx.indexOf("/>"));
  assert.ok(!/\bname=\{/.test(props), "the public homepage must not pass an admin name to the renderer");
});

test("legacy generated labels stored in config are hidden from customers", () => {
  for (const label of FORBIDDEN_PUBLIC_LABELS) {
    assert.equal(isLegacyGeneratedLabel(label), true, `"${label}" must be treated as a legacy label`);
    assert.equal(isLegacyGeneratedLabel(`  ${label.toLowerCase()}  `.trim()), true);
  }
  assert.equal(isLegacyGeneratedLabel("WINTER '26 DROP"), false);
  assert.equal(isLegacyGeneratedLabel("Hero"), false);
  assert.equal(isLegacyGeneratedLabel(undefined), false);
  assert.equal(isLegacyGeneratedLabel(42), false);

  const storefront = read("src/components/sections/StorefrontSection.tsx");
  assert.match(storefront, /isLegacyGeneratedLabel/, "the storefront must filter legacy generated labels");

  const sanitized = stripLegacyGeneratedLabels({
    titleEn: "NEW HERO",
    subtitleEn: "WINTER '26 DROP",
    items: ["ZAVRUNE", "NEW MARQUEE"],
    nested: { headingEn: "Custom streetwear section content." },
  });
  assert.deepEqual(sanitized, {
    titleEn: "",
    subtitleEn: "WINTER '26 DROP",
    items: ["ZAVRUNE"],
    nested: { headingEn: "" },
  });

  const homepage = read("src/app/page.tsx");
  assert.match(homepage, /stripLegacyGeneratedLabels/, "the public homepage must strip legacy labels before rendering");
});

test("the builder keeps Sections, Preview and Edit reachable on phones", () => {
  const builder = read("src/components/admin/HomepageBuilder.tsx");
  assert.match(builder, /label: "Sections"/);
  assert.match(builder, /label: "Preview"/);
  assert.match(builder, /label: "Edit"/);
  assert.match(builder, /lg:hidden/, "the pane switcher must be present for small screens");
  assert.match(builder, /Section name/, "the admin name must stay editable");
  assert.match(builder, /Section type \(read-only\)/, "the internal type must be visible but read-only");
  assert.match(builder, /suggestSectionName/, "new sections must receive a generated admin name");
  assert.match(builder, /defaultSectionConfig/, "new sections must start with empty public content");
});

test("product resolution: manual order, limits, category filters and managed groups", () => {
  const products = [
    { id: "a", price: 300, categoryId: "cat-1", collectionId: "col-1", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "b", price: 100, categoryId: "cat-1", collectionId: "col-2", createdAt: "2026-03-01T00:00:00.000Z" },
    { id: "c", price: 200, categoryId: "cat-2", collectionId: "col-1", createdAt: "2026-02-01T00:00:00.000Z" },
  ];

  assert.deepEqual(
    selectSectionProducts({ productSource: "manual", productIds: ["c", "a"] }, products, 8).map((product) => product.id),
    ["c", "a"]
  );
  assert.deepEqual(selectSectionProducts({ productSource: "manual", productIds: [] }, products, 8), []);
  assert.deepEqual(
    selectSectionProducts({ productSource: "category", categoryId: "cat-1" }, products, 8).map((product) => product.id),
    ["a", "b"]
  );
  assert.deepEqual(
    selectSectionProducts({ productSource: "collection", collectionId: "col-2" }, products, 8).map((product) => product.id),
    ["b"]
  );
  assert.deepEqual(
    selectSectionProducts({ productSource: "newest" }, products, 8).map((product) => product.id),
    ["b", "c", "a"]
  );
  assert.deepEqual(
    selectSectionProducts({ productSource: "auto" }, products, 2).map((product) => product.id),
    ["a", "b"]
  );
  assert.deepEqual(
    selectSectionProducts({ productSource: "new_drop" }, products, 8, { groupProductIds: { new_drop: ["b"] } }).map(
      (product) => product.id
    ),
    ["b"]
  );
  assert.deepEqual(
    selectSectionProducts({ productSource: "price_asc" as any, order: "price_asc" }, products, 8).map((product) => product.id),
    ["b", "c", "a"]
  );
});
