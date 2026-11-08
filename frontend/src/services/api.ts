import { formatReturnPolicy } from "../utils/product";

export interface ProductOption {
  size: string;
  price?: number;
  comparePrice?: number;
  stock?: number;
  sku?: string;
  status?: string;
}

export interface ProductImage {
  public_id?: string;
  alt?: string;
  url: string;
}

export interface ProductVariant {
  id?: string;
  variantName: string;
  colorName?: string;
  colorHex?: string;
  sku?: string;
  price?: number;
  mrp?: number;
  stock?: number;
  isActive?: boolean;
  isDefault?: boolean;
  attributes?: Record<string, string>;
  images?: ProductImage[];
  videos?: ProductImage[];
  sizes?: ProductOption[];
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductShipping {
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  shippingClass?: string;
  deliveryInfo?: string;
}

export interface ProductSeo {
  title?: string;
  metaDescription?: string;
  keywords?: string[];
  socialImage?: string;
}

export interface ProductItem {
  id: string | number;
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  category: string;
  categoryId?: string;
  subcategory?: string;
  subcategoryId?: string;
  brand?: string;
  brandId?: string;
  brandName?: string;
  manufacturer?: string;
  modelNumber?: string;
  price: number;
  old?: number;
  mrp?: number;
  discountPercentage?: number;
  image: string;
  hoverImage?: string;
  images?: ProductImage[];
  videos?: ProductImage[];
  badge?: string;
  description?: string;
  shortDescription?: string;
  ratings?: number;
  numOfReviews?: number;
  reviewCount?: number;
  stock?: number;
  minStockLevel?: number;
  maxPurchaseQuantity?: number;
  lowStockThreshold?: number;
  features?: string[];
  highlights?: string[];
  specifications?: ProductSpecification[];
  sizes?: ProductOption[];
  variants?: ProductVariant[];
  tags?: string[];
  collections?: string[];
  freeShipping?: boolean;
  productType?: string;
  material?: string;
  color?: string;
  taxRate?: number;
  taxIncluded?: boolean;
  hsnCode?: string;
  shipping?: ProductShipping;
  seo?: ProductSeo;
  returnPolicy?: string;
  warranty?: string;
  careInstructions?: string;
  estimatedDeliveryDays?: number;
  has360View?: boolean;
  images360?: string[];
  visibility?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  status?: string;
  manageStock?: boolean;
  allowBackorder?: boolean;
  createdAt?: string;
  updatedAt?: string;
  inStock?: boolean;
  raw?: any;
}

export interface BackendHealth {
  connected: boolean;
  database: string;
  redis?: string;
  status?: string;
  error?: string;
}

export const BACKEND_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  ""
).replace(/\/+$/, "");

export const API_BASE = `${BACKEND_URL}/api/v1`;

export function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string" && input.startsWith("/") && BACKEND_URL) {
    return `${BACKEND_URL}${input}`;
  }
  return input;
}

