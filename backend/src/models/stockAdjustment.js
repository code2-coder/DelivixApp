import mongoose from "mongoose";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
    },
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
    previousQuantity: {
      type: Number,
      required: true,
    },
    adjustmentQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
    },
    adjustmentType: {
      type: String,
      enum: ["Add", "Remove", "Correction", "Damaged", "Missing", "Returned"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adjustmentDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ product: 1 });
stockAdjustmentSchema.index({ adjustmentType: 1 });
stockAdjustmentSchema.index({ adjustmentDate: -1 });

export default mongoose.model("StockAdjustment", stockAdjustmentSchema);
