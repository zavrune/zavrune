import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const [record] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "design_system"))
      .limit(1);

    if (!record) {
      return NextResponse.json({
        theme: {
          bgPrimary: "#08080A",
          bgSurface: "#121215",
          bgSurfaceHover: "#1B1B20",
          textPrimary: "#F4F4F5",
          textMuted: "#9CA3AF",
          accent: "#E2E8F0",
          btnBg: "#FFFFFF",
          btnText: "#000000",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderRadius: "0px",
          typographyFont: "inter",
          shadows: "none",
        },
      });
    }

    return NextResponse.json(record.value);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    await db
      .insert(settings)
      .values({
        key: "design_system",
        value: body,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: body,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
