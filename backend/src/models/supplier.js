import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    gstNumber: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    suppliedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    totalPurchaseAmount: {
      type: Number,
      default: 0,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
    },
    paymentTerms: {
      type: String,
      default: "Net 30",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

supplierSchema.index({ supplierName: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ status: 1 });

export default mongoose.model("Supplier", supplierSchema);

