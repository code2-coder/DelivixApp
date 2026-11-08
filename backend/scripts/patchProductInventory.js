import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const productModelPath = join(__dirname, '..', 'src', 'models', 'product.js');

let content = readFileSync(productModelPath, 'utf8');

// Ensure top-level fields are in productSchema
const topFieldsMarker = `    discountPercentage: {\r\n      type: Number,\r\n    },`;
const topFieldsMarkerLF = `    discountPercentage: {\n      type: Number,\n    },`;

const extraTopFields = `    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    costPrice: {
      type: Number,
    },
    purchasePrice: {
      type: Number,
    },
    minStockLevel: {
      type: Number,
      default: 5,
    },
    maxStockLevel: {
      type: Number,
      default: 100,
    },
    reservedStock: {
      type: Number,
      default: 0,
    },
    incomingStock: {
      type: Number,
      default: 0,
    },
    damagedStock: {
      type: Number,
      default: 0,
    },
    warehouseLocation: {
      type: String,
      default: "Main Warehouse (Zone A)",
    },
    shelfBin: {
      type: String,
      default: "",
    },
    batchNumber: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    manufacturingDate: {
      type: Date,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },\n`;

if (!content.includes('minStockLevel:')) {
  if (content.includes(topFieldsMarker)) {
    content = content.replace(topFieldsMarker, topFieldsMarker + '\r\n' + extraTopFields.replace(/\n/g, '\r\n'));
    console.log("Added top-level inventory fields to productSchema (CRLF)");
  } else if (content.includes(topFieldsMarkerLF)) {
    content = content.replace(topFieldsMarkerLF, topFieldsMarkerLF + '\n' + extraTopFields);
    console.log("Added top-level inventory fields to productSchema (LF)");
  }
}

// Ensure variants schema supports title, attributes, costPrice, etc.
const variantNameMarker = `variantName: { type: String, required: true },`;
const variantNameReplacement = `variantName: { type: String },\n        title: { type: String },\n        sku: { type: String },\n        barcode: { type: String },\n        price: { type: Number },\n        mrp: { type: Number },\n        costPrice: { type: Number },\n        stock: { type: Number, default: 0 },\n        reservedStock: { type: Number, default: 0 },\n        incomingStock: { type: Number, default: 0 },\n        minStockLevel: { type: Number, default: 5 },\n        maxStockLevel: { type: Number, default: 100 },\n        attributes: { type: mongoose.Schema.Types.Mixed },\n        isDefault: { type: Boolean, default: false },`;

if (!content.includes('attributes: { type: mongoose.Schema.Types.Mixed }') && content.includes(variantNameMarker)) {
  const isCRLF = content.includes('\r\n');
  content = content.replace(variantNameMarker, isCRLF ? variantNameReplacement.replace(/\n/g, '\r\n') : variantNameReplacement);
  console.log("Updated variants schema for inventory tracking");
}

writeFileSync(productModelPath, content, 'utf8');
console.log("Successfully updated product.js");

