"use client";

import React, { useState } from "react";
import { Button, Card, Field, Input, Notice, PageHeader, Select, Spinner, Toggle, adminFetch } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { Settings } from "lucide-react";

export interface StoreSettingsShape {
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socials: { instagram: string; tiktok: string; facebook: string; youtube: string; x: string; whatsapp: string };
  currency: string;
  freeShippingThreshold: number | null;
  orderPrefix: string;
  orderThankYouNote: string;
  codEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryNote: string;
  musicUrl: string;
  musicEnabled: boolean;
  musicAutoplay: boolean;
  announcementText: string;
  metaTitle: string;
  metaDescription: string;
}

export function StoreSettingsForm({ initial }: { initial: StoreSettingsShape }) {
  const [form, setForm] = useState<StoreSettingsShape>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState<null | "logo" | "favicon" | "music">(null);

  const set = <K extends keyof StoreSettingsShape>(key: K, value: StoreSettingsShape[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setSocial = (key: keyof StoreSettingsShape["socials"], value: string) =>
    setForm((prev) => ({ ...prev, socials: { ...prev.socials, [key]: value } }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/settings/store", { method: "PUT", body: JSON.stringify(form) });
      setNotice("Store settings saved. The storefront picks these up on the next request.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        eyebrow="STOREFRONT CONFIGURATION"
        title="Store Settings"
        icon={<Settings className="w-7 h-7 text-zinc-300" />}
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Store name">
            <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} />
          </Field>
          <Field label="Tagline">
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {form.logoUrl ? <img src={form.logoUrl} alt="" className="w-12 h-12 object-contain border border-white/10 bg-black" /> : null}
              <Button variant="ghost" onClick={() => setPicker("logo")}>
                Choose / upload
              </Button>
              {form.logoUrl && (
                <Button variant="ghost" onClick={() => set("logoUrl", "")}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
          <Field label="Favicon">
            <div className="flex items-center gap-3">
              {form.faviconUrl ? <img src={form.faviconUrl} alt="" className="w-8 h-8 object-contain border border-white/10 bg-black" /> : null}
              <Button variant="ghost" onClick={() => setPicker("favicon")}>
                Choose / upload
              </Button>
              {form.faviconUrl && (
                <Button variant="ghost" onClick={() => set("faviconUrl", "")}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
        </div>
        <Field label="Announcement bar text" hint="Shown in the storefront header when set.">
          <Input value={form.announcementText} onChange={(e) => set("announcementText", e.target.value)} />
        </Field>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Contact & social</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Phone">
            <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </Field>
          <Field label="Address">
            <Input value={form.contactAddress} onChange={(e) => set("contactAddress", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Instagram URL">
            <Input value={form.socials.instagram} onChange={(e) => setSocial("instagram", e.target.value)} />
          </Field>
          <Field label="TikTok URL">
            <Input value={form.socials.tiktok} onChange={(e) => setSocial("tiktok", e.target.value)} />
          </Field>
          <Field label="Facebook URL">
            <Input value={form.socials.facebook} onChange={(e) => setSocial("facebook", e.target.value)} />
          </Field>
          <Field label="YouTube URL">
            <Input value={form.socials.youtube} onChange={(e) => setSocial("youtube", e.target.value)} />
          </Field>
          <Field label="X / Twitter URL">
            <Input value={form.socials.x} onChange={(e) => setSocial("x", e.target.value)} />
          </Field>
          <Field label="WhatsApp link">
            <Input value={form.socials.whatsapp} onChange={(e) => setSocial("whatsapp", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Commerce</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="DZD">DZD — Algerian Dinar</option>
            </Select>
          </Field>
          <Field label="Free shipping threshold (DZD)" hint="Empty disables free shipping.">
            <Input
              type="number"
              value={form.freeShippingThreshold ?? ""}
              onChange={(e) => set("freeShippingThreshold", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="Order number prefix">
            <Input value={form.orderPrefix} onChange={(e) => set("orderPrefix", e.target.value)} />
          </Field>
        </div>
        <Field label="Thank-you note (order success page)">
          <textarea
            rows={2}
            value={form.orderThankYouNote}
            onChange={(e) => set("orderThankYouNote", e.target.value)}
            className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
          />
        </Field>
        <div className="flex flex-wrap gap-5 border-t border-white/10 pt-4">
          <Toggle checked={form.codEnabled} onChange={(value) => set("codEnabled", value)} label="Cash on delivery enabled" />
          <Toggle checked={form.deliveryEnabled} onChange={(value) => set("deliveryEnabled", value)} label="Delivery enabled" />
        </div>
        <Field label="Delivery note (checkout)">
          <Input value={form.deliveryNote} onChange={(e) => set("deliveryNote", e.target.value)} />
        </Field>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Music & SEO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Storefront music URL (mp3)">
            <div className="flex gap-2">
              <Input value={form.musicUrl} onChange={(e) => set("musicUrl", e.target.value)} />
              <Button variant="ghost" onClick={() => setPicker("music")}>
                Pick
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Toggle checked={form.musicEnabled} onChange={(value) => set("musicEnabled", value)} label="Music enabled" />
            <Toggle checked={form.musicAutoplay} onChange={(value) => set("musicAutoplay", value)} label="Autoplay" />
          </div>
        </div>
        <Field label="Meta title">
          <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} />
        </Field>
        <Field label="Meta description">
          <textarea
            rows={2}
            value={form.metaDescription}
            onChange={(e) => set("metaDescription", e.target.value)}
            className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <MediaPicker
        open={picker !== null}
        accept={picker === "music" ? "any" : "image"}
        folder="brand"
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "logo") set("logoUrl", url);
          else if (picker === "favicon") set("faviconUrl", url);
          else if (picker === "music") set("musicUrl", url);
        }}
      />
    </div>
  );
}
