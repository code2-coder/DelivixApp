import mongoose from "mongoose";
import crypto from "crypto";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
} from "../utils/orderPolicy.js";

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    changedByName: {
      type: String,
    },
    source: {
      type: String,
      enum: ["customer", "admin", "system", "payment", "shipment"],
      default: "system",
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const paymentTransactionSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["Stripe", "Razorpay", "COD", "Manual"],
      required: true,
    },
    transactionId: { type: String },
    providerOrderId: { type: String },
    providerSessionId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["Created", "Pending", "Paid", "Failed", "Refunded", "Partially Refunded"],
      default: "Pending",
    },
    method: { type: String },
    failureReason: { type: String },
    verifiedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const refundSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    provider: { type: String },
    refundId: { type: String },
    reference: { type: String },
    reason: { type: String },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedByName: { type: String },
    processedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Customer snapshot so order history survives profile edits/deletions.
    customerInfo: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },

    shippingInfo: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
      },
      address: {
        type: String,
        required: true,
      },
      addressLine1: { type: String },
      addressLine2: { type: String },
      landmark: { type: String },
      city: {
        type: String,
        required: true,
      },
      state: { type: String },
      phoneNo: {
        type: String,
        required: true,
      },
      altPhoneNo: {
        type: String,
      },
      zipCode: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
    },

    // Structured address snapshot used by invoices and packing slips.
    shippingAddress: {
      fullName: { type: String },
      phone: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String },
      landmark: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      pincode: { type: String },
    },

    billingAddress: {
      fullName: { type: String },
      phone: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      pincode: { type: String },
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    orderItems: [
      {
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        image: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        size: {
          type: String,
        },
        variantName: {
          type: String,
        },
        variantSku: {
          type: String,
        },
        sku: {
          type: String,
        },
        subtotal: {
          type: Number,
        },
        taxAmount: {
          type: Number,
          default: 0,
        },
        discountAmount: {
          type: Number,
          default: 0,
        },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        returnActive: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Return",
        },
      },
    ],

    paymentMethod: {
      type: String,
      required: [true, "Please select payment method"],
      enum: PAYMENT_METHODS,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
    },

    paymentInfo: {
      id: String,
      status: String,
    },

    paymentTransactions: [paymentTransactionSchema],

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    itemsPrice: {
      type: Number,
      required: true,
    },

    taxAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    shippingAmount: {
      type: Number,
      required: true,
    },

    packagingAmount: {
      type: Number,
      default: 0,
    },

    packagingOption: {
      type: String,
      enum: ["standard", "exquisite"],
      default: "standard",
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    // Immutable coupon snapshot applied to this order. Preserved so that
    // future coupon edits never change historical order records.
    coupon: {
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
      code: { type: String, trim: true, uppercase: true },
      name: { type: String, trim: true },
      discountType: { type: String, enum: ["percentage", "fixed", "free_shipping"] },
      discountValue: { type: Number },
      maxDiscount: { type: Number },
      minOrderValue: { type: Number },
      discountAmount: { type: Number, default: 0 },
      shippingDiscount: { type: Number, default: 0 },
    },

    shippingMethod: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: "Pending",
      index: true,
    },

    statusHistory: [statusHistorySchema],

    deliveredAt: Date,

    paidAt: Date,

    trackingId: {
      type: String,
    },

    trackingUrl: {
      type: String,
    },

    awbNumber: {
      type: String,
    },

    courierName: {
      type: String,
    },

    shipmentDate: Date,

    estimatedDeliveryDate: Date,

    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
    },

    cancellation: {
      requestedAt: Date,
      cancelledAt: Date,
      reason: String,
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      cancelledByName: String,
      refundStatus: {
        type: String,
        enum: ["Not Applicable", "Pending", "Completed", "Failed"],
        default: "Not Applicable",
      },
    },

    returnInfo: {
      status: {
        type: String,
        enum: ["None", "Requested", "Approved", "Rejected", "Returned", "Refund Pending", "Refunded"],
        default: "None",
      },
      reason: String,
      requestedAt: Date,
      approvedAt: Date,
      rejectedAt: Date,
      returnedAt: Date,
      refundPendingAt: Date,
      refundedAt: Date,
      returnIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Return",
        },
      ],
    },

    inventory: {
      reserved: { type: Boolean, default: false },
      reservedAt: Date,
      deductedAt: Date,
      restoredAt: Date,
    },

    refunds: [refundSchema],

    // Set by checkout so a retried request cannot create a duplicate order.
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    internalNotes: [
      {
        note: String,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdByName: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const generateOrderNumber = () => {
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `ORD-${date}-${crypto.randomInt(100000, 999999)}`;
};

orderSchema.pre("validate", function () {
  if (!this.orderNumber) {
    this.orderNumber = generateOrderNumber();
  }
  if (!this.orderStatus) {
    this.orderStatus = "Pending";
  }
  if (!this.paymentStatus) {
    this.paymentStatus = "Pending";
  }
  if (!Array.isArray(this.statusHistory)) {
    this.statusHistory = [];
  }
  if (this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.orderStatus,
      note: "Order created",
      source: "system",
      at: this.createdAt || new Date(),
    });
  }
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, createdAt: -1 });
orderSchema.index({ shippingMethod: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "customerInfo.email": 1 });
orderSchema.index({ "customerInfo.phone": 1 });
orderSchema.index({ "shippingInfo.phoneNo": 1 });
orderSchema.index({ "paymentInfo.id": 1 }, { sparse: true });
orderSchema.index({ "paymentTransactions.transactionId": 1 }, { unique: true, sparse: true });
orderSchema.index({ trackingId: 1 }, { sparse: true });
orderSchema.index({ awbNumber: 1 }, { sparse: true });

export { generateOrderNumber };
export default mongoose.model("Order", orderSchema);
