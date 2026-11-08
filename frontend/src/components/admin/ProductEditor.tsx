import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  uploadProductMedia,
  type BrandItem,
  type CategoryItem,
  type ProductImage,
  type ProductItem,
} from "../../services/api";
import { formatPrice } from "../../utils/currency";
import "./ProductEditor.css";

export interface ProductFormSize {
  size: string;
  sku: string;
  barcode: string;
  price: string;
  comparePrice: string;
  stock: string;
  status: "Active" | "Draft";
}

export interface ProductFormVariant {
  variantName: string;
  colorName: string;
  colorHex: string;
  sku: string;
  barcode: string;
  attributes: string;
  price: string;
  mrp: string;
  stock: string;
  isActive: boolean;
  isDefault: boolean;
  images: ProductImage[];
  sizes: ProductFormSize[];
}

export interface ProductFormSpec {
  label: string;
  value: string;
}

export interface ProductFormState {
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  brandName: string;
  manufacturer: string;
  modelNumber: string;
  category: string;
  subcategory: string;
  productType: string;
  shortDescription: string;
  description: string;
  tags: string;
  collections: string;
  highlights: string;
  specifications: ProductFormSpec[];
  images: ProductImage[];
  videos: ProductImage[];
  has360View: boolean;
  images360: string;
  price: string;
  mrp: string;
  costPrice: string;
  taxRate: string;
  taxIncluded: boolean;
  saleStartDate: string;
  saleEndDate: string;
  stock: string;
  minStockLevel: string;
  maxStockLevel: string;
  maxPurchaseQuantity: string;
  manageStock: boolean;
  allowBackorder: boolean;
  warehouseLocation: string;
  shelfBin: string;
  variants: ProductFormVariant[];
  sizes: ProductFormSize[];
  weight: string;
  length: string;
  width: string;
  height: string;
  shippingClass: string;
  freeShipping: boolean;
  deliveryInfo: string;
  estimatedDeliveryDays: string;
  returnPolicy: string;
  warranty: string;
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoSocialImage: string;
  seoCanonicalUrl: string;
  status: "draft" | "published" | "scheduled" | "archived";
  publishAt: string;
  visibility: "public" | "hidden";
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  homeSection: string;
}

export const emptyProductForm = (): ProductFormState => ({
  name: "",
  slug: "",
  sku: "",
  barcode: "",
  brandName: "",
  manufacturer: "",
  modelNumber: "",
  category: "",
  subcategory: "",
  productType: "",
  shortDescription: "",
  description: "",
  tags: "",
  collections: "",
  highlights: "",
  specifications: [{ label: "", value: "" }],
  images: [],
  videos: [],
  has360View: false,
  images360: "",
  price: "",
  mrp: "",
  costPrice: "",
  taxRate: "",
  taxIncluded: true,
  saleStartDate: "",
  saleEndDate: "",
  stock: "0",
  minStockLevel: "5",
  maxStockLevel: "100",
  maxPurchaseQuantity: "10",
  manageStock: true,
  allowBackorder: false,
  warehouseLocation: "",
  shelfBin: "",
  variants: [],
  sizes: [],
  weight: "",
  length: "",
  width: "",
  height: "",
  shippingClass: "Standard",
  freeShipping: false,
  deliveryInfo: "",
  estimatedDeliveryDays: "3",
  returnPolicy: "",
  warranty: "",
  careInstructions: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  seoSocialImage: "",
  seoCanonicalUrl: "",
  status: "published",
  publishAt: "",
  visibility: "public",
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  isTrending: false,
  homeSection: "",
});

