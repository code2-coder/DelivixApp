import mongoose from "mongoose";

const orderSettingsSchema = new mongoose.Schema(
  {
    orderIdPrefix: {
      type: String,
      default: "DLX-",
      trim: true,
    },
    orderNumberFormat: {
      type: String,
      enum: ["sequential", "timestamp_random", "date_sequential"],
      default: "timestamp_random",
    },
    defaultOrderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Confirmed"],
      default: "Pending",
    },
    instantConfirmation: {
      type: Boolean,
      default: true,
    },
    autoProcessOrders: {
      type: Boolean,
      default: false,
    },
    allowCustomerCancellation: {
      type: Boolean,
      default: true,
    },
    cancellationWindowHours: {
      type: Number,
      default: 24,
      min: 0,
      max: 168, // up to 7 days
    },
    allowCancellationAfterShipment: {
      type: Boolean,
      default: false,
    },
    allowCustomerAddressEdit: {
      type: Boolean,
      default: true,
    },
    allowAdminOrderEditing: {
      type: Boolean,
      default: true,
    },
    autoGenerateInvoice: {
      type: Boolean,
      default: true,
    },
    autoGeneratePackingSlip: {
      type: Boolean,
      default: true,
    },
    returnWindowDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 90,
    },
    refundMode: {
      type: String,
      enum: ["automatic_source", "manual_approval", "store_credit"],
      default: "automatic_source",
    },
  },
  { timestamps: true }
);

export default mongoose.model("OrderSettings", orderSettingsSchema);

