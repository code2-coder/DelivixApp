import mongoose from "mongoose";

const SHIPMENT_STATUSES = [
  // 13 Primary Standard Statuses
  "Order Confirmed",
  "Processing",
  "Packed",
  "Ready to Ship",
  "Shipped",
  "In Transit",
  "Reached Destination Hub",
  "Out for Delivery",
  "Delivered",
  "Delivery Attempt Failed",
  "Return to Origin",
  "Returned",
  "Cancelled",

  // Backwards-compatible aliases
  "Shipment Created",
  "Ready for Pickup",
  "Picked Up",
  "Dispatched",
  "Arrived at Hub",
  "Delivery Failed",
  "Delivery Attempted",
  "Customer Unavailable",
  "Rescheduled",
  "Return Received",
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    date: { type: Date, default: Date.now },
    time: { type: String },
    remark: { type: String },
    location: { type: String, default: "" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminName: { type: String },
  },
  { _id: true, immutable: true }
);

const noteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    adminName: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    adminName: { type: String },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    previousValue: { type: String },
    newValue: { type: String },
  },
  { timestamps: true }
);

const deliveryProofSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Delivery Photo", "Signed Receipt", "POD Document"],
      required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminName: { type: String },
  },
  { timestamps: true }
);

const returnInfoSchema = new mongoose.Schema({
  returnDate: { type: Date },
  returnReason: { type: String },
  packageCondition: {
    type: String,
    enum: ["Good", "Damaged", "Partial", "Missing Items"],
  },
  refundStatus: {
    type: String,
    enum: ["Pending", "Processed", "Not Applicable"],
    default: "Not Applicable",
  },
  internalRemarks: { type: String },
});

const shipmentSchema = new mongoose.Schema(
  {
    shipmentId: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },

    shippingAddress: {
      fullName: { type: String, required: true },
      mobileNumber: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      landmark: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      country: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    courierProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
    },
    courierName: { type: String },
    trackingNumber: { type: String, sparse: true, unique: true },
    awbNumber: { type: String, sparse: true, unique: true },
    trackingUrl: { type: String },
    trackingToken: { type: String, sparse: true },

    shippingMethod: {
      type: String,
      enum: ["standard", "express", "surface", "air", "other"],
      default: "standard",
    },
    packageWeight: { type: String, default: "0.5 kg" },
    packageDimensions: { type: String, default: "20x15x10 cm" },
    numberOfPackages: { type: Number, default: 1 },

    shippingCharges: { type: Number, default: 0 },
    codCharges: { type: Number, default: 0 },
    totalCharges: { type: Number, default: 0 },

    orderDate: { type: Date },
    packingDate: { type: Date },
    dispatchDate: { type: Date },
    estimatedDeliveryDate: { type: Date },
    deliveredDate: { type: Date },

    paymentType: {
      type: String,
      enum: ["Prepaid", "Cash on Delivery"],
      required: true,
    },

    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: "Order Confirmed",
    },

    // Personnel Assignment
    assignedPersonnel: {
      personnelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPersonnel",
      },
      name: { type: String },
      phone: { type: String },
      assignedAt: { type: Date },
    },

    // Failed delivery handling
    failedDeliveryReason: {
      type: String,
      enum: [
        "Customer unavailable",
        "Incorrect address",
        "Customer refused delivery",
        "Payment issue",
        "Delivery address unserviceable",
        "Other",
        "",
      ],
      default: "",
    },
    reattemptCount: { type: Number, default: 0 },
    nextDeliveryAttemptDate: { type: Date },

    remarks: { type: String },
    specialInstructions: { type: String },

    statusHistory: [statusHistorySchema],
    notes: [noteSchema],
    activityLog: [activityLogSchema],
    deliveryProof: [deliveryProofSchema],
    returnInfo: returnInfoSchema,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: { type: String },

    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

shipmentSchema.index({ order: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ createdAt: -1 });
shipmentSchema.index({ isArchived: 1 });
shipmentSchema.index({ "shippingAddress.pincode": 1 });

export { SHIPMENT_STATUSES };
export default mongoose.model("Shipment", shipmentSchema);
