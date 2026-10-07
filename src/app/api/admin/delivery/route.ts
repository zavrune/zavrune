import { db } from "@/db";
import { deliveryRates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdminReady } from "@/db/initialize";
import { jsonError, jsonOk, readJsonBody, withAdmin } from "@/lib/api";
import { recordAdminAudit } from "@/lib/auth";
import { ensureDeliveryRates, listDeliveryRates } from "@/lib/delivery";

export const runtime = "nodejs";

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "unavailable") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.min(Math.round(numeric), 1_000_000);
}

export async function GET(req: Request) {
  return withAdmin(
    req,
    async () => {
      await ensureAdminReady();
      const rates = await listDeliveryRates();
      return jsonOk({ rates });
    },
    { context: "admin/delivery request failed" }
  );
}

/** Bulk update of the 58 wilaya rates (prices and method availability). */
export async function PATCH(req: Request) {
  return withAdmin(
    req,
    async (session) => {
      await ensureAdminReady();
      const body = await readJsonBody(req);
      const incoming = Array.isArray(body.rates) ? body.rates : [];
      if (incoming.length === 0) return jsonError("rates must be a non-empty array.", 400);

      await ensureDeliveryRates();

      let updated = 0;
      await db.transaction(async (tx) => {
        for (const entry of incoming as any[]) {
          const code = typeof entry?.wilayaCode === "string" ? entry.wilayaCode.padStart(2, "0") : "";
          if (!/^\d{2}$/.test(code)) continue;

          const homePrice = parsePrice(entry.homePrice);
          const deskPrice = parsePrice(entry.deskPrice);

          const result = await tx
            .update(deliveryRates)
            .set({
              homePrice,
              deskPrice,
              homeEnabled: homePrice !== null && (entry.homeEnabled ?? true) !== false,
              deskEnabled: deskPrice !== null && (entry.deskEnabled ?? true) !== false,
              updatedAt: new Date(),
            })
            .where(eq(deliveryRates.wilayaCode, code))
            .returning({ id: deliveryRates.id });

          if (result.length > 0) updated += 1;
        }
      });

      await recordAdminAudit(session.admin, "admin.delivery.updated", { detail: { updated }, req });
      return jsonOk({ updated });
    },
    { context: "admin/delivery update failed" }
  );
}
