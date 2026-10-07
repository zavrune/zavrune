"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Grid, Plus } from "lucide-react";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [imageUrl, setImageUrl] = useState("https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (res.ok && data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn, nameAr, nameFr, imageUrl }),
      });
      if (res.ok) {
        setModalOpen(false);
        setNameEn("");
        fetchCategories();
      }
    } catch (err) {
      alert("Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
              STREETWEAR CATEGORIES
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <Grid className="w-8 h-8 text-blue-400" />
              <span>CATEGORY MANAGER</span>
            </h1>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-white text-black font-extrabold text-xs uppercase flex items-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Category</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-[#121216] border border-white/10 p-4 space-y-3">
              {cat.imageUrl && (
                <div className="aspect-square bg-zinc-900 border border-white/10 overflow-hidden">
                  <img src={cat.imageUrl} alt={cat.nameEn} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <strong className="text-sm font-bold text-white uppercase block">{cat.nameEn}</strong>
                <span className="text-xs text-zinc-400 block">{cat.nameAr}</span>
                <span className="text-[10px] text-zinc-500 font-mono block">slug: {cat.slug}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
          <div className="bg-[#121216] border border-white/20 max-w-md w-full p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold uppercase">Add Streetwear Category</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-zinc-300 mb-1 uppercase">Name (English)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leather Jackets"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 uppercase">Name (Arabic)</label>
                <input
                  type="text"
                  placeholder="سترات جلدية"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 uppercase">Image URL</label>
                <input
                  type="text"
                  required
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-white text-black font-extrabold uppercase hover:bg-zinc-200"
              >
                {isSubmitting ? "Creating..." : "Save Category"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
