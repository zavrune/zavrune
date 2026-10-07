import { db } from "@/db";
import { sizeGuides, sizeGuideMeasurements } from "@/db/schema";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Ruler } from "lucide-react";

export const revalidate = 0;

export default async function AdminSizeGuidesPage() {
  const guides = await db.select().from(sizeGuides);
  const measurements = await db.select().from(sizeGuideMeasurements);

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6">
          <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
            FITMENT ARCHITECTURE
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
            <Ruler className="w-8 h-8 text-cyan-400" />
            <span>SIZE GUIDES MANAGER</span>
          </h1>
        </div>

        <div className="space-y-6">
          {guides.map((g) => {
            const mList = measurements.filter((m) => m.sizeGuideId === g.id);
            return (
              <div key={g.id} className="bg-[#121216] border border-white/10 p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white uppercase">{g.name}</h2>
                  <p className="text-xs text-zinc-400">{g.description}</p>
                </div>

                <div className="overflow-x-auto border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black text-zinc-300 font-bold uppercase border-b border-white/10">
                      <tr>
                        <th className="p-2.5">Size</th>
                        <th className="p-2.5">Chest</th>
                        <th className="p-2.5">Waist</th>
                        <th className="p-2.5">Length</th>
                        <th className="p-2.5">Sleeve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {mList.map((m) => (
                        <tr key={m.id}>
                          <td className="p-2.5 font-bold text-white">{m.sizeLabel}</td>
                          <td className="p-2.5 text-zinc-300">{m.chest}</td>
                          <td className="p-2.5 text-zinc-300">{m.waist}</td>
                          <td className="p-2.5 text-zinc-300 font-bold">{m.length}</td>
                          <td className="p-2.5 text-zinc-300">{m.sleeve}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
