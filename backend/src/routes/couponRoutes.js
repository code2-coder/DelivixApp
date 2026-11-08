import express from "express";
import couponController from "../controllers/couponController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validator.js";
import {
  couponListSchema,
  couponCreateSchema,
  couponUpdateSchema,
  couponStatusSchema,
  couponArchiveSchema,
  couponDeleteSchema,
  couponDuplicateSchema,
  couponValidateSchema,
  couponAnalyticsSchema,
} from "../validators/coupon.validator.js";
import { couponValidationLimiter } from "../middleware/couponRateLimit.middleware.js";

const router = express.Router();
const adminOrStaff = authorizeRoles("admin", "staff");

// ── Admin coupon management (static paths before /:id) ─────────────────

router.get(
  "/admin/coupons",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponListSchema),
  couponController.listCoupons
);

router.get(
  "/admin/coupons/stats",
  isAuthenticatedUser,
  adminOrStaff,
  couponController.getCouponStats
);

router.get(
  "/admin/coupons/analytics",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponAnalyticsSchema),
  couponController.getCouponAnalytics
);

router.get(
  "/admin/coupons/analytics/export",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponAnalyticsSchema),
  couponController.exportCouponAnalytics
);

router.post(
  "/admin/coupons",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponCreateSchema),
  couponController.createCoupon
);

// ── Coupon item routes ─────────────────────────────────────────────────

router.get(
  "/admin/coupons/:id",
  isAuthenticatedUser,
  adminOrStaff,
  couponController.getCoupon
);

router.put(
  "/admin/coupons/:id",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponUpdateSchema),
  couponController.updateCoupon
);

router.patch(
  "/admin/coupons/:id/active",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponStatusSchema),
  couponController.setCouponActive
);

router.patch(
  "/admin/coupons/:id/archive",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponArchiveSchema),
  couponController.archiveCoupon
);

router.delete(
  "/admin/coupons/:id",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponDeleteSchema),
  couponController.deleteCoupon
);

router.post(
  "/admin/coupons/:id/duplicate",
  isAuthenticatedUser,
  adminOrStaff,
  validate(couponDuplicateSchema),
  couponController.duplicateCoupon
);

// ── Customer-facing coupon validation (authenticated) ──────────────────

router.post(
  "/coupons/validate",
  isAuthenticatedUser,
  couponValidationLimiter,
  validate(couponValidateSchema),
  couponController.validateCoupon
);

// ── Internal: release redemption on cancellation/refund (admin) ────────

router.post(
  "/admin/coupons/reverse-redemption/:orderId",
  isAuthenticatedUser,
  adminOrStaff,
  couponController.reverseRedemptionForOrder
);

export default router;
