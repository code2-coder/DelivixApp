import express from "express";
import { getBrands, createBrand, updateBrand, deleteBrand } from "../controllers/brandController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

router.get("/brands", cacheMiddleware(600), getBrands);
router.get("/admin/brands", isAuthenticatedUser, authorizeRoles("admin", "staff"), getBrands);
router.post("/admin/brands", isAuthenticatedUser, authorizeRoles("admin", "staff"), createBrand);
router.put("/admin/brands/:id", isAuthenticatedUser, authorizeRoles("admin", "staff"), updateBrand);
router.delete("/admin/brands/:id", isAuthenticatedUser, authorizeRoles("admin", "staff"), deleteBrand);

export default router;
