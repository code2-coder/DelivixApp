import express from "express";
import productController from "../controllers/ProductController.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

//
// 📦 PUBLIC ROUTES
// IMPORTANT: static routes must come BEFORE /products/:id.
//
router.get("/products/filter-options", cacheMiddleware(60), (req, res, next) =>
  productController.getFilterOptions(req, res, next)
);
router.post("/products/visual-search", (req, res, next) =>
  productController.visualSearchProducts(req, res, next)
);
router.get("/products", cacheMiddleware(60), (req, res, next) =>
  productController.getProducts(req, res, next)
);
router.get("/products/:id", cacheMiddleware(300), (req, res, next) =>
  productController.getProductById(req, res, next)
);

//
// 👑 ADMIN PRODUCT ROUTES
//
const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

router.get("/admin/products/stats", adminGuard, (req, res, next) =>
  productController.getAdminProductStats(req, res, next)
);
router.get("/admin/products/export", adminGuard, (req, res, next) =>
  productController.exportProducts(req, res, next)
);
router.post("/admin/products/import", adminGuard, (req, res, next) =>
  productController.importProducts(req, res, next)
);
router.post("/admin/products/bulk", adminGuard, (req, res, next) =>
  productController.bulkUpdateProducts(req, res, next)
);

router
  .route("/admin/products")
  .get(adminGuard, (req, res, next) => productController.getAdminProducts(req, res, next))
  .post(adminGuard, (req, res, next) => productController.createProduct(req, res, next));

router.post("/admin/products/:id/duplicate", adminGuard, (req, res, next) =>
  productController.duplicateProduct(req, res, next)
);

router
  .route("/admin/products/:id")
  .get(adminGuard, (req, res, next) => productController.getAdminProductById(req, res, next))
  .put(adminGuard, (req, res, next) => productController.updateProduct(req, res, next))
  .delete(adminGuard, (req, res, next) => productController.deleteProduct(req, res, next));

export default router;
