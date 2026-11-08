import mongoose from "mongoose";

/**
 * Persistent audit trail for coupon administration.
 *
 * Coupon logs are intentionally kept after a coupon is deleted so privileged
 * changes remain reviewable. No customer PII is stored here; only the acting
 * administrator, the coupon identity and a small action metadata object.
 */
const couponAuditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "system",
    },
    action: {
      type: String,
      required: true,
      maxlength: 60,
      index: true,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

couponAuditLogSchema.index({ createdAt: -1 });
couponAuditLogSchema.index({ coupon: 1, createdAt: -1 });

const CouponAuditLog = mongoose.model("CouponAuditLog", couponAuditLogSchema);

export default CouponAuditLog;
