"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Palette, Save, CheckCircle } from "lucide-react";

export default function AdminDesignPage() {
  const [bgPrimary, setBgPrimary] = useState("#08080A");
  const [bgSurface, setBgSurface] = useState("#121215");
  const [textPrimary, setTextPrimary] = useState("#F4F4F5");
  const [textMuted, setTextMuted] = useState("#9CA3AF");
  const [accent, setAccent] = useState("#E2E8F0");
  const [btnBg, setBtnBg] = useState("#FFFFFF");
  const [btnText, setBtnText] = useState("#000000");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch("/api/settings/design");
        const data = await res.json();
        if (data?.theme) {
          setBgPrimary(data.theme.bgPrimary || "#08080A");
          setBgSurface(data.theme.bgSurface || "#121215");
          setTextPrimary(data.theme.textPrimary || "#F4F4F5");
          setTextMuted(data.theme.textMuted || "#9CA3AF");
          setAccent(data.theme.accent || "#E2E8F0");
          setBtnBg(data.theme.btnBg || "#FFFFFF");
          setBtnText(data.theme.btnText || "#000000");
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadTheme();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const payload = {
        theme: {
          bgPrimary,
          bgSurface,
          textPrimary,
          textMuted,
          accent,
          btnBg,
          btnText,
          borderRadius: "0px",
          typographyFont: "inter",
        },
      };

      const res = await fetch("/api/settings/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
      }
    } catch (err) {
      alert("Failed to save design tokens");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-8 font-mono">
        <div className="border-b border-white/10 pb-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 uppercase tracking-widest block mb-1">
              THEME CONTROL
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight flex items-center gap-3">
              <Palette className="w-8 h-8 text-pink-400" />
              <span>DESIGN SYSTEM TOKENS</span>
            </h1>
          </div>

          {success && (
            <span className="text-xs text-emerald-400 bg-emerald-950 px-3 py-1.5 border border-emerald-500/30 font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="bg-[#121216] border border-white/10 p-6 sm:p-8 space-y-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 mb-1 uppercase font-bold">Background Primary</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgPrimary}
                  onChange={(e) => setBgPrimary(e.target.value)}
                  className="w-10 h-10 bg-transparent border border-white/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={bgPrimary}
                  onChange={(e) => setBgPrimary(e.target.value)}
                  className="flex-1 bg-black border border-white/20 p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 mb-1 uppercase font-bold">Background Surface</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgSurface}
                  onChange={(e) => setBgSurface(e.target.value)}
                  className="w-10 h-10 bg-transparent border border-white/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={bgSurface}
                  onChange={(e) => setBgSurface(e.target.value)}
                  className="flex-1 bg-black border border-white/20 p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 mb-1 uppercase font-bold">Text Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textPrimary}
                  onChange={(e) => setTextPrimary(e.target.value)}
                  className="w-10 h-10 bg-transparent border border-white/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={textPrimary}
                  onChange={(e) => setTextPrimary(e.target.value)}
                  className="flex-1 bg-black border border-white/20 p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 mb-1 uppercase font-bold">Button Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={btnBg}
                  onChange={(e) => setBtnBg(e.target.value)}
                  className="w-10 h-10 bg-transparent border border-white/20 cursor-pointer"
                />
                <input
                  type="text"
                  value={btnBg}
                  onChange={(e) => setBtnBg(e.target.value)}
                  className="flex-1 bg-black border border-white/20 p-2 text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-white text-black font-extrabold text-sm uppercase flex items-center justify-center gap-2 hover:bg-zinc-200"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Updating..." : "Save Design Tokens"}</span>
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
