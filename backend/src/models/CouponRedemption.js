import mongoose from "mongoose";

/**
 * CouponRedemption is the immutable audit trail of every coupon use.
 *
 * Lifecycle:
 *   pending  → a checkout reserved the coupon but payment is not confirmed.
 *   success  → payment/order is confirmed and the coupon is consumed.
 *   reversed → cancelled order or expired reservation; usage is released.
 *   refunded → fully refunded order; usage is released.
 *
 * `isActive` mirrors pending/success so a single partial unique index on the
 * order guarantees one live coupon per order without relying on the status
 * enum. Historical rows (reversed/refunded) remain for auditing.
 */
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },

    couponCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Indexed through the partial unique index below, which also guarantees
    // one live redemption per order.
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // Total value granted by the coupon (item discount + shipping discount).
    discountAmount: {
      type: Number,
      required: true,
      min: [0, "Discount amount cannot be negative"],
      default: 0,
    },

    itemDiscountAmount: {
      type: Number,
      default: 0,
      min: [0, "Item discount cannot be negative"],
    },

    shippingDiscountAmount: {
      type: Number,
      default: 0,
      min: [0, "Shipping discount cannot be negative"],
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "success", "reversed", "refunded"],
      default: "pending",
      index: true,
    },

    // True for pending and success rows. Cleared when the redemption is
    // released so the partial unique index below only protects live rows.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    confirmedAt: Date,
    releasedAt: Date,

    // Pending reservations expire automatically so abandoned checkouts never
    // consume a coupon slot forever.
    expiresAt: {
      type: Date,
      index: true,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Reason cannot exceed 200 characters"],
    },
  },
  { timestamps: true }
);

// One live coupon per order (pending or success). This makes checkout retries
// idempotent while allowing historical reversed/refunded rows to remain.
couponRedemptionSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

couponRedemptionSchema.index({ coupon: 1, customer: 1, status: 1 });
couponRedemptionSchema.index({ coupon: 1, isActive: 1 });
couponRedemptionSchema.index({ customer: 1, status: 1 });
couponRedemptionSchema.index({ status: 1, redeemedAt: -1 });
couponRedemptionSchema.index({ status: 1, isActive: 1, expiresAt: 1 });

const CouponRedemption =
  mongoose.models.CouponRedemption ||
  mongoose.model("CouponRedemption", couponRedemptionSchema);

export default CouponRedemption;
