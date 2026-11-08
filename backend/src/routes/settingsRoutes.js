import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
    getSettings,
    updateSettings,
    getShippingCost,
    getPackagingOptions,
    getPackagingText,
} from "../controllers/settingsController.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// Public endpoints
router.get("/settings/shipping", getShippingCost);
router.post("/settings/shipping", getShippingCost);
router.get("/settings/packaging-options", cacheMiddleware(3600), getPackagingOptions);
router.get("/settings/packaging-text", cacheMiddleware(3600), getPackagingText);
router.get("/settings", cacheMiddleware(3600), getSettings);

// Admin endpoints
router.put(
    "/settings",
    isAuthenticatedUser,
    authorizeRoles("admin"),
    updateSettings
);

export default router;
