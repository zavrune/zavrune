import { sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { pageSections } from "./schema";
import { normalizeSectionName, publicSectionConfig } from "../lib/homepage-sections";

export type PageSectionExecutor = Pick<typeof db, "execute">;
export type PageSectionRow = typeof pageSections.$inferSelect;
export type PageSectionValues = Omit<typeof pageSections.$inferInsert, "id" | "createdAt" | "updatedAt">;
// Drizzle's raw execute intentionally leaves PostgreSQL timestamps as strings.
type RawPageSectionRow = Omit<PageSectionRow, "createdAt" | "updatedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

/**
 * Inspect the actual relation, not just the migration ledger. Do not memoize a
 * missing capability: a warm instance must notice 0002 as soon as it commits.
 * Use the caller's executor so transactional writes share its connection.
 */
export async function pageSectionsHaveName(executor: PageSectionExecutor = db): Promise<boolean> {
  const result = await executor.execute<{ hasName: boolean }>(sql`
    select exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = to_regclass('public.page_sections')
        and attname = 'name' and not attisdropped
    ) as "hasName"
  `);
  return result.rows[0]?.hasName === true;
}

/** Explicit projection: never SELECT * / Drizzle's implicit table projection. */
export async function readPageSections(where?: SQL, executor: PageSectionExecutor = db): Promise<PageSectionRow[]> {
  const hasName = await pageSectionsHaveName(executor);
  // NULL is an expression/alias, not a reference to the absent column.
  const name = hasName ? sql`${pageSections.name}` : sql`null::text`;
  const result = await executor.execute<RawPageSectionRow>(sql`
    select ${pageSections.id} as "id", ${pageSections.pageId} as "pageId",
      ${pageSections.sectionType} as "sectionType", ${name} as "name",
      ${pageSections.displayOrder} as "displayOrder", ${pageSections.isVisible} as "isVisible",
      ${pageSections.desktopVisible} as "desktopVisible", ${pageSections.mobileVisible} as "mobileVisible",
      ${pageSections.version} as "version", ${pageSections.config} as "config",
      ${pageSections.createdAt} as "createdAt", ${pageSections.updatedAt} as "updatedAt"
    from ${pageSections}
    ${where ? sql`where ${where}` : sql``}
    order by ${pageSections.displayOrder} asc
  `);
  return result.rows.map((row) => ({
    ...row,
    name: normalizeSectionName(row.name) ?? normalizeSectionName((row.config as Record<string, unknown> | null)?.adminName),
    config: publicSectionConfig(row.config),
    // Use the schema's decoder to retain the old SELECT builder's Date/UTC
    // semantics and ISO API serialization, including timestamp without zone.
    createdAt: typeof row.createdAt === "string" ? (pageSections.createdAt.mapFromDriverValue(row.createdAt) as Date) : row.createdAt,
    updatedAt: typeof row.updatedAt === "string" ? (pageSections.updatedAt.mapFromDriverValue(row.updatedAt) as Date) : row.updatedAt,
  }));
}

/**
 * Drizzle's table INSERT includes every schema column even if values omit name.
 * Use parameterized SQL with an explicit column list instead. DB-generated IDs
 * and timestamps keep their defaults; section contents/visibility/order remain
 * unchanged. Callers retain their existing atomic seed/publish transactions.
 * Their preceding existence read/delete holds a relation lock until commit, so
 * concurrent ALTER/backfill cannot slip between capability detection and insert.
 */
export async function insertPageSections(sections: PageSectionValues[], executor: PageSectionExecutor): Promise<void> {
  if (sections.length === 0) return;
  const hasName = await pageSectionsHaveName(executor);
  const values = sections.map((section) => {
    // Explicit null/blank means clear the name, not restore an old JSON mirror.
    // Legacy snapshots without a name property can still recover their mirror.
    const name = section.name !== undefined
      ? normalizeSectionName(section.name)
      : normalizeSectionName((section.config as Record<string, unknown> | undefined)?.adminName);
    const config = publicSectionConfig(section.config);
    if (!hasName && name) config.adminName = name;
    return sql`(
      ${section.pageId ?? null}::uuid, ${section.sectionType}, ${section.displayOrder ?? 0},
      ${section.isVisible ?? true}, ${section.desktopVisible ?? true}, ${section.mobileVisible ?? true},
      ${section.version ?? "published"}, ${JSON.stringify(config)}::jsonb
      ${hasName ? sql`, ${name}` : sql``}
    )`;
  });
  await executor.execute(sql`
    insert into ${pageSections}
      ("page_id", "section_type", "display_order", "is_visible", "desktop_visible", "mobile_visible", "version", "config"
        ${hasName ? sql`, "name"` : sql``})
    values ${sql.join(values, sql`, `)}
  `);
}
