import express from "express";
import {
  getAttributes,
  newAttribute,
  updateAttribute,
  deleteAttribute,
} from "../controllers/attributeController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

// Public route
router.route("/attributes").get(cacheMiddleware(3600), getAttributes);

// Admin routes
router
  .route("/admin/attribute/new")
  .post(isAuthenticatedUser, authorizeRoles("admin"), newAttribute);

router
  .route("/admin/attribute/:id")
  .put(isAuthenticatedUser, authorizeRoles("admin"), updateAttribute)
  .delete(isAuthenticatedUser, authorizeRoles("admin"), deleteAttribute);

export default router;
