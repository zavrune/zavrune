import { db } from "./index";
import { insertPageSections } from "./page-sections";
import {
  settings,
  categories,
  collections,
  sizeGuides,
  sizeGuideMeasurements,
  products,
  productVariants,
  pageSections,
  navigation,
  shippingZones,
  shippingMethods,
  pages,
  orders,
  customers,
} from "./schema";
import { and, eq, isNull, sql } from "drizzle-orm";

interface VariantSeed {
  color: string;
  colorHex?: string;
  size: string;
  stock: number;
  price: number;
  compareAtPrice?: number;
}

const SEED_MARKER = "zavrune_official_seed_v1";

/** Insert-only official starter data. Every write and the eligibility check share
 * one transaction/connection; the transaction-scoped lock works with poolers.
 * Explicit admin/CLI runs can safely resume a legacy partial seed. Automatic
 * bootstrap refuses unmarked nonempty storefronts rather than guessing ownership.
 */
type LockRow = { acquired: boolean };

export async function seedDatabase({ onlyIfEmpty = false } = {}) {
  // Read-only fast path: a completed store never opens a lock or a transaction.
  const [completed] = await db.select().from(settings).where(eq(settings.key, SEED_MARKER)).limit(1);
  if (completed) return;

  return db.transaction(async (tx) => {
    // Non-blocking: concurrent cold instances skip instead of queueing. The
    // transaction-scoped lock releases even if the connection is recycled.
    const locked = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('zavrune-official-seed-v1')) as acquired`
    );
    if ((locked.rows?.[0] as LockRow | undefined)?.acquired !== true) return;
    const [marker] = await tx.select().from(settings).where(eq(settings.key, SEED_MARKER));
    // Completed stores stay untouched even if an owner later removes seed content.
    if (marker) return;
    if (onlyIfEmpty) {
      const occupied = [
        await tx.select({ id: products.id }).from(products).limit(1),
        await tx.select({ id: categories.id }).from(categories).limit(1),
        await tx.select({ id: collections.id }).from(collections).limit(1),
        await tx.select({ id: pages.id }).from(pages).limit(1),
        await tx.select({ id: pageSections.id }).from(pageSections).limit(1),
        await tx.select({ id: navigation.id }).from(navigation).limit(1),
        await tx.select({ id: sizeGuides.id }).from(sizeGuides).limit(1),
        await tx.select({ id: shippingZones.id }).from(shippingZones).limit(1),
        await tx.select({ id: orders.id }).from(orders).limit(1),
        await tx.select({ id: customers.id }).from(customers).limit(1),
      ];
      if (occupied.some((rows) => rows.length > 0)) {
        console.warn("[db] Unmarked nonempty storefront preserved. To resume a legacy partial seed, use authenticated admin POST /api/seed.");
        return;
      }
    }
    await seedOfficialData(tx);
    await tx.insert(settings).values({ key: SEED_MARKER, value: { completed: true } })
      .onConflictDoNothing();
  });
}

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedOfficialData(db: SeedTransaction) {
  // Never provision demo admin credentials in production.
  // 2. Settings (Design System + General Configuration)
  const defaultDesignSystem = {
    theme: {
      bgPrimary: "#08080A",
      bgSurface: "#121215",
      bgSurfaceHover: "#1B1B20",
      textPrimary: "#F4F4F5",
      textMuted: "#9CA3AF",
      accent: "#E2E8F0",
      btnBg: "#FFFFFF",
      btnText: "#000000",
      borderColor: "rgba(255, 255, 255, 0.12)",
      borderRadius: "0px", // Urban sharp minimal design
      typographyFont: "inter", // inter, display, mono
      shadows: "none",
    },
    store: {
      storeName: "ZAVRUNE",
      tagline: "BUILT FOR THE STREETS",
      currency: "DZD",
      currencySymbol: "دج",
      defaultLanguage: "en",
      supportPhone: "+213 550 00 00 00",
      supportEmail: "contact@zavrune.com",
    },
    checkout: {
      requireEmail: false,
      requirePostalCode: false,
      allowNotes: true,
      defaultWilaya: "16 - Alger",
    },
  };

  await db
    .insert(settings)
    .values({ key: "design_system", value: defaultDesignSystem })
    .onConflictDoNothing();

  // 3. Streetwear Categories (All 16 requested streetwear categories + extensibility)
  const categoriesData = [
    { slug: "t-shirts", nameEn: "T-Shirts", nameAr: "تيشيرتات", nameFr: "T-Shirts", displayOrder: 1, imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80" },
    { slug: "hoodies", nameEn: "Hoodies", nameAr: "هوديز", nameFr: "Sweats à Capuche", displayOrder: 2, imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80" },
    { slug: "sweatshirts", nameEn: "Sweatshirts", nameAr: "سويت شيرت", nameFr: "Sweatshirts", displayOrder: 3, imageUrl: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&q=80" },
    { slug: "sweatpants", nameEn: "Sweatpants", nameAr: "بناطيل رياضية", nameFr: "Pantalons de Jogging", displayOrder: 4, imageUrl: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80" },
    { slug: "pants", nameEn: "Pants", nameAr: "بناطيل", nameFr: "Pantalons", displayOrder: 5, imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80" },
    { slug: "jeans", nameEn: "Jeans", nameAr: "جينز", nameFr: "Jeans", displayOrder: 6, imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80" },
    { slug: "shorts", nameEn: "Shorts", nameAr: "شورتات", nameFr: "Shorts", displayOrder: 7, imageUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&q=80" },
    { slug: "jackets", nameEn: "Jackets", nameAr: "سترات", nameFr: "Vestes", displayOrder: 8, imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80" },
    { slug: "outerwear", nameEn: "Outerwear", nameAr: "ملابس خارجية", nameFr: "Vêtements d'extérieur", displayOrder: 9, imageUrl: "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&q=80" },
    { slug: "tracksuits", nameEn: "Tracksuits", nameAr: "بدلات رياضية", nameFr: "Survêtements", displayOrder: 10, imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" },
    { slug: "shirts", nameEn: "Shirts", nameAr: "قمصان", nameFr: "Chemises", displayOrder: 11, imageUrl: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80" },
    { slug: "caps", nameEn: "Caps", nameAr: "قبعات", nameFr: "Casquettes", displayOrder: 12, imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80" },
    { slug: "beanies", nameEn: "Beanies", nameAr: "قبعات صوفية", nameFr: "Bonnets", displayOrder: 13, imageUrl: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80" },
    { slug: "bags", nameEn: "Bags", nameAr: "حقائب", nameFr: "Sacs", displayOrder: 14, imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80" },
    { slug: "accessories", nameEn: "Accessories", nameAr: "إكسسوارات", nameFr: "Accessoires", displayOrder: 15, imageUrl: "https://images.unsplash.com/photo-1611591475777-233ca70be7df?w=800&q=80" },
    { slug: "sneakers", nameEn: "Sneakers", nameAr: "أحذية رياضية", nameFr: "Baskets", displayOrder: 16, imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80" },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of categoriesData) {
    const existing = await db.select().from(categories).where(eq(categories.slug, cat.slug)).limit(1);
    if (existing.length === 0) {
      const [inserted] = await db.insert(categories).values(cat).returning();
      categoryMap[cat.slug] = inserted.id;
    } else {
      categoryMap[cat.slug] = existing[0].id;
    }
  }
  console.log("✓ Categories initialized");

  // 4. Collections
  const collectionsData = [
    { slug: "new-drop", titleEn: "New Drop", titleAr: "التشكيلة الجديدة", titleFr: "Nouvelle Collection", displayOrder: 1, imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80" },
    { slug: "essentials", titleEn: "Essentials", titleAr: "الأساسيات", titleFr: "Les Essentiels", displayOrder: 2, imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80" },
    { slug: "oversized", titleEn: "Oversized Fit", titleAr: "مقاس واسع", titleFr: "Coupe Oversize", displayOrder: 3, imageUrl: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=80" },
    { slug: "winter-26", titleEn: "Winter Collection", titleAr: "مجموعة الشتاء", titleFr: "Collection Hiver", displayOrder: 4, imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80" },
  ];

  const collectionMap: Record<string, string> = {};
  for (const col of collectionsData) {
    const existing = await db.select().from(collections).where(eq(collections.slug, col.slug)).limit(1);
    if (existing.length === 0) {
      const [inserted] = await db.insert(collections).values(col).returning();
      collectionMap[col.slug] = inserted.id;
    } else {
      collectionMap[col.slug] = existing[0].id;
    }
  }
  console.log("✓ Collections initialized");

  // 5. Size Guides
  const existingGuide = await db.select().from(sizeGuides).where(and(eq(sizeGuides.name, "Streetwear Oversized Tops"), eq(sizeGuides.categoryId, categoryMap["hoodies"]))).limit(1);
  let hoodieGuideId = "";
  if (existingGuide.length === 0) {
    const [guide] = await db.insert(sizeGuides).values({
      categoryId: categoryMap["hoodies"],
      name: "Streetwear Oversized Tops",
      description: "Measurements in cm. Designed for a relaxed, oversized drop-shoulder aesthetic.",
    }).returning();
    hoodieGuideId = guide.id;

  } else {
    hoodieGuideId = existingGuide[0].id;
  }
  const measurements = [
      { sizeGuideId: hoodieGuideId, sizeLabel: "S", chest: "58 cm", waist: "56 cm", length: "70 cm", sleeve: "61 cm" },
      { sizeGuideId: hoodieGuideId, sizeLabel: "M", chest: "61 cm", waist: "59 cm", length: "73 cm", sleeve: "63 cm" },
      { sizeGuideId: hoodieGuideId, sizeLabel: "L", chest: "64 cm", waist: "62 cm", length: "76 cm", sleeve: "65 cm" },
      { sizeGuideId: hoodieGuideId, sizeLabel: "XL", chest: "67 cm", waist: "65 cm", length: "78 cm", sleeve: "67 cm" },
      { sizeGuideId: hoodieGuideId, sizeLabel: "XXL", chest: "70 cm", waist: "68 cm", length: "80 cm", sleeve: "69 cm" },
  ];
  for (const measurement of measurements) {
    const [existing] = await db.select().from(sizeGuideMeasurements).where(and(
      eq(sizeGuideMeasurements.sizeGuideId, hoodieGuideId),
      eq(sizeGuideMeasurements.sizeLabel, measurement.sizeLabel),
    )).limit(1);
    if (!existing) await db.insert(sizeGuideMeasurements).values(measurement);
  }
  console.log("✓ Size Guides initialized");

  // 6. Products & Variants (Streetwear photography + variants)
  const initialProducts: {
    slug: string;
    nameEn: string;
    nameAr: string;
    nameFr: string;
    descriptionEn: string;
    descriptionAr: string;
    descriptionFr: string;
    shortDescriptionEn: string;
    shortDescriptionAr: string;
    shortDescriptionFr: string;
    price: number;
    compareAtPrice: number;
    sku: string;
    categorySlug: string;
    collectionSlug: string;
    badge: string;
    featured: boolean;
    images: { url: string; alt: string; color: string }[];
    variants: VariantSeed[];
  }[] = [
    {
      slug: "zavrune-heavyweight-oversized-hoodie",
      nameEn: "ZAVRUNE Heavyweight Oversized Hoodie",
      nameAr: "هودي ثقيل بملامح عصرية ZAVRUNE",
      nameFr: "Sweat à Capuche Heavyweight Oversize ZAVRUNE",
      descriptionEn: "500 GSM custom fleece knit hoodie with signature drop shoulder, double-layered hood, and distressed minimal branding. Premium streetwear heavy drape.",
      descriptionAr: "هودي قماش صوف ثقيل 500 جرام بمظهر عصري مميز وأكتاف مائلة وقبعة مزدوجة.",
      descriptionFr: "Sweat 500 GSM en molleton épais avec épaules tombantes et capuche doublée.",
      shortDescriptionEn: "500 GSM Heavyweight Fleece, Oversized Fit",
      shortDescriptionAr: "قماش 500 جرام ثقيل، مقاس واسع",
      shortDescriptionFr: "Molleton 500 GSM, Coupe Oversize",
      price: 6800,
      compareAtPrice: 8500,
      sku: "ZVR-HD-001",
      categorySlug: "hoodies",
      collectionSlug: "new-drop",
      badge: "NEW DROP",
      featured: true,
      images: [
        { url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1000&q=80", alt: "Black Heavyweight Hoodie Front", color: "Charcoal Black" },
        { url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=1000&q=80", alt: "Washed Grey Hoodie", color: "Washed Grey" },
        { url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1000&q=80", alt: "Model Wearing Oversized Hoodie", color: "Charcoal Black" },
      ],
      variants: [
        { color: "Charcoal Black", colorHex: "#121214", size: "S", stock: 15, price: 6800, compareAtPrice: 8500 },
        { color: "Charcoal Black", colorHex: "#121214", size: "M", stock: 25, price: 6800, compareAtPrice: 8500 },
        { color: "Charcoal Black", colorHex: "#121214", size: "L", stock: 30, price: 6800, compareAtPrice: 8500 },
        { color: "Charcoal Black", colorHex: "#121214", size: "XL", stock: 20, price: 6800, compareAtPrice: 8500 },
        { color: "Washed Grey", colorHex: "#4A4D52", size: "M", stock: 18, price: 6800, compareAtPrice: 8500 },
        { color: "Washed Grey", colorHex: "#4A4D52", size: "L", stock: 22, price: 6800, compareAtPrice: 8500 },
        { color: "Washed Grey", colorHex: "#4A4D52", size: "XL", stock: 12, price: 6800, compareAtPrice: 8500 },
      ]
    },
    {
      slug: "ryven-tactical-cargo-sweatpants",
      nameEn: "RYVEN Tactical Cargo Sweatpants",
      nameAr: "بنطال رياضي تكتيكي RYVEN",
      nameFr: "Pantalon Tactical Cargo RYVEN",
      descriptionEn: "Heavy French terry cargo sweatpants featuring utility zip pockets, adjustable ankle cords, and relaxed urban taper.",
      descriptionAr: "بنطال رياضي بجيوب تكتيكية متعددة وخامات ممتازة للشوارع.",
      descriptionFr: "Pantalon cargo en terry français avec poches zippées tactiques.",
      shortDescriptionEn: "450 GSM Terry, Tactical Zip Pockets",
      shortDescriptionAr: "خامة ممتازة 450 جرام، جيوب تكتيكية",
      shortDescriptionFr: "450 GSM Terry, Poches zippées",
      price: 5900,
      compareAtPrice: 7200,
      sku: "ZVR-PT-002",
      categorySlug: "sweatpants",
      collectionSlug: "essentials",
      badge: "BESTSELLER",
      featured: true,
      images: [
        { url: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=1000&q=80", alt: "Tactical Cargo Pants", color: "Stealth Black" },
        { url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=1000&q=80", alt: "Model in Cargo Pants", color: "Stealth Black" },
      ],
      variants: [
        { color: "Stealth Black", colorHex: "#0D0E11", size: "S", stock: 10, price: 5900 },
        { color: "Stealth Black", colorHex: "#0D0E11", size: "M", stock: 20, price: 5900 },
        { color: "Stealth Black", colorHex: "#0D0E11", size: "L", stock: 25, price: 5900 },
        { color: "Stealth Black", colorHex: "#0D0E11", size: "XL", stock: 15, price: 5900 },
        { color: "Desert Khaki", colorHex: "#8C7A6B", size: "M", stock: 14, price: 5900 },
        { color: "Desert Khaki", colorHex: "#8C7A6B", size: "L", stock: 18, price: 5900 },
      ]
    },
    {
      slug: "distorted-box-logo-heavy-tee",
      nameEn: "Distorted Box Logo Heavy Tee",
      nameAr: "تيشيرت عصري بشعار بوكس ZAVRUNE",
      nameFr: "T-Shirt Oversize Distorted Logo ZAVRUNE",
      descriptionEn: "280 GSM combed cotton drop-shoulder streetwear tee with high-density puff print ZAVRUNE box graphic.",
      descriptionAr: "تيشيرت قطني 280 جرام ممتاز بطبعة بارزة وتصميم مريح.",
      descriptionFr: "T-Shirt 280 GSM en coton peigné avec impression relief.",
      shortDescriptionEn: "280 GSM Combed Cotton, Puff Print",
      shortDescriptionAr: "قطن 280 جرام، طباعة بارزة عالية الجودة",
      shortDescriptionFr: "Coton 280 GSM, Impression relief",
      price: 3800,
      compareAtPrice: 4800,
      sku: "ZVR-TS-003",
      categorySlug: "t-shirts",
      collectionSlug: "new-drop",
      badge: "LIMITED",
      featured: true,
      images: [
        { url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1000&q=80", alt: "Distorted Box Logo Tee Front", color: "Off White" },
        { url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=1000&q=80", alt: "Off White Tee Detail", color: "Off White" },
      ],
      variants: [
        { color: "Off White", colorHex: "#F3F3F1", size: "S", stock: 12, price: 3800 },
        { color: "Off White", colorHex: "#F3F3F1", size: "M", stock: 35, price: 3800 },
        { color: "Off White", colorHex: "#F3F3F1", size: "L", stock: 40, price: 3800 },
        { color: "Off White", colorHex: "#F3F3F1", size: "XL", stock: 25, price: 3800 },
        { color: "Raw Charcoal", colorHex: "#222326", size: "M", stock: 30, price: 3800 },
        { color: "Raw Charcoal", colorHex: "#222326", size: "L", stock: 30, price: 3800 },
      ]
    },
    {
      slug: "matrix-bomber-jacket-v2",
      nameEn: "MATRIX Oversized Padded Bomber Jacket",
      nameAr: "سترة بومبر ثقيلة MATRIX",
      nameFr: "Veste Bomber Rembourrée MATRIX",
      descriptionEn: "Weatherproof flight nylon exterior, thick thermal fill, matte black heavy hardware, and internal shoulder harness straps.",
      descriptionAr: "جاكيت بومبر مقاوم للطقس بحشوة حرارية وسحابات متينة.",
      descriptionFr: "Nylon résistant, rembourrage thermique et détails en métal noir.",
      shortDescriptionEn: "Water-resistant Flight Nylon, Thermal Fill",
      shortDescriptionAr: "نايلون مقاوم للماء، عزل حراري",
      shortDescriptionFr: "Nylon imperméable, Isolation thermique",
      price: 11500,
      compareAtPrice: 14500,
      sku: "ZVR-JK-004",
      categorySlug: "jackets",
      collectionSlug: "winter-26",
      badge: "DROP 01",
      featured: true,
      images: [
        { url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1000&q=80", alt: "Matrix Bomber Jacket", color: "Obsidian Black" },
        { url: "https://images.unsplash.com/photo-1544441893-675973e31985?w=1000&q=80", alt: "Bomber Jacket Back View", color: "Obsidian Black" },
      ],
      variants: [
        { color: "Obsidian Black", colorHex: "#111113", size: "M", stock: 8, price: 11500 },
        { color: "Obsidian Black", colorHex: "#111113", size: "L", stock: 12, price: 11500 },
        { color: "Obsidian Black", colorHex: "#111113", size: "XL", stock: 6, price: 11500 },
      ]
    },
    {
      slug: "zavrune-distressed-raw-denim-jeans",
      nameEn: "ZAVRUNE Distressed Wide Leg Denim",
      nameAr: "جينز واسع بلمسات عصرية ZAVRUNE",
      nameFr: "Jean Denim Large Effet Usé ZAVRUNE",
      descriptionEn: "14oz rigid Japanese raw denim cut in a wide, relaxed silhouette with subtle hand-distressed detailing at hem and knee.",
      descriptionAr: "جينز قطني ياباني 14 أونصة بقصة واسعة ومظهر متميز.",
      descriptionFr: "Denim brut 14oz coupe large avec détails usés faits main.",
      shortDescriptionEn: "14oz Japanese Rigid Denim, Wide Cut",
      shortDescriptionAr: "جينز قطني ثقيل 14 أونصة",
      shortDescriptionFr: "Denim 14oz, Coupe Wide",
      price: 7500,
      compareAtPrice: 9200,
      sku: "ZVR-DN-005",
      categorySlug: "jeans",
      collectionSlug: "essentials",
      badge: "CORE",
      featured: false,
      images: [
        { url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=1000&q=80", alt: "Raw Denim Jeans", color: "Vintage Blue" },
      ],
      variants: [
        { color: "Vintage Blue", colorHex: "#354A62", size: "S", stock: 8, price: 7500 },
        { color: "Vintage Blue", colorHex: "#354A62", size: "M", stock: 15, price: 7500 },
        { color: "Vintage Blue", colorHex: "#354A62", size: "L", stock: 18, price: 7500 },
        { color: "Vintage Blue", colorHex: "#354A62", size: "XL", stock: 10, price: 7500 },
      ]
    },
    {
      slug: "sub-zero-embroidered-beanie",
      nameEn: "SUB-ZERO Heavy Knit Beanie",
      nameAr: "قبعة صوفية ثقيلة ZAVRUNE",
      nameFr: "Bonnet en Maille Épaisse SUB-ZERO",
      descriptionEn: "Ribbed acrylic-wool blend heavy knit beanie with 3D tonal ZAVRUNE logo embroidery.",
      descriptionAr: "قبعة صوف دافئة بتطريز بارز لشعار زافرون.",
      descriptionFr: "Bonnet en maille côtelée avec broderie 3D.",
      shortDescriptionEn: "Ribbed Knit, 3D Tonal Embroidery",
      shortDescriptionAr: "صوف محبوك، تطريز ثلاثي الأبعاد",
      shortDescriptionFr: "Maille côtelée, Broderie 3D",
      price: 2200,
      compareAtPrice: 2800,
      sku: "ZVR-BN-006",
      categorySlug: "beanies",
      collectionSlug: "essentials",
      badge: "ESSENTIAL",
      featured: false,
      images: [
        { url: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=1000&q=80", alt: "Heavy Knit Beanie", color: "Pitch Black" },
      ],
      variants: [
        { color: "Pitch Black", colorHex: "#000000", size: "One Size", stock: 45, price: 2200 },
        { color: "Heather Grey", colorHex: "#777777", size: "One Size", stock: 30, price: 2200 },
      ]
    }
  ];

  for (const prodData of initialProducts) {
    const existing = await db.select().from(products).where(eq(products.slug, prodData.slug)).limit(1);
    let productId = "";

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(products)
        .values({
          slug: prodData.slug,
          nameEn: prodData.nameEn,
          nameAr: prodData.nameAr,
          nameFr: prodData.nameFr,
          descriptionEn: prodData.descriptionEn,
          descriptionAr: prodData.descriptionAr,
          descriptionFr: prodData.descriptionFr,
          shortDescriptionEn: prodData.shortDescriptionEn,
          shortDescriptionAr: prodData.shortDescriptionAr,
          shortDescriptionFr: prodData.shortDescriptionFr,
          price: prodData.price,
          compareAtPrice: prodData.compareAtPrice,
          sku: prodData.sku,
          categoryId: categoryMap[prodData.categorySlug],
          collectionId: collectionMap[prodData.collectionSlug],
          sizeGuideId: hoodieGuideId,
          badge: prodData.badge,
          featured: prodData.featured,
          images: prodData.images,
          status: "published",
        })
        .returning();
      productId = inserted.id;

    } else {
      productId = existing[0].id;
    }
    // Resume missing variants without changing inventory or prices.
    for (const v of prodData.variants) {
      const [existingVariant] = await db.select().from(productVariants).where(and(
        eq(productVariants.productId, productId),
        eq(productVariants.color, v.color), eq(productVariants.size, v.size),
      )).limit(1);
      if (!existingVariant) {
        await db.insert(productVariants).values({
          productId,
          sku: `${prodData.sku}-${v.color.replace(/\s+/g, "").toUpperCase()}-${v.size}`,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          price: v.price,
          compareAtPrice: v.compareAtPrice || null,
          stock: v.stock,
          status: "active",
        });
      }
    }
  }
  console.log("✓ Products & Variants initialized");

  // 7. Storefront Sections (Default Homepage layout in DB)
  {
    const defaultHomepageSections = [
      {
        sectionType: "announcement",
        name: "Announcement Bar",
        displayOrder: 1,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          textEn: "FREE EXPRESS DELIVERY ACROSS ALGERIA FOR ORDERS OVER 15,000 DZD • NEW DROP LIVE NOW",
          textAr: "توصيل سريع لجميع الولايات الجزائرية • التشكيلة الجديدة متوفرة الآن",
          textFr: "LIVRAISON EXPRESS DANS TOUTE L'ALGÉRIE DÈS 15 000 DZD • NOUVELLE COLLECTION",
          bgColor: "#000000",
          textColor: "#FFFFFF",
          closable: false,
        },
      },
      {
        sectionType: "hero",
        name: "Hero",
        displayOrder: 2,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          badgeEn: "WINTER '26 DROP",
          badgeAr: "مجموعة الشتاء '26",
          badgeFr: "COLLECTION HIVER '26",
          titleEn: "BUILT FOR THE STREETS",
          titleAr: "مصممة للشارع",
          titleFr: "CONÇU POUR LA RUE",
          subtitleEn: "Heavyweight silhouettes engineered with raw minimalism and uncompromised detail.",
          subtitleAr: "قصات ثقيلة وتصاميم عصرية متميزة بأعلى درجات الجودة.",
          subtitleFr: "Coupes oversize et matières lourdes travaillées dans le moindre détail.",
          ctaPrimaryTextEn: "SHOP NEW DROP",
          ctaPrimaryTextAr: "تصفح التشكيلة الجديدة",
          ctaPrimaryTextFr: "DÉCOUVRIR LE DROP",
          ctaPrimaryUrl: "/shop?collection=new-drop",
          ctaSecondaryTextEn: "EXPLORE ALL PRODUCTS",
          ctaSecondaryTextAr: "جميع المنتجات",
          ctaSecondaryTextFr: "VOIR TOUS LES PRODUITS",
          ctaSecondaryUrl: "/shop",
          bgImageDesktop: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=85",
          bgImageMobile: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=85",
          overlayOpacity: 0.55,
          textAlignment: "center",
          sectionHeight: "large",
        },
      },
      {
        sectionType: "marquee",
        name: "Marquee Ticker",
        displayOrder: 3,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          items: ["ZAVRUNE", "HEAVYWEIGHT FABRICS", "ALGERIA WIDE SHIPPING", "LIMITED DROPS", "PREMIUM STREETWEAR", "ORIGINAL CUTS"],
          speed: "medium",
          bgColor: "#121215",
          textColor: "#FFFFFF",
        },
      },
      {
        sectionType: "featured_collection",
        name: "New Drop Arrivals",
        displayOrder: 4,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          titleEn: "NEW DROP ARRIVALS",
          titleAr: "وصل حديثاً",
          titleFr: "NOUVEAUTÉS",
          subtitleEn: "Strictly limited quantities. Premium heavy drape.",
          subtitleAr: "كميات محدودة جداً. خامات ممتازة عالية الجودة.",
          subtitleFr: "Quantités très limitées. Matières épaisses haut de gamme.",
          limit: 4,
          collectionSlug: "new-drop",
          columnsDesktop: 4,
          columnsMobile: 1,
        },
      },
      {
        sectionType: "category_showcase",
        name: "Category Showcase",
        displayOrder: 5,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          titleEn: "BROWSE CATEGORIES",
          titleAr: "تصفح حسب الفئة",
          titleFr: "PARCOURIR LES CATÉGORIES",
          categoriesToShow: ["hoodies", "t-shirts", "sweatpants", "jackets", "sneakers", "accessories"],
          columnsDesktop: 3,
          columnsMobile: 2,
        },
      },
      {
        sectionType: "drop_announcement",
        name: "Drop Announcement",
        displayOrder: 6,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          titleEn: "HEAVYWEIGHT FLEECE SERIES",
          titleAr: "سلسلة الصوف الثقيل 500 GSM",
          titleFr: "SÉRIE MOLLETON 500 GSM",
          descriptionEn: "Crafted from custom 500 GSM combed cotton. Built to endure seasons.",
          descriptionAr: "مصنوعة من القطن الثقيل الممتاز 500 جرام لتدوم طويلاً.",
          descriptionFr: "Conçu en coton peigné 500 GSM sur-mesure.",
          ctaTextEn: "BUY NOW - LIMITED QUANTITY",
          ctaTextAr: "اطلب الآن - كمية محدودة",
          ctaTextFr: "ACHETER MAINTENANT",
          ctaUrl: "/shop?category=hoodies",
          imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80",
        },
      },
      {
        sectionType: "product_grid",
        name: "Best Sellers",
        displayOrder: 7,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          titleEn: "BEST SELLERS",
          titleAr: "الأكثر مبيعاً",
          titleFr: "MEILLEURES VENTES",
          subtitleEn: "Core streetwear essentials defined by quality.",
          subtitleAr: "أساسيات ملابس الشارع عالية الجودة.",
          subtitleFr: "Les incontournables du streetwear.",
          limit: 6,
          columnsDesktop: 3,
          columnsMobile: 2,
        },
      },
      {
        sectionType: "brand_story",
        name: "Brand Story",
        displayOrder: 8,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          badgeEn: "OUR MANIFESTO",
          badgeAr: "بيان ZAVRUNE",
          badgeFr: "NOTRE MANIFESTE",
          headingEn: "NO FICTION. NO FAST FASHION. JUST PURE STREETWEAR ARCHITECTURE.",
          headingAr: "لا زيف. لا موضة سريعة. هندسة ملابس الشارع الحقيقية.",
          headingFr: "PAS DE FICTION. PAS DE FAST FASHION. LA PURE ARCHITECTURE STREETWEAR.",
          textEn: "ZAVRUNE was engineered to dismantle cheap streetwear trends. Every garment features custom heavyweight knits, oversized relaxed proportions, and relentless attention to detail.",
          textAr: "تم تأسيس ZAVRUNE لتقديم أزياء شوارع حقيقية تجمع بين الفخامة، الخامات الثقيلة، والقصات العصرية المريحة.",
          textFr: "ZAVRUNE a été conçu pour redéfinir le streetwear avec des tissus lourds sur-mesure et des coupes oversize parfaites.",
          imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80",
        },
      },
      {
        sectionType: "newsletter",
        name: "Newsletter",
        displayOrder: 9,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          titleEn: "GET ACCESS TO SECRET DROPS",
          titleAr: "احصل على إشعارات التشكيلات الحصرية",
          titleFr: "ACCÈS AUX DROPS EXCLUSIFS",
          subtitleEn: "Enter your phone number or email to receive private drop alerts before public releases.",
          subtitleAr: "أدخل رقم هاتفك أو بريدك الإلكتروني للحصول على إشعارات التشكيلات المغلقة قبل الجميع.",
          subtitleFr: "Inscrivez-vous pour recevoir les alertes avant tout le monde.",
          buttonTextEn: "JOIN THE CLUB",
          buttonTextAr: "انضم الآن",
          buttonTextFr: "REJOINDRE",
        },
      },
      {
        sectionType: "footer",
        name: "Footer",
        displayOrder: 10,
        isVisible: true,
        desktopVisible: true,
        mobileVisible: true,
        config: {
          brandName: "ZAVRUNE",
          taglineEn: "PREMIUM URBAN STREETWEAR ARCHITECTURE",
          taglineAr: "أزياء الشارع العصرية الفاخرة",
          taglineFr: "ARCHITECTURE STREETWEAR HAUT DE GAMME",
          copyrightTextEn: "© 2026 ZAVRUNE. All Rights Reserved. Algerian Dinar (DZD)",
          copyrightTextAr: "© 2026 ZAVRUNE. جميع الحقوق محفوظة. الدينار الجزائري (دج)",
          copyrightTextFr: "© 2026 ZAVRUNE. Tous Droits Réservés. Dinar Algérien (DZD)",
        },
      },
    ];

    for (const sec of defaultHomepageSections) {
      for (const version of ["published", "draft"]) {
        const [existing] = await db.select({ id: pageSections.id }).from(pageSections).where(and(
          isNull(pageSections.pageId), eq(pageSections.version, version),
          eq(pageSections.displayOrder, sec.displayOrder),
        )).limit(1);
        if (!existing) await insertPageSections([{ ...sec, pageId: null, version }], db);
      }
    }
  }
  console.log("✓ Page Sections initialized");

  // 8. Navigation Links
  {
    const defaultNav = [
      { location: "header", labelEn: "HOME", labelAr: "الرئيسية", labelFr: "ACCUEIL", url: "/", displayOrder: 1 },
      { location: "header", labelEn: "NEW DROP", labelAr: "التشكيلة الجديدة", labelFr: "NOUVEAUTÉS", url: "/shop?collection=new-drop", displayOrder: 2 },
      { location: "header", labelEn: "HOODIES", labelAr: "هوديز", labelFr: "SWEATS", url: "/shop?category=hoodies", displayOrder: 3 },
      { location: "header", labelEn: "PANTS & CARGOS", labelAr: "بناطيل", labelFr: "PANTALONS", url: "/shop?category=sweatpants", displayOrder: 4 },
      { location: "header", labelEn: "SHOP ALL", labelAr: "المتجر", labelFr: "BOUTIQUE", url: "/shop", displayOrder: 5 },
      
      { location: "footer", labelEn: "Shop All", labelAr: "كافة المنتجات", labelFr: "Tous les produits", url: "/shop", displayOrder: 1 },
      { location: "footer", labelEn: "Size Guide", labelAr: "دليل المقاسات", labelFr: "Guide des tailles", url: "/pages/size-guide", displayOrder: 2 },
      { location: "footer", labelEn: "Shipping & Returns", labelAr: "التوصيل والإرجاع", labelFr: "Livraison & Retours", url: "/pages/shipping", displayOrder: 3 },
      { location: "footer", labelEn: "Contact Us", labelAr: "اتصل بنا", labelFr: "Contactez-nous", url: "/pages/contact", displayOrder: 4 },
    ];
    for (const item of defaultNav) {
      const [existing] = await db.select().from(navigation).where(and(
        eq(navigation.location, item.location), eq(navigation.url, item.url),
      )).limit(1);
      if (!existing) await db.insert(navigation).values(item);
    }
  }
  console.log("✓ Navigation initialized");

  // 9. Shipping Zones & Methods (Wilayas of Algeria)
  {
    async function ensureZone(data: typeof shippingZones.$inferInsert) {
      const [existing] = await db.select().from(shippingZones).where(eq(shippingZones.name, data.name)).limit(1);
      if (existing) return existing;
      const [inserted] = await db.insert(shippingZones).values(data).returning();
      return inserted;
    }
    const zoneAlgiers = await ensureZone({
      name: "Grand Alger & Centre",
      wilayas: ["16 - Alger", "09 - Blida", "42 - Tipaza", "35 - Boumerdès"],
    });

    const zoneNational = await ensureZone({
      name: "Autres Wilayas",
      wilayas: ["01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna", "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "10 - Bouira", "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda", "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine", "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla", "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arréridj", "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela", "41 - Souk Ahras", "43 - Mila", "44 - Aïn Defla", "45 - Naâma", "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - Timimoun", "50 - Bordj Badji Mokhtar", "51 - Ouled Djellal", "52 - Béni Abbès", "53 - In Salah", "54 - In Guezzam", "55 - Touggourt", "56 - Djanet", "57 - El M'Ghair", "58 - El Meniaa"],
    });

    // Shipping Methods
    const methods = [
      {
        zoneId: zoneAlgiers.id,
        nameEn: "Home Delivery (Algiers Hub)",
        nameAr: "توصيل للمنزل (الجزائر العاصمة وما حولها)",
        nameFr: "Livraison à Domicile (Alger)",
        deliveryType: "home",
        price: 400, // 400 DZD
        freeShippingThreshold: 15000,
        estDays: "24-48 Hours",
      },
      {
        zoneId: zoneNational.id,
        nameEn: "Standard Home Delivery (National)",
        nameAr: "توصيل للمنزل (باقي الولايات)",
        nameFr: "Livraison à Domicile (National)",
        deliveryType: "home",
        price: 750, // 750 DZD
        freeShippingThreshold: 20000,
        estDays: "2-4 Business Days",
      },
      {
        zoneId: zoneNational.id,
        nameEn: "Desk / Stop-Desk Pickup",
        nameAr: "توصيل إلى مكتب التوصيل (Stops Desk)",
        nameFr: "Livraison en Point Relais / Bureau",
        deliveryType: "bureau",
        price: 450, // 450 DZD
        freeShippingThreshold: 15000,
        estDays: "2-3 Business Days",
      },
    ];
    for (const method of methods) {
      const [existing] = await db.select().from(shippingMethods).where(and(
        eq(shippingMethods.zoneId, method.zoneId), eq(shippingMethods.nameEn, method.nameEn),
      )).limit(1);
      if (!existing) await db.insert(shippingMethods).values(method);
    }
  }
  console.log("✓ Shipping Zones & Methods initialized");

  console.log("🚀 Zavrune Database Seed Complete!");
}
