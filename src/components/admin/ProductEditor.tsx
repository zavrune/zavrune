"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Notice, PageHeader, Select, Spinner, Toggle, adminFetch, formatDZD } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { VariantOptionsEditor, type EditorOptionType, type EditorVariant } from "@/components/admin/VariantOptionsEditor";
import { ArrowLeft, Image as ImageIcon, Layers, Plus, Star, Trash2, Flame } from "lucide-react";

interface ProductForm {
  nameEn: string;
  nameAr: string;
  nameFr: string;
  slug: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionFr: string;
  shortDescriptionEn: string;
  price: string;
  compareAtPrice: string;
  salePrice: string;
  sku: string;
  categoryId: string;
  collectionId: string;
  badge: string;
  status: string;
  featured: boolean;
  videoUrl: string;
  seoTitle: string;
  seoDescription: string;
  tags: string;
}

const emptyForm: ProductForm = {
  nameEn: "",
  nameAr: "",
  nameFr: "",
  slug: "",
  descriptionEn: "",
  descriptionAr: "",
  descriptionFr: "",
  shortDescriptionEn: "",
  price: "0",
  compareAtPrice: "",
  salePrice: "",
  sku: "",
  categoryId: "",
  collectionId: "",
  badge: "",
  status: "published",
  featured: false,
  videoUrl: "",
  seoTitle: "",
  seoDescription: "",
  tags: "",
};

