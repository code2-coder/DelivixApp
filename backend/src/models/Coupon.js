import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      maxlength: [30, "Coupon code cannot exceed 30 characters"],
      match: [/^[A-Z0-9_-]+$/, "Coupon code may only contain uppercase letters, numbers, underscores and hyphens"],
    },

    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
      maxlength: [120, "Coupon name cannot exceed 120 characters"],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // ── Discount type & value ──────────────────────────────────────────
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
      required: [true, "Discount type is required"],
    },

    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
      max: [10000, "Discount value is too large"],
    },

    // Maximum discount cap (only meaningful for percentage coupons).
    maxDiscount: {
      type: Number,
      default: 0,
      min: [0, "Maximum discount cannot be negative"],
    },

    // ── Eligibility thresholds ─────────────────────────────────────────
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },

    minQuantity: {
      type: Number,
      default: 1,
      min: [1, "Minimum quantity must be at least 1"],
    },

    // ── Validity window (server time is authoritative) ─────────────────
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      index: true,
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
    },

    // ── Usage limits ───────────────────────────────────────────────────
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
      min: [1, "Usage limit must be at least 1"],
    },

    usageCount: {
      type: Number,
      default: 0,
      min: [0, "Usage count cannot be negative"],
    },

    // Reservations created by checkout but not yet confirmed by a successful
    // payment. Pending reservations count against the global usage limit so two
    // concurrent checkouts can never oversell the same coupon slot.
    pendingCount: {
      type: Number,
      default: 0,
      min: [0, "Pending count cannot be negative"],
    },

    perCustomerLimit: {
      type: Number,
      default: 1,
      min: [1, "Per-customer limit must be at least 1"],
    },

    firstOrderOnly: {
      type: Boolean,
      default: false,
    },

    // Empty = every shipping method. Useful for restricting a free-shipping
    // coupon to standard or express delivery.
    shippingMethods: {
      type: [String],
      enum: ["standard", "express"],
      default: [],
    },

    combinable: {
      type: Boolean,
      default: true,
      description: "Whether this coupon can be combined with other coupons/promotions",
    },

    // ── Product / category scope ───────────────────────────────────────
    eligibleCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    eligibleProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    excludedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // ── Customer scope ─────────────────────────────────────────────────
    eligibleCustomers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ── Lifecycle ──────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdByName: {
      type: String,
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────
couponSchema.index({ isActive: 1, expiryDate: 1, startDate: 1 });
couponSchema.index({ isArchived: 1, isActive: 1 });
couponSchema.index({ usageCount: 1, usageLimit: 1 });
// `code` is already declared unique on the field itself. A second compound
// unique index on { code, isActive } conflicts with archived/disabled coupons
// and is intentionally not declared.

// ── Normalize code before save ─────────────────────────────────────────
couponSchema.pre("validate", function () {
  if (this.code) {
    this.code = String(this.code)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  }
});

// ── Virtual: computed status ───────────────────────────────────────────
couponSchema.virtual("status").get(function () {
  const now = new Date();
  if (this.isArchived) return "archived";
  if (!this.isActive) return "disabled";
  if (now < this.startDate) return "scheduled";
  if (now > this.expiryDate) return "expired";
  if (this.usageLimit != null && this.usageCount >= this.usageLimit) return "exhausted";
  return "active";
});

// Ensure virtuals are serialized.
couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);

export default Coupon;
