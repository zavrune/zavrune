/**
 * Homepage Builder end-to-end checks with AND without the optional name column.
 *
 * Requirements verified here:
 *   - /mohamedbdr/homepage answers HTTP 200 for an authenticated admin;
 *   - sections can be created, renamed, duplicated, reordered, hidden and
 *     deleted independently of their internal `sectionType`;
 *   - the admin name never reaches the public storefront, while the configured
 *     public heading does;
 *   - desktop/mobile visibility flags are persisted and applied publicly;
 *   - legacy generated labels (NEW HERO, NEW PRODUCT GRID, ...) never render.
 *
 * Run through `npm run test:db` (needs DATABASE_URL=zavrune_test_* + TEST_BASE_URL).
 */
import assert from "node:assert/strict";
import { pool } from "../src/db";

const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
const base = new URL(process.env.TEST_BASE_URL || "http://127.0.0.1:3117");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
assert(database.pathname.startsWith("/zavrune_test_"));
assert(["localhost", "127.0.0.1"].includes(base.hostname));

const email = process.env.ZAVRUNE_ADMIN_EMAIL;
const password = process.env.ZAVRUNE_ADMIN_PASSWORD;
assert(email && password, "the app must be started with admin provisioning variables");

const LEGACY_LABELS = [
  "NEW HERO",
  "NEW PRODUCT GRID",
  "NEW FEATURED COLLECTION",
  "NEW CATEGORY SHOWCASE",
  "NEW BRAND STORY",
  "NEW ANNOUNCEMENT",
  "NEW MARQUEE",
  "Custom streetwear section content",
];

const ADMIN_NAME = "Winter Campaign Hero";
const DUPLICATE_NAME = "Winter Duplicate Hero";
const GRID_NAME = "Mobile Only Grid";
const PUBLIC_HEADING = "ZAVRUNE HOMEPAGE TEST HEADING";
const PUBLIC_HEADING_V2 = "ZAVRUNE HOMEPAGE TEST HEADING V2";
const GRID_HEADING = "MOBILE ONLY GRID HEADING";

type Section = {
  id?: string;
  pageId?: string | null;
  sectionType: string;
  name?: string | null;
  isVisible: boolean;
  desktopVisible: boolean;
  mobileVisible: boolean;
  config: Record<string, any>;
};

function sameOriginHeaders(extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", Origin: base.origin, "Sec-Fetch-Site": "same-origin", ...extra };
}

async function api(path: string, cookie: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, base), {
    ...init,
    headers: { ...(init.headers ?? {}), Cookie: cookie },
  });
  return response;
}

async function listSections(cookie: string, version: "draft" | "published" = "draft"): Promise<Section[]> {
  const response = await api(`/api/admin/sections?version=${version}`, cookie);
  assert.equal(response.status, 200, `GET /api/admin/sections?version=${version}`);
  const payload = await response.json();
  assert.equal(payload.success, true);
  for (const section of payload.sections) {
    assert.match(section.createdAt, /^\d{4}-\d\d-\d\dT.*Z$/, "section timestamps must retain ISO API serialization");
    assert.match(section.updatedAt, /^\d{4}-\d\d-\d\dT.*Z$/);
  }
  return payload.sections as Section[];
}

