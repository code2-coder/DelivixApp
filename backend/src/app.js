import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import hpp from "hpp";
import mongoose from "mongoose";
import passport from "./config/passport.js";
import { isRedisReady } from "./config/redis.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";

// Routes
import categoryRoutes from "./routes/categoryRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import forgotPasswordRoutes from "./routes/forgotPassword.routes.js";
import orderRoutes from "./routes/orderRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import paymentWebhookRoutes from "./routes/paymentWebhookRoutes.js";
import subscriberRoutes from "./routes/subscriberRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import adPosterRoutes from "./routes/adPosterRoutes.js";
import sizeRoutes from "./routes/sizeRoutes.js";
import priceRangeRoutes from "./routes/priceRangeRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import delhiveryRoutes from "./routes/delhiveryRoutes.js";
import attributeRoutes from "./routes/attributeRoutes.js";
import returnRoutes from "./routes/returnRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import pageRoutes from "./routes/pageRoutes.js";
import currencySettingRoutes from "./routes/currencySettingRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import storeSettingsRoutes from "./routes/storeSettingsRoutes.js";
import { getRobotsTxt, getSitemapXml } from "./controllers/storeSettingsController.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy for Render/Vercel (required for rate limiting and secure cookies)
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.set("etag", "weak");

// Ultra-fast lightweight health check endpoint
// Placed at the very top of the stack to bypass all body-parsers, passport, hpp, compression, and helmet
app.get("/api/health", (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(
    `{"success":true,"status":"ok","service":"shreeharikripa-api","timestamp":"${new Date().toISOString()}"}`
  );
});

// Allowed Origins for CORS
const envOrigins = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
  .filter(Boolean)
  .flatMap((u) => u.split(",").map((s) => s.trim().replace(/\/+$/, "")))
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "https://delivix.in",
  "https://www.delivix.in",
  "http://delivix.in",
  "http://www.delivix.in",
  ...envOrigins,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");

      const isLocalhost =
        normalizedOrigin.startsWith("http://localhost:") ||
        normalizedOrigin.startsWith("http://127.0.0.1:") ||
        normalizedOrigin === "http://localhost" ||
        normalizedOrigin === "http://127.0.0.1";

      if (isLocalhost) {
        return callback(null, true);
      }

      // Explicit match from env or configured origins
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Automatically allow Vercel previews & production, Railway, Render, and Delivix domain
      if (
        normalizedOrigin.endsWith(".vercel.app") ||
        normalizedOrigin.endsWith(".railway.app") ||
        normalizedOrigin.endsWith(".onrender.com") ||
        normalizedOrigin === "https://delivix.in" ||
        normalizedOrigin === "https://www.delivix.in" ||
        normalizedOrigin.endsWith(".delivix.in") ||
        normalizedOrigin.endsWith("delivix.in")
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com", "https://images.unsplash.com", "https://placehold.co"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "PRODUCTION") {
  app.use(
    morgan("dev", {
      skip: (req) =>
        req.url === "/health" ||
        req.originalUrl === "/health" ||
        req.url === "/api/health" ||
        req.originalUrl === "/api/health",
    })
  );
}

// Payment webhooks need the untouched raw body for signature verification.
// Mount them before the global JSON parser.
app.use("/api/v1", paymentWebhookRoutes);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Security middleware against HTTP parameter pollution
app.use(hpp());

// API Rate Limiting
app.use("/api", apiLimiter);

// DB readiness flag — set to true in server.js after MongoDB connects
let _dbReady = false;
export const setDbReady = () => {
  _dbReady = true;
};

// Standardized Health check endpoint
app.get("/health", (req, res) => {
  const redisConnected = isRedisReady();
  const dbConnected = mongoose.connection.readyState === 1 || _dbReady;
  if (dbConnected) {
    res.status(200).json({
      success: true,
      status: "ok",
      database: "connected",
      redis: redisConnected ? "connected" : "in_memory_fallback",
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      success: false,
      status: "starting",
      database: "connecting",
      redis: redisConnected ? "connected" : "in_memory_fallback",
      timestamp: new Date().toISOString(),
    });
  }
});

// Register API Routes
app.use("/api/v1", categoryRoutes);
app.use("/api/v1", brandRoutes);
app.use("/api/v1", productRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", forgotPasswordRoutes);
app.use("/api/auth", forgotPasswordRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", bannerRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", subscriberRoutes);
app.use("/api/v1", currencyRoutes);
app.use("/api/v1", settingsRoutes);
app.use("/api/v1", adPosterRoutes);
app.use("/api/v1", sizeRoutes);
app.use("/api/v1", priceRangeRoutes);
app.use("/api/v1/me/addresses", addressRoutes);
app.use("/api/v1/delhivery", delhiveryRoutes);
app.use("/api/v1", attributeRoutes);
app.use("/api/v1", returnRoutes);
app.use("/api/v1", shipmentRoutes);
app.use("/api/v1", uploadRoutes);
app.use("/api/v1", reviewRoutes);
app.use("/api/v1", pageRoutes);
app.use("/api/v1", currencySettingRoutes);
app.use("/api/v1", adminDashboardRoutes);
app.use("/api/v1", customerRoutes);
app.use("/api/v1", couponRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/v1/admin/analytics", analyticsRoutes);
app.use("/api/admin/analytics", analyticsRoutes);

// Public SEO Files
app.get("/robots.txt", getRobotsTxt);
app.get("/sitemap.xml", getSitemapXml);

// Store Settings Module
app.use("/api/v1", storeSettingsRoutes);

// Handle unmatched API routes
app.all(/^\/api\/.*/, (req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  err.statusCode = 404;
  next(err);
});

// Serve client static build in production
if (
  process.env.NODE_ENV === "PRODUCTION" ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "Production"
) {
  app.use(
    express.static(path.join(__dirname, "../../frontend/dist"), {
      maxAge: "7d",
      etag: true,
      immutable: true,
      index: false,
    })
  );

  app.get(/^.*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(__dirname, "../../frontend/dist/index.html"));
  });
} else {
  // Development default landing page
  app.get("/", (req, res) => {
    res.send("Server is running in development mode!");
  });
}

// Register global centralized error handler middleware (must be last)
app.use(errorMiddleware);

export default app;
