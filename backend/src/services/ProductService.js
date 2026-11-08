import ProductRepository from "../repositories/ProductRepository.js";
import UploadService from "./UploadService.js";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Brand from "../models/brand.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import mongoose from "mongoose";
import ErrorHandler from "../utils/errorHandler.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PER_PAGE = 12;
const PRODUCT_STATUSES = ["draft", "published", "scheduled", "archived"];

const publicProductMatch = () => ({
  $and: [
    {
      $or: [
        { status: { $nin: ["draft", "scheduled", "archived"] } },
        { status: "scheduled", publishAt: { $lte: new Date() } },
      ],
    },
    { visibility: { $ne: "hidden" } },
  ],
});

const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumber = (value, fallback = undefined) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on", "active", "published"].includes(String(value).toLowerCase());
};

const cleanString = (value, fallback = "") =>
  value === undefined || value === null ? fallback : String(value).trim();

const stringArray = (value) => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,|\n]/)
      : [];
  const seen = new Set();
  return entries
    .map((entry) => {
      if (entry && typeof entry === "object") {
        return cleanString(entry.value ?? entry.name ?? entry.label ?? entry.text);
      }
      return cleanString(entry);
    })
    .filter((entry) => {
      if (!entry) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeSpecifications = (value) => {
  if (!value) return [];
  const output = [];
  const push = (label, entryValue) => {
    const cleanLabel = cleanString(label);
    const cleanValue = cleanString(entryValue);
    if (cleanLabel && cleanValue) output.push({ label: cleanLabel, value: cleanValue });
  };

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === "string") {
        const [label, ...rest] = entry.split(":");
        push(label, rest.join(":"));
      } else if (entry && typeof entry === "object") {
        push(entry.label ?? entry.name ?? entry.key, entry.value ?? entry.text);
      }
    });
  } else if (typeof value === "object") {
    Object.entries(value).forEach(([label, entryValue]) => push(label, entryValue));
  } else if (typeof value === "string") {
    value.split(/\n/).forEach((line) => {
      const [label, ...rest] = line.split(":");
      push(label, rest.join(":"));
    });
  }

  return output;
};

const normalizeHex = (value) => {
  const hex = cleanString(value);
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
  }
  return "";
};

const normalizeStatus = (value, fallback = "published") => {
  if (value === undefined || value === null || value === "") return fallback;
  const status = String(value).toLowerCase().trim();
  if (["publish", "published", "active", "live", "1", "true"].includes(status)) return "published";
  if (["draft", "inactive", "unpublished", "0", "false"].includes(status)) return "draft";
  if (["scheduled", "schedule"].includes(status)) return "scheduled";
  if (["archived", "archive"].includes(status)) return "archived";
  return fallback;
};

const normalizeDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export class ProductService {
  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────
  sanitizeFeatures(features) {
    return stringArray(features).filter((feature) => feature.length <= 160);
  }

  async uniqueSlug(value, excludeId = null) {
    const base = slugify(value) || `product-${Date.now()}`;
    let candidate = base;
    let suffix = 2;
    while (await Product.exists({ slug: candidate, _id: { $ne: excludeId } })) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  buildSku(prefix, suffix) {
    const base = cleanString(prefix)
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toUpperCase() || "DLV";
    const tail = cleanString(suffix)
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toUpperCase();
    return tail ? `${base}-${tail}` : base;
  }

  async resolveReference(Model, value, { label, createIfMissing = true, parent = null } = {}) {
    if (value === null || value === "") return null;
    if (value === undefined) return undefined;

    if (typeof value === "object") {
      if (value._id && mongoose.Types.ObjectId.isValid(value._id)) {
        const found = await Model.findById(value._id);
        if (found) return found;
      }
      const nestedName = cleanString(value.name || value.title);
      if (!nestedName) return null;
      return this.resolveReference(Model, nestedName, { label, createIfMissing, parent });
    }

    const text = cleanString(value);
    if (!text) return null;

    if (mongoose.Types.ObjectId.isValid(text)) {
      const byId = await Model.findById(text);
      if (byId) return byId;
    }

    const byName = await Model.findOne({ name: new RegExp(`^${escapeRegex(text)}$`, "i") });
    if (byName) return byName;

    if (!createIfMissing) return null;

    const payload = { name: text, slug: slugify(text) || `${label || "item"}-${Date.now()}` };
    if (parent) payload.parentCategory = parent;

    try {
      return await Model.create(payload);
    } catch (error) {
      if (error?.code === 11000) {
        return Model.findOne({ name: new RegExp(`^${escapeRegex(text)}$`, "i") });
      }
      throw error;
    }
  }

  async resolveBrand(raw = {}) {
    if (raw.brand === null && !raw.brandName) return { brand: null, brandName: "" };
    const value = raw.brand ?? raw.brandId ?? raw.brandName;
    if (value === undefined) return undefined;

    const brand = await this.resolveReference(Brand, value, {
      label: "brand",
      createIfMissing: true,
    });
    if (brand) {
      if (raw.brandName !== undefined && !raw.brand) {
        // Allow renaming a brand from the product form by name.
        const name = cleanString(raw.brandName);
        if (name && name !== brand.name) {
          brand.name = name;
          brand.slug = slugify(name) || brand.slug;
          await brand.save().catch(() => {});
        }
      }
      return { brand: brand._id, brandName: brand.name };
    }
    return { brand: null, brandName: cleanString(raw.brandName) };
  }

  async resolveCategoryFields(raw = {}, existing = null) {
    const data = {};

    let categoryDoc;
    if (raw.category !== undefined || raw.categoryId !== undefined || raw.categoryName !== undefined) {
      const value = raw.category ?? raw.categoryId ?? raw.categoryName;
      categoryDoc = await this.resolveReference(Category, value, {
        label: "category",
        createIfMissing: true,
      });
      data.category = categoryDoc?._id ?? null;
    }

    if (
      raw.subcategory !== undefined ||
      raw.subcategoryId !== undefined ||
      raw.subcategoryName !== undefined
    ) {
      const value = raw.subcategory ?? raw.subcategoryId ?? raw.subcategoryName;
      const subcategoryDoc = await this.resolveReference(Category, value, {
        label: "subcategory",
        createIfMissing: true,
        parent: categoryDoc?._id || existing?.category || null,
      });
      data.subcategory = subcategoryDoc?._id ?? null;

      // If the admin picked a subcategory but no parent category, infer it.
      if (!data.category && subcategoryDoc?.parentCategory) {
        data.category = subcategoryDoc.parentCategory;
      }
    }

    return data;
  }

  async _processMediaArray(mediaArray, type = "image") {
    if (!mediaArray || !Array.isArray(mediaArray)) return [];
    const uploadPromises = mediaArray.map(async (media) => {
      const withAlt = (entry) =>
        type === "image" ? { ...entry, alt: cleanString(media?.alt) } : entry;
      if (typeof media === "string" && media.trim()) {
        const cleanMedia = media.trim();
        if (cleanMedia.includes("cloudinary.com")) {
          return withAlt({
            public_id: `cld_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            url: cleanMedia,
          });
        }
        try {
          const res = await UploadService.uploadMedia(cleanMedia, {
            type,
            folder: "delivix/products",
          });
          return withAlt({ public_id: res.public_id, url: res.url });
        } catch (err) {
          console.error("[ProductService] Cloudinary upload error:", err.message);
          return withAlt({ public_id: `img_${Date.now()}`, url: cleanMedia });
        }
      }

      if (typeof media === "object" && media) {
        const urlOrFile = media.url || media.file;
        if (media.public_id && media.url) {
          if (media.url.includes("cloudinary.com")) {
            return withAlt({ public_id: media.public_id, url: media.url });
          }
          if (
            UploadService.isConfigured() &&
            (media.url.startsWith("http") || media.url.startsWith("data:"))
          ) {
            try {
              const res = await UploadService.uploadMedia(media.url, {
                type,
                folder: "delivix/products",
              });
              return withAlt({ public_id: res.public_id, url: res.url });
            } catch {
              return withAlt({ public_id: media.public_id, url: media.url });
            }
          }
          return withAlt({ public_id: media.public_id, url: media.url });
        }
        if (urlOrFile) {
          try {
            const res = await UploadService.uploadMedia(urlOrFile, {
              type,
              folder: "delivix/products",
            });
            return withAlt({ public_id: res.public_id, url: res.url });
          } catch {
            return withAlt({ public_id: `img_${Date.now()}`, url: urlOrFile });
          }
        }
      }
      return null;
    });
    const results = await Promise.all(uploadPromises);
    return results.filter(Boolean);
  }

  normalizeSizes(entries, base = {}) {
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const sizes = [];
    for (const entry of entries) {
      if (!entry) continue;
      const size = cleanString(entry.size ?? entry.name ?? entry.value);
      if (!size) continue;
      const key = size.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      sizes.push({
        size,
        price: toNumber(entry.price, toNumber(base.price, 0)),
        comparePrice: toNumber(entry.comparePrice ?? entry.mrp, toNumber(base.comparePrice, undefined)),
        stock: Math.max(0, toNumber(entry.stock, 0)),
        sku: cleanString(entry.sku) || undefined,
        weight: toNumber(entry.weight, undefined),
        barcode: cleanString(entry.barcode) || undefined,
        status: entry.status === "Draft" || entry.isActive === false ? "Draft" : "Active",
      });
    }
    return sizes;
  }

  normalizeVariant(variant, index, context = {}) {
    const colorName =
      cleanString(variant.colorName || variant.variantName || variant.color || variant.name) ||
      `Colour ${index + 1}`;
    const variantName = cleanString(variant.variantName || colorName);
    const colorHex = normalizeHex(variant.colorHex || variant.hex || variant.colorCode);
    const price = toNumber(variant.price, toNumber(context.price, 0));
    const mrp = toNumber(variant.mrp ?? variant.comparePrice, toNumber(context.mrp, undefined));
    const rawSizes = this.normalizeSizes(variant.sizes, { price, comparePrice: mrp });
    const sizes = rawSizes.map((size) => ({
      ...size,
      sku:
        size.sku ||
        this.buildSku(
          context.sku || "DLV",
          `${slugify(colorName).slice(0, 10)}-${slugify(size.size).slice(0, 10)}`
        ),
    }));

    const variantSku =
      cleanString(variant.sku) ||
      this.buildSku(context.sku || "DLV", slugify(colorName).slice(0, 14));

    const attributes =
      variant.attributes && typeof variant.attributes === "object"
        ? { ...variant.attributes }
        : {};
    if (colorName) attributes.Colour = colorName;
    if (colorHex) attributes.ColourHex = colorHex;

    const sizeStock = sizes.reduce((sum, size) => sum + size.stock, 0);
    const stock = sizes.length ? sizeStock : Math.max(0, toNumber(variant.stock, 0));

    return {
      variantName,
      colorName,
      colorHex: colorHex || undefined,
      title: cleanString(variant.title) || variantName,
      sku: variantSku,
      skuPrefix: cleanString(variant.skuPrefix) || variantSku,
      barcode: cleanString(variant.barcode) || undefined,
      price,
      mrp,
      costPrice: toNumber(variant.costPrice, undefined),
      stock,
      reservedStock: Math.max(0, toNumber(variant.reservedStock, 0)),
      incomingStock: Math.max(0, toNumber(variant.incomingStock, 0)),
      minStockLevel: Math.max(0, toNumber(variant.minStockLevel, 5)),
      maxStockLevel: Math.max(0, toNumber(variant.maxStockLevel, 100)),
      attributes,
      isDefault: toBool(variant.isDefault, index === 0),
      isActive: toBool(variant.isActive, true),
      sizes,
    };
  }

  generateVariantsFromAttributes(attributes, context = {}) {
    if (!Array.isArray(attributes) || attributes.length === 0) return [];
    const axes = attributes
      .map((attribute) => {
        const name = cleanString(attribute.name ?? attribute.label);
        const values = (Array.isArray(attribute.values) ? attribute.values : [])
          .map((entry) => {
            if (entry && typeof entry === "object") {
              return {
                name: cleanString(entry.name ?? entry.value ?? entry.label),
                hex: normalizeHex(entry.hex ?? entry.colorHex),
              };
            }
            return { name: cleanString(entry), hex: "" };
          })
          .filter((entry) => entry.name);
        return name && values.length ? { name, values } : null;
      })
      .filter(Boolean);

    if (!axes.length) return [];

    let combinations = [{ attributes: {}, labels: [] }];
    for (const axis of axes) {
      const next = [];
      for (const combination of combinations) {
        for (const value of axis.values) {
          next.push({
            attributes: { ...combination.attributes, [axis.name]: value.name },
            labels: [...combination.labels, value],
          });
        }
      }
      combinations = next;
    }

    return combinations.map((combination, index) => {
      const colourLabel = combination.labels.find((label) => label.hex);
      return this.normalizeVariant(
        {
          variantName: combination.labels.map((label) => label.name).join(" / "),
          colorName:
            cleanString(combination.attributes.Colour || combination.attributes.Color) ||
            colourLabel?.name ||
            combination.labels[0]?.name,
          colorHex: colourLabel?.hex,
          attributes: combination.attributes,
          price: context.price,
          mrp: context.mrp,
          stock: 0,
          isActive: true,
          isDefault: index === 0,
        },
        index,
        context
      );
    });
  }

  normalizeShipping(value, existing = {}) {
    const current = existing?.toObject ? existing.toObject() : existing || {};
    if (!value || typeof value !== "object") return { ...current };
    return {
      weight: Math.max(0, toNumber(value.weight, current.weight ?? 0)),
      length: Math.max(0, toNumber(value.length, current.length ?? 0)),
      width: Math.max(0, toNumber(value.width, current.width ?? 0)),
      height: Math.max(0, toNumber(value.height, current.height ?? 0)),
      shippingClass: cleanString(value.shippingClass, current.shippingClass || "Standard"),
      deliveryInfo: cleanString(value.deliveryInfo, current.deliveryInfo || ""),
    };
  }

  normalizeSeo(value, existing = {}) {
    const current = existing?.toObject ? existing.toObject() : existing || {};
    if (!value || typeof value !== "object") return { ...current };
    return {
      title: cleanString(value.title, current.title || ""),
      metaDescription: cleanString(value.metaDescription, current.metaDescription || ""),
      keywords: value.keywords !== undefined ? stringArray(value.keywords) : current.keywords || [],
      socialImage: cleanString(value.socialImage, current.socialImage || ""),
      canonicalUrl: cleanString(value.canonicalUrl, current.canonicalUrl || ""),
    };
  }

  collectSkus(product = {}) {
    const skus = [];
    const push = (sku) => {
      const clean = cleanString(sku).toUpperCase();
      if (clean) skus.push(clean);
    };
    push(product.sku);
    (product.sizes || []).forEach((size) => push(size.sku));
    (product.variants || []).forEach((variant) => {
      push(variant.sku);
      (variant.sizes || []).forEach((size) => push(size.sku));
    });
    return skus;
  }

  async assertUniqueSkus(skus, excludeId = null) {
    const normalized = [...new Set(skus.map((sku) => cleanString(sku).toUpperCase()).filter(Boolean))];
    if (!normalized.length) return;

    const duplicatesInPayload = skus
      .map((sku) => cleanString(sku).toUpperCase())
      .filter(Boolean)
      .filter((sku, index, list) => list.indexOf(sku) !== index);
    if (duplicatesInPayload.length) {
      throw new ErrorHandler(
        `Duplicate SKU in this product: ${[...new Set(duplicatesInPayload)].join(", ")}. Every SKU must be unique.`,
        400
      );
    }

    const filter = {
      $or: [
        { sku: { $in: normalized } },
        { "variants.sku": { $in: normalized } },
        { "variants.sizes.sku": { $in: normalized } },
        { "sizes.sku": { $in: normalized } },
      ],
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const conflicts = await Product.find(filter)
      .select("name sku variants.sku variants.sizes.sku sizes.sku")
      .lean();

    if (conflicts.length) {
      const conflicting = new Set();
      conflicts.forEach((product) => {
        const productSkus = this.collectSkus(product);
        productSkus.forEach((sku) => {
          if (normalized.includes(sku)) conflicting.add(sku);
        });
      });
      throw new ErrorHandler(
        `SKU already exists: ${[...conflicting].join(", ")}. SKUs must be unique across all products and variants.`,
        409
      );
    }
  }

  async normalizeProductPayload(raw = {}, { existing = null, userId = null } = {}) {
    const data = {};
    const isCreate = !existing;
    const has = (...keys) => keys.some((key) => raw[key] !== undefined);

    // ── Basic information ───────────────────────────────────────────────────
    if (has("name", "title")) data.name = cleanString(raw.name ?? raw.title);
    if (has("manufacturer")) data.manufacturer = cleanString(raw.manufacturer);
    if (has("modelNumber")) data.modelNumber = cleanString(raw.modelNumber);
    if (has("description", "moreDetails")) data.description = cleanString(raw.description ?? raw.moreDetails);
    if (has("shortDescription")) data.shortDescription = cleanString(raw.shortDescription);
    if (has("tags")) data.tags = stringArray(raw.tags);
    if (has("highlights", "features")) data.highlights = stringArray(raw.highlights ?? raw.features);
    if (has("features", "highlights")) data.features = stringArray(raw.features ?? raw.highlights);
    if (has("specifications", "specs")) data.specifications = normalizeSpecifications(raw.specifications ?? raw.specs);
    if (has("productType")) data.productType = cleanString(raw.productType);
    if (has("moreDetails")) data.moreDetails = cleanString(raw.moreDetails);

    // ── Reference fields ────────────────────────────────────────────────────
    if (has("brand", "brandId", "brandName")) {
      const brandFields = await this.resolveBrand(raw);
      if (brandFields) Object.assign(data, brandFields);
    }
    Object.assign(data, await this.resolveCategoryFields(raw, existing));

    // ── Pricing ─────────────────────────────────────────────────────────────
    const effectivePrice = toNumber(raw.price ?? raw.basePrice, existing?.price);
    const effectiveMrp = toNumber(
      raw.comparePrice ?? raw.mrp ?? raw.oldPrice,
      existing?.mrp ?? existing?.comparePrice
    );

    if (has("price", "basePrice")) data.price = effectivePrice;
    if (has("comparePrice", "mrp", "oldPrice")) data.mrp = effectiveMrp;
    if (has("costPrice")) data.costPrice = toNumber(raw.costPrice, undefined);
    if (has("purchasePrice")) data.purchasePrice = toNumber(raw.purchasePrice, undefined);
    if (has("taxRate")) data.taxRate = Math.max(0, toNumber(raw.taxRate, 0));
    if (has("taxIncluded")) data.taxIncluded = toBool(raw.taxIncluded, true);
    if (has("hsnCode")) data.hsnCode = cleanString(raw.hsnCode);
    if (has("saleStartDate")) data.saleStartDate = normalizeDate(raw.saleStartDate);
    if (has("saleEndDate")) data.saleEndDate = normalizeDate(raw.saleEndDate);

    // ── Inventory ───────────────────────────────────────────────────────────
    if (has("sku")) data.sku = cleanString(raw.sku).toUpperCase();
    if (has("barcode")) data.barcode = cleanString(raw.barcode);
    if (has("stock", "stockQuantity")) data.stock = Math.max(0, toNumber(raw.stock ?? raw.stockQuantity, 0));
    if (has("minStockLevel", "lowStockThreshold")) {
      data.minStockLevel = Math.max(0, toNumber(raw.minStockLevel ?? raw.lowStockThreshold, 5));
    }
    if (has("maxStockLevel")) data.maxStockLevel = Math.max(0, toNumber(raw.maxStockLevel, 100));
    if (has("maxPurchaseQuantity")) {
      data.maxPurchaseQuantity = Math.max(1, toNumber(raw.maxPurchaseQuantity, 10));
    }
    if (has("manageStock")) data.manageStock = toBool(raw.manageStock, true);
    if (has("allowBackorder")) data.allowBackorder = toBool(raw.allowBackorder, false);
    if (has("warehouseLocation")) data.warehouseLocation = cleanString(raw.warehouseLocation);
    if (has("shelfBin")) data.shelfBin = cleanString(raw.shelfBin);

    // ── Media ───────────────────────────────────────────────────────────────
    if (has("images", "image")) {
      const images = raw.images !== undefined ? raw.images : raw.image ? [raw.image] : [];
      data.images = await this._processMediaArray(Array.isArray(images) ? images : [images], "image");
    }
    if (has("videos")) {
      data.videos = await this._processMediaArray(Array.isArray(raw.videos) ? raw.videos : [raw.videos], "video");
    }
    if (has("has360View")) data.has360View = toBool(raw.has360View, false);
    if (has("images360")) data.images360 = stringArray(raw.images360);

    // ── Variants & sizes ────────────────────────────────────────────────────
    const context = {
      sku: cleanString(raw.sku) || cleanString(existing?.sku) || "DLV",
      price: effectivePrice,
      mrp: effectiveMrp,
    };

    if (has("variants") || has("variantAttributes")) {
      let variants = Array.isArray(raw.variants) ? raw.variants : [];
      if (!variants.length && Array.isArray(raw.variantAttributes)) {
        variants = this.generateVariantsFromAttributes(raw.variantAttributes, context);
      }

      const normalized = [];
      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        if (!variant) continue;
        const entry = this.normalizeVariant(variant, index, context);
        if (has("variants") && variant.images !== undefined) {
          entry.images = await this._processMediaArray(
            Array.isArray(variant.images) ? variant.images : [variant.images],
            "image"
          );
        } else if (Array.isArray(variant.images)) {
          entry.images = variant.images.filter((image) => image?.url);
        }
        if (variant.videos !== undefined) {
          entry.videos = await this._processMediaArray(
            Array.isArray(variant.videos) ? variant.videos : [variant.videos],
            "video"
          );
        }
        normalized.push(entry);
      }
      data.variants = normalized;
    }

    if (has("sizes")) {
      data.sizes = this.normalizeSizes(raw.sizes, context);
    }

    if (has("variantAttributes")) {
      data.variantAttributes = (Array.isArray(raw.variantAttributes) ? raw.variantAttributes : [])
        .map((attribute) => ({
          name: cleanString(attribute.name ?? attribute.label),
          values: stringArray(attribute.values),
        }))
        .filter((attribute) => attribute.name && attribute.values.length);
    }

    // ── Shipping & SEO ──────────────────────────────────────────────────────
    if (has("shipping")) data.shipping = this.normalizeShipping(raw.shipping, existing?.shipping);
    if (has("seo")) data.seo = this.normalizeSeo(raw.seo, existing?.seo);
    if (has("collections")) data.collections = stringArray(raw.collections);
    if (has("freeShipping")) data.freeShipping = toBool(raw.freeShipping, false);
    if (has("estimatedDeliveryDays")) {
      data.estimatedDeliveryDays = Math.max(0, toNumber(raw.estimatedDeliveryDays, 3));
    }
    if (has("returnPolicy")) data.returnPolicy = cleanString(raw.returnPolicy);
    if (has("warranty")) data.warranty = cleanString(raw.warranty);
    if (has("careInstructions")) data.careInstructions = cleanString(raw.careInstructions);

    // ── Publishing & merchandising ──────────────────────────────────────────
    if (has("status")) data.status = normalizeStatus(raw.status, existing?.status || "published");
    if (has("visibility")) data.visibility = raw.visibility === "hidden" ? "hidden" : "public";
    if (has("publishAt", "scheduledPublishAt")) {
      data.publishAt = normalizeDate(raw.publishAt ?? raw.scheduledPublishAt);
    }
    if (has("isFeatured")) data.isFeatured = toBool(raw.isFeatured, false);
    if (has("isNewArrival")) data.isNewArrival = toBool(raw.isNewArrival, false);
    if (has("isBestSeller")) data.isBestSeller = toBool(raw.isBestSeller, false);
    if (has("isTrending")) data.isTrending = toBool(raw.isTrending, false);
    if (has("homeSection")) data.homeSection = cleanString(raw.homeSection);

    // ── Legacy mirror fields ────────────────────────────────────────────────
    if (data.name) data.title = data.name;
    if (data.price !== undefined) data.basePrice = data.price;
    if (data.mrp !== undefined) data.mrp = data.mrp;

    // ── Cross-field derivations ─────────────────────────────────────────────
    const finalPrice = toNumber(data.price, existing?.price);
    let finalMrp = toNumber(data.mrp, existing?.mrp);

    if (Array.isArray(data.variants)) {
      const activeVariants = data.variants.filter((variant) => variant.isActive !== false);
      if (activeVariants.length) {
        if (data.price === undefined) {
          data.price = Math.min(...activeVariants.map((variant) => toNumber(variant.price, finalPrice ?? 0)));
          data.basePrice = data.price;
        }
        if (data.mrp === undefined) {
          const mrpValues = activeVariants
            .map((variant) => toNumber(variant.mrp, undefined))
            .filter((value) => value !== undefined);
          if (mrpValues.length) data.mrp = Math.max(...mrpValues);
        }
        if (data.stock === undefined) {
          data.stock = activeVariants.reduce((sum, variant) => sum + toNumber(variant.stock, 0), 0);
        }
      }
    }

    if (Array.isArray(data.sizes) && data.sizes.length && data.stock === undefined) {
      data.stock = data.sizes.reduce((sum, size) => sum + toNumber(size.stock, 0), 0);
    }

    const derivedPrice = toNumber(data.price, finalPrice);
    finalMrp = toNumber(data.mrp, finalMrp);
    if (derivedPrice !== undefined && finalMrp !== undefined) {
      data.discountPercentage =
        finalMrp > derivedPrice ? Math.round(((finalMrp - derivedPrice) / finalMrp) * 100) : 0;
      data.onSale = data.discountPercentage > 0;
    } else if (has("discountPercentage")) {
      data.discountPercentage = Math.max(0, toNumber(raw.discountPercentage, 0));
    }

    // ── Defaults & validation ───────────────────────────────────────────────
    if (isCreate) {
      if (!data.name) throw new ErrorHandler("Product name is required", 400);
      if (!data.description) throw new ErrorHandler("Product description is required", 400);
      if (data.price === undefined || data.price === null) {
        throw new ErrorHandler("Product price is required", 400);
      }
      data.user = userId || (await this.defaultUserId());
      data.seller = cleanString(raw.seller, "Delivix");
      data.status = data.status || normalizeStatus(raw.status, "published");
      data.stock = data.stock !== undefined ? data.stock : 0;
      data.slug = await this.uniqueSlug(raw.slug || data.name);
      data.sku = data.sku || this.buildSku(data.name.slice(0, 12), Date.now().toString(36).slice(-5));
      if (!data.shortDescription) {
        data.shortDescription = data.description.slice(0, 180);
      }
    } else {
      if (data.slug !== undefined) data.slug = await this.uniqueSlug(data.slug, existing._id);
      if (has("slug") && raw.slug) data.slug = await this.uniqueSlug(raw.slug, existing._id);
    }

    // ── SKU uniqueness (after all generation) ───────────────────────────────
    const mergedForSku = {
      sku: data.sku ?? existing?.sku,
      sizes: data.sizes ?? existing?.sizes ?? [],
      variants: data.variants ?? existing?.variants ?? [],
    };
    await this.assertUniqueSkus(this.collectSkus(mergedForSku), existing?._id || null);

    return data;
  }

  async defaultUserId() {
    try {
      const adminUser = (await User.findOne({ role: "admin" })) || (await User.findOne({}));
      return adminUser ? adminUser._id : new mongoose.Types.ObjectId();
    } catch {
      return new mongoose.Types.ObjectId();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public catalogue
  // ──────────────────────────────────────────────────────────────────────────
  async resolveCategoryIds(queryStr) {
    const rawCategory = queryStr.category;
    if (!rawCategory) return null;

    const values = String(rawCategory).split(",").map((value) => value.trim()).filter(Boolean);
    if (!values.length) return null;

    const objectIds = values.filter((value) => mongoose.Types.ObjectId.isValid(value));
    const names = values.filter((value) => !mongoose.Types.ObjectId.isValid(value));

    const matched = await Category.find({
      $or: [
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
        ...(names.length
          ? [{ name: { $in: names.map((name) => new RegExp(`^${escapeRegex(name)}$`, "i")) } }]
          : []),
      ],
    })
      .select("_id")
      .lean();

    const ids = matched.map((category) => category._id);
    if (!ids.length) return [];

    // Include child categories so browsing a parent surfaces subcategory items.
    const children = await Category.find({
      $or: [{ parentCategory: { $in: ids } }, { parent: { $in: ids } }],
    })
      .select("_id")
      .lean();

    return [...new Set([...ids, ...children.map((category) => category._id)].map(String))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  }

  async getProducts(queryStr = {}) {
    const params = { ...queryStr };

    params.resolvedCategoryIds = await this.resolveCategoryIds(params);

    if (params.brand) {
      const brandValues = String(params.brand)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const brandIds = [];
      for (const value of brandValues) {
        const brand = await this.resolveReference(Brand, value, {
          label: "brand",
          createIfMissing: false,
        });
        if (brand) brandIds.push(brand._id);
      }
      params.resolvedBrandIds = brandIds;
    }

    if (params.subcategory) {
      const subcategoryValues = String(params.subcategory)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const subcategoryIds = [];
      for (const value of subcategoryValues) {
        const subcategory = await this.resolveReference(Category, value, {
          label: "subcategory",
          createIfMissing: false,
        });
        if (subcategory) subcategoryIds.push(subcategory._id);
      }
      params.resolvedSubcategoryIds = subcategoryIds;
    }

    if (params.keyword) {
      const regex = new RegExp(escapeRegex(params.keyword.trim()), "i");
      const matchedCategories = await Category.find({ name: { $regex: regex } })
        .select("_id")
        .lean();
      if (matchedCategories.length) {
        params.matchedCategories = matchedCategories.map((category) => category._id);
      }
    }

    const APIFilters = (await import("../utils/apiFilters.js")).default;
    const baseQuery = Product.find(publicProductMatch());
    const apiFilters = new APIFilters(baseQuery, params)
      .search()
      .filters()
      .sort()
      .pagination(DEFAULT_PER_PAGE);

    const countQuery = new APIFilters(Product.find(publicProductMatch()), params)
      .search()
      .filters();

    const [products, totalProducts] = await Promise.all([
      apiFilters.query
        .select(
          "name title slug price basePrice comparePrice mrp discountPercentage " +
            "shortDescription description images videos category subcategory brand brandName " +
            "ratings numOfReviews stock variants sizes features highlights specifications tags " +
            "homeSection isNewArrival isBestSeller isTrending isFeatured onSale color material " +
            "stoneType sku productType warranty returnPolicy shipping seo taxRate taxIncluded " +
            "estimatedDeliveryDays has360View images360 manageStock allowBackorder visibility " +
            "minStockLevel status createdAt"
        )
        .populate("category", "name slug parentCategory")
        .populate("subcategory", "name slug parentCategory")
        .populate("brand", "name slug logo")
        .lean(),
      Product.countDocuments(countQuery.query.getFilter()),
    ]);

    products.forEach((product) => {
      if (!product.features) product.features = [];
      if (!product.variants) product.variants = [];
      if (!product.sizes) product.sizes = [];
    });

    return {
      products,
      count: products.length,
      totalProducts,
      page: Math.max(1, Number(params.page) || 1),
      perPage: Math.min(MAX_PAGE_SIZE, Number(params.limit) || DEFAULT_PER_PAGE),
    };
  }

  async getFilterOptions() {
    const [aggregateResult, categoryCounts, brands, priceRange] = await Promise.all([
      Product.aggregate([
        { $match: publicProductMatch() },
        {
          $group: {
            _id: null,
            materials: { $addToSet: "$material" },
            stoneTypes: { $addToSet: "$stoneType" },
            colors: { $addToSet: "$color" },
            variantColors: { $addToSet: "$variants.colorName" },
            sizes: { $addToSet: "$sizes.size" },
            variantSizes: { $addToSet: "$variants.sizes.size" },
          },
        },
        {
          $project: {
            _id: 0,
            materials: 1,
            stoneTypes: 1,
            colors: {
              $setUnion: [
                { $filter: { input: "$colors", as: "v", cond: { $ne: ["$$v", null] } } },
                { $filter: { input: "$variantColors", as: "v", cond: { $ne: ["$$v", null] } } },
              ],
            },
            sizes: {
              $setUnion: [
                { $filter: { input: "$sizes", as: "v", cond: { $ne: ["$$v", null] } } },
                { $filter: { input: "$variantSizes", as: "v", cond: { $ne: ["$$v", null] } } },
              ],
            },
          },
        },
      ]),
      Product.aggregate([
        { $match: publicProductMatch() },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            count: 1,
            name: { $ifNull: ["$categoryInfo.name", "Uncategorised"] },
          },
        },
        { $sort: { name: 1 } },
      ]),
      Product.aggregate([
        { $match: publicProductMatch() },
        { $group: { _id: "$brand", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "brands",
            localField: "_id",
            foreignField: "_id",
            as: "brandInfo",
          },
        },
        { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            count: 1,
            name: { $ifNull: ["$brandInfo.name", "$brandName"] },
            slug: "$brandInfo.slug",
          },
        },
        { $match: { name: { $nin: [null, ""] } } },
        { $sort: { name: 1 } },
      ]),
      Product.aggregate([
        { $match: publicProductMatch() },
        { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } },
      ]),
    ]);

    const opts = aggregateResult[0] || {
      materials: [],
      stoneTypes: [],
      colors: [],
      sizes: [],
    };

    const clean = (values) =>
      [...new Set((values || []).filter((value) => value !== null && value !== "" && value !== undefined))]
        .map(String)
        .sort();

    return {
      materials: clean(opts.materials),
      stoneTypes: clean(opts.stoneTypes),
      colors: clean(opts.colors),
      sizes: clean(opts.sizes),
      brands: brands.map((brand) => ({
        _id: brand._id,
        name: brand.name,
        slug: brand.slug,
        count: brand.count,
      })),
      categoryCounts: categoryCounts.map((category) => ({
        _id: category._id,
        name: category.name,
        count: category.count,
      })),
      priceRange: {
        min: Math.floor(priceRange[0]?.min ?? 0),
        max: Math.ceil(priceRange[0]?.max ?? 0),
      },
    };
  }

  async getProductById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorHandler("Product not found", 404);
    }

    const product = await Product.findOne({
      _id: id,
      ...publicProductMatch(),
    })
      .populate("category", "name slug parentCategory")
      .populate("subcategory", "name slug parentCategory")
      .populate("brand", "name slug logo description")
      .lean();

    if (!product) throw new ErrorHandler("Product not found", 404);

    const [reviewSummary] = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(id), status: "Approved" } },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (reviewSummary) {
      product.ratings = Number(reviewSummary.average.toFixed(1));
      product.numOfReviews = reviewSummary.count;
    }

    if (!product.features) product.features = [];
    if (!product.variants) product.variants = [];
    if (!product.sizes) product.sizes = [];
    return product;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin catalogue
  // ──────────────────────────────────────────────────────────────────────────
  async getAdminProductStats() {
    const result = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$status", "published"] }, "published"] }, 1, 0],
            },
          },
          draftProducts: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          scheduledProducts: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
          outOfStockProducts: {
            $sum: { $cond: [{ $lte: [{ $ifNull: ["$stock", 0] }, 0] }, 1, 0] },
          },
          lowStockProducts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $ifNull: ["$stock", 0] }, 0] },
                    {
                      $lte: [
                        { $ifNull: ["$stock", 0] },
                        { $ifNull: ["$minStockLevel", 5] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          featuredProducts: { $sum: { $cond: ["$isFeatured", 1, 0] } },
          totalVariants: { $sum: { $size: { $ifNull: ["$variants", []] } } },
          hiddenProducts: { $sum: { $cond: [{ $eq: ["$visibility", "hidden"] }, 1, 0] } },
        },
      },
    ]);

    const stats = result[0] || {};
    return {
      totalProducts: stats.totalProducts || 0,
      activeProducts: stats.activeProducts || 0,
      draftProducts: stats.draftProducts || 0,
      scheduledProducts: stats.scheduledProducts || 0,
      outOfStockProducts: stats.outOfStockProducts || 0,
      lowStockProducts: stats.lowStockProducts || 0,
      featuredProducts: stats.featuredProducts || 0,
      totalVariants: stats.totalVariants || 0,
      hiddenProducts: stats.hiddenProducts || 0,
    };
  }

  async buildAdminFilter(query = {}) {
    const filter = {};
    const and = [];

    if (query.keyword) {
      const regex = new RegExp(escapeRegex(String(query.keyword).trim()), "i");
      const matchedCategories = await Category.find({ name: { $regex: regex } })
        .select("_id")
        .lean();
      const keywordClauses = [
        { name: { $regex: regex } },
        { title: { $regex: regex } },
        { sku: { $regex: regex } },
        { barcode: { $regex: regex } },
        { brandName: { $regex: regex } },
        { tags: { $regex: regex } },
        { "variants.sku": { $regex: regex } },
        { "variants.sizes.sku": { $regex: regex } },
        { "sizes.sku": { $regex: regex } },
      ];
      if (matchedCategories.length) {
        keywordClauses.push({ category: { $in: matchedCategories.map((category) => category._id) } });
      }
      if (mongoose.Types.ObjectId.isValid(String(query.keyword).trim())) {
        keywordClauses.push({ _id: String(query.keyword).trim() });
      }
      and.push({ $or: keywordClauses });
    }

    if (query.status && query.status !== "all") {
      if (query.status === "published") {
        and.push({ $or: [{ status: "published" }, { status: { $exists: false } }] });
      } else {
        and.push({ status: query.status });
      }
    }

    if (query.category && query.category !== "all") {
      const categoryIds = await this.resolveCategoryIds({ category: query.category });
      if (categoryIds) filter.category = { $in: categoryIds };
    }

    if (query.subcategory && query.subcategory !== "all") {
      const subcategory = await this.resolveReference(Category, query.subcategory, {
        label: "subcategory",
        createIfMissing: false,
      });
      if (subcategory) filter.subcategory = subcategory._id;
    }

    if (query.brand && query.brand !== "all") {
      const brand = await this.resolveReference(Brand, query.brand, {
        label: "brand",
        createIfMissing: false,
      });
      if (brand) filter.brand = brand._id;
    }

    if (query.featured === "true" || query.featured === true) filter.isFeatured = true;
    if (query.newArrival === "true") filter.isNewArrival = true;
    if (query.bestSeller === "true") filter.isBestSeller = true;
    if (query.trending === "true") filter.isTrending = true;

    const minPrice = toNumber(query.minPrice ?? query["price[gte]"], undefined);
    const maxPrice = toNumber(query.maxPrice ?? query["price[lte]"], undefined);
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    if (query.stockStatus && query.stockStatus !== "all") {
      if (query.stockStatus === "out") {
        filter.stock = { $lte: 0 };
      } else if (query.stockStatus === "low") {
        filter.stock = { $gt: 0, $lte: toNumber(query.lowStockThreshold, 5) };
      } else if (query.stockStatus === "in") {
        filter.stock = { $gt: 0 };
      }
    }

    if (query.colors) {
      const colors = stringArray(query.colors);
      if (colors.length) {
        and.push({
          $or: [
            { color: { $in: colors.map((color) => new RegExp(`^${escapeRegex(color)}$`, "i")) } },
            { "variants.colorName": { $in: colors.map((color) => new RegExp(`^${escapeRegex(color)}$`, "i")) } },
          ],
        });
      }
    }

    if (query.sizes) {
      const sizes = stringArray(query.sizes);
      if (sizes.length) {
        and.push({
          $or: [{ "sizes.size": { $in: sizes } }, { "variants.sizes.size": { $in: sizes } }],
        });
      }
    }

    if (and.length) filter.$and = and;
    return filter;
  }

  adminSort(sortKey = "newest") {
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      stock_asc: { stock: 1 },
      stock_desc: { stock: -1 },
      popular: { numOfReviews: -1, ratings: -1 },
      rating: { ratings: -1 },
      updated: { updatedAt: -1 },
    };
    return sortMap[sortKey] || sortMap.newest;
  }

  async getAdminProducts(query = {}) {
    const page = Math.max(1, toNumber(query.page, 1));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, toNumber(query.limit, 20)));
    const filter = await this.buildAdminFilter(query);

    const [products, totalProducts, stats] = await Promise.all([
      Product.find(filter)
        .select("-visualEmbedding")
        .populate("category", "name slug parentCategory")
        .populate("subcategory", "name slug parentCategory")
        .populate("brand", "name slug logo")
        .sort(this.adminSort(query.sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      this.getAdminProductStats(),
    ]);

    return {
      products,
      totalProducts,
      page,
      perPage: limit,
      totalPages: Math.max(1, Math.ceil(totalProducts / limit)),
      stats,
    };
  }

  async getAdminProductById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorHandler("Product not found", 404);
    }
    const product = await Product.findById(id)
      .select("-visualEmbedding")
      .populate("category", "name slug parentCategory")
      .populate("subcategory", "name slug parentCategory")
      .populate("brand", "name slug logo")
      .lean();
    if (!product) throw new ErrorHandler("Product not found", 404);
    return product;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────────
  async createProduct(rawProduct, userId) {
    const productData = await this.normalizeProductPayload(rawProduct, { userId });
    const product = await Product.create(productData);

    if (!product.variants?.length && !product.sizes?.length && product.stock === 0 && rawProduct.stock === undefined) {
      product.stock = 25;
      await product.save();
    }

    return product;
  }

  async updateProduct(id, rawProduct) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorHandler("Product not found", 404);
    }
    const product = await Product.findById(id);
    if (!product) throw new ErrorHandler("Product not found", 404);

    const updateData = await this.normalizeProductPayload(rawProduct, { existing: product });

    if (updateData.images !== undefined) {
      const keep = new Set(updateData.images.map((image) => image.public_id));
      await Promise.all(
        (product.images || []).map((image) => {
          if (image.public_id && !keep.has(image.public_id)) {
            return UploadService.deleteMedia(image.public_id, "image").catch(() => {});
          }
          return Promise.resolve();
        })
      );
    }

    if (updateData.videos !== undefined) {
      const keep = new Set(updateData.videos.map((video) => video.public_id));
      await Promise.all(
        (product.videos || []).map((video) => {
          if (video.public_id && !keep.has(video.public_id)) {
            return UploadService.deleteMedia(video.public_id, "video").catch(() => {});
          }
          return Promise.resolve();
        })
      );
    }

    Object.assign(product, updateData);
    await product.save();
    return product;
  }

  async deleteProduct(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorHandler("Product not found", 404);
    }
    const product = await Product.findById(id);
    if (!product) throw new ErrorHandler("Product not found", 404);

    const images = [
      ...(product.images || []),
      ...(product.images360 || []).map((url) => ({ url, public_id: null })),
      ...(product.variants || []).flatMap((variant) => variant.images || []),
    ];
    const videos = [
      ...(product.videos || []),
      ...(product.variants || []).flatMap((variant) => variant.videos || []),
    ];

    await Promise.all(
      images.map(async (image) => {
        if (!image.public_id) return;
        const usedElsewhere = await Product.exists({
          _id: { $ne: product._id },
          $or: [
            { "images.public_id": image.public_id },
            { "variants.images.public_id": image.public_id },
          ],
        });
        if (!usedElsewhere) {
          await UploadService.deleteMedia(image.public_id, "image").catch(() => {});
        }
      })
    );

    await Promise.all(
      videos.map(async (video) => {
        if (!video.public_id) return;
        const usedElsewhere = await Product.exists({
          _id: { $ne: product._id },
          $or: [
            { "videos.public_id": video.public_id },
            { "variants.videos.public_id": video.public_id },
          ],
        });
        if (!usedElsewhere) {
          await UploadService.deleteMedia(video.public_id, "video").catch(() => {});
        }
      })
    );

    await Review.deleteMany({ product: product._id });
    await product.deleteOne();
    return product;
  }

  async duplicateProduct(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ErrorHandler("Product not found", 404);
    }
    const source = await Product.findById(id).lean();
    if (!source) throw new ErrorHandler("Product not found", 404);

    const timestamp = Date.now().toString(36).toUpperCase();
    const baseName = `${source.name} (Copy)`;
    const copy = {
      ...source,
      _id: new mongoose.Types.ObjectId(),
      name: baseName,
      title: baseName,
      slug: await this.uniqueSlug(baseName),
      sku: this.buildSku(source.sku || source.name.slice(0, 10), `COPY-${timestamp}`),
      status: "draft",
      ratings: 0,
      numOfReviews: 0,
      reviews: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      variants: (source.variants || []).map((variant, variantIndex) => ({
        ...variant,
        _id: new mongoose.Types.ObjectId(),
        sku: this.buildSku(variant.sku || source.sku || "DLV", `C${variantIndex + 1}-${timestamp}`),
        sizes: (variant.sizes || []).map((size, sizeIndex) => ({
          ...size,
          _id: new mongoose.Types.ObjectId(),
          sku: this.buildSku(
            size.sku || variant.sku || source.sku || "DLV",
            `C${sizeIndex + 1}-${timestamp}`
          ),
        })),
      })),
      sizes: (source.sizes || []).map((size, index) => ({
        ...size,
        _id: new mongoose.Types.ObjectId(),
        sku: this.buildSku(size.sku || source.sku || "DLV", `C${index + 1}-${timestamp}`),
      })),
    };

    return Product.create(copy);
  }

  async bulkUpdateProducts({ ids = [], action, value } = {}) {
    const validIds = (Array.isArray(ids) ? ids : []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) throw new ErrorHandler("Select at least one product", 400);

    const actions = ["delete", "publish", "draft", "feature", "unfeature", "hide", "show"];
    if (!actions.includes(action)) {
      throw new ErrorHandler(`Unsupported bulk action: ${action}`, 400);
    }

    if (action === "delete") {
      let deleted = 0;
      for (const id of validIds) {
        try {
          await this.deleteProduct(id);
          deleted += 1;
        } catch {
          // Continue so one bad record does not block the rest.
        }
      }
      return { action, matched: validIds.length, modified: deleted };
    }

    const updates = {
      publish: { status: "published" },
      draft: { status: "draft" },
      feature: { isFeatured: true },
      unfeature: { isFeatured: false },
      hide: { visibility: "hidden" },
      show: { visibility: "public" },
    };

    const update = { ...updates[action] };
    if (action === "draft" && value !== undefined) update.status = normalizeStatus(value, "draft");

    const result = await Product.updateMany({ _id: { $in: validIds } }, { $set: update });
    return { action, matched: result.matchedCount, modified: result.modifiedCount };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Import / export
  // ──────────────────────────────────────────────────────────────────────────
  flattenForExport(product) {
    const category =
      typeof product.category === "object" ? product.category?.name : product.category || "";
    const subcategory =
      typeof product.subcategory === "object" ? product.subcategory?.name : product.subcategory || "";
    const brand = typeof product.brand === "object" ? product.brand?.name : product.brandName || "";
    const image = product.images?.[0]?.url || "";
    const variantCount =
      (product.variants || []).reduce(
        (count, variant) => count + Math.max(1, (variant.sizes || []).length),
        0
      ) || (product.sizes || []).length;

    return {
      id: String(product._id),
      name: product.name || product.title || "",
      slug: product.slug || "",
      sku: product.sku || "",
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      category,
      subcategory,
      brand,
      price: product.price ?? product.basePrice ?? 0,
      mrp: product.mrp ?? product.comparePrice ?? "",
      discountPercentage: product.discountPercentage || 0,
      stock: product.stock ?? 0,
      status: product.status || "published",
      featured: product.isFeatured ? "yes" : "no",
      variants: variantCount,
      image,
      tags: (product.tags || []).join("|"),
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : "",
    };
  }

  async exportProducts(query = {}, format = "csv") {
    const filter = await this.buildAdminFilter(query);
    const products = await Product.find(filter)
      .select("-visualEmbedding")
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .sort(this.adminSort(query.sort))
      .limit(5000)
      .lean();

    const rows = products.map((product) => this.flattenForExport(product));
    return { rows, format: format === "xlsx" ? "xlsx" : "csv" };
  }

  async importProducts(rows = []) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new ErrorHandler("Import file contains no rows", 400);
    }
    if (rows.length > 1000) {
      throw new ErrorHandler("You can import a maximum of 1000 products at a time", 400);
    }

    const created = [];
    const failed = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const name = cleanString(row.name ?? row.title ?? row["Product Name"]);
      if (!name) {
        failed.push({ row: index + 1, name: "", reason: "Missing product name" });
        continue;
      }

      try {
        const payload = {
          name,
          description:
            cleanString(row.description ?? row["Description"]) || `${name} from the Delivix catalogue.`,
          shortDescription: cleanString(row.shortDescription ?? row["Short Description"]),
          sku: cleanString(row.sku ?? row.SKU),
          price: toNumber(row.price ?? row["Price"], 0),
          mrp: toNumber(row.mrp ?? row["MRP"], undefined),
          stock: Math.max(0, toNumber(row.stock ?? row["Stock"], 0)),
          status: normalizeStatus(row.status ?? row["Status"], "draft"),
          category: cleanString(row.category ?? row["Category"]) || "General",
          subcategory: cleanString(row.subcategory ?? row["Subcategory"]) || undefined,
          brand: cleanString(row.brand ?? row["Brand"]) || undefined,
          tags: stringArray(row.tags ?? row["Tags"]),
          isFeatured: toBool(row.featured ?? row["Featured"], false),
          images: cleanString(row.image ?? row["Image"])
            ? [cleanString(row.image ?? row["Image"])]
            : [],
        };
        const product = await this.createProduct(payload, null);
        created.push({ id: String(product._id), name: product.name });
      } catch (error) {
        failed.push({ row: index + 1, name, reason: error.message || "Import failed" });
      }
    }

    return { created, failed, total: rows.length };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy review helpers (kept for backwards compatibility)
  // ──────────────────────────────────────────────────────────────────────────
  async addProductReview(productId, { rating, comment }, userId) {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new ErrorHandler("Product not found", 404);

    const isReviewed = product.reviews.find(
      (review) => review.user.toString() === userId.toString()
    );

    if (isReviewed) {
      product.reviews.forEach((review) => {
        if (review.user.toString() === userId.toString()) {
          review.comment = comment;
          review.rating = Number(rating);
        }
      });
    } else {
      product.reviews.push({ user: userId, rating: Number(rating), comment });
      product.numOfReviews = product.reviews.length;
    }

    product.ratings =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    return product;
  }

  async getProductReviews(productId) {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new ErrorHandler("Product not found", 404);
    return product.reviews;
  }

  async deleteProductReview(productId, reviewId) {
    const product = await ProductRepository.findById(productId);
    if (!product) throw new ErrorHandler("Product not found", 404);

    const reviews = product.reviews.filter(
      (review) => review._id.toString() !== reviewId.toString()
    );

    const numOfReviews = reviews.length;
    const ratings =
      numOfReviews === 0
        ? 0
        : reviews.reduce((acc, item) => item.rating + acc, 0) / numOfReviews;

    return ProductRepository.updateById(
      productId,
      { reviews, ratings, numOfReviews },
      { new: true }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Visual search
  // ──────────────────────────────────────────────────────────────────────────
  async visualSearch(embedding) {
    if (!embedding || !Array.isArray(embedding)) {
      throw new ErrorHandler("Valid visual embedding array is required", 400);
    }

    const products = await ProductRepository.findWithVisualEmbeddings();
    if (!products || products.length === 0) return [];

    return products
      .map((product) => {
        const score = this.calculateCosineSimilarity(embedding, product.visualEmbedding);
        delete product.visualEmbedding;
        return { ...product, similarityScore: score };
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10);
  }

  calculateCosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i += 1) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default new ProductService();