export function ProductEditor({ productId }: { productId: string }) {
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [images, setImages] = useState<{ url: string; alt?: string }[]>([]);
  const [mobileImages, setMobileImages] = useState<{ url: string; alt?: string }[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [optionTypes, setOptionTypes] = useState<EditorOptionType[]>([]);
  const [variants, setVariants] = useState<EditorVariant[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameEn: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState<null | "main" | "mobile" | "video">(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await adminFetch<{ product: any; graph: any }>(`/api/admin/products/${productId}`);
        const product = data.product;
        setForm({
          nameEn: product.nameEn ?? "",
          nameAr: product.nameAr ?? "",
          nameFr: product.nameFr ?? "",
          slug: product.slug ?? "",
          descriptionEn: product.descriptionEn ?? "",
          descriptionAr: product.descriptionAr ?? "",
          descriptionFr: product.descriptionFr ?? "",
          shortDescriptionEn: product.shortDescriptionEn ?? "",
          price: String(product.price ?? 0),
          compareAtPrice: product.compareAtPrice === null ? "" : String(product.compareAtPrice),
          salePrice: "",
          sku: product.sku ?? "",
          categoryId: product.categoryId ?? "",
          collectionId: product.collectionId ?? "",
          badge: product.badge ?? "",
          status: product.status ?? "published",
          featured: Boolean(product.featured),
          videoUrl: product.videoUrl ?? "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
        });
        setImages(Array.isArray(product.images) ? product.images : []);
        setMobileImages(Array.isArray(product.mobileImages) ? product.mobileImages : []);

        setOptionTypes(
          data.graph.optionTypes.map((type: any) => ({
            id: type.id,
            name: type.name,
            isEnabled: type.isEnabled,
            values: type.values.map((value: any) => ({
              id: value.id,
              value: value.value,
              isEnabled: value.isEnabled,
              colorHex: value.colorHex ?? "",
              imageUrl: value.imageUrl ?? "",
            })),
          }))
        );
        setVariants(
          data.graph.variants.map((variant: any) => ({
            id: variant.id,
            sku: variant.sku,
            stock: variant.stock,
            price: variant.price === null ? "" : String(variant.price),
            compareAtPrice: variant.compareAtPrice === null ? "" : String(variant.compareAtPrice),
            imageUrl: variant.imageUrl ?? "",
            status: variant.status === "inactive" ? "inactive" : "active",
            options: variant.options ?? {},
          }))
        );

        const [categoriesData, groupsData] = await Promise.all([
          adminFetch<{ categories: { id: string; nameEn: string }[] }>("/api/admin/categories"),
          adminFetch<{ groups: { key: string; productIds: string[] }[] }>("/api/admin/groups"),
        ]);
        setCategories(categoriesData.categories ?? []);
        setGroups(
          (groupsData.groups ?? [])
            .filter((group) => Array.isArray(group.productIds) && group.productIds.includes(productId))
            .map((group) => group.key)
        );
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const saveProduct = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminFetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          nameEn: form.nameEn,
          nameAr: form.nameAr,
          nameFr: form.nameFr,
          slug: form.slug || undefined,
          descriptionEn: form.descriptionEn,
          descriptionAr: form.descriptionAr,
          descriptionFr: form.descriptionFr,
          shortDescriptionEn: form.shortDescriptionEn,
          price: Number(form.price) || 0,
          compareAtPrice: form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
          sku: form.sku,
          categoryId: form.categoryId || null,
          collectionId: form.collectionId || null,
          badge: form.badge,
          status: form.status,
          featured: form.featured,
          videoUrl: form.videoUrl,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          images,
          mobileImages,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          groupKeys: groups,
        }),
      });
      setNotice("Product saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading product..." />;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="PRODUCT EDITOR"
        title={form.nameEn || "Product"}
        icon={<Layers className="w-7 h-7 text-purple-400" />}
        actions={
          <>
            <Link href="/mohamedbdr/products" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <Button onClick={saveProduct} disabled={saving}>
              {saving ? "Saving..." : "Save product"}
            </Button>
          </>
        }
      />

      {error && <Notice tone="error" onDismiss={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onDismiss={() => setNotice("")}>{notice}</Notice>}

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name (English)">
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </Field>
          <Field label="Name (Arabic)">
            <Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          </Field>
          <Field label="Name (French)">
            <Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field label="Price (DZD)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Compare-at (original)">
            <Input type="number" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="Badge">
            <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="NEW DROP" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="published">Published (live)</option>
              <option value="draft">Draft / hidden</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="URL slug" hint="Used in /p/<slug>">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
        </div>

        <Field label="Tags (comma separated)">
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="oversized, heavyweight, drop-1" />
        </Field>

        <div className="grid grid-cols-1 gap-3">
          <Field label="Short description (English)">
            <Input value={form.shortDescriptionEn} onChange={(e) => setForm({ ...form, shortDescriptionEn: e.target.value })} />
          </Field>
          <Field label="Description (English)">
            <textarea
              rows={4}
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Description (Arabic)">
            <textarea
              rows={3}
              dir="rtl"
              value={form.descriptionAr}
              onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="Description (French)">
            <textarea
              rows={3}
              value={form.descriptionFr}
              onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
              className="w-full bg-black border border-white/20 px-3 py-2 text-sm text-white"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5 border-t border-white/10 pt-4">
          <Toggle checked={form.featured} onChange={(value) => setForm({ ...form, featured: value })} label="Featured" />
          <Toggle checked={groups.includes("new_drop")} onChange={(value) => setGroups(value ? [...groups, "new_drop"] : groups.filter((g) => g !== "new_drop"))} label="In New Drop" />
          <Toggle checked={groups.includes("featured")} onChange={(value) => setGroups(value ? [...groups, "featured"] : groups.filter((g) => g !== "featured"))} label="In Featured collection" />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">Media</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {images.map((image, index) => (
              <div key={`${image.url}-${index}`} className="relative">
                <img src={image.url} alt="" className="w-20 h-24 object-cover border border-white/10" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 bg-black border border-white/20 p-1 text-zinc-300 hover:text-red-400"
                  aria-label="Remove image"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setPicker("main")}>
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add image
              </span>
            </Button>
          </div>

          <Field label="Video URL (mp4 / webm)">
            <div className="flex gap-2">
              <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://... or /api/media/..." />
              <Button variant="ghost" onClick={() => setPicker("video")}>
                Choose
              </Button>
            </div>
          </Field>

          <Field label="Mobile images (optional)">
            <div className="flex flex-wrap items-center gap-3">
              {mobileImages.map((image, index) => (
                <div key={`${image.url}-mobile-${index}`} className="relative">
                  <img src={image.url} alt="" className="w-14 h-20 object-cover border border-white/10" />
                  <button
                    onClick={() => setMobileImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute -top-2 -right-2 bg-black border border-white/20 p-1 text-zinc-300 hover:text-red-400"
                    aria-label="Remove mobile image"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setPicker("mobile")}>
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" /> Add mobile image
                </span>
              </Button>
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase text-white border-b border-white/10 pb-3">SEO</h2>
        <div className="grid grid-cols-1 gap-3">
          <Field label="SEO title">
            <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          </Field>
          <Field label="SEO description">
            <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </Field>
        </div>
      </Card>

      <VariantOptionsEditor
        productId={productId}
        baseSku={form.sku || "ZVR"}
        basePrice={Number(form.price) || 0}
        initialOptionTypes={optionTypes}
        initialVariants={variants}
        onSaved={setNotice}
      />

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-[10px] text-zinc-500">
          Current price {formatDZD(Number(form.price) || 0)}
          {form.compareAtPrice ? ` • was ${formatDZD(Number(form.compareAtPrice))}` : ""}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Star className="w-3 h-3" /> featured
            <Flame className="w-3 h-3 ml-2" /> new drop
          </span>
          <Button onClick={saveProduct} disabled={saving}>
            {saving ? "Saving..." : "Save product"}
          </Button>
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        accept={picker === "video" ? "video" : "image"}
        folder="product"
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "main") setImages((prev) => [...prev, { url, alt: form.nameEn }]);
          else if (picker === "mobile") setMobileImages((prev) => [...prev, { url, alt: form.nameEn }]);
          else if (picker === "video") setForm((prev) => ({ ...prev, videoUrl: url }));
        }}
      />
    </div>
  );
}
