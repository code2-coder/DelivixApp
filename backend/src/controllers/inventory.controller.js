import * as XLSX from "xlsx";
import { InventoryManagementService } from "../services/inventoryManagement.service.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 1. Overview KPIs
export const getOverview = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getOverview();
  res.status(200).json({ success: true, data });
});

// 2. Paginated Products
export const getProducts = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getProducts(req.query);
  res.status(200).json({ success: true, data });
});

// 3. Product Details
export const getProductDetails = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getProductDetails(req.params.productId);
  res.status(200).json({ success: true, data });
});

// 4. Update Product Inventory
export const updateProduct = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.updateProductInventory(
    req.params.productId,
    req.body,
    req.user
  );
  res.status(200).json({ success: true, message: "Inventory updated successfully", data });
});

// 5. Bulk Update Stock
export const bulkUpdateStock = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.bulkUpdateStock(req.body.updates || [], req.user);
  res.status(200).json({ success: true, message: "Bulk stock updated", data });
});

// 6. Stock Adjustment (Create)
export const adjustStock = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.adjustStock({
    ...req.body,
    user: req.user,
  });
  res.status(201).json({ success: true, message: "Stock adjusted successfully", data });
});

// 7. Stock Adjustments (List)
export const getAdjustments = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getAdjustments(req.query);
  res.status(200).json({ success: true, data });
});

// 8. Stock Inward (Create)
export const createStockInward = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.createStockInward({
    ...req.body,
    user: req.user,
  });
  res.status(201).json({ success: true, message: "Stock inward recorded successfully", data });
});

// 9. Stock Inwards (List)
export const getStockInwards = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getStockInwards(req.query);
  res.status(200).json({ success: true, data });
});

// 10. Stock Outward (Create)
export const recordStockOutward = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.recordStockOutward({
    ...req.body,
    user: req.user,
  });
  res.status(201).json({ success: true, message: "Stock outward recorded successfully", data });
});

// 11. Inventory Movements Ledger
export const getMovements = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getMovements(req.query);
  res.status(200).json({ success: true, data });
});

// 12. Low & Out of Stock Alerts
export const getAlerts = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getLowAndOutOfStockAlerts();
  res.status(200).json({ success: true, data });
});

// 13. Reports & Analytics
export const getReports = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getReports();
  res.status(200).json({ success: true, data });
});

// 14. Suppliers Management
export const getSuppliers = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getSuppliers();
  res.status(200).json({ success: true, data });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.createSupplier(req.body);
  res.status(201).json({ success: true, message: "Supplier created successfully", data });
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.updateSupplier(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Supplier updated successfully", data });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await InventoryManagementService.deleteSupplier(req.params.id);
  res.status(200).json({ success: true, message: "Supplier deleted successfully" });
});

// 15. Stock Transfers
export const getTransfers = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getTransfers();
  res.status(200).json({ success: true, data });
});

export const createTransfer = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.createTransfer(req.body, req.user);
  res.status(201).json({ success: true, message: "Transfer initiated successfully", data });
});

export const updateTransferStatus = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.updateTransferStatus(req.params.id, req.body.status);
  res.status(200).json({ success: true, message: "Transfer status updated", data });
});

// 16. Batch & Expiry
export const getBatches = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getBatches();
  res.status(200).json({ success: true, data });
});

export const createBatch = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.createBatch(req.body);
  res.status(201).json({ success: true, message: "Batch created successfully", data });
});

// 17. Warehouses Management
export const getWarehouses = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.getWarehouses();
  res.status(200).json({ success: true, data });
});

export const createWarehouse = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.createWarehouse(req.body);
  res.status(201).json({ success: true, message: "Warehouse created successfully", data });
});

export const updateWarehouse = asyncHandler(async (req, res) => {
  const data = await InventoryManagementService.updateWarehouse(req.params.id, req.body);
  res.status(200).json({ success: true, message: "Warehouse updated successfully", data });
});

export const deleteWarehouse = asyncHandler(async (req, res) => {
  await InventoryManagementService.deleteWarehouse(req.params.id);
  res.status(200).json({ success: true, message: "Warehouse deleted successfully" });
});

// 18. SKU & Barcode Automation
export const generateSku = asyncHandler(async (req, res) => {
  const sku = await InventoryManagementService.generateSku(req.body);
  res.status(200).json({ success: true, sku });
});

export const generateBarcode = asyncHandler(async (req, res) => {
  const barcode = await InventoryManagementService.generateBarcode();
  res.status(200).json({ success: true, barcode });
});

export const searchByBarcode = asyncHandler(async (req, res) => {
  const matches = await InventoryManagementService.searchBySkuOrBarcode(req.query.q || req.query.barcode || req.query.sku);
  res.status(200).json({ success: true, data: matches });
});

// 17. Export Reports (Excel .xlsx / CSV / JSON)
export const exportInventory = asyncHandler(async (req, res) => {
  const { type = "current_stock", format = "xlsx" } = req.query;
  const exportData = await InventoryManagementService.getExportData(type);

  if (format === "csv") {
    const csvContent = [exportData.headers, ...exportData.rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "");
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportData.filename}.csv"`
    );
    return res.status(200).send(csvContent);
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.rows]);
    XLSX.utils.book_append_sheet(wb, ws, exportData.sheetName || "Inventory");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportData.filename}.xlsx"`
    );
    return res.status(200).send(buffer);
  }

  res.status(200).json({ success: true, data: exportData });
});

