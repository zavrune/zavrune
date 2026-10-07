import { db } from "@/db";
import { productVariants, products, inventoryEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Boxes } from "lucide-react";

export const revalidate = 0;

export default async function AdminInventoryPage() {
  const variantsList = await db.select().from(productVariants);
  const productsList = await db.select().from(products);
  const eventsList = await db.select().from(inventoryEvents).orderBy(desc(inventoryEvents.createdAt)).limit(10);

  const inventoryMatrix = variantsList.map((v) => {
    const parentProd = productsList.find((p) => p.id === v.productId);
    return {
      ...v,
      productName: parentProd?.nameEn || "Streetwear Item",
      productSku: parentProd?.sku || "SKU",
    };
  });

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6">
          <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
            STOCK CONTROL
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
            <Boxes className="w-8 h-8 text-amber-400" />
            <span>INVENTORY MATRIX</span>
          </h1>
        </div>

        <div className="bg-[#121216] border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-3">
            Variant Stock Levels ({inventoryMatrix.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black text-zinc-400 font-bold uppercase border-b border-white/10">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Variant SKU</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">In Stock</th>
                  <th className="p-3">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inventoryMatrix.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white uppercase">{item.productName}</td>
                    <td className="p-3 text-zinc-400">{item.sku}</td>
                    <td className="p-3 text-zinc-300">{item.color}</td>
                    <td className="p-3 text-zinc-300 font-bold">{item.size}</td>
                    <td className="p-3 text-base font-black text-white">{item.stock}</td>
                    <td className="p-3">
                      {item.stock > 5 ? (
                        <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                          In Stock
                        </span>
                      ) : item.stock > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-500/30 uppercase font-bold">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-500/30 uppercase font-bold">
                          Out of Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
