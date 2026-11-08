import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
  getPages,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage
} from "../controllers/pageController.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// Public endpoints
router.get("/pages", cacheMiddleware(3600), getPages);
router.get("/pages/:slug", cacheMiddleware(3600), getPageBySlug);

// Protected admin endpoints
router.post("/pages", isAuthenticatedUser, authorizeRoles("admin"), createPage);
router.put("/pages/:slug", isAuthenticatedUser, authorizeRoles("admin"), updatePage);
router.delete("/pages/:slug", isAuthenticatedUser, authorizeRoles("admin"), deletePage);

export default router;
