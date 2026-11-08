import mongoose from "mongoose";

const stockInwardItemSchema = new mongoose.Schema(
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
    barcode: {
      type: String,
      default: "",
    },
    orderedQuantity: {
      type: Number,
      default: 0,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    batchNumber: {
      type: String,
      default: "",
    },
    expiryDate: {
      type: Date,
    },
    manufacturingDate: {
      type: Date,
    },
  },
  { _id: true }
);

const stockInwardSchema = new mongoose.Schema(
  {
    inwardNumber: {
      type: String,
      required: true,
      unique: true,
    },
    purchaseReference: {
      type: String,
      default: "",
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    supplierName: {
      type: String,
      default: "",
    },
    supplierInvoiceNumber: {
      type: String,
      default: "",
    },
    items: [stockInwardItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    totalQuantity: {
      type: Number,
      default: 0,
    },
    receivedDate: {
      type: Date,
      default: Date.now,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Partial"],
      default: "Pending",
    },
    status: {
      type: String,
      enum: ["Received", "Partially Received", "Pending", "Cancelled"],
      default: "Received",
    },
    notes: {
      type: String,
      default: "",
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

stockInwardSchema.index({ supplier: 1 });
stockInwardSchema.index({ receivedDate: -1 });
stockInwardSchema.index({ status: 1 });

export default mongoose.model("StockInward", stockInwardSchema);
