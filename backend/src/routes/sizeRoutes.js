import express from "express";
import { getSizes, createSize, deleteSize, updateSize } from "../controllers/sizeController.js";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

router.route("/sizes").get(cacheMiddleware(3600), getSizes);
router.route("/admin/sizes").post(isAuthenticatedUser, authorizeRoles("admin"), createSize);
router.route("/admin/sizes/:id")
  .put(isAuthenticatedUser, authorizeRoles("admin"), updateSize)
  .delete(isAuthenticatedUser, authorizeRoles("admin"), deleteSize);

export default router;
