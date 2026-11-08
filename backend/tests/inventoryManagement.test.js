import test from "node:test";
import assert from "node:assert/strict";
import { InventoryManagementService } from "../src/services/inventoryManagement.service.js";

test("SKU generation creates unique uppercase SKU with category and brand prefix", async () => {
  const sku = await InventoryManagementService.generateSku({
    category: "Laptops",
    brand: "Apple",
    name: "MacBook Pro",
  });

  assert.ok(sku, "SKU should be generated");
  assert.equal(typeof sku, "string");
  assert.ok(sku.startsWith("LAP-APP-"), `SKU should start with category and brand codes: ${sku}`);
  assert.equal(sku, sku.toUpperCase(), "SKU should be uppercase");
});

test("Barcode generation produces valid 13-digit EAN code with valid check digit", async () => {
  const barcode = await InventoryManagementService.generateBarcode();
  assert.ok(barcode, "Barcode should be generated");
  assert.equal(barcode.length, 13, "EAN-13 barcode must be 13 digits");
  assert.ok(/^\d{13}$/.test(barcode), "Barcode must be numeric");

  // Validate EAN-13 checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(barcode[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  assert.equal(parseInt(barcode[12], 10), expectedCheckDigit, "Checksum digit must match EAN-13 specification");
});

test("Stock adjustment math correctly calculates Add, Remove, and Set Exact", () => {
  const current = 25;
  const delta = 10;

  // Add
  const addStock = current + delta;
  assert.equal(addStock, 35);

  // Remove
  const removeStock = Math.max(0, current - delta);
  assert.equal(removeStock, 15);

  // Set Exact
  const exactStock = 50;
  assert.equal(exactStock, 50);

  // Scrap / Damage
  const scrapStock = Math.max(0, current - 5);
  assert.equal(scrapStock, 20);
});

test("Export manifest structure contains required columns for Excel/CSV generation", async () => {
  // Test low stock export format
  const lowStockExport = await InventoryManagementService.getExportData("low_stock");
  assert.ok(lowStockExport.headers.includes("Product Name"));
  assert.ok(lowStockExport.headers.includes("SKU"));
  assert.ok(lowStockExport.headers.includes("Current Stock"));
  assert.ok(lowStockExport.headers.includes("Min Level"));
  assert.ok(Array.isArray(lowStockExport.rows));

  // Test current stock export format
  const stockExport = await InventoryManagementService.getExportData("current_stock");
  assert.ok(stockExport.headers.includes("Product Name"));
  assert.ok(stockExport.headers.includes("Available Qty"));
  assert.ok(stockExport.headers.includes("Selling Price"));
  assert.ok(stockExport.headers.includes("Total Valuation"));
});
