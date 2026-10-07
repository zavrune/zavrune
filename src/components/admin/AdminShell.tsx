"use client";

import React, { useState } from "react";
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
  ShieldCheck,
  Users,
  Settings,
  Menu,
  X,
  Flame,
  Star,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/mohamedbdr", icon: LayoutDashboard },
  { label: "Products & Variants", href: "/mohamedbdr/products", icon: ShoppingBag },
  { label: "New Drop", href: "/mohamedbdr/drops", icon: Flame, badge: "LIVE" },
  { label: "Featured", href: "/mohamedbdr/featured", icon: Star },
  { label: "Categories", href: "/mohamedbdr/categories", icon: Grid },
  { label: "Homepage Builder", href: "/mohamedbdr/homepage", icon: Layers, badge: "VISUAL" },
  { label: "Orders", href: "/mohamedbdr/orders", icon: ClipboardList },
  { label: "Customers", href: "/mohamedbdr/customers", icon: Users },
  { label: "Inventory", href: "/mohamedbdr/inventory", icon: Boxes },
  { label: "Media Library", href: "/mohamedbdr/media", icon: ImageIcon },
  { label: "Delivery", href: "/mohamedbdr/delivery", icon: Truck, badge: "58" },
  { label: "Store Settings", href: "/mohamedbdr/settings", icon: Settings },
  { label: "Design System", href: "/mohamedbdr/design", icon: Palette },
  { label: "Security", href: "/mohamedbdr/security", icon: ShieldCheck },
  { label: "Size Guides", href: "/mohamedbdr/size-guides", icon: Ruler },
  { label: "Storefront Health", href: "/mohamedbdr/health", icon: Activity, badge: "SCAN" },
];

export function AdminShell({ children, adminName }: { children: React.ReactNode; adminName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The login screen renders without the admin chrome.
  if (pathname === "/mohamedbdr/login") return <>{children}</>;

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/mohamedbdr/login");
      router.refresh();
    }
  };

  const nav = (
    <nav className="p-3 space-y-1 text-xs">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/mohamedbdr" && pathname.startsWith(`${item.href}/`));
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={() => setMobileNavOpen(false)}
            className={`flex items-center justify-between px-3 py-2.5 uppercase font-bold transition-all ${
              isActive ? "bg-white text-black font-extrabold shadow-md" : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </span>
            {item.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 ${isActive ? "bg-black text-white" : "bg-white/10 text-zinc-300"}`}>
                {item.badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#08080A] text-zinc-100 flex flex-col md:flex-row font-mono antialiased">
      <aside className="hidden md:flex md:w-64 bg-[#0E0E12] border-r border-white/10 shrink-0 flex-col justify-between">
        <div>
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
            <a href="/mohamedbdr" className="text-xl font-black uppercase text-white tracking-widest">
              ZAVRUNE <span className="text-[10px] text-zinc-400 block font-normal">ADMIN CONTROL</span>
            </a>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-zinc-400 hover:text-white"
              title="View live storefront"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          {nav}
        </div>
        <div className="p-4 border-t border-white/10 space-y-3">
          {adminName && <p className="text-[10px] text-zinc-500 truncate">Signed in as {adminName}</p>}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-950/60 border border-red-500/30 text-red-300 text-xs uppercase hover:bg-red-900 transition-colors font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 bg-[#0E0E12] sticky top-0 z-40">
        <button onClick={() => setMobileNavOpen(true)} className="p-2 text-zinc-300 hover:text-white" aria-label="Open admin menu">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-black uppercase tracking-widest">ZAVRUNE ADMIN</span>
        <a href="/" target="_blank" rel="noreferrer" className="p-2 text-zinc-400 hover:text-white" aria-label="View storefront">
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setMobileNavOpen(false)}>
          <div className="w-72 max-w-[85%] h-full bg-[#0E0E12] border-r border-white/10 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest">MENU</span>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 text-zinc-400 hover:text-white" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-950/60 border border-red-500/30 text-red-300 text-xs uppercase font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden min-h-screen">{children}</main>
    </div>
  );
}