// Backend restarts (tsx watch, deploys) briefly refuse connections. Retry
// idempotent requests so a page that loads during that window recovers
// instead of showing empty data / proxy errors.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inFlightReads = new Map<string, Promise<Response>>();

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  isRead: boolean
): Promise<Response> {
  const maxAttempts = isRead ? 5 : 2;
  const target = resolveApiUrl(input);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await globalThis.fetch(target, init);
      if (isRead && RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(400 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const isRead = method === "GET" || method === "HEAD";
  if (!isRead || init?.signal) {
    return fetchWithRetry(input, init, isRead);
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const headerKey = Array.from(headers.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
  const requestUrl = input instanceof Request ? input.url : String(input);
  const credentials = init?.credentials || (input instanceof Request ? input.credentials : "");
  const requestKey = `${method}:${requestUrl}:${credentials}:${headerKey}`;
  let request = inFlightReads.get(requestKey);

  if (!request) {
    request = fetchWithRetry(input, init, isRead);
    inFlightReads.set(requestKey, request);
  }

  try {
    return (await request).clone();
  } finally {
    if (inFlightReads.get(requestKey) === request) {
      inFlightReads.delete(requestKey);
    }
  }
}

export function normalizeProduct(p: any): ProductItem {
  const categoryName =
    typeof p.category === "object" && p.category?.name
      ? p.category.name
      : typeof p.category === "string"
        ? p.category
        : p.categoryName || "General";
  const categoryId =
    typeof p.category === "object" && p.category?._id
      ? String(p.category._id)
      : typeof p.category === "string"
        ? p.category
        : undefined;
  const subcategoryName =
    typeof p.subcategory === "object" && p.subcategory?.name
      ? p.subcategory.name
      : typeof p.subcategory === "string"
        ? p.subcategory
        : p.subcategoryName || "";
  const subcategoryId =
    typeof p.subcategory === "object" && p.subcategory?._id
      ? String(p.subcategory._id)
      : typeof p.subcategory === "string"
        ? p.subcategory
        : undefined;
  const brandName =
    typeof p.brand === "object" && p.brand?.name
      ? p.brand.name
      : p.brandName || (typeof p.brand === "string" ? p.brand : "");
  const brandId =
    typeof p.brand === "object" && p.brand?._id
      ? String(p.brand._id)
      : typeof p.brand === "string"
        ? p.brand
        : undefined;

  const images: ProductImage[] = (Array.isArray(p.images) ? p.images : [])
    .map((image: any) =>
      typeof image === "string"
        ? { url: image }
        : image?.url
          ? { public_id: image.public_id, alt: image.alt || "", url: image.url }
          : null
    )
    .filter((image: ProductImage | null): image is ProductImage => Boolean(image));

  const fallbackImage =
    p.image ||
    "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?auto=format&fit=crop&w=900&q=85";
  const imgUrl = images[0]?.url || fallbackImage;
  const hoverImage = images[1]?.url || undefined;

  const defaultVariant =
    Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants.find((variant: any) => variant.isDefault) || p.variants[0]
      : null;

  const mapOption = (entry: any): ProductOption | null => {
    if (!entry || !entry.size) return null;
    return {
      size: String(entry.size),
      price:
        entry.price === undefined || entry.price === null ? undefined : Number(entry.price) || 0,
      comparePrice:
        entry.comparePrice === undefined || entry.comparePrice === null
          ? undefined
          : Number(entry.comparePrice) || 0,
      stock: Number(entry.stock) || 0,
      sku: entry.sku ? String(entry.sku) : undefined,
      status: entry.status || "Active",
    };
  };

  const mapOptions = (entries: any): ProductOption[] =>
    (Array.isArray(entries) ? entries : [])
      .map(mapOption)
      .filter((entry): entry is ProductOption => Boolean(entry));

  const sizes = mapOptions(p.sizes).filter((entry) => entry.status !== "Draft");

  const variants: ProductVariant[] = (Array.isArray(p.variants) ? p.variants : [])
    .map((variant: any, index: number) => {
      const variantName = String(variant?.variantName || variant?.colorName || "");
      const variantSizes = mapOptions(variant?.sizes);
      const sizeStock = variantSizes.reduce((sum, size) => sum + (size.stock || 0), 0);
      return {
        id: variant?._id ? String(variant._id) : undefined,
        variantName: variantName || `Option ${index + 1}`,
        colorName: variant?.colorName ? String(variant.colorName) : variantName,
        colorHex: variant?.colorHex ? String(variant.colorHex) : undefined,
        sku: variant?.sku ? String(variant.sku) : undefined,
        price:
          variant?.price === undefined || variant?.price === null
            ? undefined
            : Number(variant.price) || 0,
        mrp:
          variant?.mrp === undefined || variant?.mrp === null
            ? undefined
            : Number(variant.mrp) || 0,
        stock: variantSizes.length ? sizeStock : Number(variant?.stock) || 0,
        isActive: variant?.isActive !== false,
        isDefault: Boolean(variant?.isDefault),
        attributes:
          variant?.attributes && typeof variant.attributes === "object"
            ? variant.attributes
            : undefined,
        images: Array.isArray(variant?.images)
          ? variant.images.filter((image: any) => image?.url).map((image: any) => ({
              public_id: image.public_id,
              alt: image.alt || "",
              url: image.url,
            }))
          : [],
        videos: Array.isArray(variant?.videos)
          ? variant.videos.filter((video: any) => video?.url).map((video: any) => ({
              public_id: video.public_id,
              url: video.url,
            }))
          : [],
        sizes: variantSizes,
      };
    })
    .filter((variant: ProductVariant) => Boolean(variant.variantName));

  const rawPrice = p.price ?? p.basePrice ?? defaultVariant?.price ?? 0;
  const rawOld = p.comparePrice ?? p.mrp ?? p.old ?? defaultVariant?.mrp;
  const price = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice) || 0;
  const old = typeof rawOld === "number" ? rawOld : parseFloat(rawOld) || undefined;
  const discountPercentage =
    Number(p.discountPercentage) > 0
      ? Number(p.discountPercentage)
      : old && old > price
        ? Math.round(((old - price) / old) * 100)
        : 0;

  let badge = p.badge;
  if (!badge) {
    if (p.homeSection === "New Arrival" || p.isNewArrival) badge = "NEW";
    else if (p.homeSection === "Best Seller" || p.isBestSeller) badge = "BESTSELLER";
    else if (p.isTrending) badge = "TRENDING";
    else if (p.isFeatured) badge = "FEATURED";
    else if (discountPercentage > 0 || p.onSale) badge = `${discountPercentage || ""}% OFF`;
  }

  const variantStock = variants
    .filter((variant) => variant.isActive !== false)
    .reduce((sum, variant) => sum + (variant.stock || 0), 0);
  const rootSizeStock = sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
  const stock =
    variants.length || sizes.length
      ? variantStock || rootSizeStock
      : p.stock !== undefined && p.stock !== null
        ? Number(p.stock) || 0
        : 0;

  return {
    id: p._id || p.id,
    name: p.name || p.title || "Untitled product",
    slug: p.slug,
    sku: p.sku,
    barcode: p.barcode,
    category: categoryName,
    categoryId,
    subcategory: subcategoryName,
    subcategoryId,
    brand: brandName,
    brandId,
    brandName,
    manufacturer: p.manufacturer || "",
    modelNumber: p.modelNumber || "",
    price,
    old,
    mrp: old,
    discountPercentage,
    image: imgUrl,
    hoverImage,
    images: images.length ? images : [{ url: imgUrl }],
    videos: Array.isArray(p.videos) ? p.videos.filter((video: any) => video?.url) : [],
    badge,
    description: p.description || p.shortDescription || "",
    shortDescription: p.shortDescription || "",
    ratings: Number(p.ratings) || 0,
    numOfReviews: Number(p.numOfReviews) || 0,
    reviewCount: Number(p.numOfReviews) || 0,
    stock,
    minStockLevel: Number(p.minStockLevel) || 5,
    lowStockThreshold: Number(p.minStockLevel) || 5,
    features: Array.isArray(p.features) ? p.features : [],
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    specifications: Array.isArray(p.specifications)
      ? p.specifications.filter((spec: any) => spec?.label && spec?.value)
      : [],
    sizes,
    variants,
    tags: Array.isArray(p.tags) ? p.tags : [],
    collections: Array.isArray(p.collections) ? p.collections : [],
    freeShipping: Boolean(p.freeShipping),
    productType: p.productType || "",
    material: p.material || "",
    color: p.color || "",
    taxRate: Number(p.taxRate) || 0,
    taxIncluded: p.taxIncluded !== false,
    hsnCode: p.hsnCode || "",
    shipping: p.shipping || {},
    seo: p.seo || {},
    returnPolicy: formatReturnPolicy(p.returnPolicy, ""),
    warranty: p.warranty || "",
    careInstructions: p.careInstructions || "",
    estimatedDeliveryDays: Number(p.estimatedDeliveryDays) || 3,
    has360View: Boolean(p.has360View),
    images360: Array.isArray(p.images360) ? p.images360 : [],
    visibility: p.visibility || "public",
    isFeatured: Boolean(p.isFeatured),
    isNewArrival: Boolean(p.isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    isTrending: Boolean(p.isTrending),
    status: p.status || "published",
    manageStock: p.manageStock !== false,
    allowBackorder: Boolean(p.allowBackorder),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    inStock: stock > 0,
    raw: p,
  };
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const res = await apiFetch("/health", {
      headers: { credentials: "omit" },
    });
    if (!res.ok) {
      // Fallback check to /api/health
      const alt = await apiFetch("/api/health");
      if (alt.ok) {
        return { connected: true, database: "connected", status: "ok" };
      }
      return { connected: false, database: "disconnected", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      connected: data.success === true,
      database: data.database || "connected",
      redis: data.redis,
      status: data.status,
    };
  } catch (err: any) {
    return {
      connected: false,
      database: "disconnected",
      error: err.message || "Cannot reach backend server",
    };
  }
}

export interface ProductQueryOptions {
  category?: string;
  keyword?: string;
  limit?: number;
  page?: number;
  brand?: string;
  subcategory?: string;
  colors?: string;
  sizes?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  trending?: boolean;
  rating?: number;
  sort?: string;
  tags?: string;
}

export async function fetchProducts(options?: ProductQueryOptions): Promise<ProductItem[]> {
  const params = new URLSearchParams();
  if (options?.category && options.category !== "All products") {
    params.set("category", options.category);
  }
  if (options?.keyword?.trim()) {
    params.set("keyword", options.keyword.trim());
  }
  if (options?.brand) params.set("brand", options.brand);
  if (options?.subcategory) params.set("subcategory", options.subcategory);
  if (options?.colors) params.set("colors", options.colors);
  if (options?.sizes) params.set("sizes", options.sizes);
  if (options?.minPrice !== undefined) params.set("minPrice", String(options.minPrice));
  if (options?.maxPrice !== undefined) params.set("maxPrice", String(options.maxPrice));
  if (options?.inStock) params.set("inStock", "true");
  if (options?.featured) params.set("featured", "true");
  if (options?.newArrival) params.set("newArrival", "true");
  if (options?.bestSeller) params.set("bestSeller", "true");
  if (options?.trending) params.set("trending", "true");
  if (options?.rating) params.set("rating", String(options.rating));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.tags) params.set("tags", options.tags);
  if (options?.page) params.set("page", String(options.page));
  // The storefront renders the full catalogue from this single request. Ask for
  // the API maximum (100) so products managed in the admin dashboard are not
  // silently cut off by the default 12-per-page pagination.
  params.set("limit", String(options?.limit ?? 100));

  const url = `${API_BASE}/products${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch products (${res.status})`);
  }

  const data = await res.json();
  const rawProducts = data.products || (data.data && data.data.products) || [];
  return rawProducts.map(normalizeProduct);
}

export interface ProductFilterOptions {
  materials: string[];
  stoneTypes: string[];
  colors: string[];
  sizes: string[];
  brands: { _id: string; name: string; slug?: string; count: number }[];
  categoryCounts: { _id: string; name: string; count: number }[];
  priceRange: { min: number; max: number };
}

export async function fetchProductFilterOptions(): Promise<ProductFilterOptions> {
  try {
    const res = await apiFetch(`${API_BASE}/products/filter-options`);
    if (!res.ok) throw new Error("Failed to load filters");
    const data = await res.json();
    return {
      materials: data.materials || [],
      stoneTypes: data.stoneTypes || [],
      colors: data.colors || [],
      sizes: data.sizes || [],
      brands: data.brands || [],
      categoryCounts: data.categoryCounts || [],
      priceRange: data.priceRange || { min: 0, max: 0 },
    };
  } catch {
    return {
      materials: [],
      stoneTypes: [],
      colors: [],
      sizes: [],
      brands: [],
      categoryCounts: [],
      priceRange: { min: 0, max: 0 },
    };
  }
}

export interface BrandItem {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logo?: { public_id?: string; url?: string } | null;
  isActive?: boolean;
}

export async function fetchBrands(adminMode = false): Promise<BrandItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/brands${adminMode ? "?all=true" : ""}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.brands || []).map((brand: any) => ({
      id: brand._id || brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logo: brand.logo?.url ? brand.logo : null,
      isActive: brand.isActive !== false,
    }));
  } catch {
    return [];
  }
}

export async function createBrand(payload: Partial<BrandItem>): Promise<BrandItem> {
  const res = await apiFetch(`${API_BASE}/admin/brands`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create brand");
  const brand = data.brand || data.data?.brand;
  return { id: brand._id, name: brand.name, slug: brand.slug, isActive: brand.isActive };
}

export async function fetchProductById(id: string | number): Promise<ProductItem | null> {
  const res = await apiFetch(`${API_BASE}/products/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data.product || (data.data && data.data.product);
  return raw ? normalizeProduct(raw) : null;
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await apiFetch(`${API_BASE}/categories`);
    if (!res.ok) return [];
    const data = await res.json();
    const categories = data.categories || [];
    return categories.map((c: any) => ({
      id: c._id || c.id,
      name: c.name,
    }));
  } catch {
    return [];
  }
}

export interface CategoryItem {
  id: string;
  name: string;
  parentCategory: string | null;
  image?: { public_id?: string; url?: string } | null;
  createdAt?: string;
}

function normalizeCategory(c: any): CategoryItem {
  // Older catalog records store the parent in `parent`; newer ones use
  // `parentCategory`. Accept both so the hierarchy is preserved.
  const parent = c.parentCategory ?? c.parent;
  return {
    id: c._id || c.id,
    name: c.name,
    parentCategory:
      parent && typeof parent === "object"
        ? parent._id || parent.id || null
        : parent || null,
    image: c.image?.url ? { public_id: c.image.public_id, url: c.image.url } : null,
    createdAt: c.createdAt,
  };
}

// Full category tree (main + subcategories) for the admin manager.
export async function fetchAllCategories(): Promise<CategoryItem[]> {
  try {
    const res = await apiFetch(`${API_BASE}/categories`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.categories || []).map(normalizeCategory);
  } catch {
    return [];
  }
}

export async function createCategory(payload: {
  name: string;
  parentCategory?: string | null;
  image?: string | null;
}): Promise<CategoryItem> {
  const body: any = { name: payload.name };
  if (payload.parentCategory) body.parentCategory = payload.parentCategory;
  if (payload.image) body.image = payload.image;

  const res = await apiFetch(`${API_BASE}/admin/categories`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create category");
  }
  return normalizeCategory(data.category);
}

export async function updateCategory(
  id: string,
  payload: { name?: string; parentCategory?: string | null; image?: string | null }
): Promise<CategoryItem> {
  const body: any = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.parentCategory !== undefined) body.parentCategory = payload.parentCategory || null;
  if (payload.image !== undefined) body.image = payload.image || null;

  const res = await apiFetch(`${API_BASE}/admin/categories/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update category");
  }
  return normalizeCategory(data.category);
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/admin/categories/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function subscribeNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await apiFetch(`${API_BASE}/newsletter/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || "Failed to subscribe" };
    }
    return { success: true, message: data.message || "Successfully subscribed to DELIVIX newsletter!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error subscribing" };
  }
}

export interface CloudinaryStatus {
  configured: boolean;
  folder: string;
  provider?: string;
}

export async function checkCloudinaryStatus(): Promise<CloudinaryStatus> {
  try {
    const res = await apiFetch(`${API_BASE}/upload/status`);
    if (res.ok) {
      const data = await res.json();
      return {
        configured: data.configured ?? false,
        folder: data.folder || "delivix/products",
        provider: data.provider || "Cloudinary",
      };
    }
  } catch {
    // Graceful fallback
  }
  return { configured: false, folder: "delivix/products", provider: "Cloudinary" };
}

export async function uploadProductImage(
  fileOrUrl: string,
  folder = "delivix/products"
): Promise<{ url: string; public_id: string; cloudinary: boolean }> {
  const res = await apiFetch(`${API_BASE}/upload/product-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: fileOrUrl, folder, type: "image" }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to upload image to Cloudinary");
  }
  return {
    url: data.media.url,
    public_id: data.media.public_id,
    cloudinary: data.cloudinary ?? true,
  };
}

export interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  mobileImage?: string;
  link?: string;
  buttonText?: string;
  badgeText?: string;
  position?: string;
  displayOrder?: number;
  isActive: boolean;
  createdAt?: string;
}

// The API has shipped both `image` and `imageUrl` shapes over time (older
// seeded documents only have `imageUrl`). Normalize once here so every
// component can rely on `image` being a string.
function normalizeBanner(b: any): BannerItem {
  const image = b.imageUrl || b.image || "";
  return {
    id: b._id || b.id,
    title: b.title || "Untitled banner",
    subtitle: b.subtitle || "",
    image,
    mobileImage: b.mobileImageUrl || b.mobileImage || "",
    link: b.link || "/shop",
    buttonText: b.buttonText || "",
    badgeText: b.badgeText || "",
    position: b.position || "HERO",
    displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : 0,
    isActive: b.isActive ?? true,
    createdAt: b.createdAt,
  };
}

// Send both field names so the API works whether it expects `image` or
// `imageUrl` (the model accepts either).
function toBannerPayload(banner: Partial<BannerItem>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (banner.title !== undefined) payload.title = banner.title;
  if (banner.subtitle !== undefined) payload.subtitle = banner.subtitle;
  if (banner.image !== undefined) {
    payload.image = banner.image;
    payload.imageUrl = banner.image;
  }
  if (banner.mobileImage !== undefined) {
    payload.mobileImage = banner.mobileImage;
    payload.mobileImageUrl = banner.mobileImage;
  }
  if (banner.link !== undefined) payload.link = banner.link;
  if (banner.buttonText !== undefined) payload.buttonText = banner.buttonText;
  if (banner.badgeText !== undefined) payload.badgeText = banner.badgeText;
  if (banner.position !== undefined) payload.position = banner.position;
  if (banner.displayOrder !== undefined) payload.displayOrder = banner.displayOrder;
  if (banner.isActive !== undefined) payload.isActive = banner.isActive;
  return payload;
}

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem("delivix_admin_token");
  } catch {
    return null;
  }
}