async function save(cookie: string, action: "save_draft" | "publish", sections: Section[]) {
  // State-changing admin routes require same-origin request evidence.
  const response = await api("/api/admin/sections", cookie, {
    method: "POST",
    headers: sameOriginHeaders(),
    body: JSON.stringify({ action, sections }),
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `${action} failed: ${JSON.stringify(payload)}`);
}

let hasNameColumn = false;
async function storedSection(name: string) {
  // Fixed SQL expressions only; the label stays a parameter. Both schemas run
  // the same full builder workflow rather than a watered-down pending test.
  const expression = hasNameColumn ? "name" : "config ->> 'adminName'";
  return pool.query(
    `select ${expression} as name, section_type, config, desktop_visible, mobile_visible
     from page_sections where version = 'published' and ${expression} = $1`,
    [name]
  );
}

async function main() {
  hasNameColumn = (await pool.query(
    "select exists (select 1 from pg_attribute where attrelid = 'public.page_sections'::regclass and attname = 'name' and not attisdropped) as present"
  )).rows[0].present;
  const health = await fetch(new URL("/api/health", base));
  assert.equal(health.status, 200);
  const readiness = await health.json();
  assert.equal(readiness.degraded, !hasNameColumn);
  assert.deepEqual(readiness.pendingMigrations, hasNameColumn ? [] : ["0002_homepage_section_names"]);

  // 1. Only an authenticated admin reaches the builder; the page renders.
  const anonymous = await fetch(new URL("/mohamedbdr/homepage", base), { redirect: "manual" });
  assert([302, 303, 307, 308].includes(anonymous.status), "anonymous access must redirect to the login page");

  const login = await fetch(new URL("/api/admin/login", base), {
    method: "POST",
    headers: sameOriginHeaders(),
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, `admin login failed: ${await login.clone().text()}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie && cookie.startsWith("zavrune_admin_session=zvr_secure_"));

  const builder = await api("/mohamedbdr/homepage", cookie);
  assert.equal(builder.status, 200, "/mohamedbdr/homepage must render for an admin");
  const builderHtml = await builder.text();
  for (const fragment of ["Homepage Builder", "Section name", "Section type", "Preview", "Edit"]) {
    assert.ok(builderHtml.includes(fragment), `the builder page must include "${fragment}"`);
  }

  // 2. Existing sections expose a type and a separate admin name.
  const draft = await listSections(cookie);
  assert.ok(draft.length >= 10, "the seeded storefront should have sections");
  for (const section of draft) {
    assert.ok(!Object.hasOwn(section.config, "adminName"), "admin config must keep the name separate from public content");
    assert.equal(typeof section.sectionType, "string");
    assert.ok(section.sectionType.trim().length > 0);
    assert.notEqual(section.name, section.sectionType, `${section.sectionType} must not use its raw type as a name`);
    if (section.name) {
      assert.ok(!LEGACY_LABELS.includes(section.name), `unexpected legacy label "${section.name}"`);
    }
  }
  const seededProductSection = draft.find((section) => section.sectionType === "featured_collection");
  assert.ok(seededProductSection, "the seeded featured collection section is required for the smoke checks");
  assert.equal(seededProductSection.config.titleEn, "NEW DROP ARRIVALS");

  // 3. Create: a hero with its own admin name and public heading.
  const hero: Section = {
    sectionType: "hero",
    name: ADMIN_NAME,
    isVisible: true,
    desktopVisible: true,
    mobileVisible: true,
    config: {
      titleEn: PUBLIC_HEADING,
      subtitleEn: "Created by the homepage builder verification.",
      ctaPrimaryTextEn: "SHOP NOW",
      ctaPrimaryUrl: "/shop",
      overlayOpacity: 0.6,
    },
  };
  // Two sections of the same renderer type must be allowed.
  const duplicateType: Section = {
    sectionType: "hero",
    name: DUPLICATE_NAME,
    isVisible: true,
    desktopVisible: true,
    mobileVisible: true,
    config: { titleEn: "SECOND HERO HEADING" },
  };
  // A legacy section whose public config still holds a generated label must not
  // leak that label to customers (the built-in default is rendered instead).
  const legacyLabelled: Section = {
    sectionType: "hero",
    name: "Legacy Labelled Hero",
    isVisible: true,
    desktopVisible: true,
    mobileVisible: true,
    config: { titleEn: "NEW HERO", subtitleEn: "" },
  };
  const mobileOnly: Section = {
    sectionType: "product_grid",
    name: GRID_NAME,
    isVisible: true,
    desktopVisible: false,
    mobileVisible: true,
    config: { titleEn: GRID_HEADING, productSource: "auto", limit: 2 },
  };
  // The opposite selection: desktop only, hidden on phones.
  const desktopOnly: Section = {
    sectionType: "spacer",
    name: "Desktop Only Spacer",
    isVisible: true,
    desktopVisible: true,
    mobileVisible: false,
    config: { height: 24 },
  };

  const hidden: Section = {
    sectionType: "hero", name: "Private Hidden Hero", isVisible: false,
    desktopVisible: true, mobileVisible: true, config: { titleEn: "HIDDEN PUBLIC HEADING" },
  };
  const created = [...draft, hero, duplicateType, mobileOnly, desktopOnly, legacyLabelled, hidden];
  await save(cookie, "save_draft", created);

  let savedDraft = await listSections(cookie);
  assert.equal(savedDraft.filter((section) => section.sectionType === "hero").length >= 2, true, "two heroes must coexist");
  const savedHero = savedDraft.find((section) => section.name === ADMIN_NAME);
  assert.ok(savedHero, "the created section must keep its admin name");
  assert.equal(savedHero.sectionType, "hero");
  assert.equal(savedHero.config.titleEn, PUBLIC_HEADING);

  // Drafts stay private until they are published.
  const beforePublish = await (await fetch(new URL("/", base))).text();
  assert.ok(!beforePublish.includes(PUBLIC_HEADING), "draft content must not reach the storefront");

  // 4. Rename: the admin name changes, the type and public config do not.
  const renamed = savedDraft.map((section) =>
    section.name === ADMIN_NAME ? { ...section, name: "Winter Campaign Hero Renamed" } : section
  );
  await save(cookie, "save_draft", renamed);

  savedDraft = await listSections(cookie);
  const renamedHero = savedDraft.find((section) => section.name === "Winter Campaign Hero Renamed");
  assert.ok(renamedHero, "renaming must persist");
  assert.equal(renamedHero.sectionType, "hero", "renaming must never change the section type");
  assert.equal(renamedHero.config.titleEn, PUBLIC_HEADING, "renaming must never change public content");
  assert.equal(savedDraft.some((section) => section.name === ADMIN_NAME), false);

  // 5. Edit public content: heading changes are independent from the admin name.
  const headingEdit = savedDraft.map((section) =>
    section.name === "Winter Campaign Hero Renamed"
      ? { ...section, config: { ...section.config, titleEn: PUBLIC_HEADING_V2 } }
      : section
  );
  await save(cookie, "save_draft", headingEdit);
  savedDraft = await listSections(cookie);
  const edited = savedDraft.find((section) => section.name === "Winter Campaign Hero Renamed");
  assert.ok(edited);
  assert.equal(edited.config.titleEn, PUBLIC_HEADING_V2);
  assert.equal(edited.sectionType, "hero");

  // 6. Reorder: move the mobile-only grid to the front of the draft.
  const gridIndex = savedDraft.findIndex((section) => section.name === GRID_NAME);
  assert.ok(gridIndex > 0, "the grid section must exist to be reordered");
  const reordered = [savedDraft[gridIndex], ...savedDraft.filter((_, index) => index !== gridIndex)];
  await save(cookie, "save_draft", reordered);
  savedDraft = await listSections(cookie);
  assert.equal(savedDraft[0].name, GRID_NAME, "the reordered section must come first");

  // 7. Duplicate: a section can be copied (same type, distinct admin name).
  const heroPosition = savedDraft.findIndex((section) => section.name === "Winter Campaign Hero Renamed");
  const copy: Section = {
    sectionType: savedDraft[heroPosition].sectionType,
    name: "Winter Campaign Hero Copy",
    isVisible: true,
    desktopVisible: true,
    mobileVisible: true,
    config: { ...savedDraft[heroPosition].config },
  };
  const duplicated = [...savedDraft];
  duplicated.splice(heroPosition + 1, 0, copy);
  await save(cookie, "save_draft", duplicated);
  savedDraft = await listSections(cookie);
  assert.equal(savedDraft.filter((section) => section.sectionType === "hero").length >= 3, true, "the copy must exist");
  assert.equal(savedDraft[heroPosition + 1].name, "Winter Campaign Hero Copy");

  // 8. Delete: remove the duplicate again.
  const afterDelete = savedDraft.filter((section) => section.name !== "Winter Campaign Hero Copy");
  await save(cookie, "save_draft", afterDelete);
  savedDraft = await listSections(cookie);
  assert.equal(savedDraft.some((section) => section.name === "Winter Campaign Hero Copy"), false);

  // 9. Publish, then verify the live storefront renders config, not admin names.
  await save(cookie, "publish", savedDraft);

  const published = await listSections(cookie, "published");
  assert.ok(published.every((section) => !Object.hasOwn(section.config, "adminName")));
  const publishedGrid = published.find((section) => section.name === GRID_NAME);
  assert.ok(publishedGrid, "the published list must keep the admin name");
  assert.equal(publishedGrid.sectionType, "product_grid");
  assert.equal(publishedGrid.desktopVisible, false, "desktop visibility must persist");
  assert.equal(publishedGrid.mobileVisible, true, "mobile visibility must persist");

  const homepage = await fetch(new URL("/", base));
  assert.equal(homepage.status, 200);
  const html = await homepage.text();

  assert.ok(!html.includes("adminName"), "storage-only metadata must not appear even in the public RSC payload");
  assert.ok(!html.includes("HIDDEN PUBLIC HEADING"), "invisible sections must not be published to the browser");
  assert.ok(!html.includes("Private Hidden Hero"));
  assert.ok(html.includes(PUBLIC_HEADING_V2), "the storefront must render the configured public heading");
  assert.ok(html.includes("SHOP NOW"), "the storefront must render the configured button text");
  for (const adminName of [ADMIN_NAME, DUPLICATE_NAME, GRID_NAME, "Winter Campaign Hero Renamed", "Winter Campaign Hero Copy"]) {
    assert.ok(!html.includes(adminName), `the storefront must never render the admin name "${adminName}"`);
  }
  for (const legacy of LEGACY_LABELS) {
    assert.ok(!html.includes(legacy), `the storefront must never render "${legacy}"`);
  }
  assert.ok(html.includes("NEW DROP ARRIVALS"), "pre-existing storefront content must be preserved");

  // The stored legacy label stays in the database but never reaches customers.
  const legacyRow = await storedSection("Legacy Labelled Hero");
  assert.equal(legacyRow.rows.length, 1);
  assert.equal(legacyRow.rows[0].config.titleEn, "NEW HERO", "legacy config data must be preserved");

  // 13/14. Generated labels stay hidden while configured copy renders.
  assert.ok(!/NEW HERO\b/i.test(html), "generated legacy labels must never render publicly");
  assert.ok(html.includes("BUILT FOR THE STREETS"), "the section falls back to its built-in default instead");

  // Desktop/mobile visibility is enforced with breakpoint classes.
  assert.ok(html.includes("md:hidden"), "desktop-hidden sections must be hidden on desktop viewports");
  assert.ok(html.includes("hidden md:block"), "mobile-hidden sections must be hidden on phones");
  const desktopOnlyRow = await storedSection("Desktop Only Spacer");
  assert.equal(desktopOnlyRow.rows.length, 1);
  assert.equal(desktopOnlyRow.rows[0].desktop_visible, true);
  assert.equal(desktopOnlyRow.rows[0].mobile_visible, false);

  // 10. Database shape: name lives beside section_type and config.
  const { rows } = await storedSection(GRID_NAME);
  assert.equal(rows.length, 1, "the published row must exist exactly once");
  assert.equal(rows[0].name, GRID_NAME);
  assert.equal(rows[0].section_type, "product_grid");
  assert.equal(rows[0].config.titleEn, GRID_HEADING);
  assert.equal(rows[0].desktop_visible, false);
  assert.equal(rows[0].mobile_visible, true);
  if (hasNameColumn) assert.ok(!Object.hasOwn(rows[0].config, "adminName"));
  else assert.equal(rows[0].config.adminName, GRID_NAME, "pending names must be mirrored for later backfill");

  const heroRow = await storedSection("Winter Campaign Hero Renamed");
  assert.equal(heroRow.rows.length, 1);
  assert.equal(heroRow.rows[0].section_type, "hero");
  assert.equal(heroRow.rows[0].config.titleEn, PUBLIC_HEADING_V2);

  // 11. The 500-fix contract: the draft homepage row set stays renderable.
  const afterReload = await api("/mohamedbdr/homepage", cookie);
  assert.equal(afterReload.status, 200, "/mohamedbdr/homepage must stay 200 after edits");

  // Revisions retain names independently of JSON content in either schema.
  const revisionList = await api("/api/admin/sections", cookie);
  const firstRevision = (await revisionList.json()).revisions[0];
  assert.ok(firstRevision?.id);
  const shape = (sections: Section[]) => sections.map(({ sectionType, name, isVisible, desktopVisible, mobileVisible, config }) =>
    ({ sectionType, name, isVisible, desktopVisible, mobileVisible, config })
  );
  const firstShape = shape(published);
  const changed = published.map((section) => section.name === "Winter Campaign Hero Renamed"
    ? { ...section, name: "Second Revision Hero", isVisible: false, config: { ...section.config, titleEn: "SECOND REVISION HEADING" } }
    : section);
  await save(cookie, "save_draft", changed);
  await save(cookie, "publish", changed);
  const secondShape = shape(await listSections(cookie, "published"));
  const rollback = async (revisionId?: string) => {
    const response = await api("/api/admin/sections", cookie, {
      method: "POST", headers: sameOriginHeaders(), body: JSON.stringify({ action: "rollback", revisionId }),
    });
    assert.equal(response.status, 200, `rollback failed: ${await response.text()}`);
  };
  await rollback();
  assert.deepEqual(shape(await listSections(cookie)), secondShape, "default rollback restores the newest revision, not the oldest");
  await rollback(firstRevision.id);
  assert.deepEqual(shape(await listSections(cookie)), firstShape, "selected revision restores the draft names, config, order and visibility");
  assert.deepEqual(shape(await listSections(cookie, "published")), firstShape, "selected revision restores the live storefront atomically");
  const restored = await fetch(new URL("/", base));
  assert.equal(restored.status, 200);
  const restoredHtml = await restored.text();
  assert.ok(restoredHtml.includes(PUBLIC_HEADING_V2));
  assert.ok(!restoredHtml.includes("adminName"));

  console.log(`PASS: homepage builder create/rename/duplicate/reorder/delete, visibility, publish, revisions/rollback and public rendering (${hasNameColumn ? "migrated" : "0002 pending"})`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Homepage builder checks failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
