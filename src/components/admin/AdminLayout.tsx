"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Activity,
  ShoppingBag,
  Grid,
  FolderKanban,
  ClipboardList,
  Boxes,
  Truck,
  Ruler,
  Palette,
  Image as ImageIcon,
  LogOut,
  ExternalLink,
} from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Storefront Builder", href: "/admin/builder", icon: Layers, badge: "VISUAL" },
    { label: "Storefront Health", href: "/admin/health", icon: Activity, badge: "SCAN" },
    { label: "Products & Variants", href: "/admin/products", icon: ShoppingBag },
    { label: "Categories", href: "/admin/categories", icon: Grid },
    { label: "Collections", href: "/admin/collections", icon: FolderKanban },
    { label: "Direct Orders", href: "/admin/orders", icon: ClipboardList },
    { label: "Inventory Matrix", href: "/admin/inventory", icon: Boxes },
    { label: "Shipping Rates", href: "/admin/shipping", icon: Truck },
    { label: "Size Guides", href: "/admin/size-guides", icon: Ruler },
    { label: "Design System", href: "/admin/design", icon: Palette },
    { label: "Media Library", href: "/admin/media", icon: ImageIcon },
  ];

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col md:flex-row font-mono antialiased">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0E0E12] border-r border-white/10 shrink-0 flex flex-col justify-between">
        <div>
          {/* Header Branding */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
            <a href="/admin" className="text-xl font-black uppercase text-white tracking-widest">
              ZAVRUNE <span className="text-[10px] text-zinc-400 block font-normal">ADMIN CONTROL</span>
            </a>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-zinc-400 hover:text-white"
              title="View Live Storefront"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Nav List */}
          <nav className="p-3 space-y-1 text-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 uppercase font-bold transition-all ${
                    isActive
                      ? "bg-white text-black font-extrabold shadow-md"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 ${
                        isActive ? "bg-black text-white" : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-950/60 border border-red-500/30 text-red-300 text-xs uppercase hover:bg-red-900 transition-colors font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen">
        {children}
      </main>
    </div>
  );
}
