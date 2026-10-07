import { listDeliveryRates } from "@/lib/delivery";
import { getStoreSettingsSafe } from "@/lib/store-settings";
import { ensureDatabaseSchema } from "@/db/initialize";

export const runtime = "nodejs";

/**
 * Public, read-only delivery pricing for the checkout. Contains no customer data
 * and no admin-only fields; the server re-computes the final price on order
 * creation regardless of what the browser sends.
 */
export async function GET() {
  try {
    await ensureDatabaseSchema();
    const [rates, settings] = await Promise.all([listDeliveryRates(), getStoreSettingsSafe()]);

    return Response.json(
      {
        success: true,
        rates: rates.map((rate) => ({
          wilayaCode: rate.wilayaCode,
          wilayaNameEn: rate.wilayaNameEn,
          wilayaNameAr: rate.wilayaNameAr,
          homePrice: rate.homeEnabled ? rate.homePrice : null,
          deskPrice: rate.deskEnabled ? rate.deskPrice : null,
        })),
        freeShippingThreshold: settings.freeShippingThreshold,
        currency: settings.currency,
        deliveryEnabled: settings.deliveryEnabled,
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ success: false, error: "Delivery rates unavailable" }, { status: 500 });
  }
}
