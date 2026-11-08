import express from "express";
import {
  createBanner,
  getBanners,
  getAdminBanners,
  getSingleBanner,
  updateBanner,
  deleteBanner,
} from "../controllers/bannerController.js";

import {
  isAuthenticatedUser,
  authorizeRoles,
} from "../middleware/auth.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

// ✅ Public Routes
router.get("/banners", cacheMiddleware(60), getBanners);
router.get("/banner/:id", cacheMiddleware(300), getSingleBanner);

// 🔒 Admin Routes (requires an authenticated admin/staff user)
router.get(["/admin/banners", "/admin/banner"], adminGuard, getAdminBanners);
router.post(["/admin/banner", "/admin/banners"], adminGuard, createBanner);
router.put(["/admin/banner/:id", "/admin/banners/:id"], adminGuard, updateBanner);
router.delete(["/admin/banner/:id", "/admin/banners/:id"], adminGuard, deleteBanner);

export default router;
