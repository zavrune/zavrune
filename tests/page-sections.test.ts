import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  insertPageSections,
  readPageSections,
  type PageSectionExecutor,
  type PageSectionValues,
} from "../src/db/page-sections";
import { pageSections } from "../src/db/schema";
import { normalizeSection, publicSectionConfig, stripLegacyGeneratedLabels } from "../src/lib/homepage-sections";

const dialect = new PgDialect();
function recordingDatabase(hasName: boolean, rows: Record<string, unknown>[] = []) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const state = { hasName };
  const executor = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      statements.push(query);
      return { rows: /pg_catalog\.pg_attribute/.test(query.sql) ? [{ hasName: state.hasName }] : rows };
    },
  } as unknown as PageSectionExecutor;
  return { executor, statements, state };
}

const section: PageSectionValues = {
  sectionType: "hero",
  name: "  Winter Campaign  ",
  displayOrder: 3,
  isVisible: false,
  desktopVisible: true,
  mobileVisible: false,
  version: "draft",
  config: { titleEn: "Public heading", adminName: "Outdated mirror" },
};

function storedConfigs(statements: { params: unknown[] }[]): Record<string, unknown>[] {
  return statements[1].params
    .filter((value): value is string => typeof value === "string" && value.startsWith("{"))
    .map((value) => JSON.parse(value));
}

test("pre-0002 reads use an explicit projection without referencing the missing name column", async () => {
  const config = Object.freeze({ titleEn: "Public heading", adminName: "  Winter Campaign  " });
  const { executor, statements } = recordingDatabase(false, [{
    id: "row-1", name: null, sectionType: "hero", config, isVisible: true, desktopVisible: false, mobileVisible: true,
    createdAt: "2026-10-08 16:33:00.123", updatedAt: "2026-10-08 17:33:00.456",
  }]);
  const rows = await readPageSections(eq(pageSections.version, "draft"), executor);
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /pg_catalog\.pg_attribute/);
  assert.match(statements[1].sql, /null::text as "name"/);
  assert.doesNotMatch(statements[1].sql, /"page_sections"\."name"|select\s+\*/i);
  assert.match(statements[1].sql, /"section_type".*as "sectionType"/);
  assert.ok(statements[1].params.includes("draft"));
  assert.equal(rows[0].name, "Winter Campaign");
  assert.equal(rows[0].id, "row-1");
  assert.equal(rows[0].desktopVisible, false);
  assert.equal(rows[0].createdAt.toISOString(), "2026-10-08T16:33:00.123Z", "raw SQL must preserve Drizzle's UTC timestamp decoding");
  assert.equal(rows[0].updatedAt.toISOString(), "2026-10-08T17:33:00.456Z");
  assert.deepEqual(rows[0].config, { titleEn: "Public heading" });
  assert.equal(config.adminName, "  Winter Campaign  ", "reads must not rewrite existing JSON");
});

test("native names take precedence over legacy mirrors and config remains public-only", async () => {
  const { executor, statements } = recordingDatabase(true, [{
    name: "Native label", config: { titleEn: "Public heading", adminName: "Old mirror" },
  }]);
  const rows = await readPageSections(undefined, executor);
  assert.match(statements[1].sql, /"page_sections"\."name"/);
  assert.equal(rows[0].name, "Native label");
  assert.deepEqual(rows[0].config, { titleEn: "Public heading" });
});

test("pre-0002 writes bypass Drizzle INSERT and omit name from the SQL column list entirely", async () => {
  const { executor, statements } = recordingDatabase(false);
  await insertPageSections([section], executor);
  assert.equal(statements.length, 2);
  const insert = statements[1];
  assert.match(insert.sql, /insert into "page_sections"/);
  assert.doesNotMatch(insert.sql, /"name"/);
  for (const column of ["page_id", "section_type", "display_order", "is_visible", "desktop_visible", "mobile_visible", "version", "config"]) {
    assert.ok(insert.sql.includes(`"${column}"`));
  }
  assert.match(insert.sql, /\$\d+::jsonb/);
  assert.ok(insert.params.includes(false), "visibility flags must be kept");
  assert.ok(insert.params.includes(3), "display order must be kept");
  assert.deepEqual(storedConfigs(statements), [{ titleEn: "Public heading", adminName: "Winter Campaign" }]);
  assert.equal((section.config as Record<string, unknown>).adminName, "Outdated mirror", "writes must not mutate incoming config");
});

