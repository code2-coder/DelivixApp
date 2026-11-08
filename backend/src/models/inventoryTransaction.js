import mongoose from "mongoose";

/**
 * Immutable inventory ledger. Every stock movement is keyed so retries and
 * duplicate webhooks cannot adjust the same order line twice.
 */
const inventoryTransactionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productTitle: {
      type: String,
      default: "",
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    variantName: String,
    size: String,
    sku: String,
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
    },
    action: {
      type: String,
      enum: [
        "reserve",
        "deduct",
        "restore",
        "release",
        "stock_in",
        "stock_out",
        "adjustment_add",
        "adjustment_remove",
        "adjustment_correct",
        "damaged",
        "missing",
        "supplier_return",
        "transfer",
      ],
      required: true,
    },
    transactionType: {
      type: String,
      default: "Order Deduction",
    },
    referenceId: {
      type: String,
      default: "",
    },
    reason: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

inventoryTransactionSchema.index({ order: 1, createdAt: -1 });
inventoryTransactionSchema.index({ product: 1, createdAt: -1 });
inventoryTransactionSchema.index({ action: 1, createdAt: -1 });
inventoryTransactionSchema.index({ referenceId: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });

export default mongoose.model("InventoryTransaction", inventoryTransactionSchema);
