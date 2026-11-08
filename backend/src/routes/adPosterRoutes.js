import express from "express";
import {
  createAdPoster,
  getAdPosters,
  getSingleAdPoster,
  updateAdPoster,
  deleteAdPoster,
} from "../controllers/adPosterController.js";

import {
  isAuthenticatedUser,
  authorizeRoles,
} from "../middleware/auth.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// ✅ Public Routes
router.get("/ad-posters", cacheMiddleware(300), getAdPosters);
router.get("/ad-poster/:id", cacheMiddleware(300), getSingleAdPoster);

// ✅ Admin Routes
router.post(
  "/admin/ad-poster",
  isAuthenticatedUser,
  authorizeRoles("admin"),
  createAdPoster
);

router.put(
  "/admin/ad-poster/:id",
  isAuthenticatedUser,
  authorizeRoles("admin"),
  updateAdPoster
);

router.delete(
  "/admin/ad-poster/:id",
  isAuthenticatedUser,
  authorizeRoles("admin"),
  deleteAdPoster
);

export default router;
