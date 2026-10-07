"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Button, Input, Notice, Field, Spinner } from "@/components/admin/ui";
import { Upload, Link2, Trash2 } from "lucide-react";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  fileType: string;
  fileSize: number;
  folder: string;
  altText: string | null;
  source: string;
}

/**
 * Upload / choose media. On phones the <input type="file" accept="image/*"> and
 * accept="video/*" controls open the normal Gallery / File picker.
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = "image",
  folder = "general",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  accept?: "image" | "video" | "any";
  folder?: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptAttr = accept === "video" ? "video/*" : accept === "image" ? "image/*" : "image/*,video/*";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/media?pageSize=120&folder=all`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load media");
      const filtered = (data.media as MediaItem[]).filter((item) =>
        accept === "any" ? true : item.fileType.startsWith(`${accept}/`)
      );
      setItems(filtered);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      void load();
    });
  }, [open, load]);

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);

      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

      setItems((prev) => [data.media as MediaItem, ...prev]);
      onSelect(data.media.url);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this media item permanently?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Media library" onClose={onClose} wide>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          <span className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> {busy ? "Uploading..." : "Upload file"}
          </span>
        </Button>
        <span className="text-[10px] text-zinc-500">Max 4 MB per file. Stored durably in the database.</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <Field label="Or paste an external URL (e.g. video link)" className="flex-1">
          <Input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://..." />
        </Field>
        <Button
          variant="ghost"
          onClick={async () => {
            if (!manualUrl.trim()) return;
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/admin/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: manualUrl.trim(), folder, fileType: accept === "video" ? "video/mp4" : "image/jpeg" }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) throw new Error(data.error || "Could not link URL");
              setItems((prev) => [data.media as MediaItem, ...prev]);
              onSelect(data.media.url);
              onClose();
            } catch (err: any) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5" /> Link URL
          </span>
        </Button>
      </div>

      {loading ? (
        <Spinner label="Loading media..." />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-zinc-500 text-xs">No media yet. Upload the first file above.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="bg-black border border-white/10 p-2 space-y-2 group">
              <button
                type="button"
                onClick={() => {
                  onSelect(item.url);
                  onClose();
                }}
                className="block w-full aspect-square overflow-hidden bg-zinc-900"
              >
                {item.fileType.startsWith("video/") ? (
                  <video src={item.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={item.url} alt={item.altText || item.filename} className="w-full h-full object-cover" />
                )}
              </button>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] text-zinc-500 truncate">{item.filename}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-zinc-500 hover:text-red-400 shrink-0"
                  aria-label={`Delete ${item.filename}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
