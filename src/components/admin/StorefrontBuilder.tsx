"use client";

import React, { useState, useEffect } from "react";
import { StorefrontSection } from "@/components/sections/StorefrontSection";
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Save,
  Send,
  RotateCcw,
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

const AVAILABLE_SECTION_TYPES = [
  { type: "announcement", label: "Announcement Bar", icon: "📢" },
  { type: "hero", label: "Hero Banner", icon: "🔥" },
  { type: "marquee", label: "Marquee Ticker", icon: "📜" },
  { type: "featured_collection", label: "Featured Collection", icon: "✨" },
  { type: "product_grid", label: "Product Grid", icon: "🛍️" },
  { type: "category_showcase", label: "Category Showcase", icon: "🗂️" },
  { type: "drop_announcement", label: "Drop Announcement", icon: "⚡" },
  { type: "brand_story", label: "Brand Manifesto", icon: "📖" },
  { type: "newsletter", label: "Newsletter VIP Club", icon: "✉️" },
  { type: "spacer", label: "Spacer", icon: "↕️" },
  { type: "divider", label: "Divider Line", icon: "➖" },
];

export function StorefrontBuilder({
  initialSections = [],
  productsList = [],
  categoriesList = [],
}: {
  initialSections: any[];
  productsList: any[];
  categoriesList: any[];
}) {
  const [sections, setSections] = useState<any[]>(initialSections);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const selectedSection = sections[selectedIndex] || null;

  // Move Section Up/Down
  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setSections(updated);
    setSelectedIndex(targetIndex);
  };

  // Duplicate Section
  const duplicateSection = (index: number) => {
    const original = sections[index];
    const duplicated = JSON.parse(JSON.stringify(original));
    duplicated.id = `sec_dup_${Date.now()}`;

    const updated = [...sections];
    updated.splice(index + 1, 0, duplicated);
    setSections(updated);
    setSelectedIndex(index + 1);
  };

  // Delete Section
  const deleteSection = (index: number) => {
    if (sections.length <= 1) {
      alert("At least one section must remain on the page.");
      return;
    }
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    setSelectedIndex(Math.max(0, index - 1));
  };

  // Toggle Visibility
  const toggleVisibility = (index: number) => {
    const updated = [...sections];
    updated[index].isVisible = !updated[index].isVisible;
    setSections(updated);
  };

  // Add New Section
  const handleAddSection = (type: string) => {
    const newSec = {
      id: `sec_new_${Date.now()}`,
      sectionType: type,
      isVisible: true,
      desktopVisible: true,
      mobileVisible: true,
      config: {
        titleEn: `NEW ${type.replace("_", " ").toUpperCase()}`,
        subtitleEn: "Custom streetwear section content.",
      },
    };
    setSections([...sections, newSec]);
    setSelectedIndex(sections.length);
    setAddModalOpen(false);
  };

  // Update Active Section Config
  const updateConfig = (key: string, value: any) => {
    if (selectedIndex === null) return;
    const updated = [...sections];
    updated[selectedIndex].config = {
      ...updated[selectedIndex].config,
      [key]: value,
    };
    setSections(updated);
  };

  // Save Draft to DB
  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusMessage("");
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_draft", sections }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage("Draft saved!");
      }
    } catch (err: any) {
      alert("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  // Publish to Live Storefront
  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage("");
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", sections }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage("Published to Live Storefront!");
      }
    } catch (err: any) {
      alert("Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  // Rollback to Last Revision
  const handleRollback = async () => {
    if (!confirm("Are you sure you want to rollback to the last published snapshot?")) return;
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Rollback successful. Reloading page...");
        window.location.reload();
      }
    } catch (err: any) {
      alert("Rollback failed");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#08080A] text-zinc-100 font-mono">
      {/* Top Toolbar */}
      <div className="h-14 bg-[#121216] border-b border-white/10 px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h1 className="text-sm font-black uppercase text-white tracking-widest hidden sm:inline">
            STOREFRONT BUILDER
          </h1>

          {statusMessage && (
            <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 animate-fadeIn">
              ✓ {statusMessage}
            </span>
          )}
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center bg-black border border-white/15 p-0.5">
          <button
            onClick={() => setViewport("desktop")}
            className={`p-1.5 transition-colors ${
              viewport === "desktop" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
            }`}
            title="Desktop View"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport("tablet")}
            className={`p-1.5 transition-colors ${
              viewport === "tablet" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
            }`}
            title="Tablet View"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`p-1.5 transition-colors ${
              viewport === "mobile" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
            }`}
            title="Mobile View"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleRollback}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 font-bold uppercase flex items-center gap-1.5"
            title="Rollback to last snapshot"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rollback</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/20 font-bold uppercase flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Draft"}</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 font-extrabold uppercase flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublishing ? "Publishing..." : "Publish Live"}</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 text-zinc-400 hover:text-white border border-white/10"
            title="Open Live Preview"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Section Tree */}
        <div className="w-72 bg-[#0E0E12] border-r border-white/10 flex flex-col shrink-0">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-zinc-300">Section Tree ({sections.length})</span>
            <button
              onClick={() => setAddModalOpen(true)}
              className="p-1 bg-white text-black hover:bg-zinc-200"
              title="Add Section"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
            {sections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                onClick={() => setSelectedIndex(idx)}
                className={`p-2.5 border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                  selectedIndex === idx
                    ? "bg-white text-black font-extrabold border-white"
                    : "bg-[#15151A] text-zinc-300 border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[10px] text-zinc-500 font-bold">{idx + 1}.</span>
                  <span className="truncate uppercase">{sec.sectionType.replace("_", " ")}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(idx);
                    }}
                    className="p-0.5 hover:text-white"
                  >
                    {sec.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "up");
                    }}
                    disabled={idx === 0}
                    className="p-0.5 disabled:opacity-20"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "down");
                    }}
                    disabled={idx === sections.length - 1}
                    className="p-0.5 disabled:opacity-20"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateSection(idx);
                    }}
                    className="p-0.5 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSection(idx);
                    }}
                    className="p-0.5 text-red-400 hover:text-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10">
            <button
              onClick={() => setAddModalOpen(true)}
              className="w-full py-2 bg-white text-black font-bold uppercase text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Section</span>
            </button>
          </div>
        </div>

        {/* CENTER COLUMN: Live Storefront Preview */}
        <div className="flex-1 bg-[#050507] p-4 flex items-center justify-center overflow-auto">
          <div
            className={`bg-[#08080A] border border-white/20 shadow-2xl transition-all duration-300 overflow-y-auto max-h-full ${
              viewport === "mobile"
                ? "w-[375px] h-[750px]"
                : viewport === "tablet"
                ? "w-[768px] h-[800px]"
                : "w-full h-full"
            }`}
          >
            {sections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative transition-all cursor-pointer ${
                  selectedIndex === idx ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black z-20" : ""
                } ${!sec.isVisible ? "opacity-30 border border-dashed border-red-500" : ""}`}
              >
                <StorefrontSection
                  sectionType={sec.sectionType}
                  config={sec.config}
                  productsList={productsList}
                  categoriesList={categoriesList}
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Inspector Properties Panel */}
        <div className="w-80 bg-[#0E0E12] border-l border-white/10 flex flex-col shrink-0">
          <div className="p-3 border-b border-white/10">
            <span className="text-xs font-bold uppercase text-white">Section Properties Inspector</span>
          </div>

          {selectedSection ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="p-2 bg-black border border-white/10 text-zinc-400 font-bold uppercase">
                Type: <span className="text-white">{selectedSection.sectionType}</span>
              </div>

              {/* Title EN / AR / FR */}
              <div className="space-y-2">
                <label className="text-zinc-300 uppercase block font-bold">Title (English)</label>
                <input
                  type="text"
                  value={selectedSection.config?.titleEn || ""}
                  onChange={(e) => updateConfig("titleEn", e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                />

                <label className="text-zinc-300 uppercase block font-bold">Title (Arabic)</label>
                <input
                  type="text"
                  value={selectedSection.config?.titleAr || ""}
                  onChange={(e) => updateConfig("titleAr", e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                  dir="rtl"
                />
              </div>

              {/* Subtitle / Description */}
              <div className="space-y-2">
                <label className="text-zinc-300 uppercase block font-bold">Subtitle / Description</label>
                <textarea
                  rows={3}
                  value={selectedSection.config?.subtitleEn || selectedSection.config?.descriptionEn || ""}
                  onChange={(e) => updateConfig("subtitleEn", e.target.value)}
                  className="w-full bg-black border border-white/20 p-2 text-white"
                />
              </div>

              {/* Image URL */}
              {selectedSection.sectionType === "hero" || selectedSection.sectionType === "drop_announcement" ? (
                <div className="space-y-2">
                  <label className="text-zinc-300 uppercase block font-bold">Background / Campaign Image URL</label>
                  <input
                    type="text"
                    value={selectedSection.config?.bgImageDesktop || selectedSection.config?.imageUrl || ""}
                    onChange={(e) => {
                      updateConfig("bgImageDesktop", e.target.value);
                      updateConfig("imageUrl", e.target.value);
                    }}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>
              ) : null}

              {/* Hero CTA Button 1 & 2 */}
              {selectedSection.sectionType === "hero" && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <label className="text-zinc-300 uppercase block font-bold">Primary Button Text</label>
                  <input
                    type="text"
                    value={selectedSection.config?.ctaPrimaryTextEn || ""}
                    onChange={(e) => updateConfig("ctaPrimaryTextEn", e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />

                  <label className="text-zinc-300 uppercase block font-bold">Primary Link URL</label>
                  <input
                    type="text"
                    value={selectedSection.config?.ctaPrimaryUrl || "/shop"}
                    onChange={(e) => updateConfig("ctaPrimaryUrl", e.target.value)}
                    className="w-full bg-black border border-white/20 p-2 text-white"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs">
              Select a section from the left tree to inspect and edit properties.
            </div>
          )}
        </div>
      </div>

      {/* Add Section Library Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121216] border border-white/20 max-w-lg w-full p-6 text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold uppercase">Add New Streetwear Section</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {AVAILABLE_SECTION_TYPES.map((sec) => (
                <button
                  key={sec.type}
                  onClick={() => handleAddSection(sec.type)}
                  className="p-3 bg-black border border-white/15 hover:border-white text-left font-mono text-xs uppercase flex items-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <span className="text-lg">{sec.icon}</span>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
