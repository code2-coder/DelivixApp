import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
  getOverview,
  getRevenue,
  getSales,
  getProducts,
  getCustomers,
  getCategories,
  getPayments,
  getInventory,
  getCoupons,
  getReturns,
  exportAnalytics,
} from "../controllers/analytics.controller.js";

const router = express.Router();

const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

// Analytics & Reports Routes
router.get("/overview", adminGuard, getOverview);
router.get("/revenue", adminGuard, getRevenue);
router.get("/sales", adminGuard, getSales);
router.get("/products", adminGuard, getProducts);
router.get("/customers", adminGuard, getCustomers);
router.get("/categories", adminGuard, getCategories);
router.get("/payments", adminGuard, getPayments);
router.get("/inventory", adminGuard, getInventory);
router.get("/coupons", adminGuard, getCoupons);
router.get("/returns", adminGuard, getReturns);
router.get("/export", adminGuard, exportAnalytics);

export default router;