export function getStoredAdminUser(): any | null {
  try {
    const raw = localStorage.getItem("delivix_admin_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAdmin(token: string, user: any): void {
  try {
    localStorage.setItem("delivix_admin_token", token);
    localStorage.setItem("delivix_admin_user", JSON.stringify(user));
  } catch {}
}

export function clearStoredAdmin(): void {
  try {
    localStorage.removeItem("delivix_admin_token");
    localStorage.removeItem("delivix_admin_user");
  } catch {}
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── ZeptoMail OTP & Admin Auth ──────────────────────────────────────────────
export async function sendZeptoOtp(
  email: string
): Promise<{ success: boolean; message: string; devOtp?: string }> {
  try {
    const res = await apiFetch(`${API_BASE}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to send OTP via ZeptoMail");
    }
    return {
      success: true,
      message: data.message || `OTP sent to ${email} via ZeptoMail`,
      devOtp: data.data?.devOtp || data.devOtp,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to contact ZeptoMail service" };
  }
}

export async function registerAccount(
  name: string,
  email: string,
  password: string,
  phoneNumber?: string
): Promise<{ success: boolean; message: string; userId?: string }> {
  try {
    const res = await apiFetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phoneNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail =
        Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors.map((e: any) => e.message).join(", ")
          : data.message;
      throw new Error(detail || "Registration failed");
    }
    return {
      success: true,
      message: data.message || "Registration successful. Please check your email for the OTP.",
      userId: data.userId || data.data?.userId,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Registration failed" };
  }
}

export async function verifyZeptoOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; message: string; token?: string; user?: any }> {
  try {
    const res = await apiFetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Invalid or expired OTP");
    }
    const token = data.data?.token || data.token;
    const user = data.data?.user || data.user;
    if (token) {
      setStoredAdmin(token, user);
    }
    return {
      success: true,
      message: data.message || "Email verified & Login successful",
      token,
      user,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "OTP verification failed" };
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string; user?: any; requiresVerification?: boolean }> {
  try {
    const res = await apiFetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.requiresVerification) {
      // Auto trigger ZeptoMail OTP
      sendZeptoOtp(email).catch(() => {});
      return {
        success: false,
        requiresVerification: true,
        message: data.message || "Account requires OTP verification. An OTP has been sent to your email via ZeptoMail.",
      };
    }
    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }
    const token = data.data?.token || data.token;
    const user = data.data?.user || data.user;
    if (token) {
      setStoredAdmin(token, user);
    }
    return {
      success: true,
      message: "Login successful",
      token,
      user,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Login failed" };
  }
}

// ── Current User (Account) ──────────────────────────────────────────────────
export async function fetchMyProfile(): Promise<any | null> {
  const res = await apiFetch(`${API_BASE}/me`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to load profile");
  }
  const data = await res.json();
  return data.user || data.data?.user || null;
}

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Processing"
  | "Packed"
  | "Shipped"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled"
  | "Return Requested"
  | "Return Approved"
  | "Return Rejected"
  | "Returned"
  | "Refund Pending"
  | "Refunded";

export type PaymentStatus =
  | "Pending"
  | "Paid"
  | "Failed"
  | "Refund Pending"
  | "Partially Refunded"
  | "Refunded"
  | "Cancelled";

export interface OrderItemRecord {
  _id: string;
  product: string | { _id: string; name?: string; images?: { url: string }[] };
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  variantName?: string;
  sku?: string;
  variantSku?: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  returnActive?: any;
}

export interface OrderAddressRecord {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface OrderStatusHistoryRecord {
  _id?: string;
  status: OrderStatus | string;
  note?: string;
  source?: string;
  changedBy?: string;
  changedByName?: string;
  at: string;
}

export interface PaymentTransactionRecord {
  _id?: string;
  provider: string;
  transactionId?: string;
  providerOrderId?: string;
  providerSessionId?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  failureReason?: string;
  verifiedAt?: string;
  createdAt?: string;
}

export interface OrderRefundRecord {
  _id?: string;
  amount: number;
  status: "Pending" | "Completed" | "Failed";
  provider?: string;
  refundId?: string;
  reference?: string;
  reason?: string;
  processedByName?: string;
  processedAt?: string;
  createdAt?: string;
}

export interface OrderRecord {
  _id: string;
  orderNumber?: string;
  user?: any;
  customerInfo?: { name?: string; email?: string; phone?: string };
  shippingInfo?: {
    fullName?: string;
    email?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    landmark?: string;
    city?: string;
    state?: string;
    phoneNo?: string;
    altPhoneNo?: string;
    zipCode?: string;
    country?: string;
  };
  shippingAddress?: OrderAddressRecord;
  billingAddress?: OrderAddressRecord;
  orderItems: OrderItemRecord[];
  paymentMethod: string;
  paymentStatus: PaymentStatus | string;
  paymentInfo?: { id?: string; status?: string };
  paymentTransactions?: PaymentTransactionRecord[];
  currency?: string;
  itemsPrice: number;
  taxAmount?: number;
  shippingAmount?: number;
  packagingAmount?: number;
  discountAmount?: number;
  shippingMethod?: string;
  packagingOption?: string;
  coupon?: {
    couponId?: string;
    code?: string;
    name?: string;
    discountType?: CouponDiscountType;
    discountValue?: number;
    maxDiscount?: number;
    minOrderValue?: number;
    discountAmount?: number;
    shippingDiscount?: number;
  };
  totalAmount: number;
  orderStatus: OrderStatus | string;
  statusHistory?: OrderStatusHistoryRecord[];
  deliveredAt?: string;
  paidAt?: string;
  trackingId?: string;
  trackingUrl?: string;
  awbNumber?: string;
  courierName?: string;
  shipmentDate?: string;
  estimatedDeliveryDate?: string;
  shipment?: any;
  cancellation?: {
    requestedAt?: string;
    cancelledAt?: string;
    reason?: string;
    cancelledByName?: string;
    refundStatus?: string;
  };
  returnInfo?: {
    status?: string;
    reason?: string;
    requestedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    returnedAt?: string;
    refundedAt?: string;
    returnIds?: string[];
  };
  refunds?: OrderRefundRecord[];
  createdAt: string;
  updatedAt?: string;
}

export interface OrderPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface OrderQuoteItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  variantName?: string;
  sku?: string;
  subtotal: number;
  availableStock: number;
}

export interface OrderQuoteCoupon {
  couponId?: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;
  minQuantity?: number;
  discountAmount: number;
  shippingDiscount: number;
  totalDiscount?: number;
  eligibleSubtotal: number;
  breakdown?: any;
}

export interface OrderQuote {
  items: OrderQuoteItem[];
  amounts: {
    itemsPrice: number;
    taxAmount: number;
    shippingAmount: number;
    shippingDiscount?: number;
    payableShipping?: number;
    packagingAmount: number;
    discountAmount: number;
    couponDiscount?: number;
    totalAmount: number;
    currency: string;
  };
  shipping: {
    method: string;
    packagingOption: string;
    details: string;
    packagingName: string;
    isFreeShipping: boolean;
  };
  coupon?: OrderQuoteCoupon | null;
}

export interface PaymentConfig {
  cod: boolean;
  razorpay: boolean;
  razorpayKeyId: string | null;
  stripe: boolean;
  stripeWebhook: boolean;
  razorpayWebhook: boolean;
}

export interface AdminOrderStats {
  totalOrders: number;
  totalRevenue: number;
  statusCounts: Record<string, number>;
  paymentCounts: Record<string, number>;
  methodCounts: Record<string, number>;
  grouped: {
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    returned: number;
    refunded: number;
    refundPending: number;
  };
}

export interface AdminOrderDetailResponse {
  order: OrderRecord;
  inventoryTransactions: any[];
  notifications: any[];
  allowedNextStatuses: OrderStatus[];
  refundableAmount: number;
}

async function parseApiJson(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      Array.isArray(data.errors) && data.errors.length
        ? data.errors.map((error: any) => error.message).filter(Boolean).join(", ")
        : "";
    throw new Error(detail || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function orderQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function fetchMyOrders(options?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<OrderRecord[]> {
  const result = await fetchMyOrdersPage(options);
  return result.orders;
}

export async function fetchMyOrdersPage(options?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{ orders: OrderRecord[]; pagination: OrderPagination }> {
  const res = await apiFetch(
    `${API_BASE}/me/orders${orderQuery({
      page: options?.page,
      limit: options?.limit,
      status: options?.status,
      search: options?.search,
    })}`,
    { headers: getAuthHeaders(), cache: "no-store" }
  );
  const data = await parseApiJson(res);
  return {
    orders: data.orders || data.data?.orders || [],
    pagination: data.pagination || {
      page: 1,
      limit: (data.orders || []).length,
      total: (data.orders || []).length,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export async function fetchOrderDetails(
  orderId: string
): Promise<{ order: OrderRecord; allowedNextStatuses?: OrderStatus[]; refundableAmount?: number }> {
  const res = await apiFetch(`${API_BASE}/orders/${orderId}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  return parseApiJson(res);
}

export async function quoteOrder(payload: {
  items: { productId: string; quantity: number; size?: string | null; variantName?: string | null }[];
  shippingInfo: Record<string, any>;
  shippingMethod?: string;
  packagingOption?: string;
  currency?: string;
  couponCode?: string;
}): Promise<OrderQuote> {
  const res = await apiFetch(`${API_BASE}/orders/quote`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return data.quote;
}

export async function createOrder(
  payload: {
    items: { productId: string; quantity: number; size?: string | null; variantName?: string | null }[];
    shippingInfo: Record<string, any>;
    billingAddress?: Record<string, any>;
    shippingMethod?: string;
    packagingOption?: string;
    currency?: string;
    couponCode?: string;
    paymentMethod: "COD" | "Razorpay" | "Stripe";
  },
  idempotencyKey: string
): Promise<{ order: OrderRecord; idempotent: boolean }> {
  const res = await apiFetch(`${API_BASE}/orders/new`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return { order: data.order, idempotent: Boolean(data.idempotent) };
}

export async function cancelMyOrder(
  orderId: string,
  reason: string
): Promise<OrderRecord> {
  const res = await apiFetch(`${API_BASE}/orders/${orderId}/cancel`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await parseApiJson(res);
  return data.order;
}

export async function submitOrderReturn(
  orderId: string,
  payload: {
    items?: {
      orderItemId: string;
      quantity: number;
      reason: string;
      description: string;
      returnType?: string;
      media?: any[];
    }[];
    orderItemId?: string;
    quantity?: number;
    reason?: string;
    description?: string;
    returnType?: string;
    media?: any[];
  }
): Promise<{ order: OrderRecord; returns: any[] }> {
  const res = await apiFetch(`${API_BASE}/orders/${orderId}/returns`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function fetchOrderInvoice(orderId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/orders/${orderId}/invoice`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseApiJson(res);
  return data.invoice;
}

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const res = await apiFetch(`${API_BASE}/payments/config`, { cache: "no-store" });
  const data = await parseApiJson(res);
  return data.config;
}

export async function createRazorpayPayment(orderId: string): Promise<{
  order: any;
  keyId: string;
  amount: number;
  currency: string;
}> {
  const res = await apiFetch(`${API_BASE}/payments/razorpay/create-order`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await parseApiJson(res);
  return data;
}

export async function verifyRazorpayPayment(payload: {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<OrderRecord> {
  const res = await apiFetch(`${API_BASE}/payments/razorpay/verify`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return data.order;
}

export async function createStripePayment(orderId: string): Promise<{
  sessionId: string;
  url: string;
}> {
  const res = await apiFetch(`${API_BASE}/payments/stripe/create-checkout-session`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await parseApiJson(res);
  return { sessionId: data.sessionId, url: data.url };
}

export async function verifyStripePayment(payload: {
  orderId: string;
  sessionId: string;
}): Promise<OrderRecord> {
  const res = await apiFetch(`${API_BASE}/payments/stripe/verify`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return data.order;
}

// ── Admin order management ─────────────────────────────────────────────────
export async function fetchAdminOrderStats(): Promise<AdminOrderStats> {
  const res = await apiFetch(`${API_BASE}/admin/orders/stats`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  return parseApiJson(res);
}

export async function fetchAdminOrders(options?: {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
}): Promise<{ orders: OrderRecord[]; pagination: OrderPagination }> {
  const res = await apiFetch(
    `${API_BASE}/admin/orders${orderQuery({
      page: options?.page,
      limit: options?.limit,
      status: options?.status,
      paymentStatus: options?.paymentStatus,
      paymentMethod: options?.paymentMethod,
      shippingMethod: options?.shippingMethod,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      search: options?.search,
      sort: options?.sort,
    })}`,
    { headers: getAuthHeaders(), cache: "no-store" }
  );
  const data = await parseApiJson(res);
  return {
    orders: data.orders || [],
    pagination: data.pagination || {
      page: 1,
      limit: (data.orders || []).length,
      total: (data.orders || []).length,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

export async function fetchAdminOrderDetails(orderId: string): Promise<AdminOrderDetailResponse> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  return parseApiJson(res);
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: { status: OrderStatus; note?: string; codCollected?: boolean }
): Promise<OrderRecord> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return data.order;
}

export async function bulkUpdateAdminOrderStatus(payload: {
  orderIds: string[];
  status: OrderStatus;
  note?: string;
  codCollected?: boolean;
}): Promise<{ updated: any[]; failed: any[] }> {
  const res = await apiFetch(`${API_BASE}/admin/orders/bulk-status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return { updated: data.updated || [], failed: data.failed || [] };
}

export async function updateAdminOrderShipment(
  orderId: string,
  payload: {
    courierName?: string;
    trackingNumber?: string;
    awbNumber?: string;
    trackingUrl?: string;
    shippingMethod?: string;
    shipmentDate?: string;
    estimatedDeliveryDate?: string;
    status?: string;
    note?: string;
    remarks?: string;
  }
): Promise<{ order: OrderRecord; shipment: any }> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}/shipment`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function refundAdminOrder(
  orderId: string,
  payload: { amount?: number; reason?: string; reference?: string; confirmManual?: boolean }
): Promise<OrderRecord> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}/refund`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  return data.order;
}

export async function retryAdminOrderNotification(
  orderId: string,
  event: string
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}/notifications/retry`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ event }),
  });
  const data = await parseApiJson(res);
  return data.notification;
}

export async function deleteAdminOrder(orderId: string): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/admin/orders/${orderId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await parseApiJson(res);
  return true;
}

export async function exportAdminOrders(options?: {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
}): Promise<Blob> {
  const res = await apiFetch(
    `${API_BASE}/admin/orders/export${orderQuery({
      status: options?.status,
      paymentStatus: options?.paymentStatus,
      paymentMethod: options?.paymentMethod,
      shippingMethod: options?.shippingMethod,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      search: options?.search,
      sort: options?.sort,
    })}`,
    { headers: getAuthHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to export orders");
  }
  return res.blob();
}

export async function fetchMyAddresses(): Promise<any[]> {
  const res = await apiFetch(`${API_BASE}/me/addresses`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to load addresses");
  }
  const data = await res.json();
  return data.addresses || data.data?.addresses || [];
}

export interface UserProfileUpdatePayload {
  name?: string;
  phoneNumber?: string;
  phone?: string;
  altPhoneNumber?: string;
  address?: {
    street?: string;
    landmark?: string;
    village?: string;
    city?: string;
    state?: string;
    pinCode?: string;
  };
}

export async function updateMyProfile(payload: UserProfileUpdatePayload): Promise<any> {
  const res = await apiFetch(`${API_BASE}/me/update`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to update profile");
  }
  return data.data?.user || data.user;
}

export interface AddressItem {
  _id?: string;
  title?: string;
  fullName: string;
  phoneNo: string;
  phone?: string;
  altPhoneNo?: string;
  street?: string;
  landmark?: string;
  village?: string;
  address?: string;
  city: string;
  state?: string;
  zipCode: string;
  pinCode?: string;
  country?: string;
  isDefault?: boolean;
}

export async function createAddress(payload: AddressItem): Promise<AddressItem[]> {
  const res = await apiFetch(`${API_BASE}/me/addresses`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to add address");
  }
  return data.addresses || data.data?.addresses || [];
}

export async function updateAddress(id: string, payload: Partial<AddressItem>): Promise<AddressItem[]> {
  const res = await apiFetch(`${API_BASE}/me/addresses/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to update address");
  }
  return data.addresses || data.data?.addresses || [];
}

export async function deleteAddress(id: string): Promise<AddressItem[]> {
  const res = await apiFetch(`${API_BASE}/me/addresses/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to delete address");
  }
  return data.addresses || data.data?.addresses || [];
}

export async function setDefaultAddress(id: string): Promise<AddressItem[]> {
  const res = await apiFetch(`${API_BASE}/me/addresses/${id}/default`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to set default address");
  }
  return data.addresses || data.data?.addresses || [];
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  pendingOrders: number;
  deliveredOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStock: number;
}

export interface DashboardData {
  stats: DashboardStats;
  statusBreakdown: Record<string, number>;
  salesTrend: { date: string; revenue: number; orders: number }[];
  bestSellers: { _id: string; name: string; image?: string; unitsSold: number; revenue: number }[];
  recentOrders: any[];
  latestCustomers: any[];
  lowStockProducts: any[];
  lowStockThreshold: number;
  trendDays: number;
}

export async function fetchDashboardStats(days = 14): Promise<DashboardData> {
  const res = await apiFetch(`${API_BASE}/admin/dashboard/stats?days=${days}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load dashboard stats (${res.status})`);
  }
  return {
    stats: data.stats,
    statusBreakdown: data.statusBreakdown || {},
    salesTrend: data.salesTrend || [],
    bestSellers: data.bestSellers || [],
    recentOrders: data.recentOrders || [],
    latestCustomers: data.latestCustomers || [],
    lowStockProducts: data.lowStockProducts || [],
    lowStockThreshold: data.lowStockThreshold ?? 5,
    trendDays: data.trendDays ?? days,
  };
}

// ── Product CRUD ─────────────────────────────────────────────────────────────
export interface AdminProductQuery {
  keyword?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  status?: string;
  stockStatus?: string;
  featured?: boolean;
  colors?: string;
  sizes?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface AdminProductStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  scheduledProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  featuredProducts: number;
  totalVariants: number;
  hiddenProducts: number;
}

export interface AdminProductsResult {
  products: ProductItem[];
  totalProducts: number;
  page: number;
  perPage: number;
  totalPages: number;
  stats: AdminProductStats;
}

const EMPTY_PRODUCT_STATS: AdminProductStats = {
  totalProducts: 0,
  activeProducts: 0,
  draftProducts: 0,
  scheduledProducts: 0,
  outOfStockProducts: 0,
  lowStockProducts: 0,
  featuredProducts: 0,
  totalVariants: 0,
  hiddenProducts: 0,
};

export async function fetchAdminProductPage(
  query: AdminProductQuery = {}
): Promise<AdminProductsResult> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    if (typeof value === "boolean") {
      if (value) params.set(key, "true");
      return;
    }
    params.set(key, String(value));
  });
  if (!params.has("limit")) params.set("limit", "20");

  const res = await apiFetch(`${API_BASE}/admin/products?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load products (${res.status})`);
  }

  return {
    products: (data.products || []).map(normalizeProduct),
    totalProducts: data.totalProducts ?? 0,
    page: data.page ?? 1,
    perPage: data.perPage ?? 20,
    totalPages: data.totalPages ?? 1,
    stats: { ...EMPTY_PRODUCT_STATS, ...(data.stats || {}) },
  };
}

export async function fetchAdminProducts(): Promise<ProductItem[]> {
  try {
    const result = await fetchAdminProductPage({ limit: 100 });
    return result.products;
  } catch {
    return fetchProducts();
  }
}

export async function fetchAdminProductById(id: string | number): Promise<ProductItem | null> {
  const res = await apiFetch(`${API_BASE}/admin/products/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data.product || data.data?.product;
  return raw ? normalizeProduct(raw) : null;
}

export async function createProduct(payload: Record<string, any>): Promise<ProductItem> {
  const res = await apiFetch(`${API_BASE}/admin/products`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to create product");
  }
  const raw = data.product || data.data?.product;
  return normalizeProduct(raw);
}

export async function updateProduct(
  id: string | number,
  payload: Record<string, any>
): Promise<ProductItem> {
  const res = await apiFetch(`${API_BASE}/admin/products/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to update product");
  }
  const raw = data.product || data.data?.product;
  return normalizeProduct(raw);
}

export async function deleteProduct(id: string | number): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/admin/products/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function duplicateProduct(id: string | number): Promise<ProductItem> {
  const res = await apiFetch(`${API_BASE}/admin/products/${id}/duplicate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to duplicate product");
  return normalizeProduct(data.product || data.data?.product);
}

export async function bulkUpdateProducts(
  ids: (string | number)[],
  action: "delete" | "publish" | "draft" | "feature" | "unfeature" | "hide" | "show"
): Promise<{ matched: number; modified: number }> {
  const res = await apiFetch(`${API_BASE}/admin/products/bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ids: ids.map(String), action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Bulk action failed");
  return { matched: data.matched ?? 0, modified: data.modified ?? 0 };
}

export async function updateProductStatus(
  id: string | number,
  status: "published" | "draft" | "scheduled"
): Promise<ProductItem> {
  return updateProduct(id, { status });
}

export async function toggleProductFeatured(
  id: string | number,
  isFeatured: boolean
): Promise<ProductItem> {
  return updateProduct(id, { isFeatured });
}

export async function exportProducts(
  query: AdminProductQuery,
  format: "csv" | "xlsx"
): Promise<Blob> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    if (typeof value === "boolean") {
      if (value) params.set(key, "true");
      return;
    }
    params.set(key, String(value));
  });
  params.set("format", format);

  const res = await apiFetch(`${API_BASE}/admin/products/export?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to export products");
  }
  return res.blob();
}

export async function importProducts(
  rows: Record<string, any>[]
): Promise<{ created: { id: string; name: string }[]; failed: { row: number; name: string; reason: string }[]; total: number }> {
  const res = await apiFetch(`${API_BASE}/admin/products/import`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rows }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to import products");
  return {
    created: data.created || [],
    failed: data.failed || [],
    total: data.total || rows.length,
  };
}

export async function uploadProductMedia(
  file: string,
  type: "image" | "video" = "image",
  folder = "delivix/products"
): Promise<{ url: string; public_id: string; cloudinary: boolean }> {
  const res = await apiFetch(`${API_BASE}/upload/product-image`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ file, folder, type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to upload media");
  return {
    url: data.media?.url,
    public_id: data.media?.public_id,
    cloudinary: data.cloudinary ?? true,
  };
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export interface ReviewItem {
  _id: string;
  product?: any;
  user?: { _id?: string; name?: string; email?: string; avatar?: any };
  rating: number;
  title?: string;
  comment: string;
  images?: ProductImage[];
  videos?: ProductImage[];
  status: "Pending" | "Approved" | "Rejected";
  isVerifiedPurchase?: boolean;
  helpfulCount?: number;
  reportsCount?: number;
  isFeatured?: boolean;
  adminReply?: { comment?: string; repliedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalRatings: number;
  totalReviews: number;
  distribution: { stars: number; count: number; percentage: number }[];
  featuredReviews?: ReviewItem[];
}

export async function fetchProductReviews(
  productId: string | number,
  options: { page?: number; limit?: number; rating?: number; sort?: string; hasPhotos?: boolean; hasVideos?: boolean; isVerified?: boolean; keyword?: string } = {}
): Promise<{ reviews: ReviewItem[]; totalReviews: number; page: number; limit: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.rating) params.set("rating", String(options.rating));
  if (options.sort) params.set("sort", options.sort);
  if (options.hasPhotos) params.set("hasPhotos", "true");
  if (options.hasVideos) params.set("hasVideos", "true");
  if (options.isVerified) params.set("isVerified", "true");
  if (options.keyword) params.set("keyword", options.keyword);

  const res = await apiFetch(
    `${API_BASE}/reviews/product/${productId}${params.toString() ? `?${params.toString()}` : ""}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to load reviews");
  return {
    reviews: data.reviews || [],
    totalReviews: data.totalReviews ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? 10,
    totalPages: data.totalPages ?? 1,
  };
}

export async function fetchProductReviewSummary(
  productId: string | number
): Promise<ReviewSummary> {
  const res = await apiFetch(`${API_BASE}/reviews/product/${productId}/summary`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to load review summary");
  return (
    data.summary || {
      averageRating: 0,
      totalRatings: 0,
      totalReviews: 0,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
    }
  );
}

export async function checkReviewEligibility(
  productId: string | number
): Promise<{ eligible: boolean; reason?: string; message?: string; orderId?: string }> {
  const res = await apiFetch(`${API_BASE}/reviews/check-eligibility?productId=${productId}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not verify review eligibility");
  return { ...data, message: data.message };
}

export async function submitProductReview(payload: {
  productId: string | number;
  rating: number;
  title?: string;
  comment: string;
  images?: ProductImage[];
  videos?: ProductImage[];
}): Promise<ReviewItem> {
  const res = await apiFetch(`${API_BASE}/reviews`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to submit review");
  return data.review || data.data?.review;
}

export async function uploadReviewMedia(
  file: string,
  type: "image" | "video" = "image"
): Promise<ProductImage> {
  const res = await apiFetch(`${API_BASE}/reviews/upload-media`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ file, type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to upload review media");
  return data.media;
}

export async function toggleReviewHelpful(
  reviewId: string
): Promise<{ voted: boolean; helpfulCount: number }> {
  const res = await apiFetch(`${API_BASE}/reviews/${reviewId}/helpful`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not register your vote");
  return { voted: data.voted, helpfulCount: data.helpfulCount };
}

export async function reportReview(reviewId: string, reason: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/reviews/${reviewId}/report`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not report review");
}

export interface AdminReviewQuery {
  status?: string;
  rating?: number;
  product?: string;
  reported?: boolean;
  featured?: boolean;
  keyword?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface AdminReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  featured: number;
  reported: number;
  averageRating: number;
}

export async function fetchAdminReviews(
  query: AdminReviewQuery = {}
): Promise<{ reviews: ReviewItem[]; totalReviews: number; page: number; limit: number; totalPages: number; stats: AdminReviewStats }> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    if (typeof value === "boolean") {
      if (value) params.set(key, "true");
      return;
    }
    params.set(key, String(value));
  });
  if (!params.has("limit")) params.set("limit", "20");

  const res = await apiFetch(`${API_BASE}/admin/reviews?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to load reviews");
  return {
    reviews: data.reviews || [],
    totalReviews: data.totalReviews ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
    totalPages: data.totalPages ?? 1,
    stats: data.stats || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      featured: 0,
      reported: 0,
      averageRating: 0,
    },
  };
}

export async function fetchAdminReviewStats(): Promise<AdminReviewStats> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/stats`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to load review stats");
  return data.stats;
}

export async function updateReview(
  reviewId: string,
  payload: Partial<Pick<ReviewItem, "rating" | "title" | "comment" | "status" | "isFeatured">>
): Promise<ReviewItem> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/${reviewId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to update review");
  return data.review;
}

export async function updateReviewStatus(
  reviewId: string,
  status: "Pending" | "Approved" | "Rejected"
): Promise<ReviewItem> {
  return updateReview(reviewId, { status });
}

export async function replyToReview(reviewId: string, comment: string): Promise<ReviewItem> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/${reviewId}/reply`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ comment }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to save reply");
  return data.review;
}

export async function deleteReview(reviewId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/${reviewId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to delete review");
}

export async function bulkReviewAction(
  ids: string[],
  action: "approve" | "reject" | "pending" | "feature" | "unfeature" | "delete"
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ids, action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Bulk review action failed");
}

export async function removeReviewMedia(
  reviewId: string,
  public_id: string,
  type: "image" | "video"
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/reviews/${reviewId}/media`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    body: JSON.stringify({ public_id, type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Failed to delete review media");
}

// ── Banner CRUD ──────────────────────────────────────────────────────────────
export async function fetchBanners(adminMode = true): Promise<BannerItem[]> {
  try {
    const endpoint = adminMode ? `${API_BASE}/admin/banners` : `${API_BASE}/banners`;
    const res = await apiFetch(endpoint, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      // Fallback check
      const fallbackRes = await apiFetch(`${API_BASE}/banners?all=true`);
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        return (fbData.banners || []).map(normalizeBanner);
      }
      return [];
    }
    const data = await res.json();
    return (data.banners || []).map(normalizeBanner);
  } catch {
    return [];
  }
}

export async function createBanner(banner: Partial<BannerItem>): Promise<BannerItem> {
  const res = await apiFetch(`${API_BASE}/admin/banner`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(toBannerPayload(banner)),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create banner");
  }
  return normalizeBanner(data.banner);
}

export async function updateBanner(
  id: string,
  banner: Partial<BannerItem>
): Promise<BannerItem> {
  const res = await apiFetch(`${API_BASE}/admin/banner/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(toBannerPayload(banner)),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update banner");
  }
  return normalizeBanner(data.banner);
}

export async function deleteBanner(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/admin/banner/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Customer Management ───────────────────────────────────────────────────

export type CustomerAccountStatus = "active" | "inactive" | "suspended" | "blocked";

export interface CustomerStats {
  totalRegistered: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  customersWithCompletedOrders: number;
  customersWithPendingOrders: number;
  blockedCustomers: number;
  inactiveCustomers: number;
  totalRevenue: number;
  averageOrderValue: number;
  highValueThreshold: number;
}

export interface CustomerAdminNote {
  _id: string;
  note: string;
  addedBy?: string;
  addedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerStatusHistoryEntry {
  _id?: string;
  status: CustomerAccountStatus;
  reason?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
}

export interface CustomerRecord {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  altPhoneNumber?: string;
  avatar?: { url?: string; public_id?: string };
  status: CustomerAccountStatus;
  role: string;
  isVerified: boolean;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSpent: number;
  lastOrderDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string | null;
  addresses?: AddressItem[];
  adminNotes?: CustomerAdminNote[];
  statusHistory?: CustomerStatusHistoryEntry[];
}

export interface CustomerPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CustomersListResponse {
  customers: CustomerRecord[];
  pagination: CustomerPagination;
  highValueThreshold?: number;
}

export interface CustomerPurchaseMetrics {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: string | null;
}

export interface CustomerDetailResponse {
  customer: CustomerRecord;
  metrics: CustomerPurchaseMetrics;
  orders: OrderRecord[];
  addresses: AddressItem[];
  adminNotes: CustomerAdminNote[];
  statusHistory: CustomerStatusHistoryEntry[];
}

export interface CustomerQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  segment?: string;
  sort?: string;
  dateFrom?: string;
  dateTo?: string;
  orderCount?: string;
  minSpent?: number | string;
  maxSpent?: number | string;
}

function customerQuery(options?: CustomerQueryOptions): string {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status && options.status !== "All") params.set("status", options.status);
  if (options.segment && options.segment !== "All") params.set("segment", options.segment);
  if (options.sort) params.set("sort", options.sort);
  if (options.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options.dateTo) params.set("dateTo", options.dateTo);
  if (options.orderCount && options.orderCount !== "All") params.set("orderCount", options.orderCount);
  if (options.minSpent !== undefined && options.minSpent !== "") params.set("minSpent", String(options.minSpent));
  if (options.maxSpent !== undefined && options.maxSpent !== "") params.set("maxSpent", String(options.maxSpent));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAdminCustomerStats(): Promise<CustomerStats> {
  const res = await apiFetch(`${API_BASE}/admin/customers/stats`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch customer statistics");
  }
  return data.stats || data;
}

export async function fetchAdminCustomers(
  options?: CustomerQueryOptions
): Promise<CustomersListResponse> {
  const url = `${API_BASE}/admin/customers${customerQuery(options)}`;
  const res = await apiFetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch customer list");
  }
  return {
    customers: data.customers || [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 1, hasNext: false, hasPrev: false },
    highValueThreshold: data.highValueThreshold,
  };
}

export async function fetchAdminCustomerDetails(
  customerId: string
): Promise<CustomerDetailResponse> {
  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch customer details");
  }
  return {
    customer: data.customer,
    metrics: data.metrics || {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      lastOrderDate: null,
    },
    orders: data.orders || [],
    addresses: data.addresses || [],
    adminNotes: data.adminNotes || [],
    statusHistory: data.statusHistory || [],
  };
}

export async function updateAdminCustomer(
  customerId: string,
  payload: {
    name?: string;
    phoneNumber?: string | null;
    altPhoneNumber?: string | null;
    isVerified?: boolean;
    status?: CustomerAccountStatus;
    reason?: string;
  }
): Promise<CustomerDetailResponse> {
  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update customer");
  }
  return data;
}

export async function updateAdminCustomerStatus(
  customerId: string,
  status: CustomerAccountStatus,
  reason?: string
): Promise<{ success: boolean; message: string; status: CustomerAccountStatus }> {
  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}/status`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update customer status");
  }
  return {
    success: data.success,
    message: data.message,
    status: data.status,
  };
}

export async function addAdminCustomerNote(
  customerId: string,
  note: string
): Promise<CustomerAdminNote> {
  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}/notes`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to add admin note");
  }
  return data.note;
}

export async function deleteAdminCustomerNote(
  customerId: string,
  noteId: string
): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}/notes/${noteId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to delete admin note");
  }
  return true;
}

export async function exportAdminCustomers(
  options?: CustomerQueryOptions
): Promise<Blob> {
  const url = `${API_BASE}/admin/customers/export${customerQuery(options)}`;
  const res = await apiFetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to export customer records");
  }
  return res.blob();
}

export async function fetchAdminCustomerOrders(
  customerId: string,
  options?: { page?: number; limit?: number; status?: string }
): Promise<{ orders: OrderRecord[]; pagination: CustomerPagination }> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.status && options.status !== "All") params.set("status", options.status);
  const qs = params.toString();

  const res = await apiFetch(`${API_BASE}/admin/customers/${customerId}/orders${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch customer orders");
  }
  return {
    orders: data.orders || [],
    pagination: data.pagination || { page: 1, limit: 10, total: 0, pages: 1, hasNext: false, hasPrev: false },
  };
}

// ── Coupons & Discounts ────────────────────────────────────────────────

export type CouponDiscountType = "percentage" | "fixed" | "free_shipping";

export type CouponStatus = "active" | "disabled" | "scheduled" | "expired" | "exhausted" | "archived";

export interface CouponRecord {
  _id: string;
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;
  minQuantity: number;
  startDate: string;
  expiryDate: string;
  usageLimit: number | null;
  usageCount: number;
  pendingCount?: number;
  availableUses?: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  shippingMethods?: ("standard" | "express")[];
  combinable: boolean;
  eligibleCategories: string[];
  eligibleProducts: string[];
  excludedCategories: string[];
  excludedProducts: string[];
  eligibleCustomers: string[];
  isActive: boolean;
  isArchived: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: CouponStatus;
}

export interface CouponListResponse {
  coupons: CouponRecord[];
  pagination: CouponPagination;
}

export interface CouponPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CouponCreatePayload {
  code?: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderValue?: number;
  minQuantity?: number;
  startDate: string;
  expiryDate: string;
  usageLimit?: number | null;
  perCustomerLimit?: number;
  firstOrderOnly?: boolean;
  shippingMethods?: ("standard" | "express")[];
  combinable?: boolean;
  eligibleCategories?: string[];
  eligibleProducts?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  eligibleCustomers?: string[];
  isActive?: boolean;
}

export interface CouponUpdatePayload extends Partial<CouponCreatePayload> {}

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: {
    id: string;
    code: string;
    name: string;
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscount: number;
    minOrderValue: number;
    minQuantity?: number;
    shippingMethods?: ("standard" | "express")[];
  };
  discountAmount?: number;
  eligibleSubtotal?: number;
  shippingDiscount?: number;
  totalDiscount?: number;
  breakdown?: any;
}

export interface CouponAnalyticsSummary {
  totalRedemptions: number;
  uniqueCustomers: number;
  totalDiscountGranted: number;
  itemDiscountGranted?: number;
  shippingDiscountGranted?: number;
  grossOrderValue: number;
  netRevenue: number;
  refundedAmount?: number;
  eligibleRevenue?: number;
  averageOrderValue: number;
  totalOrders?: number;
  totalCoupons?: number;
  activeCoupons?: number;
  scheduledCoupons?: number;
  expiredCoupons?: number;
  exhaustedCoupons?: number;
  pendingReservations?: number;
}

export interface CouponAnalyticsRow {
  couponId?: string;
  code: string;
  name?: string;
  discountType?: CouponDiscountType;
  status?: CouponStatus;
  startDate?: string;
  expiryDate?: string;
  usageLimit?: number | null;
  usageCount?: number;
  pendingCount?: number;
  remaining?: number;
  pctUsed?: number;
  totalRedemptions: number;
  totalDiscount: number;
  itemDiscount?: number;
  shippingDiscount?: number;
  uniqueCustomers: number;
  grossOrderValue: number;
  netRevenue: number;
  averageOrderValue: number;
}

export interface CouponAnalyticsResponse {
  summary: CouponAnalyticsSummary;
  mostUsed: CouponAnalyticsRow[];
  usageOverTime: { date: string; redemptions: number; discount: number; netRevenue: number }[];
  nearingLimits: CouponAnalyticsRow[];
  expiredUnused: any[];
  generatedAt?: string;
  range?: { dateFrom: string | null; dateTo: string | null };
}

export interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  scheduledCoupons: number;
  expiredCoupons: number;
  exhaustedCoupons: number;
  successfulRedemptions: number;
  totalDiscountGranted: number;
  pendingReservations: number;
  totalOrdersWithCoupons: number;
  grossOrderValue: number;
  netRevenue: number;
  averageOrderValue: number;
}

function couponQuery(options?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  discountType?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}): string {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status && options.status !== "All") params.set("status", options.status);
  if (options.discountType && options.discountType !== "All") params.set("discountType", options.discountType);
  if (options.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options.dateTo) params.set("dateTo", options.dateTo);
  if (options.sort) params.set("sort", options.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAdminCoupons(
  options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    discountType?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }
): Promise<CouponListResponse> {
  const res = await apiFetch(`${API_BASE}/admin/coupons${couponQuery(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch coupons");
  }
  return {
    coupons: (data.coupons || []).map((c: any) => ({
      ...c,
      id: c._id || c.id,
    })),
    pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 1, hasNext: false, hasPrev: false },
  };
}

export async function fetchAdminCoupon(couponId: string): Promise<CouponRecord> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch coupon");
  }
  const c = data.coupon || data;
  return { ...c, id: c._id || c.id };
}

export async function createCoupon(payload: CouponCreatePayload): Promise<CouponRecord> {
  const res = await apiFetch(`${API_BASE}/admin/coupons`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create coupon");
  }
  const c = data.coupon || data;
  return { ...c, id: c._id || c.id };
}

export async function updateCoupon(
  couponId: string,
  payload: CouponUpdatePayload
): Promise<CouponRecord> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update coupon");
  }
  const c = data.coupon || data;
  return { ...c, id: c._id || c.id };
}

