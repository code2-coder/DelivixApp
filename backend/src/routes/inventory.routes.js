import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
  getOverview,
  getProducts,
  getProductDetails,
  updateProduct,
  bulkUpdateStock,
  adjustStock,
  getAdjustments,
  createStockInward,
  getStockInwards,
  recordStockOutward,
  getMovements,
  getAlerts,
  getReports,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getTransfers,
  createTransfer,
  updateTransferStatus,
  getBatches,
  createBatch,
  exportInventory,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  generateSku,
  generateBarcode,
  searchByBarcode,
} from "../controllers/inventory.controller.js";

const router = express.Router();
const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

// 1. Overview
router.get("/overview", adminGuard, getOverview);

// 2. Product Catalog
router.get("/products", adminGuard, getProducts);
router.get("/products/:productId", adminGuard, getProductDetails);
router.put("/products/:productId", adminGuard, updateProduct);
router.post("/products/bulk-update", adminGuard, bulkUpdateStock);

// 3. Stock Adjustments
router.post("/adjust", adminGuard, adjustStock);
router.get("/adjustments", adminGuard, getAdjustments);

// 4. Stock Inwards (Purchase orders received)
router.post("/stock-in", adminGuard, createStockInward);
router.get("/stock-in", adminGuard, getStockInwards);

// 5. Stock Outwards
router.post("/stock-out", adminGuard, recordStockOutward);

// 6. Movements Ledger
router.get("/movements", adminGuard, getMovements);

// 7. Alerts
router.get("/alerts", adminGuard, getAlerts);
router.get("/low-stock", adminGuard, getAlerts);

// 8. Reports
router.get("/reports", adminGuard, getReports);

// 9. Suppliers
router.get("/suppliers", adminGuard, getSuppliers);
router.post("/suppliers", adminGuard, createSupplier);
router.put("/suppliers/:id", adminGuard, updateSupplier);
router.delete("/suppliers/:id", adminGuard, deleteSupplier);

// 10. Transfers
router.get("/transfers", adminGuard, getTransfers);
router.post("/transfers", adminGuard, createTransfer);
router.put("/transfers/:id/status", adminGuard, updateTransferStatus);

// 11. Warehouses
router.get("/warehouses", adminGuard, getWarehouses);
router.post("/warehouses", adminGuard, createWarehouse);
router.put("/warehouses/:id", adminGuard, updateWarehouse);
router.delete("/warehouses/:id", adminGuard, deleteWarehouse);

// 12. SKU & Barcode Automation
router.post("/sku/generate", adminGuard, generateSku);
router.get("/barcode/generate", adminGuard, generateBarcode);
router.get("/barcode/search", adminGuard, searchByBarcode);

// 13. Batches
router.get("/batches", adminGuard, getBatches);
router.post("/batches", adminGuard, createBatch);

// 14. Export
router.get("/export", adminGuard, exportInventory);

export default router;
