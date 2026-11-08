/**
 * Standard Redis Cache Keys and TTL Configurations
 */

export const CACHE_TTL = {
  SHORT: 60,         // 1 minute (e.g. filter options, fast-moving items)
  MEDIUM: 300,       // 5 minutes (e.g. product list, product search)
  LONG: 1800,        // 30 minutes (e.g. single product detail)
  VERY_LONG: 3600,   // 1 hour (e.g. categories, banners, posters, static pages)
  DAY: 86400,        // 24 hours (e.g. settings, currencies)
};

export const CACHE_PREFIX = {
  PRODUCTS: "shk:products",
  PRODUCT: "shk:product",
  CATEGORIES: "shk:categories",
  CATEGORY: "shk:category",
  BANNERS: "shk:banners",
  POSTERS: "shk:adposters",
  PAGES: "shk:pages",
  SETTINGS: "shk:settings",
  CURRENCIES: "shk:currencies",
  REVIEWS: "shk:reviews",
};

/**
 * Key Builders
 */
export const CacheKeys = {
  // Products
  productListKey: (queryString = "") => `${CACHE_PREFIX.PRODUCTS}:list:${queryString || "default"}`,
  productDetailKey: (id) => `${CACHE_PREFIX.PRODUCT}:id:${id}`,
  productFilterOptionsKey: () => `${CACHE_PREFIX.PRODUCTS}:filter_options`,
  productReviewsKey: (productId, queryStr = "") => `${CACHE_PREFIX.REVIEWS}:product:${productId}:${queryStr || "default"}`,
  productReviewsSummaryKey: (productId) => `${CACHE_PREFIX.REVIEWS}:summary:${productId}`,

  // Categories
  categoryListKey: () => `${CACHE_PREFIX.CATEGORIES}:all`,
  categoryDetailKey: (id) => `${CACHE_PREFIX.CATEGORY}:id:${id}`,

  // Banners & Posters
  bannerListKey: () => `${CACHE_PREFIX.BANNERS}:all`,
  adPosterListKey: () => `${CACHE_PREFIX.POSTERS}:all`,

  // Pages & Settings
  pageListKey: () => `${CACHE_PREFIX.PAGES}:all`,
  pageSlugKey: (slug) => `${CACHE_PREFIX.PAGES}:slug:${slug}`,
  settingsKey: () => `${CACHE_PREFIX.SETTINGS}:global`,
  currencySettingsKey: () => `${CACHE_PREFIX.CURRENCIES}:settings`,
};

export default {
  CACHE_TTL,
  CACHE_PREFIX,
  CacheKeys,
};
