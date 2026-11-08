import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Warehouse code is required"],
      unique: true,
      trim: true,
      uppercase: true,
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
      pinCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    capacity: {
      type: Number,
      default: 10000,
      min: 0,
    },
    currentStockCount: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

warehouseSchema.index({ status: 1 });

export default mongoose.model("Warehouse", warehouseSchema);

