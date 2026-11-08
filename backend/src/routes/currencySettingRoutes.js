import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
  getCurrencySettings,
  updateCurrencySettings,
} from "../controllers/currencySettingController.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// Public: Get currently configured exchange rates
router.get("/currency-settings", cacheMiddleware(3600), getCurrencySettings);

// Admin: Update configured exchange rates
router.put(
  "/currency-settings",
  isAuthenticatedUser,
  authorizeRoles("admin"),
  updateCurrencySettings
);

export default router;
