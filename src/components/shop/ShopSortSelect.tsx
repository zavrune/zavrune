"use client";

import { useRouter } from "next/navigation";

export function ShopSortSelect({ sortOption }: { sortOption: string }) {
  const router = useRouter();
  return (
    <>
      <label htmlFor="shop-sort" className="text-zinc-400 uppercase">Sort:</label>
      <select
        id="shop-sort"
        value={sortOption}
        onChange={(event) => {
          const url = new URL(window.location.href);
          url.searchParams.set("sort", event.target.value);
          router.push(`${url.pathname}${url.search}${url.hash}`);
        }}
        className="bg-black border border-white/20 text-white px-2 py-1 focus:outline-none"
      >
        <option value="newest">Newest Arrivals</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </>
  );
}