test("post-0002 writes use the native name and remove the storage-only mirror", async () => {
  const { executor, statements } = recordingDatabase(true);
  await insertPageSections([section], executor);
  assert.match(statements[1].sql, /"name"/);
  assert.ok(statements[1].params.includes("Winter Campaign"));
  assert.deepEqual(storedConfigs(statements), [{ titleEn: "Public heading" }]);
});

test("clearing a name removes stale mirrors, while legacy revisions without name can recover them", async () => {
  for (const hasName of [false, true]) {
    for (const name of [null, "  "]) {
      const { executor, statements } = recordingDatabase(hasName);
      await insertPageSections([{ ...section, name }], executor);
      assert.deepEqual(storedConfigs(statements), [{ titleEn: "Public heading" }]);
    }
    const { executor, statements } = recordingDatabase(hasName);
    await insertPageSections([{ ...section, name: undefined }], executor);
    if (hasName) assert.ok(statements[1].params.includes("Outdated mirror"));
    else assert.equal(storedConfigs(statements)[0].adminName, "Outdated mirror");
  }
});

test("capability reads stay live after optional DDL, including on the same executor", async () => {
  const { executor, statements, state } = recordingDatabase(false);
  await insertPageSections([section], executor);
  state.hasName = true;
  await insertPageSections([section], executor);
  assert.doesNotMatch(statements[1].sql, /"name"/);
  assert.match(statements[3].sql, /"name"/);
  assert.equal(statements.filter((query) => /pg_attribute/.test(query.sql)).length, 2);
});

test("explicit SQL keeps values parameterized rather than interpolating an admin label", async () => {
  const name = "Robert'); DROP TABLE page_sections; --";
  for (const hasName of [false, true]) {
    const { executor, statements } = recordingDatabase(hasName);
    await insertPageSections([{ ...section, name }], executor);
    assert.ok(!statements[1].sql.includes(name));
    assert.ok(statements[1].params.some((value) => typeof value === "string" && value.includes(name)));
  }
});

test("unrelated database failures propagate instead of pretending the schema is compatible", async () => {
  let calls = 0;
  const executor = { execute: async () => {
    calls += 1;
    if (calls === 1) return { rows: [{ hasName: false }] };
    throw new Error("required relation does not exist");
  } } as unknown as PageSectionExecutor;
  await assert.rejects(readPageSections(undefined, executor), /required relation does not exist/);
  calls = 0;
  await assert.rejects(insertPageSections([section], executor), /required relation does not exist/);
});

test("the compatibility mirror never becomes public config or storefront payload", () => {
  const config = { titleEn: "Public heading", adminName: "Private label" };
  assert.deepEqual(normalizeSection({ sectionType: "hero", config }), {
    id: undefined, sectionType: "hero", name: "Private label", isVisible: true,
    desktopVisible: true, mobileVisible: true, config: { titleEn: "Public heading" },
  });
  assert.deepEqual(publicSectionConfig(config), { titleEn: "Public heading" });
  const sanitized = stripLegacyGeneratedLabels({ ...config, nested: { adminName: "Nested label" }, list: [{ adminName: "List label", titleEn: "Public item" }] });
  assert.deepEqual(sanitized, { titleEn: "Public heading", nested: {}, list: [{ titleEn: "Public item" }] });
  assert.ok(!JSON.stringify(sanitized).includes("adminName"));
  assert.deepEqual(config, { titleEn: "Public heading", adminName: "Private label" });
});
