import mongoose from "mongoose";

const productBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      trim: true,
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
    },
    sku: {
      type: String,
      default: "",
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      default: 0,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    status: {
      type: String,
      enum: ["Active", "Near Expiry", "Expired", "Depleted"],
      default: "Active",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

productBatchSchema.index({ batchNumber: 1 });
productBatchSchema.index({ product: 1 });
productBatchSchema.index({ expiryDate: 1 });
productBatchSchema.index({ status: 1 });

export default mongoose.model("ProductBatch", productBatchSchema);

