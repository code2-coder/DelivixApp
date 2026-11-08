import "./config/env.js";

// Validate ZeptoMail Configuration on startup
import { ZeptoMailService } from "./services/zeptoMail.service.js";
try {
  ZeptoMailService.logDebugInfo();
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "PRODUCTION") {
    try {
      ZeptoMailService.validateConfig();
    } catch (warn) {
      console.warn("⚠️ [PRODUCTION WARNING] ZeptoMail is not configured:", warn.message);
      console.warn("   Email delivery will be disabled until valid ZEPTOMAIL_ credentials are provided in your environment.");
      if (process.env.STRICT_MAIL_CONFIG === "true") {
        throw warn;
      }
    }
  } else {
    try {
      ZeptoMailService.validateConfig();
    } catch (warn) {
      console.warn("⚠️ [DEV WARNING] ZeptoMail is not configured for local development. Email sending features will be simulated/disabled.");
    }
  }
} catch (error) {
  console.error("FATAL: Startup validation failed!");
  console.error(error.message);
  process.exit(1);
}

// Handle Uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(`UNCAUGHT EXCEPTION: ${err.message}`);
  console.error(err.stack);
  console.log("Shutting down due to uncaught exception...");
  setTimeout(() => {
    process.exit(1);
  }, 200);
});

import app, { setDbReady } from "./app.js";
import { connectDB } from "./database/connection.js";
import { initRedis, closeRedis } from "./config/redis.js";
import { seedPages } from "./database/pageSeeder.js";
import { seedPriceRanges } from "./database/priceRangeSeeder.js";
import { seedProducts } from "./database/productSeeder.js";
import { migrateLegacyCoupons } from "./database/couponMigration.js";
import CouponService from "./services/CouponService.js";
import mongoose from "mongoose";

let server;

const isProduction = () => (process.env.NODE_ENV || "").toLowerCase() === "production";

// Connect to MongoDB (with retry) then run seeders/Redis. Keeps the HTTP server
// alive on failure so the proxy returns a clean 503 instead of a 502.
const initializeDatabase = async (attempt = 1) => {
  try {
    await connectDB();
    setDbReady();

    // Upgrade any legacy coupon documents before accepting API traffic.
    await migrateLegacyCoupons().catch((error) => {
      console.error("Coupon migration error:", error.message);
    });

    // Release coupon reservations abandoned by failed/abandoned checkouts.
    CouponService.startReservationSweeper();

    seedPages().catch((err) => console.error("seedPages error:", err.message));
    seedPriceRanges().catch((err) => console.error("seedPriceRanges error:", err.message));
    seedProducts().catch((err) => console.error("seedProducts error:", err.message));
    initRedis().catch((err) => {
      console.warn("Redis init warning:", err.message);
    });
  } catch (error) {
    const retryMs = Number(process.env.MONGO_RETRY_INTERVAL_MS) || 5000;
    console.error(`Database initialization failed (attempt ${attempt}): ${error.message}`);
    if (isProduction()) {
      console.error("Shutting down: unable to connect to MongoDB in production.");
      process.exit(1);
    }
    console.warn(`Retrying database connection in ${retryMs / 1000}s... (server stays up, /health reports 503)`);
    setTimeout(() => initializeDatabase(attempt + 1), retryMs);
  }
};

// Start HTTP Server and initialize database
const startServer = () => {
  const PORT = Number(process.env.PORT) || 8085;
  const HOST = process.env.HOST || "0.0.0.0";

  const listen = (attempt = 1) => {
    server = app.listen(PORT, HOST, () => {
      console.log(`Server is running on ${HOST}:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
        if (!isProduction() && attempt < 15) {
          console.warn(`Another instance may still be shutting down. Retrying in 2s... (attempt ${attempt})`);
          setTimeout(() => listen(attempt + 1), 2000);
          return;
        }
      } else {
        console.error("Server listener error:", err);
      }
      process.exit(1);
    });
  };

  listen();

  // Connect in the background so the listener is never torn down by a DB failure.
  initializeDatabase();
};

startServer();

// Graceful Shutdown Handler
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  if (server) {
    // Keep-alive connections (browser/Vite proxy) otherwise hold the port
    // during hot reloads, causing the next server instance to fail EADDRINUSE.
    const forceExit = setTimeout(() => {
      console.warn("Graceful shutdown timed out; forcing exit.");
      process.exit(1);
    }, 5000);
    if (typeof forceExit.unref === "function") forceExit.unref();

    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        await closeRedis();
        await mongoose.connection.close(false);
        console.log("Database and Redis connections closed.");
      } catch (err) {
        console.error("Error during graceful shutdown:", err);
      }
      clearTimeout(forceExit);
      process.exit(0);
    });
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle Unhandled Promise Rejections
process.on("unhandledRejection", (err) => {
  console.error(`UNHANDLED REJECTION: ${err?.message || err}`);
  if (err?.stack) {
    console.error(err.stack);
  }
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) {
    console.log("Shutting down server due to Unhandled Promise Rejection in production...");
    if (server) {
      server.close(() => {
        setTimeout(() => {
          process.exit(1);
        }, 200);
      });
    } else {
      setTimeout(() => {
        process.exit(1);
      }, 200);
    }
  }
});

