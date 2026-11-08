import mongoose from "mongoose";

const returnTimelineSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const returnMediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["video", "image"],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const returnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    // We store the specific orderItem properties or an ID to reference the product in the order
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Defective/Damaged",
        "Wrong Item Received",
        "Size Issue",
        "Quality Not as Expected",
        "Other"
      ],
    },
    returnType: {
      type: String,
      enum: ["Refund", "Replacement", "Exchange"],
      required: true,
      default: "Refund",
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Pending Review",
        "Approved",
        "Rejected",
        "Pickup Scheduled",
        "Pickup Completed",
        "Product Received",
        "Quality Inspection",
        "Refund Processing",
        "Refund Completed",
        "Replacement Preparing",
        "Replacement Shipped",
        "Replacement Delivered",
        "Exchange Approved",
        "Exchange Shipped",
        "Exchange Delivered",
        "Return Closed",
      ],
      default: "Pending Review",
    },
    media: [returnMediaSchema],
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundMethod: {
      type: String,
      enum: ["Original Payment Method", "Original Payment", "Store Wallet", "Bank Transfer", "UPI"],
      default: "Original Payment",
    },
    adminRemarks: {
      type: String,
    },
    pickupDate: {
      type: Date,
    },
    pickupTime: {
      type: String,
    },
    courierPartner: {
      type: String,
    },
    trackingNumber: {
      type: String,
    },
    pickupRemarks: {
      type: String,
    },
    refundTransactionReference: {
      type: String,
    },
    replacementProduct: {
      type: String,
    },
    shippingProgress: {
      type: String,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    timeline: [returnTimelineSchema],
  },
  { timestamps: true }
);

returnSchema.index({ user: 1, createdAt: -1 });
returnSchema.index({ order: 1 });
returnSchema.index({ order: 1, status: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ orderItemId: 1, user: 1 });

export default mongoose.model("Return", returnSchema);
