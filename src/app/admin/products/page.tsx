"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { formatDZD } from "@/lib/translations";
import { Plus, ShoppingBag, Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // New Product Form State
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [price, setPrice] = useState("5900");
  const [compareAtPrice, setCompareAtPrice] = useState("7200");
  const [sku, setSku] = useState("ZVR-ITEM-001");
  const [categoryId, setCategoryId] = useState("");
  const [badge, setBadge] = useState("NEW DROP");
  const [descriptionEn, setDescriptionEn] = useState("Heavyweight custom streetwear garment.");
  const [imageUrl, setImageUrl] = useState("https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
      }

      const catRes = await fetch("/api/categories");
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
        if (catData.categories?.length > 0) {
          setCategoryId(catData.categories[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        nameEn,
        nameAr: nameAr || nameEn,
        nameFr: nameFr || nameEn,
        price,
        compareAtPrice,
        sku,
        categoryId,
        badge,
        descriptionEn,
        images: [{ url: imageUrl, alt: nameEn, color: "Black" }],
        variants: [
          { color: "Black", size: "S", stock: 15, price },
          { color: "Black", size: "M", stock: 25, price },
          { color: "Black", size: "L", stock: 30, price },
          { color: "Black", size: "XL", stock: 20, price },
        ],
      };

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchProducts();
      }
    } catch (err) {
      alert("Failed to create product");
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
              STREETWEAR CATALOGUE
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-purple-400" />
              <span>PRODUCTS & VARIANTS MANAGER</span>
            </h1>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-white text-black font-extrabold text-xs uppercase flex items-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Streetwear Product</span>
          </button>
        </div>

        {/* Products Table */}
        <div className="bg-[#121216] border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-sm font-bold text-white uppercase">Active Products ({products.length})</h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">
              Loading products and inventory matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black text-zinc-400 font-bold uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Base Price</th>
                    <th className="p-3">Variants & Stock</th>
                    <th className="p-3">Badge</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="p-3 flex items-center gap-3">
                        {p.images && p.images[0]?.url ? (
                          <img src={p.images[0].url} alt="" className="w-10 h-12 object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-12 bg-zinc-800" />
                        )}
                        <div>
                          <strong className="text-white block uppercase">{p.nameEn}</strong>
                          <span className="text-zinc-500 text-[10px]">{p.nameAr}</span>
                        </div>
                      </td>
                      <td className="p-3 text-zinc-400">{p.sku}</td>
                      <td className="p-3 font-bold text-emerald-400">{formatDZD(p.price)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {p.variants?.map((v: any) => (
                            <span key={v.id} className="bg-zinc-800 px-1.5 py-0.5 border border-white/10 text-[10px] text-zinc-300">
                              {v.color}-{v.size}: <strong className="text-white">{v.stock}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {p.badge && (
                          <span className="px-2 py-0.5 bg-white text-black font-bold text-[10px] uppercase">
                            {p.badge}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold uppercase">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto font-mono">
          <div className="bg-[#121216] border border-white/20 max-w-xl w-full p-6 text-white space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold uppercase">Create Streetwear Product</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 uppercase">Name (English)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Heavyweight Hoodie"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 uppercase">Name (Arabic)</label>
                  <input
                    type="text"
                    placeholder="هودي ثقيل"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1 uppercase">Price (DZD)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 uppercase">Compare Price</label>
                  <input
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 uppercase">SKU</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 uppercase">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
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
                {isSubmitting ? "Creating Product..." : "Create Product with S/M/L/XL Variants"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