const asString = (value: unknown, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const dateTimeValue = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeImages = (value: unknown): ProductImage[] =>
  (Array.isArray(value) ? value : [])
    .flatMap((entry): ProductImage[] => {
      if (typeof entry === "string") return entry ? [{ url: entry }] : [];
      if (entry && typeof entry === "object" && "url" in entry && entry.url) {
        const image = entry as Record<string, unknown>;
        return [
          {
            url: String(image.url),
            public_id: image.public_id ? String(image.public_id) : undefined,
            alt: image.alt ? String(image.alt) : "",
          },
        ];
      }
      return [];
    });

const toSizeForm = (entry: any): ProductFormSize => ({
  size: asString(entry?.size),
  sku: asString(entry?.sku),
  barcode: asString(entry?.barcode),
  price: asString(entry?.price),
  comparePrice: asString(entry?.comparePrice ?? entry?.mrp),
  stock: asString(entry?.stock, "0"),
  status: entry?.status === "Draft" ? "Draft" : "Active",
});

const toVariantForm = (entry: any, index: number): ProductFormVariant => ({
  variantName: asString(entry?.variantName || entry?.colorName, `Colour ${index + 1}`),
  colorName: asString(entry?.colorName || entry?.variantName, `Colour ${index + 1}`),
  colorHex: asString(entry?.colorHex, "#D4D4D8"),
  sku: asString(entry?.sku),
  barcode: asString(entry?.barcode),
  attributes: Object.entries(entry?.attributes || {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n"),
  price: asString(entry?.price),
  mrp: asString(entry?.mrp ?? entry?.comparePrice),
  stock: asString(entry?.stock, "0"),
  isActive: entry?.isActive !== false,
  isDefault: Boolean(entry?.isDefault),
  images: normalizeImages(entry?.images),
  sizes: (Array.isArray(entry?.sizes) ? entry.sizes : []).map(toSizeForm),
});

export const productToForm = (product: ProductItem): ProductFormState => {
  const raw = product.raw || {};
  const base = emptyProductForm();
  return {
    ...base,
    name: product.name || "",
    slug: product.slug || asString(raw.slug),
    sku: product.sku || asString(raw.sku),
    barcode: product.barcode || asString(raw.barcode),
    brandName: product.brandName || product.brand || asString(raw.brandName),
    manufacturer: asString(raw.manufacturer),
    modelNumber: asString(raw.modelNumber),
    category: product.categoryId || product.category || "",
    subcategory: product.subcategoryId || product.subcategory || "",
    productType: product.productType || asString(raw.productType),
    shortDescription: product.shortDescription || asString(raw.shortDescription),
    description: product.description || asString(raw.description),
    tags: (product.tags || []).join(", "),
    collections: (Array.isArray(raw.collections) ? raw.collections : product.collections || []).join(", "),
    highlights: (product.highlights?.length ? product.highlights : product.features || []).join("\n"),
    specifications:
      (product.specifications || []).length > 0
        ? (product.specifications || []).map((spec) => ({ label: spec.label, value: spec.value }))
        : [{ label: "", value: "" }],
    images: normalizeImages(product.images),
    videos: normalizeImages(product.videos),
    has360View: Boolean(product.has360View),
    images360: (product.images360 || []).join("\n"),
    price: asString(raw.price ?? product.price),
    mrp: asString(raw.mrp ?? raw.comparePrice ?? product.mrp ?? product.old),
    costPrice: asString(raw.costPrice),
    taxRate: asString(raw.taxRate),
    taxIncluded: raw.taxIncluded !== false,
    saleStartDate: dateTimeValue(raw.saleStartDate),
    saleEndDate: dateTimeValue(raw.saleEndDate),
    stock: asString(raw.stock ?? product.stock, "0"),
    minStockLevel: asString(raw.minStockLevel, "5"),
    maxStockLevel: asString(raw.maxStockLevel, "100"),
    maxPurchaseQuantity: asString(raw.maxPurchaseQuantity, "10"),
    manageStock: raw.manageStock !== false,
    allowBackorder: Boolean(raw.allowBackorder),
    warehouseLocation: asString(raw.warehouseLocation),
    shelfBin: asString(raw.shelfBin),
    variants: (Array.isArray(raw.variants) && raw.variants.length
      ? raw.variants
      : product.variants || []
    ).map(toVariantForm),
    sizes: (Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes : product.sizes || []).map(toSizeForm),
    weight: asString(raw.shipping?.weight),
    length: asString(raw.shipping?.length),
    width: asString(raw.shipping?.width),
    height: asString(raw.shipping?.height),
    shippingClass: asString(raw.shipping?.shippingClass, "Standard"),
    freeShipping: Boolean(raw.freeShipping ?? product.freeShipping),
    deliveryInfo: asString(raw.shipping?.deliveryInfo),
    estimatedDeliveryDays: asString(raw.estimatedDeliveryDays, "3"),
    returnPolicy: product.returnPolicy || asString(raw.returnPolicy),
    warranty: product.warranty || asString(raw.warranty),
    careInstructions: product.careInstructions || asString(raw.careInstructions),
    seoTitle: asString(raw.seo?.title),
    seoDescription: asString(raw.seo?.metaDescription),
    seoKeywords: (Array.isArray(raw.seo?.keywords) ? raw.seo.keywords : []).join(", "),
    seoSocialImage: asString(raw.seo?.socialImage),
    seoCanonicalUrl: asString(raw.seo?.canonicalUrl),
    status: ["draft", "published", "scheduled", "archived"].includes(product.status || "")
      ? (product.status as ProductFormState["status"])
      : "published",
    publishAt: dateTimeValue(raw.publishAt),
    visibility: product.visibility === "hidden" ? "hidden" : "public",
    isFeatured: Boolean(product.isFeatured),
    isNewArrival: Boolean(product.isNewArrival),
    isBestSeller: Boolean(product.isBestSeller),
    isTrending: Boolean(product.isTrending),
    homeSection: asString(raw.homeSection),
  };
};

const splitList = (value: string) =>
  [...new Set(
    String(value || "")
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  )];

const numberOrUndefined = (value: string) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const numberOrZero = (value: string) => Math.max(0, numberOrUndefined(value) ?? 0);

const skuToken = (value: string) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 12);

const makeSku = (base: string, ...parts: string[]) => {
  const tokens = [base, ...parts].map(skuToken).filter(Boolean);
  return tokens.join("-").slice(0, 64) || "DLV";
};

const mediaPayload = (items: ProductImage[]) =>
  items
    .filter((item) => item.url)
    .map((item) =>
      item.public_id
        ? { url: item.url, public_id: item.public_id, alt: item.alt || "" }
        : { url: item.url, alt: item.alt || "" }
    );

export const formToPayload = (
  form: ProductFormState,
  categories: CategoryItem[] = []
): Record<string, any> => {
  const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
  const category = categories.find((entry) => entry.id === form.category || entry.name === form.category);
  const subcategory = categories.find(
    (entry) => entry.id === form.subcategory || entry.name === form.subcategory
  );
  const variants = form.variants.map((variant) => {
    const variantPrice = numberOrUndefined(variant.price) ?? numberOrUndefined(form.price) ?? 0;
    const variantMrp = numberOrUndefined(variant.mrp) ?? numberOrUndefined(form.mrp);
    return {
      variantName: variant.variantName.trim(),
      colorName: (variant.colorName || variant.variantName).trim(),
      colorHex: variant.colorHex,
      sku: variant.sku.trim() || makeSku(baseSku, variant.colorName || variant.variantName),
      barcode: variant.barcode.trim() || undefined,
      attributes: Object.fromEntries(
        variant.attributes
          .split("\n")
          .map((entry) => entry.split("="))
          .filter(([key, value]) => key?.trim() && value?.trim())
          .map(([key, ...value]) => [key.trim(), value.join("=").trim()])
      ),
      price: variantPrice,
      mrp: variantMrp,
      stock: numberOrZero(variant.stock),
      isActive: variant.isActive,
      isDefault: variant.isDefault,
      images: mediaPayload(variant.images),
      sizes: variant.sizes
        .filter((size) => size.size.trim())
        .map((size) => ({
          size: size.size.trim(),
          sku: size.sku.trim() || makeSku(baseSku, variant.colorName || variant.variantName, size.size),
          barcode: size.barcode.trim() || undefined,
          price: numberOrUndefined(size.price) ?? variantPrice,
          comparePrice: numberOrUndefined(size.comparePrice) ?? variantMrp,
          stock: numberOrZero(size.stock),
          status: size.status,
        })),
    };
  });

  const rootSizes = variants.length
    ? []
    : form.sizes
        .filter((size) => size.size.trim())
        .map((size) => ({
          size: size.size.trim(),
          sku: size.sku.trim() || makeSku(baseSku, size.size),
          barcode: size.barcode.trim() || undefined,
          price: numberOrUndefined(size.price) ?? numberOrUndefined(form.price) ?? 0,
          comparePrice: numberOrUndefined(size.comparePrice) ?? numberOrUndefined(form.mrp),
          stock: numberOrZero(size.stock),
          status: size.status,
        }));

  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    sku: form.sku.trim() || undefined,
    barcode: form.barcode.trim() || undefined,
    brandName: form.brandName.trim() || undefined,
    manufacturer: form.manufacturer.trim() || undefined,
    modelNumber: form.modelNumber.trim() || undefined,
    category: form.category ? category?.id || form.category : null,
    categoryName: form.category ? category?.name || form.category : undefined,
    subcategory: form.subcategory ? subcategory?.id || form.subcategory : null,
    subcategoryName: form.subcategory ? subcategory?.name || form.subcategory : undefined,
    productType: form.productType.trim() || undefined,
    description: form.description.trim(),
    shortDescription: form.shortDescription.trim(),
    tags: splitList(form.tags),
    collections: splitList(form.collections),
    highlights: splitList(form.highlights),
    features: splitList(form.highlights),
    specifications: form.specifications.filter((spec) => spec.label.trim() && spec.value.trim()),
    images: mediaPayload(form.images),
    videos: mediaPayload(form.videos),
    has360View: form.has360View,
    images360: splitList(form.images360),
    price: numberOrUndefined(form.price) ?? 0,
    comparePrice: numberOrUndefined(form.mrp),
    costPrice: numberOrUndefined(form.costPrice),
    taxRate: numberOrUndefined(form.taxRate) ?? 0,
    taxIncluded: form.taxIncluded,
    saleStartDate: form.saleStartDate ? new Date(form.saleStartDate).toISOString() : undefined,
    saleEndDate: form.saleEndDate ? new Date(form.saleEndDate).toISOString() : undefined,
    stock: numberOrZero(form.stock),
    minStockLevel: numberOrZero(form.minStockLevel),
    maxStockLevel: numberOrZero(form.maxStockLevel),
    maxPurchaseQuantity: Math.max(1, numberOrZero(form.maxPurchaseQuantity)),
    manageStock: form.manageStock,
    allowBackorder: form.allowBackorder,
    warehouseLocation: form.warehouseLocation.trim() || undefined,
    shelfBin: form.shelfBin.trim() || undefined,
    variants,
    sizes: rootSizes,
    freeShipping: form.freeShipping,
    shipping: {
      weight: numberOrZero(form.weight),
      length: numberOrZero(form.length),
      width: numberOrZero(form.width),
      height: numberOrZero(form.height),
      shippingClass: form.shippingClass.trim() || "Standard",
      deliveryInfo: form.deliveryInfo.trim(),
    },
    estimatedDeliveryDays: numberOrZero(form.estimatedDeliveryDays),
    returnPolicy: form.returnPolicy.trim() || undefined,
    warranty: form.warranty.trim() || undefined,
    careInstructions: form.careInstructions.trim() || undefined,
    seo: {
      title: form.seoTitle.trim(),
      metaDescription: form.seoDescription.trim(),
      keywords: splitList(form.seoKeywords),
      socialImage: form.seoSocialImage.trim(),
      canonicalUrl: form.seoCanonicalUrl.trim(),
    },
    status: form.status,
    publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : undefined,
    visibility: form.visibility,
    isFeatured: form.isFeatured,
    isNewArrival: form.isNewArrival,
    isBestSeller: form.isBestSeller,
    isTrending: form.isTrending,
    homeSection: form.homeSection,
  };
};

export const validateProductForm = (form: ProductFormState): string | null => {
  if (!form.name.trim()) return "Product name is required.";
  if (!form.description.trim()) return "A full product description is required.";
  if (numberOrUndefined(form.price) === undefined) return "A valid selling price is required.";
  if ((numberOrUndefined(form.price) ?? 0) <= 0) return "Selling price must be greater than zero.";
  if (
    numberOrUndefined(form.mrp) !== undefined &&
    (numberOrUndefined(form.mrp) ?? 0) < (numberOrUndefined(form.price) ?? 0)
  ) {
    return "Compare-at price (MRP) cannot be lower than the selling price.";
  }
  if (form.status === "scheduled" && !form.publishAt) {
    return "Choose a publish date and time for a scheduled product.";
  }

  const variantNames = new Set<string>();
  for (const [index, variant] of form.variants.entries()) {
    const name = variant.variantName.trim();
    if (!name) return `Variant ${index + 1} needs a colour or option name.`;
    const key = name.toLowerCase();
    if (variantNames.has(key)) return `Duplicate variant name: ${name}.`;
    variantNames.add(key);

    const variantPrice = numberOrUndefined(variant.price);
    const variantMrp = numberOrUndefined(variant.mrp);
    if (variant.price.trim() && (variantPrice === undefined || variantPrice <= 0)) {
      return `Enter a valid selling price for ${name}.`;
    }
    if (variant.mrp.trim() && variantMrp === undefined) {
      return `Enter a valid MRP for ${name}.`;
    }
    const effectiveVariantPrice = variantPrice ?? numberOrUndefined(form.price);
    const effectiveVariantMrp = variantMrp ?? numberOrUndefined(form.mrp);
    if (
      effectiveVariantPrice !== undefined &&
      effectiveVariantMrp !== undefined &&
      effectiveVariantMrp < effectiveVariantPrice
    ) {
      return `MRP cannot be lower than the selling price for ${name}.`;
    }

    const sizeNames = new Set<string>();
    for (const [sizeIndex, size] of variant.sizes.entries()) {
      const sizeName = size.size.trim();
      if (!sizeName) return `Remove the empty size row in ${name}.`;
      const sizeKey = sizeName.toLowerCase();
      if (sizeNames.has(sizeKey)) return `Duplicate size ${sizeName} in ${name}.`;
      sizeNames.add(sizeKey);

      const sizePrice = numberOrUndefined(size.price);
      const sizeMrp = numberOrUndefined(size.comparePrice);
      if (size.price.trim() && (sizePrice === undefined || sizePrice <= 0)) {
        return `Enter a valid selling price for ${name}, size ${sizeName || sizeIndex + 1}.`;
      }
      if (size.comparePrice.trim() && sizeMrp === undefined) {
        return `Enter a valid MRP for ${name}, size ${sizeName || sizeIndex + 1}.`;
      }
      const effectiveSizePrice = sizePrice ?? effectiveVariantPrice;
      const effectiveSizeMrp = sizeMrp ?? effectiveVariantMrp;
      if (
        effectiveSizePrice !== undefined &&
        effectiveSizeMrp !== undefined &&
        effectiveSizeMrp < effectiveSizePrice
      ) {
        return `MRP cannot be lower than the selling price for ${name}, size ${sizeName}.`;
      }
    }
  }

  if (!form.variants.length) {
    const rootNames = new Set<string>();
    for (const [index, size] of form.sizes.entries()) {
      const sizeName = size.size.trim();
      if (!sizeName) return "Remove the empty size row.";
      const key = sizeName.toLowerCase();
      if (rootNames.has(key)) return `Duplicate size: ${sizeName}.`;
      rootNames.add(key);

      const sizePrice = numberOrUndefined(size.price);
      const sizeMrp = numberOrUndefined(size.comparePrice);
      if (size.price.trim() && (sizePrice === undefined || sizePrice <= 0)) {
        return `Enter a valid selling price for size ${sizeName || index + 1}.`;
      }
      if (size.comparePrice.trim() && sizeMrp === undefined) {
        return `Enter a valid MRP for size ${sizeName || index + 1}.`;
      }
      const effectiveSizePrice = sizePrice ?? numberOrUndefined(form.price);
      const effectiveSizeMrp = sizeMrp ?? numberOrUndefined(form.mrp);
      if (
        effectiveSizePrice !== undefined &&
        effectiveSizeMrp !== undefined &&
        effectiveSizeMrp < effectiveSizePrice
      ) {
        return `MRP cannot be lower than the selling price for size ${sizeName}.`;
      }
    }
  }

  const skus = [
    form.sku,
    ...form.sizes.map((size) => size.sku),
    ...form.variants.flatMap((variant) => [
      variant.sku,
      ...variant.sizes.map((size) => size.sku),
    ]),
  ]
    .map((sku) => sku.trim().toUpperCase())
    .filter(Boolean);
  const duplicateSku = skus.find((sku, index) => skus.indexOf(sku) !== index);
  if (duplicateSku) return `Duplicate SKU in this product: ${duplicateSku}. Every SKU must be unique.`;

  return null;
};

interface MediaPickerProps {
  label: string;
  items: ProductImage[];
  onChange: (items: ProductImage[]) => void;
  type?: "image" | "video";
  max?: number;
  compact?: boolean;
}

function MediaPicker({ label, items, onChange, type = "image", max = 8, compact = false }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = max - items.length;
    const selected = Array.from(files).slice(0, Math.max(0, remaining));
    if (!selected.length) {
      toast.error(`You can add up to ${max} ${type === "video" ? "videos" : "images"}`);
      return;
    }
    setUploading(true);
    const uploaded: ProductImage[] = [];
    for (const file of selected) {
      try {
        if (type === "image" && !["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
          toast.error(`${file.name}: only JPG, PNG and WEBP are allowed`);
          continue;
        }
        if (type === "video" && !["video/mp4", "video/quicktime"].includes(file.type)) {
          toast.error(`${file.name}: only MP4 and MOV are allowed`);
          continue;
        }
        if (type === "image" && file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds the 10MB limit`);
          continue;
        }
        if (type === "video" && file.size > 30 * 1024 * 1024) {
          toast.error(`${file.name} exceeds the 30MB limit`);
          continue;
        }
        let uploadFile = file;
        if (type === "image") {
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not prepare image for upload");
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          const compressed = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
              "image/webp",
              0.84
            );
          });
          uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp",
          });
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsDataURL(uploadFile);
        });
        const media = await uploadProductMedia(dataUrl, type);
        uploaded.push({ url: media.url, public_id: media.public_id, alt: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    }
    if (uploaded.length) onChange([...items, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const move = (index: number, direction: number) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addUrl = () => {
    const value = url.trim();
    if (!value) return;
    if (items.length >= max) {
      toast.error(`You can add up to ${max} items`);
      return;
    }
    onChange([...items, { url: value }]);
    setUrl("");
  };

  return (
    <div className={`ap-media ${compact ? "ap-media--compact" : ""}`}>
      <div className="ap-media__head">
        <strong>{label}</strong>
        <span>{items.length}/{max}</span>
      </div>
      <div className="ap-media__grid">
        {items.map((item, index) => (
          <div className="ap-media__item" key={`${item.url}-${index}`}>
            {type === "video" ? (
              <video src={item.url} muted preload="metadata" />
            ) : (
              <img src={item.url} alt={`${label} ${index + 1}`} />
            )}
            {index === 0 && type === "image" && <span className="ap-media__primary">Primary</span>}
            {type === "image" && (
              <input
                className="ap-media__alt"
                value={item.alt || ""}
                onChange={(event) =>
                  onChange(items.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, alt: event.target.value } : entry
                  ))
                }
                placeholder="Image alt text"
                aria-label={`Alt text for image ${index + 1}`}
              />
            )}
            <div className="ap-media__actions">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${label} ${index + 1} earlier`}>←</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${label} ${index + 1} later`}>→</button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remove ${label} ${index + 1}`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {items.length < max && (
          <button
            type="button"
            className={`ap-media__add ${dragging ? "is-dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void addFiles(event.dataTransfer.files);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        )}
      </div>
      {!compact && (
        <div className="ap-media__url">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={`Paste a ${type === "video" ? "video" : "image"} URL`}
          />
          <button type="button" onClick={addUrl} disabled={!url.trim() || items.length >= max}>
            Add URL
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={type === "video" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp"}
        onChange={(event) => addFiles(event.target.files)}
      />
    </div>
  );
}

interface ProductEditorProps {
  open: boolean;
  product: ProductItem | null;
  categories: CategoryItem[];
  brands: BrandItem[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, any>) => Promise<void>;
}

export default function ProductEditor({
  open,
  product,
  categories,
  brands,
  saving,
  onClose,
  onSave,
}: ProductEditorProps) {
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const initialForm = useRef<ProductFormState>(emptyProductForm());
  const errorRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateColors, setGenerateColors] = useState("Black:#111111\nWhite:#FFFFFF");
  const [generateSizes, setGenerateSizes] = useState("S, M, L");

  useEffect(() => {
    if (!open) return;
    const nextForm = product ? productToForm(product) : emptyProductForm();
    initialForm.current = nextForm;
    setForm(nextForm);
    setError(null);
    setGenerateOpen(false);
  }, [open, product]);

  useEffect(() => {
    if (open) nameInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [error]);

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  const closeEditor = useCallback(() => {
    if (saving) return;
    if (hasUnsavedChanges && !window.confirm("Discard your unsaved product changes?")) return;
    onClose();
  }, [saving, hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, saving, closeEditor]);

  const mainCategories = useMemo(() => categories.filter((category) => !category.parentCategory), [categories]);
  const selectedCategory = mainCategories.find(
    (category) => category.id === form.category || category.name === form.category
  );
  const subcategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.parentCategory &&
          selectedCategory &&
          category.parentCategory === selectedCategory.id
      ),
    [categories, selectedCategory]
  );

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const updateVariant = (index: number, patch: Partial<ProductFormVariant>) =>
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant
      ),
    }));

  const updateVariantSize = (variantIndex: number, sizeIndex: number, patch: Partial<ProductFormSize>) =>
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              sizes: variant.sizes.map((size, entryIndex) =>
                entryIndex === sizeIndex ? { ...size, ...patch } : size
              ),
            }
          : variant
      ),
    }));

  const updateRootSize = (index: number, patch: Partial<ProductFormSize>) =>
    setForm((current) => ({
      ...current,
      sizes: current.sizes.map((size, sizeIndex) => (sizeIndex === index ? { ...size, ...patch } : size)),
    }));

  const addVariant = () => {
    const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
    const number = form.variants.length + 1;
    const name = `Colour ${number}`;
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          variantName: name,
          colorName: name,
          colorHex: "#D4D4D8",
          sku: makeSku(baseSku, name),
          barcode: "",
          attributes: "",
          price: current.price,
          mrp: current.mrp,
          stock: "0",
          isActive: true,
          isDefault: current.variants.length === 0,
          images: [],
          sizes: [],
        },
      ],
    }));
  };

  const addVariantSize = (variantIndex: number) => {
    const variant = form.variants[variantIndex];
    const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
    updateVariant(variantIndex, {
      sizes: [
        ...variant.sizes,
        {
          size: "",
          sku: makeSku(baseSku, variant.colorName || variant.variantName),
          barcode: "",
          price: variant.price || form.price,
          comparePrice: variant.mrp || form.mrp,
          stock: "0",
          status: "Active",
        },
      ],
    });
  };

  const addRootSize = () => {
    const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
    setForm((current) => ({
      ...current,
      sizes: [
        ...current.sizes,
        {
          size: "",
          sku: makeSku(baseSku, "SIZE"),
          barcode: "",
          price: current.price,
          comparePrice: current.mrp,
          stock: "0",
          status: "Active",
        },
      ],
    }));
  };

  const generateVariants = () => {
    const colors = String(generateColors || "")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, hex] = entry.split(":");
        return { name: name.trim(), hex: (hex || "").trim() || "#D4D4D8" };
      })
      .filter((color) => color.name);
    const sizes = splitList(generateSizes);

    if (!colors.length) {
      toast.error("Add at least one colour name");
      return;
    }

    const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
    const existing = new Set(form.variants.map((variant) => variant.variantName.toLowerCase()));
    const created = colors
      .filter((color) => !existing.has(color.name.toLowerCase()))
      .map((color, index) => ({
        variantName: color.name,
        colorName: color.name,
        colorHex: color.hex,
        sku: makeSku(baseSku, color.name),
        barcode: "",
        attributes: "",
        price: form.price,
        mrp: form.mrp,
        stock: "0",
        isActive: true,
        isDefault: form.variants.length === 0 && index === 0,
        images: [],
        sizes: sizes.map((size) => ({
          size,
          sku: makeSku(baseSku, color.name, size),
          barcode: "",
          price: form.price,
          comparePrice: form.mrp,
          stock: "0",
          status: "Active" as const,
        })),
      }));

    if (!created.length) {
      toast.error("Those colour variants already exist");
      return;
    }

    setForm((current) => ({ ...current, variants: [...current.variants, ...created] }));
    setGenerateOpen(false);
    toast.success(`${created.length} variant${created.length === 1 ? "" : "s"} generated`);
  };

  const generateSkus = () => {
    const baseSku = form.sku.trim() || skuToken(form.name) || "DLV";
    const used = new Set<string>();
    const nextSku = (...parts: string[]) => {
      let candidate = makeSku(baseSku, ...parts);
      let counter = 2;
      while (used.has(candidate.toUpperCase())) {
        candidate = `${makeSku(baseSku, ...parts)}-${counter++}`;
      }
      used.add(candidate.toUpperCase());
      return candidate;
    };

    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => ({
        ...variant,
        sku: variant.sku.trim() || nextSku(variant.colorName || variant.variantName),
        sizes: variant.sizes.map((size) => ({
          ...size,
          sku:
            size.sku.trim() ||
            nextSku(variant.colorName || variant.variantName, size.size || "size"),
        })),
      })),
      sizes: current.sizes.map((size) => ({
        ...size,
        sku: size.sku.trim() || nextSku(size.size || "size"),
      })),
    }));
    toast.success("Missing SKUs generated");
  };

  const handleSave = async () => {
    const message = validateProductForm(form);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    try {
      await onSave(formToPayload(form, categories));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the product");
    }
  };

  const discount = useMemo(() => {
    const price = numberOrUndefined(form.price) ?? 0;
    const mrp = numberOrUndefined(form.mrp) ?? 0;
    return mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  }, [form.price, form.mrp]);

  if (!open) return null;

  return createPortal(
    <div className="ap-editor-backdrop" role="dialog" aria-modal="true" aria-label={product ? "Edit product" : "Create product"}>
      <div className="ap-editor">
        <header className="ap-editor__head">
          <div>
            <p className="eyebrow">{product ? "Product editor" : "New catalogue entry"}</p>
            <h2>{product ? product.name : "Create a product"}</h2>
            <span>
              {form.variants.length
                ? `${form.variants.length} variant${form.variants.length === 1 ? "" : "s"} · `
                : ""}
              {form.status === "published" ? "Publishing live" : form.status === "scheduled" ? "Scheduled" : "Draft"}
            </span>
          </div>
          <button type="button" className="ap-editor__close" onClick={closeEditor} disabled={saving} aria-label="Close editor">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="ap-editor__body">
          <nav className="ap-editor__nav" aria-label="Product editor sections">
            {[
              ["basics", "Basics"],
              ["media", "Media"],
              ["pricing", "Pricing"],
              ["inventory", "Inventory"],
              ["variants", "Variants"],
              ["shipping", "Shipping"],
              ["seo", "SEO"],
              ["publishing", "Publishing"],
            ].map(([section, label], index) => (
              <button
                type="button"
                key={section}
                onClick={() =>
                  document.getElementById(`ap-section-${section}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {label}
              </button>
            ))}
          </nav>
          {error && (
            <div ref={errorRef} className="ap-form-error" role="alert" tabIndex={-1}>
              {error}
            </div>
          )}

          <section className="ap-section" id="ap-section-basics">
            <div className="ap-section__head">
              <span>01</span>
              <div>
                <h3>Basic information</h3>
                <p>The name, identity and story of this product.</p>
              </div>
            </div>
            <div className="ap-grid ap-grid--2">
              <label className="ap-field ap-field--wide">
                <span>Product name *</span>
                <input
                  ref={nameInputRef}
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    if (!form.slug || form.slug === slugify(form.name)) update("slug", slugify(name));
                    update("name", name);
                  }}
                  placeholder="e.g. AeroBook Pro 14"
                  maxLength={200}
                />
              </label>
              <label className="ap-field">
                <span>Product slug</span>
                <input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="auto-generated from the name" />
              </label>
              <label className="ap-field">
                <span>SKU</span>
                <input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="Auto-generated if left blank" />
                <button type="button" className="ap-link-button" onClick={() => update("sku", makeSku(form.name || "DLV", Date.now().toString(36).slice(-4)))}>
                  Generate SKU
                </button>
              </label>
              <label className="ap-field">
                <span>Barcode</span>
                <input value={form.barcode} onChange={(event) => update("barcode", event.target.value)} placeholder="EAN / UPC" />
              </label>
              <label className="ap-field">
                <span>Brand</span>
                <input
                  value={form.brandName}
                  onChange={(event) => update("brandName", event.target.value)}
                  placeholder="Choose or type a brand"
                  list="ap-brand-options"
                />
                <datalist id="ap-brand-options">
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.name} />
                  ))}
                </datalist>
              </label>
              <label className="ap-field">
                <span>Manufacturer</span>
                <input value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} placeholder="Manufacturer name" />
              </label>
              <label className="ap-field">
                <span>Model number</span>
                <input value={form.modelNumber} onChange={(event) => update("modelNumber", event.target.value)} placeholder="Model / MPN" />
              </label>
              <label className="ap-field">
                <span>Category</span>
                <select
                  value={selectedCategory?.id || form.category}
                  onChange={(event) => {
                    update("category", event.target.value);
                    update("subcategory", "");
                  }}
                >
                  <option value="">Select a category</option>
                  {mainCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                  {form.category && !selectedCategory && (
                    <option value={form.category}>{form.category}</option>
                  )}
                </select>
                <small className="ap-field__hint">
                  {mainCategories.length
                    ? "Categories are managed in the Categories section."
                    : "No categories found. Add one in the Categories section first."}
                </small>
              </label>
              <label className="ap-field">
                <span>Subcategory</span>
                <select
                  value={subcategories.some((category) => category.id === form.subcategory)
                    ? form.subcategory
                    : subcategories.find((category) => category.name === form.subcategory)?.id || form.subcategory}
                  onChange={(event) => update("subcategory", event.target.value)}
                  disabled={!selectedCategory}
                >
                  <option value="">{selectedCategory ? "None" : "Choose a category first"}</option>
                  {subcategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                  {form.subcategory && !subcategories.some((category) => category.name === form.subcategory) && (
                    <option value={form.subcategory}>{form.subcategory}</option>
                  )}
                </select>
              </label>
              <label className="ap-field">
                <span>Product type</span>
                <input value={form.productType} onChange={(event) => update("productType", event.target.value)} placeholder="e.g. Laptop, T-shirt" />
              </label>
            </div>
            <label className="ap-field">
              <span>Short description</span>
              <input value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} maxLength={220} placeholder="A concise line shown on product cards" />
            </label>
            <label className="ap-field">
              <span>Full description *</span>
              <textarea rows={5} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the product, its materials, fit and experience" />
            </label>
            <div className="ap-grid ap-grid--2">
              <label className="ap-field">
                <span>Tags <em>comma separated</em></span>
                <input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="wireless, premium, travel" />
              </label>
              <label className="ap-field">
                <span>Collections <em>comma separated</em></span>
                <input value={form.collections} onChange={(event) => update("collections", event.target.value)} placeholder="Summer edit, Essentials" />
              </label>
              <label className="ap-field">
                <span>Highlights <em>one per line</em></span>
                <textarea rows={3} value={form.highlights} onChange={(event) => update("highlights", event.target.value)} placeholder={"Active noise cancellation\n40-hour battery"} />
              </label>
            </div>

            <div className="ap-repeater">
              <div className="ap-repeater__head">
                <div>
                  <strong>Specifications</strong>
                  <span>Structured label / value pairs shown in the specs table.</span>
                </div>
                <button
                  type="button"
                  onClick={() => update("specifications", [...form.specifications, { label: "", value: "" }])}
                >
                  + Add row
                </button>
              </div>
              {form.specifications.map((spec, index) => (
                <div className="ap-repeater__row" key={index}>
                  <input
                    value={spec.label}
                    placeholder="Label (e.g. Material)"
                    onChange={(event) =>
                      update(
                        "specifications",
                        form.specifications.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, label: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <input
                    value={spec.value}
                    placeholder="Value (e.g. Cotton)"
                    onChange={(event) =>
                      update(
                        "specifications",
                        form.specifications.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => update("specifications", form.specifications.filter((_, entryIndex) => entryIndex !== index))}
                    aria-label="Remove specification"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="ap-section" id="ap-section-media">
            <div className="ap-section__head">
              <span>02</span>
              <div>
                <h3>Media</h3>
                <p>Multiple images, video and an optional 360° sequence.</p>
              </div>
            </div>
            <MediaPicker label="Product images" items={form.images} onChange={(items) => update("images", items)} max={8} />
            <MediaPicker label="Product videos" items={form.videos} onChange={(items) => update("videos", items)} type="video" max={3} />
            <div className="ap-grid ap-grid--2">
              <label className="ap-field ap-check">
                <input type="checkbox" checked={form.has360View} onChange={(event) => update("has360View", event.target.checked)} />
                <span>Enable 360° product view</span>
              </label>
              <label className="ap-field">
                <span>360° frame URLs <em>one per line</em></span>
                <textarea rows={3} value={form.images360} onChange={(event) => update("images360", event.target.value)} placeholder="https://…/frame-01.jpg" />
              </label>
            </div>
          </section>

          <section className="ap-section" id="ap-section-pricing">
            <div className="ap-section__head">
              <span>03</span>
              <div>
                <h3>Pricing</h3>
                <p>Selling price, compare-at price, tax and sale windows.</p>
              </div>
            </div>
            <div className="ap-grid ap-grid--4">
              <label className="ap-field">
                <span>Sale / selling price (₹) *</span>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0" />
              </label>
              <label className="ap-field">
                <span>Compare-at / MRP (₹)</span>
                <input type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => update("mrp", event.target.value)} placeholder="0" />
              </label>
              <label className="ap-field">
                <span>Cost price (₹)</span>
                <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => update("costPrice", event.target.value)} placeholder="Optional" />
              </label>
              <label className="ap-field">
                <span>Tax rate (%)</span>
                <input type="number" min="0" step="0.01" value={form.taxRate} onChange={(event) => update("taxRate", event.target.value)} placeholder="0" />
              </label>
            </div>
            <div className="ap-grid ap-grid--3">
              <label className="ap-field ap-check">
                <input type="checkbox" checked={form.taxIncluded} onChange={(event) => update("taxIncluded", event.target.checked)} />
                <span>Prices include tax</span>
              </label>
              <label className="ap-field">
                <span>Sale starts</span>
                <input type="datetime-local" value={form.saleStartDate} onChange={(event) => update("saleStartDate", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Sale ends</span>
                <input type="datetime-local" value={form.saleEndDate} onChange={(event) => update("saleEndDate", event.target.value)} />
              </label>
            </div>
            {discount > 0 && (
              <div className="ap-price-preview">
                <span>Customer sees</span>
                <strong>{formatPrice(numberOrUndefined(form.price) ?? 0)}</strong>
                <del>{formatPrice(numberOrUndefined(form.mrp) ?? 0)}</del>
                <em>{discount}% off</em>
              </div>
            )}
            {numberOrUndefined(form.costPrice) !== undefined && numberOrUndefined(form.price) !== undefined && (
              <p className="ap-hint">
                Estimated profit margin:{" "}
                {numberOrUndefined(form.price)! > 0
                  ? `${Math.round(((numberOrUndefined(form.price)! - numberOrUndefined(form.costPrice)!) / numberOrUndefined(form.price)!) * 100)}%`
                  : "0%"}
              </p>
            )}
          </section>

          <section className="ap-section" id="ap-section-inventory">
            <div className="ap-section__head">
              <span>04</span>
              <div>
                <h3>Inventory</h3>
                <p>Stock levels, thresholds and warehouse placement.</p>
              </div>
            </div>
            <div className="ap-grid ap-grid--4">
              <label className="ap-field">
                <span>Stock quantity</span>
                <input type="number" min="0" value={form.stock} onChange={(event) => update("stock", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Low-stock threshold</span>
                <input type="number" min="0" value={form.minStockLevel} onChange={(event) => update("minStockLevel", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Maximum purchase quantity</span>
                <input type="number" min="1" value={form.maxPurchaseQuantity} onChange={(event) => update("maxPurchaseQuantity", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Warehouse location</span>
                <input value={form.warehouseLocation} onChange={(event) => update("warehouseLocation", event.target.value)} placeholder="e.g. WH-01" />
              </label>
            </div>
            <div className="ap-grid ap-grid--3">
              <label className="ap-field ap-check">
                <input type="checkbox" checked={form.freeShipping} onChange={(event) => update("freeShipping", event.target.checked)} />
                <span>Free shipping</span>
              </label>
              <label className="ap-field">
                <span>Shelf / bin</span>
                <input value={form.shelfBin} onChange={(event) => update("shelfBin", event.target.value)} placeholder="A-12" />
              </label>
              <label className="ap-field ap-check">
                <input type="checkbox" checked={form.manageStock} onChange={(event) => update("manageStock", event.target.checked)} />
                <span>Track stock for this product</span>
              </label>
              <label className="ap-field ap-check">
                <input type="checkbox" checked={form.allowBackorder} onChange={(event) => update("allowBackorder", event.target.checked)} />
                <span>Allow backorders</span>
              </label>
            </div>
          </section>

          <section className="ap-section" id="ap-section-variants">
            <div className="ap-section__head">
              <span>05</span>
              <div>
                <h3>Variants & sizes</h3>
                <p>Colours, storage, shades or any other option. Each combination can carry its own SKU, price and stock.</p>
              </div>
            </div>

            <div className="ap-variant-toolbar">
              <button type="button" onClick={addVariant}>+ Add colour / option</button>
              <button type="button" onClick={() => setGenerateOpen(true)}>Bulk generate</button>
              <button type="button" onClick={generateSkus}>Generate missing SKUs</button>
            </div>

            {form.variants.length === 0 ? (
              <>
                <p className="ap-hint">
                  No variants yet. Add colour variants above, or use the size table below for products sold in a single colour.
                </p>
                <div className="ap-sizes">
                  <div className="ap-sizes__head">
                    <strong>Root sizes</strong>
                    <button type="button" onClick={addRootSize}>+ Add size</button>
                  </div>
                  {form.sizes.length === 0 ? (
                    <p className="ap-hint">No sizes — this product is sold as a single option.</p>
                  ) : (
                    <div className="ap-size-table">
                      <div className="ap-size-table__head">
                        <span>Size</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span>Status</span><span />
                      </div>
                      {form.sizes.map((size, index) => (
                        <div className="ap-size-table__row" key={index}>
                          <input value={size.size} onChange={(event) => updateRootSize(index, { size: event.target.value })} placeholder="S" />
                          <input value={size.sku} onChange={(event) => updateRootSize(index, { sku: event.target.value })} placeholder="SKU" />
                          <input type="number" min="0" value={size.price} onChange={(event) => updateRootSize(index, { price: event.target.value })} />
                          <input type="number" min="0" value={size.comparePrice} onChange={(event) => updateRootSize(index, { comparePrice: event.target.value })} />
                          <input type="number" min="0" value={size.stock} onChange={(event) => updateRootSize(index, { stock: event.target.value })} />
                          <select value={size.status} onChange={(event) => updateRootSize(index, { status: event.target.value as "Active" | "Draft" })}>
                            <option value="Active">Active</option>
                            <option value="Draft">Draft</option>
                          </select>
                          <button type="button" onClick={() => update("sizes", form.sizes.filter((_, entryIndex) => entryIndex !== index))} aria-label="Remove size">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="ap-variants">
                {form.variants.map((variant, variantIndex) => (
                  <article className="ap-variant" key={variantIndex}>
                    <header className="ap-variant__head">
                      <span className="ap-variant__dot" style={{ backgroundColor: variant.colorHex || "#d4d4d8" }} />
                      <div className="ap-variant__title">
                        <input
                          value={variant.variantName}
                          onChange={(event) =>
                            updateVariant(variantIndex, {
                              variantName: event.target.value,
                              colorName: event.target.value,
                            })
                          }
                          placeholder="Variant name"
                        />
                        <span>{variant.sizes.length} size{variant.sizes.length === 1 ? "" : "s"}</span>
                      </div>
                      <label className="ap-variant__color">
                        <input
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(variant.colorHex) ? variant.colorHex : "#d4d4d8"}
                          onChange={(event) => updateVariant(variantIndex, { colorHex: event.target.value.toUpperCase() })}
                        />
                        <input
                          value={variant.colorHex}
                          onChange={(event) => updateVariant(variantIndex, { colorHex: event.target.value })}
                          placeholder="#111111"
                        />
                      </label>
                      <label className="ap-check ap-check--inline">
                        <input
                          type="checkbox"
                          checked={variant.isActive}
                          onChange={(event) => updateVariant(variantIndex, { isActive: event.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                      <button
                        type="button"
                        className="ap-variant__remove"
                        onClick={() =>
                          update(
                            "variants",
                            form.variants.filter((_, entryIndex) => entryIndex !== variantIndex)
                          )
                        }
                        aria-label="Remove variant"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                        </svg>
                      </button>
                    </header>

                    <div className="ap-variant__grid">
                      <label className="ap-field">
                        <span>Variant SKU</span>
                        <input value={variant.sku} onChange={(event) => updateVariant(variantIndex, { sku: event.target.value })} placeholder="Auto-generated" />
                      </label>
                      <label className="ap-field">
                        <span>Variant barcode</span>
                        <input value={variant.barcode} onChange={(event) => updateVariant(variantIndex, { barcode: event.target.value })} placeholder="EAN / UPC" />
                      </label>
                      <label className="ap-field">
                        <span>Sale price (₹)</span>
                        <input type="number" min="0" value={variant.price} onChange={(event) => updateVariant(variantIndex, { price: event.target.value })} placeholder={form.price} />
                      </label>
                      <label className="ap-field">
                        <span>MRP (₹)</span>
                        <input type="number" min="0" value={variant.mrp} onChange={(event) => updateVariant(variantIndex, { mrp: event.target.value })} placeholder={form.mrp} />
                      </label>
                      <label className="ap-field">
                        <span>Stock (no sizes)</span>
                        <input type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(variantIndex, { stock: event.target.value })} />
                      </label>
                    </div>
                    <label className="ap-field">
                      <span>Custom attributes <em>one key=value per line</em></span>
                      <textarea
                        rows={2}
                        value={variant.attributes}
                        onChange={(event) => updateVariant(variantIndex, { attributes: event.target.value })}
                        placeholder={"Material=Cotton\nCapacity=256 GB"}
                      />
                    </label>

                    <details className="ap-variant__details">
                      <summary>Variant images ({variant.images.length})</summary>
                      <MediaPicker
                        label="Images for this variant"
                        items={variant.images}
                        onChange={(items) => updateVariant(variantIndex, { images: items })}
                        max={4}
                        compact
                      />
                    </details>

                    <div className="ap-sizes">
                      <div className="ap-sizes__head">
                        <strong>Sizes</strong>
                        <button type="button" onClick={() => addVariantSize(variantIndex)}>+ Add size</button>
                      </div>
                      {variant.sizes.length === 0 ? (
                        <p className="ap-hint">No sizes — this colour is sold as a single option.</p>
                      ) : (
                        <div className="ap-size-table">
                          <div className="ap-size-table__head">
                            <span>Size</span><span>SKU</span><span>Price</span><span>MRP</span><span>Stock</span><span>Status</span><span />
                          </div>
                          {variant.sizes.map((size, sizeIndex) => (
                            <div className="ap-size-table__row" key={sizeIndex}>
                              <input value={size.size} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { size: event.target.value })} placeholder="S" />
                              <input value={size.sku} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { sku: event.target.value })} placeholder="SKU" />
                              <input type="number" min="0" value={size.price} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { price: event.target.value })} />
                              <input type="number" min="0" value={size.comparePrice} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { comparePrice: event.target.value })} />
                              <input type="number" min="0" value={size.stock} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { stock: event.target.value })} />
                              <select value={size.status} onChange={(event) => updateVariantSize(variantIndex, sizeIndex, { status: event.target.value as "Active" | "Draft" })}>
                                <option value="Active">Active</option>
                                <option value="Draft">Draft</option>
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  updateVariant(variantIndex, {
                                    sizes: variant.sizes.filter((_, entryIndex) => entryIndex !== sizeIndex),
                                  })
                                }
                                aria-label="Remove size"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ap-section" id="ap-section-shipping">
            <div className="ap-section__head">
              <span>06</span>
              <div>
                <h3>Shipping, returns & warranty</h3>
                <p>Delivery expectations and after-sales commitments.</p>
              </div>
            </div>
            <div className="ap-grid ap-grid--4">
              <label className="ap-field">
                <span>Weight (g)</span>
                <input type="number" min="0" value={form.weight} onChange={(event) => update("weight", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Length (cm)</span>
                <input type="number" min="0" value={form.length} onChange={(event) => update("length", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Width (cm)</span>
                <input type="number" min="0" value={form.width} onChange={(event) => update("width", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Height (cm)</span>
                <input type="number" min="0" value={form.height} onChange={(event) => update("height", event.target.value)} />
              </label>
            </div>
            <div className="ap-grid ap-grid--3">
              <label className="ap-field">
                <span>Shipping class</span>
                <input value={form.shippingClass} onChange={(event) => update("shippingClass", event.target.value)} placeholder="Standard" />
              </label>
              <label className="ap-field">
                <span>Estimated delivery (days)</span>
                <input type="number" min="0" value={form.estimatedDeliveryDays} onChange={(event) => update("estimatedDeliveryDays", event.target.value)} />
              </label>
              <label className="ap-field">
                <span>Delivery information</span>
                <input value={form.deliveryInfo} onChange={(event) => update("deliveryInfo", event.target.value)} placeholder="e.g. Ships in 24 hours" />
              </label>
            </div>
            <div className="ap-grid ap-grid--3">
              <label className="ap-field">
                <span>Return policy</span>
                <textarea rows={2} value={form.returnPolicy} onChange={(event) => update("returnPolicy", event.target.value)} placeholder="7-day easy returns" />
              </label>
              <label className="ap-field">
                <span>Warranty</span>
                <textarea rows={2} value={form.warranty} onChange={(event) => update("warranty", event.target.value)} placeholder="1-year manufacturer warranty" />
              </label>
              <label className="ap-field">
                <span>Care instructions</span>
                <textarea rows={2} value={form.careInstructions} onChange={(event) => update("careInstructions", event.target.value)} placeholder="Machine wash cold" />
              </label>
            </div>
          </section>

          <section className="ap-section" id="ap-section-seo">
            <div className="ap-section__head">
              <span>07</span>
              <div>
                <h3>SEO</h3>
                <p>How this product appears in search engines and social previews.</p>
              </div>
            </div>
            <div className="ap-grid ap-grid--2">
              <label className="ap-field">
                <span>SEO title</span>
                <input value={form.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} maxLength={70} placeholder={form.name || "Product title"} />
              </label>
              <label className="ap-field">
                <span>Keywords <em>comma separated</em></span>
                <input value={form.seoKeywords} onChange={(event) => update("seoKeywords", event.target.value)} placeholder="premium, wireless, delivix" />
              </label>
            </div>
            <label className="ap-field">
              <span>Meta description</span>
              <textarea rows={2} value={form.seoDescription} onChange={(event) => update("seoDescription", event.target.value)} maxLength={170} placeholder="A concise search result description" />
            </label>
            <label className="ap-field">
              <span>Social share image URL</span>
              <input value={form.seoSocialImage} onChange={(event) => update("seoSocialImage", event.target.value)} placeholder="https://…" />
            </label>
            <label className="ap-field">
              <span>Canonical URL</span>
              <input type="url" value={form.seoCanonicalUrl} onChange={(event) => update("seoCanonicalUrl", event.target.value)} placeholder="https://example.com/products/product-slug" />
            </label>
            <div className="ap-seo-preview">
              <span>{window.location.origin.replace(/^https?:\/\//, "")} › shop › {form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</span>
              <strong>{form.seoTitle || form.name || "Product title"}</strong>
              <p>{form.seoDescription || form.shortDescription || form.description.slice(0, 150) || "Add a meta description to control how this product appears in search results."}</p>
            </div>
          </section>

          <section className="ap-section" id="ap-section-publishing">
            <div className="ap-section__head">
              <span>08</span>
              <div>
                <h3>Publishing & merchandising</h3>
                <p>Control visibility, scheduling and storefront badges.</p>
              </div>
            </div>
            <div className="ap-status-row">
              {(["draft", "published", "scheduled", "archived"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={form.status === status ? "is-active" : ""}
                  onClick={() => update("status", status)}
                >
                  {status === "draft" ? "Draft" : status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Archived"}
                </button>
              ))}
              <select value={form.visibility} onChange={(event) => update("visibility", event.target.value as "public" | "hidden")}>
                <option value="public">Visible in storefront</option>
                <option value="hidden">Hidden from storefront</option>
              </select>
            </div>
            {form.status === "scheduled" && (
              <label className="ap-field ap-field--half">
                <span>Publish at *</span>
                <input type="datetime-local" value={form.publishAt} onChange={(event) => update("publishAt", event.target.value)} />
              </label>
            )}
            <div className="ap-flags">
              {([
                ["isFeatured", "Featured"],
                ["isNewArrival", "New arrival"],
                ["isBestSeller", "Best seller"],
                ["isTrending", "Trending"],
              ] as const).map(([key, label]) => (
                <label className="ap-check ap-check--chip" key={key}>
                  <input type="checkbox" checked={form[key]} onChange={(event) => update(key, event.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
              <label className="ap-field ap-field--inline">
                <span>Home section</span>
                <select value={form.homeSection} onChange={(event) => update("homeSection", event.target.value)}>
                  <option value="">None</option>
                  <option value="New Arrival">New Arrival</option>
                  <option value="Best Seller">Best Seller</option>
                  <option value="Trending Product">Trending Product</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <footer className="ap-editor__foot">
          <div>
            <span>{form.name || "Untitled product"}</span>
            <small>
              {form.status === "published"
                ? "Will be visible in the storefront immediately"
                : form.status === "scheduled"
                  ? "Will publish automatically at the scheduled time"
                  : "Saved as a draft — hidden from customers"}
            </small>
          </div>
          <div>
            {error && (
              <span className="ap-editor__save-error" role="alert" aria-live="assertive">
                {error}
              </span>
            )}
            <button type="button" className="ap-btn ap-btn--ghost" onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="button" className="ap-btn ap-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : product ? "Save changes" : "Create product"}
            </button>
          </div>
        </footer>
      </div>

      {generateOpen && (
        <div className="ap-gen-backdrop" onClick={() => setGenerateOpen(false)}>
          <div className="ap-gen" onClick={(event) => event.stopPropagation()}>
            <div className="ap-gen__head">
              <div>
                <p className="eyebrow">Bulk creation</p>
                <h3>Generate variant combinations</h3>
              </div>
              <button type="button" onClick={() => setGenerateOpen(false)} aria-label="Close generator">×</button>
            </div>
            <label className="ap-field">
              <span>Colours <em>one per line, optional hex after a colon</em></span>
              <textarea rows={4} value={generateColors} onChange={(event) => setGenerateColors(event.target.value)} placeholder={"Black:#111111\nWhite:#FFFFFF"} />
            </label>
            <label className="ap-field">
              <span>Sizes <em>comma separated — leave blank for colour-only variants</em></span>
              <input value={generateSizes} onChange={(event) => setGenerateSizes(event.target.value)} placeholder="S, M, L, XL" />
            </label>
            <p className="ap-hint">
              This creates every colour × size combination with the base price, MRP and zero stock. You can adjust each row afterwards.
            </p>
            <div className="ap-gen__actions">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setGenerateOpen(false)}>Cancel</button>
              <button type="button" className="ap-btn ap-btn--primary" onClick={generateVariants}>Generate variants</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
