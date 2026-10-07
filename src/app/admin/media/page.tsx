import { db } from "@/db";
import { media } from "@/db/schema";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Image as ImageIcon } from "lucide-react";

export const revalidate = 0;

export default async function AdminMediaPage() {
  const mediaItems = await db.select().from(media);

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6">
          <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
            ASSET REPOSITORY
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-emerald-400" />
            <span>MEDIA LIBRARY</span>
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[
            "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
            "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
            "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&q=80",
            "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80",
            "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80",
            "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80",
            "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
            "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
          ].map((url, idx) => (
            <div key={idx} className="bg-[#121216] border border-white/10 p-2 space-y-2 group">
              <div className="aspect-square bg-zinc-900 overflow-hidden">
                <img src={url} alt={`Media ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="text-[10px] text-zinc-400 truncate">
                {url}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
