import { getRedisClient, isRedisReady } from "../config/redis.js";
import logger from "../utils/logger.js";

// In-memory fallback map for when Redis is unavailable
const memoryFallback = new Map();
const memoryExpiry = new Map();

// Periodic sweep of expired memory keys
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of memoryExpiry.entries()) {
    if (expiresAt <= now) {
      memoryFallback.delete(key);
      memoryExpiry.delete(key);
    }
  }
}, 60000);

if (cleanupInterval && typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}


export class CacheService {
  /**
   * Get cached item by key
   */
  async get(key) {
    if (!key) return null;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const data = await client.get(key);
        if (data) {
          return JSON.parse(data);
        }
        return null;
      } catch (err) {
        logger.warn(`Redis get error for key "${key}": ${err.message}. Falling back to memory/db.`);
      }
    }

    // Memory fallback
    const expiresAt = memoryExpiry.get(key);
    if (expiresAt && expiresAt > Date.now()) {
      return memoryFallback.get(key) || null;
    }
    memoryFallback.delete(key);
    memoryExpiry.delete(key);
    return null;
  }

  /**
   * Set cached item with TTL in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    if (!key || value === undefined) return false;

    const serialized = JSON.stringify(value);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (ttlSeconds > 0) {
          await client.set(key, serialized, "EX", ttlSeconds);
        } else {
          await client.set(key, serialized);
        }
        return true;
      } catch (err) {
        logger.warn(`Redis set error for key "${key}": ${err.message}. Storing in memory fallback.`);
      }
    }

    // Memory fallback
    memoryFallback.set(key, value);
    if (ttlSeconds > 0) {
      memoryExpiry.set(key, Date.now() + ttlSeconds * 1000);
    }
    return true;
  }

  /**
   * Delete specific key from cache
   */
  async del(key) {
    if (!key) return false;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.del(key);
      } catch (err) {
        logger.warn(`Redis del error for key "${key}": ${err.message}`);
      }
    }

    memoryFallback.delete(key);
    memoryExpiry.delete(key);
    return true;
  }

  /**
   * Invalidate all keys matching a prefix or pattern
   */
  async invalidatePrefix(prefix) {
    if (!prefix) return false;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const pattern = prefix.endsWith("*") ? prefix : `${prefix}*`;
        
        // Use SCAN stream to safely discover and delete matching keys without blocking Redis
        const stream = client.scanStream({
          match: pattern,
          count: 100,
        });

        const keysToDelete = [];
        for await (const resultKeys of stream) {
          if (resultKeys.length) {
            keysToDelete.push(...resultKeys);
          }
        }

        if (keysToDelete.length > 0) {
          // Chunk deletions to prevent massive arguments
          const chunkSize = 100;
          for (let i = 0; i < keysToDelete.length; i += chunkSize) {
            const chunk = keysToDelete.slice(i, i + chunkSize);
            await client.del(...chunk);
          }
        }
      } catch (err) {
        logger.warn(`Redis invalidatePrefix error for pattern "${prefix}": ${err.message}`);
      }
    }

    // Clean memory fallback keys
    const cleanPrefix = prefix.replace(/\*+$/, "");
    for (const key of memoryFallback.keys()) {
      if (key.startsWith(cleanPrefix)) {
        memoryFallback.delete(key);
        memoryExpiry.delete(key);
      }
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  async flushAll() {
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        await client.flushdb();
      } catch (err) {
        logger.warn(`Redis flushdb error: ${err.message}`);
      }
    }

    memoryFallback.clear();
    memoryExpiry.clear();
    return true;
  }
}

export default new CacheService();
