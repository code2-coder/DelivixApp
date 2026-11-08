import "../src/config/env.js";
import mongoose from "mongoose";
import { InventoryManagementService } from "../src/services/inventoryManagement.service.js";

async function testService() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  console.log("\n1. Testing getOverview()...");
  const overview = await InventoryManagementService.getOverview();
  console.log("Overview KPIs:", overview.kpis);
  console.log("Categories found:", overview.categoryStats.length);

  console.log("\n2. Testing getProducts()...");
  const prods = await InventoryManagementService.getProducts({ page: 1, limit: 5 });
  console.log(`Products fetched: ${prods.items.length} of ${prods.pagination.total}`);
  if (prods.items.length > 0) {
    console.log("Sample Item:", {
      name: prods.items[0].productName,
      variant: prods.items[0].variantTitle,
      sku: prods.items[0].sku,
      barcode: prods.items[0].barcode,
      stock: prods.items[0].availableQuantity,
      val: prods.items[0].totalStockValue,
    });
  }

  console.log("\n3. Testing getLowAndOutOfStockAlerts()...");
  const alerts = await InventoryManagementService.getLowAndOutOfStockAlerts();
  console.log(`Alerts count: ${alerts.length}`);

  console.log("\n4. Testing getReports()...");
  const reports = await InventoryManagementService.getReports();
  console.log("Report distribution:", reports.stockDistribution);
  console.log("Fast moving:", reports.fastMoving.length, "Slow moving:", reports.slowMoving.length);

  console.log("\n5. Testing getSuppliers()...");
  const suppliers = await InventoryManagementService.getSuppliers();
  console.log(`Suppliers count: ${suppliers.length}`);

  console.log("\n6. Testing getMovements()...");
  const movements = await InventoryManagementService.getMovements({ page: 1, limit: 5 });
  console.log(`Movements total: ${movements.pagination.total}`);

  console.log("\n7. Testing getExportData()...");
  const exportData = await InventoryManagementService.getExportData("current_stock");
  console.log(`Export sheet: ${exportData.sheetName}, Rows: ${exportData.rows.length}`);

  console.log("\nALL SERVICE TESTS PASSED!");
  await mongoose.disconnect();
}

testService().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

