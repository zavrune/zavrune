-- Additive homepage-builder schema change: a per-section admin label.
--
-- `page_sections.name` is the editable admin name of a section inside the
-- Homepage Builder. It is completely separate from `section_type` (the internal
-- renderer) and from `config` (the public storefront copy), so renaming a
-- section can never change what customers read and an internal type such as
-- "hero" is never published as marketing text.
--
-- Existing rows, columns and data are preserved: the column is nullable, no
-- table is dropped, no row is removed and no product/order/customer data is
-- touched. Legacy sections that already kept a name-like value in their JSON
-- config are backfilled once; everything else stays NULL and the admin UI shows
-- a human-readable fallback that is never rendered publicly.
SET LOCAL search_path TO public;
--> statement-breakpoint
ALTER TABLE "page_sections" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
UPDATE "page_sections"
SET "name" = left(
  nullif(
    trim(
      coalesce(
        "config" ->> 'adminName',
        "config" ->> 'sectionName',
        "config" ->> 'name'
      )
    ),
    ''
  ),
  120
)
WHERE "name" IS NULL
  AND nullif(
    trim(
      coalesce(
        "config" ->> 'adminName',
        "config" ->> 'sectionName',
        "config" ->> 'name'
      )
    ),
    ''
  ) IS NOT NULL;
