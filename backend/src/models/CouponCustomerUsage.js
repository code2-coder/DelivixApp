import mongoose from "mongoose";

/**
 * Atomic per-customer coupon usage counter.
 *
 * Counting redemption documents inside a transaction is not enough under
 * concurrent checkouts: two requests can both read "0 uses" before either
 * inserts. This single document acts as a lock-free counter and is updated with
 * conditional atomic operators.
 */
const couponCustomerUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    pendingCount: {
      type: Number,
      default: 0,
      min: [0, "Pending count cannot be negative"],
    },
  },
  { timestamps: true }
);

couponCustomerUsageSchema.index({ coupon: 1, customer: 1 }, { unique: true });

const CouponCustomerUsage =
  mongoose.models.CouponCustomerUsage ||
  mongoose.model("CouponCustomerUsage", couponCustomerUsageSchema);

export default CouponCustomerUsage;
