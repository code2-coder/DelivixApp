import Redis from "ioredis";
import logger from "../utils/logger.js";

let redisClient = null;
let isRedisConnected = false;
let isRedisConfiguredLogged = false;

/**
 * Checks whether Redis is explicitly configured in environment variables
 */
export const isRedisConfigured = () => {
  if (process.env.ENABLE_REDIS === "false") {
    return false;
  }
  return Boolean(process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS_HOST);
};

export const createRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  if (!isRedisConfigured()) {
    if (!isRedisConfiguredLogged) {
      logger.info("Redis is not configured. Running with in-memory caching fallback.");
      isRedisConfiguredLogged = true;
    }
    return null;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

  const redisConfig = {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false, // Prevents queuing when disconnected; fails fast to fallback
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy(times) {
      // Reconnect after delay, max 3 attempts to prevent infinite terminal log spam
      if (times > 3) {
        logger.warn("Redis: Maximum reconnection attempts (3) reached. Falling back to in-memory caching.");
        return null;
      }
      const delay = Math.min(times * 1000, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message && err.message.includes(targetError)) {
        return true;
      }
      return false;
    }
  };

  try {
    if (redisUrl) {
      redisClient = new Redis(redisUrl, redisConfig);
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...redisConfig
      });
    }

    redisClient.on("connect", () => {
      isRedisConnected = true;
      logger.info("Redis: Connected successfully.");
    });

    redisClient.on("ready", () => {
      isRedisConnected = true;
      logger.info("Redis: Ready to accept commands.");
    });

    redisClient.on("error", (err) => {
      const wasConnected = isRedisConnected;
      isRedisConnected = false;
      if (wasConnected) {
        logger.warn(`Redis connection lost: ${err.message}`);
      }
    });

    redisClient.on("close", () => {
      isRedisConnected = false;
    });

    redisClient.on("reconnecting", () => {
      logger.info("Redis: Reconnecting...");
    });
  } catch (error) {
    logger.warn(`Redis initialization failed: ${error.message}. Running without Redis.`);
    redisClient = null;
    isRedisConnected = false;
  }

  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
};

export const isRedisReady = () => Boolean(isRedisConnected && redisClient && redisClient.status === "ready");

export const initRedis = async () => {
  if (!isRedisConfigured()) {
    if (!isRedisConfiguredLogged) {
      logger.info("Redis is not configured. Running with in-memory caching fallback.");
      isRedisConfiguredLogged = true;
    }
    return null;
  }

  try {
    const client = getRedisClient();
    if (client && (client.status === "wait" || client.status === "close")) {
      await client.connect();
      logger.info("Redis: Connection established on startup.");
    }
    return client;
  } catch (error) {
    logger.warn(`Redis startup connection error: ${error.message}. Fallback to in-memory caching enabled.`);
    if (redisClient) {
      try {
        redisClient.disconnect();
      } catch (_) {}
      redisClient = null;
    }
    isRedisConnected = false;
    return null;
  }
};

export const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("Redis: Disconnected gracefully.");
    } catch (err) {
      try {
        redisClient.disconnect();
      } catch (_) {}
      logger.warn(`Redis close error: ${err.message}`);
    } finally {
      redisClient = null;
      isRedisConnected = false;
    }
  }
};

export default {
  isRedisConfigured,
  createRedisClient,
  getRedisClient,
  isRedisReady,
  initRedis,
  closeRedis
};
