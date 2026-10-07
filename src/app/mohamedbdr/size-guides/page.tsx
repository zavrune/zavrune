import React from "react";
import { db } from "@/db";
import { sizeGuideMeasurements, sizeGuides } from "@/db/schema";
import { ensureAdminReady } from "@/db/initialize";
import { AdminPage } from "@/components/admin/AdminPage";
import { Card, PageHeader } from "@/components/admin/ui";
import { Ruler } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSizeGuidesPage() {
  return (
    <AdminPage next="/mohamedbdr/size-guides">
      <SizeGuidesContent />
    </AdminPage>
  );
}

async function SizeGuidesContent() {
  await ensureAdminReady();
  const guides = await db.select().from(sizeGuides);
  const measurements = await db.select().from(sizeGuideMeasurements);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader eyebrow="FITMENT ARCHITECTURE" title="Size Guides" icon={<Ruler className="w-7 h-7 text-cyan-400" />} />

      {guides.length === 0 ? (
        <Card>
          <p className="text-xs text-zinc-500">No size guides are configured.</p>
        </Card>
      ) : (
        guides.map((guide) => {
          const rows = measurements.filter((measurement) => measurement.sizeGuideId === guide.id);
          return (
            <Card key={guide.id}>
              <div>
                <h2 className="text-sm font-bold text-white uppercase">{guide.name}</h2>
                <p className="text-[11px] text-zinc-400">{guide.description}</p>
              </div>
              <div className="overflow-x-auto border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black text-zinc-300 uppercase border-b border-white/10">
                    <tr>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Chest</th>
                      <th className="p-2.5">Waist</th>
                      <th className="p-2.5">Length</th>
                      <th className="p-2.5">Sleeve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="p-2.5 font-bold text-white">{row.sizeLabel}</td>
                        <td className="p-2.5 text-zinc-300">{row.chest}</td>
                        <td className="p-2.5 text-zinc-300">{row.waist}</td>
                        <td className="p-2.5 text-zinc-300">{row.length}</td>
                        <td className="p-2.5 text-zinc-300">{row.sleeve}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
