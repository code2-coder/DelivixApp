import cacheService from "../cache/cache.service.js";

/**
 * Express Middleware for API Response Caching with Redis & Fallback
 * @param {number} durationSeconds - Cache TTL in seconds (default 300)
 * @param {string|Function} customKeyOrBuilder - Optional custom key string or generator function
 */
export const cacheMiddleware = (durationSeconds = 300, customKeyOrBuilder = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    let key;
    if (typeof customKeyOrBuilder === "function") {
      key = customKeyOrBuilder(req);
    } else if (typeof customKeyOrBuilder === "string") {
      key = customKeyOrBuilder;
    } else {
      // Normalize URL key
      key = `shk:route:${req.originalUrl || req.url}`;
    }

    try {
      const cachedResponse = await cacheService.get(key);

      if (cachedResponse) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cachedResponse);
      }

      res.setHeader("X-Cache", "MISS");

      // Hook res.json to capture response body
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Cache only successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(key, body, durationSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      // On any unexpected error in cache middleware, proceed to controller
      next();
    }
  };
};

/**
 * Helper to invalidate cached routes or keys by prefix
 * @param {string} prefix - Key prefix or route pattern
 */
export const clearCache = (prefix) => {
  if (!prefix) return Promise.resolve();
  // Support both legacy route prefixes like /api/v1/products and shk:* keys
  const pattern = prefix.startsWith("shk:") ? prefix : `shk:route:${prefix}`;
  return cacheService.invalidatePrefix(pattern);
};

export default {
  cacheMiddleware,
  clearCache,
};
