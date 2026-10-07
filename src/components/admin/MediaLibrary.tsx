"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Spinner, adminFetch } from "@/components/admin/ui";
import { ArrowDown, ArrowUp, Copy, Image as ImageIcon, Trash2, Upload, Video } from "lucide-react";

interface MediaRow {
  id: string;
  url: string;
  filename: string;
  fileType: string;
  fileSize: number;
  folder: string;
  altText: string | null;
  source: string;
  position: number;
}

const FOLDERS = ["general", "product", "homepage", "category", "brand", "social"];

export function MediaLibrary() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [folder, setFolder] = useState("all");
  const [filter, setFilter] = useState("all");
  const [uploadFolder, setUploadFolder] = useState("product");
  const [uploading, setUploading] = useState(false);
  const [limits, setLimits] = useState<{ maxUploadBytes: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "200" });
      if (folder !== "all") params.set("folder", folder);
      if (filter !== "all") params.set("kind", filter);
      const data = await adminFetch<{ media: MediaRow[]; limits: any }>(`/api/admin/media?${params.toString()}`);
      setItems(data.media);
      setLimits(data.limits);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [folder, filter]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const upload = async (files: FileList) => {
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", uploadFolder);
        const res = await fetch("/api/admin/media", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(`${file.name}: ${data.error || "upload failed"}`);
      }
      setNotice(`${files.length} file(s) uploaded.`);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (item: MediaRow) => {
    if (!confirm(`Delete ${item.filename}? Product pages referencing it will show a broken image.`)) return;
    try {
      await adminFetch(`/api/admin/media/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setNotice("Media deleted.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await adminFetch(`/api/admin/media/${next[index].id}`, {
        method: "PATCH",
        body: JSON.stringify({ position: index }),
      });
      await adminFetch(`/api/admin/media/${next[target].id}`, {
        method: "PATCH",
        body: JSON.stringify({ position: target }),
      });
    } catch (err: any) {
      setError(err.message);
      load();
    }
  };

  const rename = async (item: MediaRow, patch: Partial<MediaRow>) => {
    try {
      await adminFetch(`/api/admin/media/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...patch } : row)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="ASSET REPOSITORY"
        title="Media Library"
        icon={<ImageIcon className="w-7 h-7 text-emerald-400" />}
        actions={<span className="text-xs text-zinc-400">{items.length} items</span>}
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Upload to folder">
            <Select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
              {FOLDERS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload files"}
              </span>
            </Button>
          </div>
          <Field label="Filter by folder">
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="all">All folders</option>
              {FOLDERS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Filter by type">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Images & videos</option>
              <option value="image">Images only</option>
              <option value="video">Videos only</option>
            </Select>
          </Field>
        </div>
        <p className="text-[10px] text-zinc-500">
          Uploads are stored durably in the database and served from /api/media/&lt;id&gt; — the Vercel filesystem is never used for
          persistence. Max {limits ? Math.floor(limits.maxUploadBytes / (1024 * 1024)) : 4} MB per file. On mobile this opens the
          Gallery / File picker.
        </p>
      </Card>

      <Card>
        {loading ? (
          <Spinner label="Loading media..." />
        ) : items.length === 0 ? (
          <EmptyState>No media in this view.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {items.map((item, index) => (
              <div key={item.id} className="bg-black border border-white/10 p-2 space-y-2">
                <div className="aspect-square bg-zinc-900 overflow-hidden">
                  {item.fileType.startsWith("video/") ? (
                    <video src={item.url} className="w-full h-full object-cover" muted controls />
                  ) : (
                    <img src={item.url} alt={item.altText || item.filename} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <Badge tone={item.source === "upload" ? "success" : "neutral"}>{item.source}</Badge>
                  <Badge tone="info">{item.folder}</Badge>
                </div>
                <Input
                  value={item.filename}
                  onChange={(e) => rename(item, { filename: e.target.value })}
                  className="text-[10px] py-1"
                />
                <Input
                  value={item.altText ?? ""}
                  placeholder="Alt text"
                  onChange={(e) => rename(item, { altText: e.target.value })}
                  className="text-[10px] py-1"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{(item.fileSize / 1024).toFixed(0)} KB</span>
                  <span className="flex items-center gap-1">
                    {item.fileType.startsWith("video/") ? <Video className="w-3 h-3" /> : null}
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(item.url);
                        setNotice("URL copied.");
                      }}
                      title="Copy URL"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <button onClick={() => move(index, -1)} className="text-zinc-500 hover:text-white" aria-label="Move up">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => move(index, 1)} className="text-zinc-500 hover:text-white" aria-label="Move down">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </span>
                  <button onClick={() => remove(item)} className="text-zinc-500 hover:text-red-400" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
