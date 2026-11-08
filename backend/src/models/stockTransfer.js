import mongoose from "mongoose";

const stockTransferItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productTitle: {
      type: String,
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    variantTitle: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: true }
);

const stockTransferSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
    },
    sourceLocation: {
      type: String,
      default: "Main Warehouse (Zone A)",
    },
    destinationLocation: {
      type: String,
      required: true,
    },
    items: [stockTransferItemSchema],
    status: {
      type: String,
      enum: ["Pending", "Dispatched", "Received", "Cancelled"],
      default: "Pending",
    },
    notes: {
      type: String,
      default: "",
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    transferDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

stockTransferSchema.index({ status: 1 });
stockTransferSchema.index({ transferDate: -1 });

export default mongoose.model("StockTransfer", stockTransferSchema);
