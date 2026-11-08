import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import {
  isAuthenticatedUser,
  authorizeRoles,
} from "../middleware/auth.js";

import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// Public
router.route("/categories").get(cacheMiddleware(3600), getAllCategories);
router.route("/categories/:id").get(cacheMiddleware(3600), getCategory);

// Admin
router.route("/admin/categories").post(isAuthenticatedUser, authorizeRoles("admin"), createCategory);
router.route("/admin/categories/:id").put(isAuthenticatedUser, authorizeRoles("admin"), updateCategory);
router.route("/admin/categories/:id").delete(isAuthenticatedUser, authorizeRoles("admin"), deleteCategory);

export default router;
