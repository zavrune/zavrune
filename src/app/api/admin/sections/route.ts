import { db } from "@/db";
import { pageSections, storefrontRevisions } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";

export const runtime = "nodejs";

type Section = {
  pageId?: string | null;
  sectionType: string;
  isVisible?: boolean;
  desktopVisible?: boolean;
  mobileVisible?: boolean;
  config?: Record<string, unknown>;
};

function normalizeSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry: any) => entry && typeof entry.sectionType === "string" && entry.sectionType.trim())
    .map((entry: any) => ({
      pageId: typeof entry.pageId === "string" ? entry.pageId : null,
      sectionType: String(entry.sectionType).slice(0, 60),
      isVisible: entry.isVisible ?? true,
      desktopVisible: entry.desktopVisible ?? true,
      mobileVisible: entry.mobileVisible ?? true,
      config: entry.config && typeof entry.config === "object" ? entry.config : {},
    }));
}

export async function GET(req: Request) {
  return withAdmin(
    req,
    async (_session, url) => {
      await ensureAdminReady();
      const version = url.searchParams.get("version") === "published" ? "published" : "draft";

      const sections = await db
        .select()
        .from(pageSections)
        .where(eq(pageSections.version, version))
        .orderBy(asc(pageSections.displayOrder));

      const revisions = await db
        .select({
          id: storefrontRevisions.id,
          revisionName: storefrontRevisions.revisionName,
          createdAt: storefrontRevisions.createdAt,
        })
        .from(storefrontRevisions)
        .orderBy(desc(storefrontRevisions.createdAt))
        .limit(20);

      return jsonOk({ sections, revisions, version });
    },
    { context: "admin/sections request failed" }
  );
}

export async function POST(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const action = String(body.action ?? "");
      const sections = normalizeSections(body.sections);

      if (action === "save_draft") {
        if (sections.length === 0) return jsonError("At least one section is required.", 400);

        // Atomic: the old draft is only replaced once the new one is written.
        await db.transaction(async (tx) => {
          await tx.delete(pageSections).where(eq(pageSections.version, "draft"));
          await tx.insert(pageSections).values(
            sections.map((section, index) => ({
              pageId: section.pageId ?? null,
              sectionType: section.sectionType,
              displayOrder: index + 1,
              isVisible: section.isVisible ?? true,
              desktopVisible: section.desktopVisible ?? true,
              mobileVisible: section.mobileVisible ?? true,
              version: "draft" as const,
              config: section.config ?? {},
            }))
          );
        });

        await recordAdminAudit(session.admin, "admin.sections.draft_saved", { detail: { count: sections.length }, req });
        return jsonOk({ message: "Draft saved successfully" });
      }

      if (action === "publish") {
        if (sections.length === 0) return jsonError("At least one section is required.", 400);

        await db.transaction(async (tx) => {
          await tx.delete(pageSections).where(eq(pageSections.version, "published"));
          await tx.insert(pageSections).values(
            sections.map((section, index) => ({
              pageId: section.pageId ?? null,
              sectionType: section.sectionType,
              displayOrder: index + 1,
              isVisible: section.isVisible ?? true,
              desktopVisible: section.desktopVisible ?? true,
              mobileVisible: section.mobileVisible ?? true,
              version: "published" as const,
              config: section.config ?? {},
            }))
          );

          await tx.insert(storefrontRevisions).values({
            revisionName: typeof body.revisionName === "string" && body.revisionName.trim()
              ? body.revisionName.trim().slice(0, 160)
              : `Published Revision - ${new Date().toISOString()}`,
            sectionsData: sections,
            createdByName: session.admin.name || "Admin",
          });
        });

        await recordAdminAudit(session.admin, "admin.sections.published", { detail: { count: sections.length }, req });
        return jsonOk({ message: "Storefront published to live successfully!" });
      }

      if (action === "rollback") {
        const revisionId = typeof body.revisionId === "string" ? body.revisionId : null;

        // Fix: rollback used to select the OLDEST revision. It now takes the
        // most recent snapshot (or an explicitly chosen revision).
        const [revision] = revisionId
          ? await db.select().from(storefrontRevisions).where(eq(storefrontRevisions.id, revisionId)).limit(1)
          : await db.select().from(storefrontRevisions).orderBy(desc(storefrontRevisions.createdAt)).limit(1);

        if (!revision) return jsonError("No previous revision found to rollback.", 400);

        const revisionSections = normalizeSections(revision.sectionsData);
        if (revisionSections.length === 0) return jsonError("That revision does not contain any sections.", 400);

        await db.transaction(async (tx) => {
          await tx.delete(pageSections).where(eq(pageSections.version, "published"));
          await tx.delete(pageSections).where(eq(pageSections.version, "draft"));

          const rows = (version: "published" | "draft") =>
            revisionSections.map((section, index) => ({
              pageId: section.pageId ?? null,
              sectionType: section.sectionType,
              displayOrder: index + 1,
              isVisible: section.isVisible ?? true,
              desktopVisible: section.desktopVisible ?? true,
              mobileVisible: section.mobileVisible ?? true,
              version,
              config: section.config ?? {},
            }));

          await tx.insert(pageSections).values(rows("published"));
          await tx.insert(pageSections).values(rows("draft"));
        });

        await recordAdminAudit(session.admin, "admin.sections.rolled_back", {
          target: revision.id,
          detail: { revisionName: revision.revisionName },
          req,
        });

        return jsonOk({ message: `Rolled back to "${revision.revisionName}".` });
      }

      return jsonError("Invalid action.", 400);
    },
    { context: "admin/sections save failed" }
  );
}
