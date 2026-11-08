import mongoose from "mongoose";

const inventorySettingsSchema = new mongoose.Schema(
  {
    enableStockManagement: {
      type: Boolean,
      default: true,
    },
    defaultLowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    outOfStockBehavior: {
      type: String,
      enum: ["show_badge", "hide_product", "allow_backorder"],
      default: "show_badge",
    },
    allowBackorders: {
      type: Boolean,
      default: false,
    },
    stockDeductionPoint: {
      type: String,
      enum: ["on_order_created", "on_payment_success"],
      default: "on_payment_success",
    },
    stockReservationMinutes: {
      type: Number,
      default: 15,
      min: 5,
      max: 120,
    },
    autoRestoreOnCancellation: {
      type: Boolean,
      default: true,
    },
    stockDisplayFormat: {
      type: String,
      enum: ["exact_count", "in_stock_badge", "low_stock_warning_only"],
      default: "low_stock_warning_only",
    },
    lowStockAlertEmail: {
      type: Boolean,
      default: true,
    },
    skuPrefix: {
      type: String,
      default: "DLX",
      trim: true,
    },
    barcodeFormat: {
      type: String,
      enum: ["Code128", "EAN13", "UPC"],
      default: "Code128",
    },
    autoGenerateBarcode: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InventorySettings", inventorySettingsSchema);