export async function setCouponActive(
  couponId: string,
  isActive: boolean
): Promise<CouponRecord> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}/active`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update coupon status");
  }
  const c = data.coupon || data;
  return { ...c, id: c._id || c.id };
}

export async function archiveCoupon(couponId: string): Promise<{ action: string; reason?: string; coupon: CouponRecord }> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}/archive`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to archive coupon");
  }
  const c = data.coupon || data;
  return { action: data.action, reason: data.reason, coupon: { ...c, id: c._id || c.id } };
}

export async function deleteCoupon(couponId: string): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to delete coupon");
  }
  return true;
}

export async function duplicateCoupon(couponId: string): Promise<CouponRecord> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/${couponId}/duplicate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to duplicate coupon");
  }
  const c = data.coupon || data;
  return { ...c, id: c._id || c.id };
}

// ── Customer-facing coupon validation (checkout) ──────────────────────

export interface CouponValidateRequest {
  code: string;
  items: { productId: string; quantity: number; size?: string | null; variantName?: string | null }[];
  shippingInfo: Record<string, any>;
  shippingMethod?: string;
  currency?: string;
  shippingAmount?: number;
}

export async function validateCouponCode(
  payload: CouponValidateRequest
): Promise<CouponValidationResult> {
  const res = await apiFetch(`${API_BASE}/coupons/validate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: CouponValidationResult = {
      valid: false,
      message: data.message || "Coupon could not be applied.",
      coupon: data.coupon,
      eligibleSubtotal: data.eligibleSubtotal,
    };
    throw Object.assign(new Error(err.message), err);
  }
  return {
    valid: data.valid,
    message: data.message,
    coupon: data.coupon,
    discountAmount: data.discountAmount,
    eligibleSubtotal: data.eligibleSubtotal,
    shippingDiscount: data.shippingDiscount,
    totalDiscount: data.totalDiscount,
    breakdown: data.breakdown,
  };
}

// ── Coupon analytics ──────────────────────────────────────────────────

export async function fetchCouponStats(): Promise<CouponStats> {
  const res = await apiFetch(`${API_BASE}/admin/coupons/stats`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch coupon statistics");
  }
  return data.stats || data;
}

export async function fetchCouponAnalytics(
  options?: { dateFrom?: string; dateTo?: string; sort?: string; limit?: number }
): Promise<CouponAnalyticsResponse> {
  const params = new URLSearchParams();
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();

  const res = await apiFetch(`${API_BASE}/admin/coupons/analytics${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch coupon analytics");
  }
  return data;
}

export async function exportCouponAnalytics(
  options?: { dateFrom?: string; dateTo?: string }
): Promise<Blob> {
  const params = new URLSearchParams();
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  const qs = params.toString();

  const res = await apiFetch(`${API_BASE}/admin/coupons/analytics/export${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to export coupon report");
  }
  return res.blob();
}



// ── Reports & Analytics Endpoints ─────────────────────────────────────────────

export interface AnalyticsKpiItem {
  value: number;
  previous?: number;
  growth?: number;
  format: "currency" | "number" | "percentage";
  count?: number;
  amount?: number;
}

export interface AnalyticsOverviewResponse {
  period: {
    range: string;
    start: string;
    end: string;
    prevStart: string;
    prevEnd: string;
  };
  kpis: {
    totalRevenue: AnalyticsKpiItem;
    totalOrders: AnalyticsKpiItem;
    totalProductsSold: AnalyticsKpiItem;
    totalCustomers: AnalyticsKpiItem;
    averageOrderValue: AnalyticsKpiItem;
    totalProfit: AnalyticsKpiItem;
    totalRefunds: AnalyticsKpiItem;
    conversionRate: AnalyticsKpiItem;
    revenueGrowthPercentage: AnalyticsKpiItem;
    pendingPayments: {
      count: number;
      amount: number;
      format: "currency";
    };
  };
  recentTrend: { _id: string; revenue: number; orders: number }[];
  allTime: {
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
  };
}

export interface AnalyticsRevenueResponse {
  range: string;
  interval: string;
  start: string;
  end: string;
  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    orders: number;
    discounts: number;
    shipping: number;
    tax: number;
  };
  series: {
    date: string;
    revenue: number;
    previousRevenue: number;
    orders: number;
    previousOrders: number;
    profit: number;
    expenses: number;
    growth: number;
    discounts: number;
  }[];
  comparison: {
    currentCount: number;
    previousCount: number;
  };
}

export interface SalesReportItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  itemCount: number;
  quantity: number;
  category: string;
  subtotal: number;
  discount: number;
  tax: number;
  shippingCharges: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  orderDate: string;
}

export interface AnalyticsSalesResponse {
  sales: SalesReportItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalSales: number;
    totalSubtotal: number;
    totalDiscounts: number;
    totalTax: number;
    totalShipping: number;
    totalItems: number;
  };
}

export interface ProductPerformanceItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  image: string;
  price: number;
  stock: number;
  stockStatus: string;
  unitsSold: number;
  revenue: number;
  profit: number;
  views: number;
  ratings: number;
}

export interface AnalyticsProductsResponse {
  bestSelling: ProductPerformanceItem[];
  lowestSelling: ProductPerformanceItem[];
  mostProfitable: ProductPerformanceItem[];
  mostViewed: ProductPerformanceItem[];
  outOfStock: ProductPerformanceItem[];
  lowStock: ProductPerformanceItem[];
  totalCatalogProducts: number;
  allPerformance: ProductPerformanceItem[];
}

export interface TopSpendingCustomer {
  rank: number;
  id: string;
  name: string;
  email: string;
  totalSpend: number;
  orderCount: number;
  lastOrderDate: string;
  averageOrderValue: number;
}

export interface AnalyticsCustomersResponse {
  summary: {
    totalRegistered: number;
    newCustomers: number;
    activeCustomers: number;
    returningCustomers: number;
    inactiveCustomers: number;
    customerLifetimeValue: number;
    averageOrdersPerCustomer: number;
  };
  topSpending: TopSpendingCustomer[];
  acquisitionTrend: { _id: string; newUsers: number }[];
}

export interface CategoryMetricItem {
  id: string;
  name: string;
  slug?: string;
  revenue: number;
  orders: number;
  unitsSold: number;
  sharePercentage: number;
}

export interface BrandMetricItem {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  unitsSold: number;
  sharePercentage: number;
}

export interface AnalyticsCategoriesResponse {
  categories: CategoryMetricItem[];
  brands: BrandMetricItem[];
  topCategories: CategoryMetricItem[];
  lowestCategories: CategoryMetricItem[];
  totalRevenue: number;
  totalUnits: number;
}

export interface AnalyticsPaymentsResponse {
  summary: {
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    refundedOrders: number;
    codOrders: { count: number; amount: number };
    onlinePayments: { count: number; amount: number };
    failedPayments: number;
    paymentSuccessRate: number;
  };
  statusBreakdown: Record<string, { count: number; amount: number }>;
  paymentTimeline: { _id: { date: string; method: string }; amount: number; count: number }[];
  recentTransactions: {
    id: string;
    orderNumber: string;
    customerName: string;
    amount: number;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    date: string;
  }[];
}

export interface InventoryItemReport {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  stock: number;
  price: number;
  valuation: number;
  lowStockThreshold: number;
  status: string;
}

export interface AnalyticsInventoryResponse {
  summary: {
    totalInventoryValue: number;
    availableStockUnits: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lowStockProducts: InventoryItemReport[];
  outOfStockProducts: InventoryItemReport[];
  fastMoving: { id: string; name: string; stock: number; salesCount: number; price: number }[];
  slowMoving: { id: string; name: string; stock: number; salesCount: number; price: number }[];
  categoryValuation: { category: string; value: number; units: number }[];
  recentTransactions: any[];
}

export interface AnalyticsCouponsResponse {
  summary: {
    totalDiscountsProvided: number;
    couponUsageCount: number;
    discountedOrders: number;
    promotionalSales: number;
    discountImpactOnSales: number;
  };
  mostUsedCoupons: {
    _id: string;
    couponName?: string;
    timesUsed: number;
    totalDiscountGiven: number;
    revenueGenerated: number;
  }[];
  couponList: {
    id: string;
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
    usageLimit?: number;
    timesUsed: number;
    totalDiscountGiven: number;
    revenueGenerated: number;
    startDate: string;
    expiryDate: string;
    isActive: boolean;
  }[];
}

export interface AnalyticsReturnsResponse {
  summary: {
    totalReturnRequests: number;
    approvedReturns: number;
    rejectedReturns: number;
    pendingReturns: number;
    totalRefundedAmount: number;
    returnPercentage: number;
  };
  returnReasons: { reason: string; count: number; percentage: number }[];
  mostReturnedProducts: { id: string; name: string; count: number; refundAmount: number }[];
  returnsList: {
    id: string;
    returnNumber: string;
    orderNumber: string;
    productName: string;
    customerName: string;
    reason: string;
    status: string;
    refundAmount: number;
    createdAt: string;
  }[];
}

function buildAnalyticsParams(options: Record<string, any> = {}): string {
  const p = new URLSearchParams();
  Object.entries(options).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      p.set(k, String(v));
    }
  });
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAnalyticsOverview(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsOverviewResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/overview${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch overview analytics");
  return data.data;
}

export async function fetchAnalyticsRevenue(
  options?: { range?: string; startDate?: string; endDate?: string; interval?: string }
): Promise<AnalyticsRevenueResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/revenue${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch revenue analytics");
  return data.data;
}

export async function fetchAnalyticsSales(
  options?: {
    range?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
    orderStatus?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: string;
  }
): Promise<AnalyticsSalesResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/sales${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch sales analytics");
  return data.data;
}

export async function fetchAnalyticsProducts(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsProductsResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/products${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch product performance analytics");
  return data.data;
}

export async function fetchAnalyticsCustomers(
  options?: { range?: string; startDate?: string; endDate?: string; interval?: string }
): Promise<AnalyticsCustomersResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/customers${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch customer analytics");
  return data.data;
}

export async function fetchAnalyticsCategories(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsCategoriesResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/categories${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch category analytics");
  return data.data;
}

export async function fetchAnalyticsPayments(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsPaymentsResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/payments${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch payment analytics");
  return data.data;
}

export async function fetchAnalyticsInventory(): Promise<AnalyticsInventoryResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/inventory`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch inventory reports");
  return data.data;
}

export async function fetchAnalyticsCoupons(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsCouponsResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/coupons${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch coupon analytics");
  return data.data;
}

export async function fetchAnalyticsReturns(
  options?: { range?: string; startDate?: string; endDate?: string }
): Promise<AnalyticsReturnsResponse> {
  const res = await apiFetch(`${API_BASE}/admin/analytics/returns${buildAnalyticsParams(options)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch returns analytics");
  return data.data;
}

export async function downloadAnalyticsExport(
  type: string,
  format: "xlsx" | "csv" | "json" = "xlsx",
  options?: Record<string, any>
): Promise<Blob> {
  const query = buildAnalyticsParams({ type, format, ...options });
  const res = await apiFetch(`${API_BASE}/admin/analytics/export${query}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to export report");
  }
  return res.blob();
}
