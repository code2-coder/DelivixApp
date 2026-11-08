import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import { sendResponse } from "../helpers/response.js";
import CouponService from "../services/CouponService.js";

// ── Admin: Coupon CRUD ─────────────────────────────────────────────────

export const listCoupons = catchAsyncErrors(async (req, res) => {
  const result = await CouponService.listCoupons(req.query);
  return sendResponse(res, 200, true, "Coupons fetched successfully", result);
});

export const getCouponStats = catchAsyncErrors(async (req, res) => {
  const stats = await CouponService.getStats();
  return sendResponse(res, 200, true, "Coupon statistics fetched successfully", {
    stats,
  });
});

export const getCoupon = catchAsyncErrors(async (req, res) => {
  const coupon = await CouponService.getCoupon(req.params.id);
  return sendResponse(res, 200, true, "Coupon fetched successfully", { coupon });
});

export const createCoupon = catchAsyncErrors(async (req, res) => {
  const coupon = await CouponService.createCoupon(req.body, req.user);
  return sendResponse(res, 201, true, "Coupon created successfully", { coupon });
});

export const updateCoupon = catchAsyncErrors(async (req, res) => {
  const coupon = await CouponService.updateCoupon(req.params.id, req.body, req.user);
  return sendResponse(res, 200, true, "Coupon updated successfully", { coupon });
});

export const setCouponActive = catchAsyncErrors(async (req, res) => {
  const coupon = await CouponService.setActive(req.params.id, req.body.isActive, req.user);
  return sendResponse(
    res,
    200,
    true,
    `Coupon ${req.body.isActive ? "activated" : "disabled"} successfully`,
    { coupon }
  );
});

export const archiveCoupon = catchAsyncErrors(async (req, res) => {
  const result = await CouponService.archiveCoupon(req.params.id, req.user);
  return sendResponse(res, 200, true, `Coupon ${result.action} successfully`, {
    coupon: result.coupon,
    action: result.action,
    reason: result.reason,
  });
});

export const deleteCoupon = catchAsyncErrors(async (req, res) => {
  const result = await CouponService.deleteCoupon(req.params.id, req.user);
  return sendResponse(res, 200, true, "Coupon deleted successfully", result);
});

export const duplicateCoupon = catchAsyncErrors(async (req, res) => {
  const coupon = await CouponService.duplicateCoupon(req.params.id, req.user);
  return sendResponse(res, 201, true, "Coupon duplicated successfully", { coupon });
});

// ── Public (customer-facing): Validate & calculate discount ────────────

export const validateCoupon = catchAsyncErrors(async (req, res) => {
  const result = await CouponService.calculateDiscount({
    code: req.body.code,
    user: req.user || null,
    items: req.body.items || [],
    shippingInfo: req.body.shippingInfo || {},
    shippingMethod: req.body.shippingMethod || "standard",
    currency: req.body.currency || "INR",
    shippingAmount: Number(req.body.shippingAmount || 0),
  });

  if (!result.valid) {
    return sendResponse(
      res,
      400,
      false,
      result.message || "Coupon could not be applied.",
      {
        coupon: result.coupon,
        eligibleSubtotal: result.eligibleSubtotal,
        breakdown: result.breakdown,
      }
    );
  }

  return sendResponse(res, 200, true, result.message, {
    coupon: result.coupon,
    discountAmount: result.discountAmount,
    eligibleSubtotal: result.eligibleSubtotal,
    shippingDiscount: result.shippingDiscount,
    totalDiscount: result.totalDiscount,
    breakdown: result.breakdown,
  });
});

// ── Analytics ──────────────────────────────────────────────────────────

export const getCouponAnalytics = catchAsyncErrors(async (req, res) => {
  const analytics = await CouponService.getAnalytics(req.query);
  return sendResponse(res, 200, true, "Coupon analytics fetched successfully", analytics);
});

export const exportCouponAnalytics = catchAsyncErrors(async (req, res) => {
  const csv = await CouponService.exportAnalyticsCsv(req.query);
  const filename = `delivix-coupons-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

// ── Redemption reversal (admin tooling / order cancellation fallback) ──

export const reverseRedemptionForOrder = catchAsyncErrors(async (req, res) => {
  const result = await CouponService.releaseRedemptionForOrder(req.params.orderId, {
    status: "reversed",
    reason: "Manually released by admin",
  });
  return sendResponse(res, 200, true, "Coupon redemption release processed", result);
});

export default {
  listCoupons,
  getCouponStats,
  getCoupon,
  createCoupon,
  updateCoupon,
  setCouponActive,
  archiveCoupon,
  deleteCoupon,
  duplicateCoupon,
  validateCoupon,
  getCouponAnalytics,
  exportCouponAnalytics,
  reverseRedemptionForOrder,
};
