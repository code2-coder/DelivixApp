import express from "express";
import { getPriceRanges, createPriceRange, updatePriceRange, deletePriceRange } from "../controllers/priceRangeController.js";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

router.route("/price-ranges").get(cacheMiddleware(3600), getPriceRanges);
router.route("/admin/price-ranges").post(isAuthenticatedUser, authorizeRoles("admin"), createPriceRange);
router.route("/admin/price-ranges/:id")
  .put(isAuthenticatedUser, authorizeRoles("admin"), updatePriceRange)
  .delete(isAuthenticatedUser, authorizeRoles("admin"), deletePriceRange);

export default router;
