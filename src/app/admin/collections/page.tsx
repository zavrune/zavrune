import { db } from "@/db";
import { collections } from "@/db/schema";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { FolderKanban } from "lucide-react";

export const revalidate = 0;

export default async function AdminCollectionsPage() {
  const collectionsList = await db.select().from(collections);

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6">
          <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
            CAMPAIGNS & DROPS
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-orange-400" />
            <span>COLLECTIONS MANAGER</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collectionsList.map((col) => (
            <div key={col.id} className="bg-[#121216] border border-white/10 p-4 space-y-3">
              {col.imageUrl && (
                <div className="aspect-video bg-zinc-900 border border-white/10 overflow-hidden">
                  <img src={col.imageUrl} alt={col.titleEn} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <strong className="text-sm font-bold text-white uppercase block">{col.titleEn}</strong>
                <span className="text-xs text-zinc-400 block">{col.titleAr}</span>
                <span className="text-[10px] text-zinc-500 font-mono block">slug: {col.slug}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
