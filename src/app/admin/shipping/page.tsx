import { db } from "@/db";
import { shippingZones, shippingMethods } from "@/db/schema";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { formatDZD } from "@/lib/translations";
import { Truck } from "lucide-react";

export const revalidate = 0;

export default async function AdminShippingPage() {
  const zones = await db.select().from(shippingZones);
  const methods = await db.select().from(shippingMethods);

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6">
          <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
            LOGISTICS & DELIVERIES
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
            <Truck className="w-8 h-8 text-blue-400" />
            <span>SHIPPING & WILAYAS RATES</span>
          </h1>
        </div>

        <div className="space-y-6">
          {zones.map((zone) => {
            const zoneMethods = methods.filter((m) => m.zoneId === zone.id);
            return (
              <div key={zone.id} className="bg-[#121216] border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="text-sm font-bold text-white uppercase">{zone.name}</h2>
                  <span className="text-xs text-zinc-400">{(zone.wilayas as any[])?.length || 0} Wilayas</span>
                </div>

                <div className="space-y-3">
                  {zoneMethods.map((m) => (
                    <div key={m.id} className="p-3 bg-black border border-white/10 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-white block uppercase">{m.nameEn}</strong>
                        <span className="text-zinc-500 text-[11px] block">{m.estDays}</span>
                      </div>
                      <div className="text-right">
                        <strong className="text-emerald-400 text-sm block">{formatDZD(m.price)}</strong>
                        <span className="text-zinc-500 text-[10px]">Type: {m.deliveryType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
