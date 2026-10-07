import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, numeric, pgEnum } from "drizzle-orm/pg-core";

// Admin Accounts
export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin Sessions
export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").references(() => admins.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// General & Design System Settings
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Streetwear Categories
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  descriptionFr: text("description_fr"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Collections
export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  titleFr: text("title_fr").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  descriptionFr: text("description_fr"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Size Guides per Category
export const sizeGuides = pgTable("size_guides", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sizeGuideMeasurements = pgTable("size_guide_measurements", {
  id: uuid("id").defaultRandom().primaryKey(),
  sizeGuideId: uuid("size_guide_id").references(() => sizeGuides.id, { onDelete: "cascade" }).notNull(),
  sizeLabel: text("size_label").notNull(), // XS, S, M, L, XL, XXL, XXXL
  chest: text("chest"),
  waist: text("waist"),
  hip: text("hip"),
  length: text("length"),
  sleeve: text("sleeve"),
  inseam: text("inseam"),
  customMeasurements: jsonb("custom_measurements"),
});

// Products
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  descriptionFr: text("description_fr"),
  shortDescriptionEn: text("short_description_en"),
  shortDescriptionAr: text("short_description_ar"),
  shortDescriptionFr: text("short_description_fr"),
  price: integer("price").notNull(), // stored in DZD
  compareAtPrice: integer("compare_at_price"), // in DZD
  sku: text("sku").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
  sizeGuideId: uuid("size_guide_id").references(() => sizeGuides.id, { onDelete: "set null" }),
  tags: jsonb("tags").default([]).notNull(), // ["oversized", "heavyweight", "drop-1"]
  images: jsonb("images").default([]).notNull(), // [{ url, alt, color }]
  mobileImages: jsonb("mobile_images").default([]).notNull(),
  videoUrl: text("video_url"),
  status: text("status").default("published").notNull(), // 'draft', 'published', 'archived'
  featured: boolean("featured").default(false).notNull(),
  badge: text("badge"), // 'NEW DROP', 'LIMITED', 'ESSENTIAL', 'SALE'
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product Variants
export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  sku: text("sku").notNull(),
  color: text("color").notNull(), // e.g., "Charcoal Black", "Washed Grey"
  colorHex: text("color_hex"), // optional hex code e.g. "#1A1A1A"
  size: text("size").notNull(), // e.g., "M", "L", "XL"
  price: integer("price"), // if null, uses product base price
  compareAtPrice: integer("compare_at_price"),
  stock: integer("stock").default(0).notNull(),
  reservedStock: integer("reserved_stock").default(0).notNull(),
  imageUrl: text("image_url"),
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Inventory Event Log
export const inventoryEvents = pgTable("inventory_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  changeQty: integer("change_qty").notNull(), // +10 or -1
  type: text("type").notNull(), // 'restock', 'order_reserved', 'order_fulfilled', 'adjustment', 'cancellation'
  referenceId: text("reference_id"), // order ID or adjustment ID
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Media Library
export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Generic Pages
export const pages = pgTable("pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  titleFr: text("title_fr").notNull(),
  status: text("status").default("published").notNull(), // 'draft', 'published'
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Visual Storefront Builder Sections
export const pageSections = pgTable("page_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }), // null = homepage
  sectionType: text("section_type").notNull(), // 'hero', 'announcement', 'marquee', 'featured_collection', 'product_grid', 'product_carousel', 'new_arrivals', 'best_sellers', 'category_showcase', 'collection_showcase', 'lookbook', 'editorial_image', 'editorial_split', 'drop_announcement', 'sale_banner', 'brand_story', 'newsletter', 'social', 'cta', 'video', 'spacer', 'divider', 'footer'
  displayOrder: integer("display_order").default(0).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  desktopVisible: boolean("desktop_visible").default(true).notNull(),
  mobileVisible: boolean("mobile_visible").default(true).notNull(),
  version: text("version").default("published").notNull(), // 'draft', 'published'
  config: jsonb("config").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Version Snapshots for Rollback
export const storefrontRevisions = pgTable("storefront_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  revisionName: text("revision_name").notNull(),
  sectionsData: jsonb("sections_data").notNull(),
  createdByName: text("created_by_name").default("Admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Store Navigation
export const navigation = pgTable("navigation", {
  id: uuid("id").defaultRandom().primaryKey(),
  location: text("location").default("header").notNull(), // 'header', 'footer'
  labelEn: text("label_en").notNull(),
  labelAr: text("label_ar").notNull(),
  labelFr: text("label_fr").notNull(),
  url: text("url").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Customers
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  wilaya: text("wilaya").notNull(),
  commune: text("commune").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shipping Zones & Methods
export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  wilayas: jsonb("wilayas").default([]).notNull(), // Array of wilaya names or numbers
  isActive: boolean("is_active").default(true).notNull(),
});

export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  zoneId: uuid("zone_id").references(() => shippingZones.id, { onDelete: "cascade" }),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull(),
  deliveryType: text("delivery_type").default("home").notNull(), // 'home', 'bureau'
  price: integer("price").notNull(), // in DZD
  freeShippingThreshold: integer("free_shipping_threshold"), // in DZD
  estDays: text("est_days").default("2-4 business days"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Orders (DIRECT PURCHASES)
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // e.g., "ZVR-89021"
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  wilaya: text("wilaya").notNull(),
  commune: text("commune").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code"),
  deliveryNotes: text("delivery_notes"),
  shippingMethodName: text("shipping_method_name").notNull(),
  shippingPrice: integer("shipping_price").default(0).notNull(), // in DZD
  itemsSubtotal: integer("items_subtotal").notNull(), // in DZD
  totalAmount: integer("total_amount").notNull(), // in DZD
  currency: text("currency").default("DZD").notNull(),
  status: text("status").default("Pending").notNull(), // 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  variantSku: text("variant_sku").notNull(),
  color: text("color").notNull(),
  size: text("size").notNull(),
  unitPrice: integer("unit_price").notNull(), // in DZD
  quantity: integer("quantity").notNull(),
  totalPrice: integer("total_price").notNull(), // in DZD
  imageUrl: text("image_url"),
});

// Order Event History
export const orderEvents = pgTable("order_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdBy: text("created_by").default("System").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
