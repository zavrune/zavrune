import { NextResponse } from "next/server";
import { db } from "@/db";
import { pageSections, storefrontRevisions } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

// Get draft or published sections for builder
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("version") || "draft"; // 'draft' or 'published'

    const sections = await db
      .select()
      .from(pageSections)
      .where(eq(pageSections.version, version))
      .orderBy(asc(pageSections.displayOrder));

    return NextResponse.json({ success: true, sections });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// Save draft or publish or rollback
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, sections = [], revisionName } = body;

    if (action === "save_draft") {
      // Replace draft version sections
      await db.delete(pageSections).where(eq(pageSections.version, "draft"));

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        await db.insert(pageSections).values({
          pageId: sec.pageId || null,
          sectionType: sec.sectionType,
          displayOrder: i + 1,
          isVisible: sec.isVisible ?? true,
          desktopVisible: sec.desktopVisible ?? true,
          mobileVisible: sec.mobileVisible ?? true,
          version: "draft",
          config: sec.config || {},
        });
      }

      return NextResponse.json({ success: true, message: "Draft saved successfully" });
    }

    if (action === "publish") {
      // 1. Transactionally copy draft sections to published sections
      await db.transaction(async (tx) => {
        // Clear published version
        await tx.delete(pageSections).where(eq(pageSections.version, "published"));

        // Insert new published sections
        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          await tx.insert(pageSections).values({
            pageId: sec.pageId || null,
            sectionType: sec.sectionType,
            displayOrder: i + 1,
            isVisible: sec.isVisible ?? true,
            desktopVisible: sec.desktopVisible ?? true,
            mobileVisible: sec.mobileVisible ?? true,
            version: "published",
            config: sec.config || {},
          });
        }

        // 2. Create Revision Snapshot for Rollback
        await tx.insert(storefrontRevisions).values({
          revisionName: revisionName || `Published Revision - ${new Date().toLocaleString()}`,
          sectionsData: sections,
          createdByName: "Admin",
        });
      });

      return NextResponse.json({ success: true, message: "Storefront published to live successfully!" });
    }

    if (action === "rollback") {
      // Fetch latest revision
      const [latestRev] = await db
        .select()
        .from(storefrontRevisions)
        .orderBy(asc(storefrontRevisions.createdAt))
        .limit(1);

      if (!latestRev) {
        return NextResponse.json({ success: false, error: "No previous revision found to rollback" }, { status: 400 });
      }

      const revSections = latestRev.sectionsData as any[];

      await db.transaction(async (tx) => {
        await tx.delete(pageSections).where(eq(pageSections.version, "published"));
        await tx.delete(pageSections).where(eq(pageSections.version, "draft"));

        for (let i = 0; i < revSections.length; i++) {
          const sec = revSections[i];
          await tx.insert(pageSections).values({
            pageId: sec.pageId || null,
            sectionType: sec.sectionType,
            displayOrder: i + 1,
            isVisible: sec.isVisible ?? true,
            desktopVisible: sec.desktopVisible ?? true,
            mobileVisible: sec.mobileVisible ?? true,
            version: "published",
            config: sec.config || {},
          });

          await tx.insert(pageSections).values({
            pageId: sec.pageId || null,
            sectionType: sec.sectionType,
            displayOrder: i + 1,
            isVisible: sec.isVisible ?? true,
            desktopVisible: sec.desktopVisible ?? true,
            mobileVisible: sec.mobileVisible ?? true,
            version: "draft",
            config: sec.config || {},
          });
        }
      });

      return NextResponse.json({ success: true, message: "Rollback completed successfully" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
