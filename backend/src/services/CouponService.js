import mongoose from "mongoose";
import crypto from "crypto";
import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import CouponCustomerUsage from "../models/CouponCustomerUsage.js";
import CouponAuditLog from "../models/CouponAuditLog.js";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Order from "../models/order.js";
import { withTransaction } from "../utils/transaction.js";
import { toMoney } from "../utils/shippingCalculator.js";
import {
  convertPrice,
  fetchCurrentRates,
  SUPPORTED_CURRENCIES,
} from "../utils/priceConverter.js";
import { resolveInventoryTarget } from "../utils/inventoryTarget.js";
import logger from "../utils/logger.js";

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const now = () => new Date();

// Online payments get a short window to complete; an abandoned checkout must
// not hold a coupon slot forever.
const RESERVATION_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.COUPON_RESERVATION_TTL_MINUTES || 30) * 60 * 1000
);
const SWEEP_THROTTLE_MS = 60 * 1000;
const VALID_SHIPPING_METHODS = ["standard", "express"];

let lastSweepAt = 0;
let sweeperTimer = null;
let categoryCache = { at: 0, map: null };

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCurrency = (value) => {
  const currency = String(value || "INR").toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw httpError(`Currency ${currency} is not supported.`);
  }
  return currency;
};

const objectIdStrings = (values) =>
  Array.isArray(values)
    ? [...new Set(values.map(String).filter((value) => mongoose.isValidObjectId(value)))]
    : [];

/**
 * CouponService
 *
 * Central, server-side coupon engine. All eligibility checks and discount
 * calculations use trusted database records — never values supplied by the
 * client. Coupon usage is reserved at checkout and only consumed when the
 * order is paid/confirmed, with atomic global and per-customer limit guards.
 */
export class CouponService {
  constructor() {
    this._lastSweepAt = 0;
  }

  /**
   * Persist an administrative coupon action for later review. Audit failures
   * must never roll back a completed business operation, so they are logged
   * and swallowed.
   */
  async _writeAudit(action, coupon, admin, metadata = {}) {
    try {
      await CouponAuditLog.create({
        admin: admin?._id || null,
        adminName: admin?.name || admin?.email || "system",
        action,
        coupon: coupon?._id || coupon?.id || null,
        code: coupon?.code || "",
        metadata,
      });
    } catch (error) {
      logger.warn("Failed to write coupon audit log", {
        action,
        code: coupon?.code,
        error: error.message,
      });
    }
  }

  // ── Public API: validate + calculate discount for a cart ──────────────

  /**
   * Validate a coupon and calculate its discount for a cart.
   *
   * @param {Object} params
   * @param {string} params.code
   * @param {Object|null} params.user
   * @param {Array} params.items - [{productId, quantity, size, variantName}]
   * @param {Object} params.shippingInfo
   * @param {string} params.shippingMethod
   * @param {string} params.currency
   * @param {number} params.shippingAmount - backend-calculated shipping amount
   * @returns {Promise<Object>}
   */
  async calculateDiscount({
    code,
    user = null,
    items = [],
    shippingInfo = {},
    shippingMethod = "standard",
    currency = "INR",
    shippingAmount = 0,
  } = {}) {
    if (!code || !String(code).trim()) {
      return { valid: false, message: "Please enter a coupon code." };
    }

    await this._maybeSweepExpiredReservations();

    const normalizedCode = this._normalizeCode(code);
    const coupon = await Coupon.findOne({ code: normalizedCode }).lean();
    if (!coupon) {
      // Generic message to avoid coupon-code enumeration.
      return { valid: false, message: "This coupon code is invalid." };
    }

    const checkoutCurrency = normalizeCurrency(currency);
    const method = VALID_SHIPPING_METHODS.includes(shippingMethod)
      ? shippingMethod
      : "standard";

    const eligibility = await this._validateCouponEligibility(coupon, user, {
      shippingMethod: method,
    });
    if (!eligibility.valid) {
      // Only expose the customer-facing coupon summary. The raw document
      // contains eligibility customer ids and audit fields.
      return {
        valid: false,
        message: eligibility.message,
        coupon: this._couponSummary(coupon),
      };
    }

    const eligible = await this._computeEligibleItems(coupon, items);
    if (!eligible.eligibleItems.length) {
      return {
        valid: false,
        coupon: this._couponSummary(coupon),
        eligibleSubtotal: 0,
        message:
          eligible.excludedItems.length > 0
            ? "None of the items in your bag are eligible for this coupon."
            : "Add items to your bag before applying a coupon.",
        breakdown: eligible.breakdown,
      };
    }

    const minQuantity = Number(coupon.minQuantity || 1);
    if (eligible.eligibleQuantity < minQuantity) {
      return {
        valid: false,
        coupon: this._couponSummary(coupon),
        eligibleSubtotal: eligible.eligibleSubtotal,
        message: `This coupon requires at least ${minQuantity} eligible item(s).`,
        breakdown: eligible.breakdown,
      };
    }

    // Coupon values are stored in INR (the catalogue base currency). Convert
    // them to the checkout currency together with the eligible subtotal so the
    // discount can never be applied in the wrong currency.
    const rates = await fetchCurrentRates();
    const eligibleSubtotal = toMoney(
      convertPrice(eligible.eligibleSubtotalInINR, checkoutCurrency, rates)
    );
    const minOrderValue = toMoney(
      convertPrice(Number(coupon.minOrderValue || 0), checkoutCurrency, rates)
    );

    if (minOrderValue > 0 && eligibleSubtotal < minOrderValue) {
      return {
        valid: false,
        coupon: this._couponSummary(coupon),
        eligibleSubtotal,
        message: `Minimum order value of ${this._formatMoney(
          minOrderValue,
          checkoutCurrency
        )} required for this coupon.`,
        breakdown: eligible.breakdown,
      };
    }

    let discountAmount = 0;
    let shippingDiscount = 0;
    const calculationSteps = [];

    if (coupon.discountType === "free_shipping") {
      const availableShipping = Math.max(0, Number(shippingAmount) || 0);
      if (availableShipping <= 0) {
        return {
          valid: false,
          coupon: this._couponSummary(coupon),
          eligibleSubtotal,
          message: "Your order already qualifies for free shipping.",
          breakdown: eligible.breakdown,
        };
      }
      shippingDiscount = toMoney(availableShipping);
      calculationSteps.push({
        type: "free_shipping",
        description: "Free shipping applied",
        amount: shippingDiscount,
      });
    } else if (coupon.discountType === "fixed") {
      const fixedValue = toMoney(
        convertPrice(Number(coupon.discountValue || 0), checkoutCurrency, rates)
      );
      discountAmount = Math.min(fixedValue, eligibleSubtotal);
      calculationSteps.push({
        type: "fixed",
        description: `Flat ${this._formatMoney(fixedValue, checkoutCurrency)} off`,
        amount: discountAmount,
      });
    } else {
      const percentage = Number(coupon.discountValue || 0);
      const rawDiscount = (eligibleSubtotal * percentage) / 100;
      const cap = toMoney(
        convertPrice(Number(coupon.maxDiscount || 0), checkoutCurrency, rates)
      );
      discountAmount = cap > 0 ? Math.min(rawDiscount, cap) : rawDiscount;
      discountAmount = Math.min(discountAmount, eligibleSubtotal);
      calculationSteps.push({
        type: "percentage",
        description: `${percentage}% off eligible items${
          cap > 0 ? ` (max ${this._formatMoney(cap, checkoutCurrency)})` : ""
        }`,
        amount: toMoney(discountAmount),
      });
    }

    discountAmount = toMoney(discountAmount);
    shippingDiscount = toMoney(shippingDiscount);

    return {
      valid: true,
      coupon: this._couponSummary(coupon),
      discountAmount,
      eligibleSubtotal,
      shippingDiscount,
      totalDiscount: toMoney(discountAmount + shippingDiscount),
      breakdown: {
        eligibleItems: eligible.eligibleItems.length,
        excludedItems: eligible.excludedItems.length,
        eligibleQuantity: eligible.eligibleQuantity,
        eligibleSubtotal,
        calculationSteps,
        excluded: eligible.excludedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          reason: item.reason,
        })),
      },
      message: "Coupon applied successfully.",
    };
  }

  // ── Reservation lifecycle ────────────────────────────────────────────

  /**
   * Reserve a coupon slot for a new order. The redemption starts as `pending`
   * and only becomes `success` when payment is confirmed (or immediately for
   * COD). Global and per-customer limits are enforced with atomic updates.
   */
  async reserveRedemption({
    couponId,
    couponCode,
    customerId,
    orderId,
    discountAmount,
    itemDiscountAmount,
    shippingDiscountAmount,
    discountType,
    currency = "INR",
    session,
  } = {}) {
    if (!couponId || !customerId || !orderId) {
      throw httpError("Coupon, customer and order are required to reserve a coupon.", 400);
    }

    const work = async (effectiveSession) => {
      const existing = await CouponRedemption.findOne({
        order: orderId,
        isActive: true,
      }).session(effectiveSession || null);
      if (existing) return existing;

      const present = now();
      const coupon = await Coupon.findOneAndUpdate(
        {
          _id: couponId,
          isActive: true,
          isArchived: false,
          startDate: { $lte: present },
          expiryDate: { $gte: present },
          $or: [
            { usageLimit: null },
            {
              $expr: {
                $lt: [
                  {
                    $add: [
                      { $ifNull: ["$usageCount", 0] },
                      { $ifNull: ["$pendingCount", 0] },
                    ],
                  },
                  "$usageLimit",
                ],
              },
            },
          ],
        },
        { $inc: { pendingCount: 1 } },
        { returnDocument: "after", session: effectiveSession || undefined }
      );

      if (!coupon) {
        throw httpError(
          "This coupon is no longer available or has reached its usage limit.",
          409
        );
      }

      let rolledBackCoupon = false;
      const rollbackCoupon = async () => {
        if (rolledBackCoupon) return;
        rolledBackCoupon = true;
        await Coupon.updateOne(
          { _id: couponId, pendingCount: { $gte: 1 } },
          { $inc: { pendingCount: -1 } },
          { session: effectiveSession || undefined }
        ).catch(() => {});
      };

      try {
        const perCustomerLimit = Math.max(1, Number(coupon.perCustomerLimit || 1));
        await CouponCustomerUsage.findOneAndUpdate(
          { coupon: couponId, customer: customerId },
          { $setOnInsert: { usedCount: 0, pendingCount: 0 } },
          {
            upsert: true,
            returnDocument: "after",
            session: effectiveSession || undefined,
          }
        );

        const usage = await CouponCustomerUsage.findOneAndUpdate(
          {
            coupon: couponId,
            customer: customerId,
            $expr: {
              $lt: [
                {
                  $add: [
                    { $ifNull: ["$usedCount", 0] },
                    { $ifNull: ["$pendingCount", 0] },
                  ],
                },
                perCustomerLimit,
              ],
            },
          },
          { $inc: { pendingCount: 1 } },
          { returnDocument: "after", session: effectiveSession || undefined }
        );

        if (!usage) {
          throw httpError(
            "You have reached the maximum number of uses for this coupon.",
            409
          );
        }

        const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
        const [redemption] = await CouponRedemption.create(
          [
            {
              coupon: couponId,
              couponCode: this._normalizeCode(couponCode || coupon.code),
              customer: customerId,
              order: orderId,
              discountAmount: toMoney(Number(discountAmount) || 0),
              itemDiscountAmount: toMoney(Number(itemDiscountAmount) || 0),
              shippingDiscountAmount: toMoney(Number(shippingDiscountAmount) || 0),
              discountType: discountType || coupon.discountType,
              currency: normalizeCurrency(currency),
              status: "pending",
              isActive: true,
              expiresAt,
              reason: "Checkout reservation",
            },
          ],
          { session: effectiveSession || undefined }
        );

        return redemption;
      } catch (error) {
        // The transaction path rolls back automatically. The standalone
        // fallback needs explicit compensation so failed checkouts never leak
        // a pending coupon slot.
        if (!effectiveSession) {
          await CouponCustomerUsage.updateOne(
            {
              coupon: couponId,
              customer: customerId,
              pendingCount: { $gte: 1 },
            },
            { $inc: { pendingCount: -1 } }
          ).catch(() => {});
          await rollbackCoupon();
        }
        if (error?.code === 11000) {
          const existingAfterRace = await CouponRedemption.findOne({
            order: orderId,
            isActive: true,
          }).session(effectiveSession || null);
          if (existingAfterRace) return existingAfterRace;
        }
        throw error;
      }
    };

    const redemption = session ? await work(session) : await withTransaction(work);

    logger.info("Coupon reserved", {
      coupon: couponId,
      couponCode,
      customer: customerId,
      order: orderId,
      discountAmount,
    });

    return redemption;
  }

  /**
   * Confirm a pending reservation after payment succeeds (or COD is placed).
   * Idempotent: a second call is a no-op.
   */
  async confirmRedemption({ orderId, session } = {}) {
    if (!orderId) throw httpError("Order is required to confirm a coupon.", 400);

    const work = async (effectiveSession) => {
      const confirmedAt = now();
      const pending = await CouponRedemption.findOneAndUpdate(
        { order: orderId, status: "pending", isActive: true },
        {
          $set: {
            status: "success",
            confirmedAt,
            expiresAt: null,
            reason: "Order confirmed",
          },
        },
        { returnDocument: "after", session: effectiveSession || undefined }
      );

      if (pending) {
        await Coupon.updateOne(
          { _id: pending.coupon, pendingCount: { $gte: 1 } },
          { $inc: { pendingCount: -1, usageCount: 1 } },
          { session: effectiveSession || undefined }
        );
        await CouponCustomerUsage.updateOne(
          {
            coupon: pending.coupon,
            customer: pending.customer,
            pendingCount: { $gte: 1 },
          },
          { $inc: { pendingCount: -1, usedCount: 1 } },
          { session: effectiveSession || undefined }
        );
        return pending;
      }

      const alreadyConfirmed = await CouponRedemption.findOne({
        order: orderId,
        status: "success",
        isActive: true,
      }).session(effectiveSession || null);
      if (alreadyConfirmed) return alreadyConfirmed;

      // The reservation may have been swept after expiring while the provider
      // was still processing. The customer has paid the discounted amount, so
      // honour the coupon and record usage even in this rare race.
      const order = await Order.findById(orderId)
        .select("user coupon")
        .session(effectiveSession || null)
        .lean();
      if (!order?.coupon?.code) return null;

      let couponId = order.coupon.couponId;
      if (!couponId) {
        const coupon = await Coupon.findOne({ code: order.coupon.code })
          .select("_id")
          .session(effectiveSession || null)
          .lean();
        couponId = coupon?._id;
      }
      if (!couponId) return null;

      const [created] = await CouponRedemption.create(
        [
          {
            coupon: couponId,
            couponCode: order.coupon.code,
            customer: order.coupon.customer || order.user,
            order: orderId,
            discountAmount: toMoney(Number(order.coupon.discountAmount) || 0),
            itemDiscountAmount: toMoney(Number(order.coupon.discountAmount) || 0),
            shippingDiscountAmount: toMoney(Number(order.coupon.shippingDiscount) || 0),
            discountType: order.coupon.discountType,
            currency: order.currency || "INR",
            status: "success",
            isActive: true,
            confirmedAt,
            reason: "Payment confirmed after reservation expiry",
          },
        ],
        { session: effectiveSession || undefined }
      );

      await Coupon.updateOne(
        { _id: couponId },
        { $inc: { usageCount: 1 } },
        { session: effectiveSession || undefined }
      );
      await CouponCustomerUsage.updateOne(
        { coupon: couponId, customer: created.customer },
        { $inc: { usedCount: 1 } },
        { upsert: true, session: effectiveSession || undefined }
      );
      return created;
    };

    return session ? work(session) : withTransaction(work);
  }

  /**
   * Release a live redemption when an order is cancelled or fully refunded.
   * Pending reservations return their slot without counting as a use;
   * successful redemptions decrement the usage count.
   */
  async releaseRedemptionForOrder(
    orderId,
    { status = "reversed", reason = "Order cancelled or refunded", session } = {}
  ) {
    if (!orderId) return { reversed: false };
    const releaseStatus = status === "refunded" ? "refunded" : "reversed";

    const work = async (effectiveSession) => {
      const redemption = await CouponRedemption.findOneAndUpdate(
        { order: orderId, isActive: true },
        {
          $set: {
            status: releaseStatus,
            isActive: false,
            releasedAt: now(),
            expiresAt: null,
            reason: String(reason).slice(0, 200),
          },
        },
        { returnDocument: "before", session: effectiveSession || undefined }
      );

      if (!redemption) return { reversed: false };

      if (redemption.status === "pending") {
        await Coupon.updateOne(
          { _id: redemption.coupon, pendingCount: { $gte: 1 } },
          { $inc: { pendingCount: -1 } },
          { session: effectiveSession || undefined }
        );
        await CouponCustomerUsage.updateOne(
          {
            coupon: redemption.coupon,
            customer: redemption.customer,
            pendingCount: { $gte: 1 },
          },
          { $inc: { pendingCount: -1 } },
          { session: effectiveSession || undefined }
        );
      } else if (redemption.status === "success") {
        await Coupon.updateOne(
          { _id: redemption.coupon, usageCount: { $gte: 1 } },
          { $inc: { usageCount: -1 } },
          { session: effectiveSession || undefined }
        );
        await CouponCustomerUsage.updateOne(
          {
            coupon: redemption.coupon,
            customer: redemption.customer,
            usedCount: { $gte: 1 },
          },
          { $inc: { usedCount: -1 } },
          { session: effectiveSession || undefined }
        );
      }

      return {
        reversed: true,
        status: releaseStatus,
        couponId: redemption.coupon,
        couponCode: redemption.couponCode,
        discountAmount: redemption.discountAmount,
        previousStatus: redemption.status,
      };
    };

    const result = session ? await work(session) : await withTransaction(work);
    if (result.reversed) {
      logger.info("Coupon redemption released", {
        order: orderId,
        coupon: result.couponId,
        couponCode: result.couponCode,
        previousStatus: result.previousStatus,
        status: result.status,
      });
    }
    return result;
  }

  async reverseRedemptionForOrder(orderId, options = {}) {
    return this.releaseRedemptionForOrder(orderId, options);
  }

  /** Release every pending reservation whose TTL has elapsed. */
  async releaseExpiredReservations(limit = 200) {
    const expired = await CouponRedemption.find({
      status: "pending",
      isActive: true,
      expiresAt: { $lt: now() },
    })
      .sort({ expiresAt: 1 })
      .limit(Math.min(1000, Math.max(1, Number(limit) || 200)))
      .select("_id order")
      .lean();

    let released = 0;
    for (const reservation of expired) {
      try {
        const result = await this.releaseRedemptionForOrder(reservation.order, {
          reason: "Reservation expired before payment",
        });
        if (result.reversed) released += 1;
      } catch (error) {
        logger.warn("Failed to release expired coupon reservation", {
          order: reservation.order,
          error: error.message,
        });
      }
    }
    return released;
  }

  async _maybeSweepExpiredReservations() {
    if (Date.now() - this._lastSweepAt < SWEEP_THROTTLE_MS) return;
    this._lastSweepAt = Date.now();
    lastSweepAt = this._lastSweepAt;
    try {
      await this.releaseExpiredReservations(200);
    } catch (error) {
      logger.warn("Coupon reservation sweep failed", { error: error.message });
    }
  }

  /** Start the background reservation sweeper (safe to call repeatedly). */
  startReservationSweeper(intervalMs = 10 * 60 * 1000) {
    if (sweeperTimer) return sweeperTimer;
    sweeperTimer = setInterval(() => {
      this._lastSweepAt = 0;
      this._maybeSweepExpiredReservations().catch(() => {});
    }, Math.max(60 * 1000, Number(intervalMs) || 10 * 60 * 1000));
    if (typeof sweeperTimer.unref === "function") sweeperTimer.unref();
    return sweeperTimer;
  }

  // ── Admin: summary stats & list ──────────────────────────────────────

  async getStats() {
    await this._maybeSweepExpiredReservations();
    const present = now();

    const activeFilter = {
      isArchived: false,
      isActive: true,
      startDate: { $lte: present },
      expiryDate: { $gte: present },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
      ],
    };

    const [totalCoupons, activeCoupons, scheduledCoupons, expiredCoupons, exhaustedCoupons, pendingReservations] =
      await Promise.all([
        Coupon.countDocuments({ isArchived: false }),
        Coupon.countDocuments(activeFilter),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          startDate: { $gt: present },
        }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          expiryDate: { $lt: present },
        }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          usageLimit: { $ne: null },
          $expr: { $gte: ["$usageCount", "$usageLimit"] },
        }),
        CouponRedemption.countDocuments({
          status: "pending",
          isActive: true,
          expiresAt: { $gt: present },
        }),
      ]);

    const redemptionSummary = await this._analyticsSummary({});

    return {
      totalCoupons,
      activeCoupons,
      scheduledCoupons,
      expiredCoupons,
      exhaustedCoupons,
      successfulRedemptions: redemptionSummary.totalRedemptions,
      totalDiscountGranted: redemptionSummary.totalDiscountGranted,
      pendingReservations,
      totalOrdersWithCoupons: redemptionSummary.totalOrders,
      grossOrderValue: redemptionSummary.grossOrderValue,
      netRevenue: redemptionSummary.netRevenue,
      averageOrderValue: redemptionSummary.averageOrderValue,
    };
  }

  async listCoupons({
    page = 1,
    limit = 20,
    search,
    status,
    discountType,
    dateFrom,
    dateTo,
    sort = "-createdAt",
  } = {}) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    const present = now();
    const filter = { isArchived: status === "archived" };

    if (search) {
      const term = String(search).trim();
      if (term) {
        const or = [
          { code: { $regex: new RegExp(escapeRegex(term), "i") } },
          { name: { $regex: new RegExp(escapeRegex(term), "i") } },
          { description: { $regex: new RegExp(escapeRegex(term), "i") } },
        ];
        if (mongoose.isValidObjectId(term)) or.push({ _id: term });
        filter.$or = or;
      }
    }

    if (discountType && ["percentage", "fixed", "free_shipping"].includes(discountType)) {
      filter.discountType = discountType;
    }

    if (dateFrom || dateTo) {
      filter.expiryDate = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) filter.expiryDate.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          filter.expiryDate.$lte = d;
        }
      }
      if (Object.keys(filter.expiryDate).length === 0) delete filter.expiryDate;
    }

    // Status is a computed concept. Translate it into database predicates so
    // pagination totals stay correct (never filter after paginating).
    if (status && status !== "archived") {
      switch (status) {
        case "active":
          filter.isActive = true;
          filter.startDate = { $lte: present };
          filter.expiryDate = { $gte: present };
          filter.$and = [
            ...(filter.$and || []),
            {
              $or: [
                { usageLimit: null },
                { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
              ],
            },
          ];
          break;
        case "disabled":
          filter.isActive = false;
          break;
        case "scheduled":
          filter.isActive = true;
          filter.startDate = { $gt: present };
          break;
        case "expired":
          filter.isActive = true;
          filter.expiryDate = { $lt: present };
          break;
        case "exhausted":
          filter.isActive = true;
          filter.startDate = { $lte: present };
          filter.expiryDate = { $gte: present };
          filter.usageLimit = { $ne: null };
          filter.$expr = { $gte: ["$usageCount", "$usageLimit"] };
          break;
        default:
          break;
      }
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .sort(this._parseSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filter),
    ]);

    const enriched = coupons.map((coupon) => this._decorateCoupon(coupon, present));

    return {
      coupons: enriched,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getCoupon(id) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findById(id).lean();
    if (!coupon || coupon.isArchived) throw httpError("Coupon not found.", 404);
    return this._decorateCoupon(coupon, now());
  }

  // ── Admin: CRUD ──────────────────────────────────────────────────────

  async createCoupon(data, admin) {
    const payload = this._sanitizeCouponPayload(data, { partial: false });
    if (!payload.code) payload.code = await this._generateUniqueCode();

    const exists = await Coupon.exists({ code: payload.code });
    if (exists) throw httpError("A coupon with this code already exists.", 409);

    const coupon = new Coupon({
      ...payload,
      createdBy: admin?._id,
      createdByName: admin?.name || admin?.email,
      usageCount: 0,
      pendingCount: 0,
    });

    try {
      await coupon.save();
    } catch (error) {
      if (error?.code === 11000) {
        throw httpError("A coupon with this code already exists.", 409);
      }
      throw error;
    }

    logger.info("Coupon created", {
      coupon: coupon._id,
      code: coupon.code,
      admin: admin?._id,
    });
    await this._writeAudit("coupon.created", coupon, admin, {
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      usageLimit: coupon.usageLimit,
      perCustomerLimit: coupon.perCustomerLimit,
    });
    return this._decorateCoupon(coupon.toObject(), now());
  }

  async updateCoupon(id, updates, admin) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findById(id);
    if (!coupon || coupon.isArchived) throw httpError("Coupon not found.", 404);

    const sanitized = this._sanitizeCouponPayload(updates, {
      partial: true,
      fallbackDiscountType: coupon.discountType,
    });
    const merged = this._sanitizeCouponPayload(
      {
        ...coupon.toObject(),
        ...sanitized,
        code: sanitized.code || coupon.code,
      },
      { partial: false }
    );

    if (sanitized.code && sanitized.code !== coupon.code) {
      const existing = await Coupon.findOne({
        code: sanitized.code,
        _id: { $ne: id },
      }).lean();
      if (existing) throw httpError("A coupon with this code already exists.", 409);
    }

    Object.assign(coupon, merged);
    try {
      await coupon.save();
    } catch (error) {
      if (error?.code === 11000) {
        throw httpError("A coupon with this code already exists.", 409);
      }
      throw error;
    }

    logger.info("Coupon updated", {
      coupon: id,
      code: coupon.code,
      admin: admin?._id,
      changes: Object.keys(sanitized),
    });
    await this._writeAudit("coupon.updated", coupon, admin, {
      changes: Object.keys(sanitized),
    });
    return this._decorateCoupon(coupon.toObject(), now());
  }

  async setActive(id, isActive, admin) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, isArchived: false },
      { $set: { isActive: Boolean(isActive) } },
      { returnDocument: "after" }
    );
    if (!coupon) throw httpError("Coupon not found.", 404);
    logger.info("Coupon status changed", {
      coupon: id,
      isActive: Boolean(isActive),
      admin: admin?._id,
    });
    await this._writeAudit(
      isActive ? "coupon.activated" : "coupon.disabled",
      coupon,
      admin,
      { isActive: Boolean(isActive) }
    );
    return this._decorateCoupon(coupon.toObject(), now());
  }

  async archiveCoupon(id, admin) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findById(id);
    if (!coupon) throw httpError("Coupon not found.", 404);
    if (coupon.isArchived) {
      return { coupon: this._decorateCoupon(coupon.toObject(), now()), action: "archived" };
    }

    // Any redemption history (including pending reservations) must survive in
    // order records, so those coupons can only be deactivated.
    const used = await CouponRedemption.countDocuments({ coupon: id });
    if (used > 0) {
      coupon.isActive = false;
      await coupon.save();
      logger.info("Coupon deactivated (has redemptions)", { coupon: id, admin: admin?._id });
      await this._writeAudit("coupon.deactivated", coupon, admin, {
        reason: "Coupon has redemption history; archival blocked",
      });
      return {
        coupon: this._decorateCoupon(coupon.toObject(), now()),
        action: "deactivated",
        reason: "Coupon has redemption history; archival blocked",
      };
    }

    coupon.isArchived = true;
    coupon.isActive = false;
    await coupon.save();
    logger.info("Coupon archived", { coupon: id, admin: admin?._id });
    await this._writeAudit("coupon.archived", coupon, admin);
    return { coupon: this._decorateCoupon(coupon.toObject(), now()), action: "archived" };
  }

  async deleteCoupon(id, admin) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findById(id);
    if (!coupon) throw httpError("Coupon not found.", 404);

    const used = await CouponRedemption.countDocuments({ coupon: id });
    if (used > 0) {
      throw httpError(
        "Coupon cannot be deleted because it has redemption history. Deactivate or archive it instead.",
        409
      );
    }

    const deletedSnapshot = { _id: coupon._id, code: coupon.code };
    await coupon.deleteOne();
    await CouponCustomerUsage.deleteMany({ coupon: id });
    logger.info("Coupon deleted", { coupon: id, admin: admin?._id });
    await this._writeAudit("coupon.deleted", deletedSnapshot, admin, {
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    });
    return { deleted: true };
  }

  async duplicateCoupon(id, admin) {
    if (!mongoose.isValidObjectId(id)) throw httpError("Coupon not found.", 404);
    const coupon = await Coupon.findById(id).lean();
    if (!coupon || coupon.isArchived) throw httpError("Coupon not found.", 404);

    const newCode = await this._generateCopyCode(coupon.code);
    const duplicate = new Coupon({
      code: newCode,
      name: `${coupon.name} (Copy)`.slice(0, 120),
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minOrderValue: coupon.minOrderValue,
      minQuantity: coupon.minQuantity,
      startDate: coupon.startDate,
      expiryDate: coupon.expiryDate,
      usageLimit: coupon.usageLimit,
      usageCount: 0,
      pendingCount: 0,
      perCustomerLimit: coupon.perCustomerLimit,
      firstOrderOnly: coupon.firstOrderOnly,
      shippingMethods: coupon.shippingMethods || [],
      combinable: coupon.combinable,
      eligibleCategories: coupon.eligibleCategories,
      eligibleProducts: coupon.eligibleProducts,
      excludedCategories: coupon.excludedCategories,
      excludedProducts: coupon.excludedProducts,
      eligibleCustomers: coupon.eligibleCustomers,
      isActive: coupon.isActive,
      createdBy: admin?._id,
      createdByName: admin?.name || admin?.email,
    });
    await duplicate.save();
    logger.info("Coupon duplicated", {
      source: id,
      duplicate: duplicate._id,
      code: newCode,
      admin: admin?._id,
    });
    await this._writeAudit("coupon.duplicated", duplicate, admin, {
      sourceCoupon: id,
      sourceCode: coupon.code,
    });
    return this._decorateCoupon(duplicate.toObject(), now());
  }

  // ── Analytics ────────────────────────────────────────────────────────

  async getAnalytics({ dateFrom, dateTo, sort = "-totalRedemptions", limit = 50 } = {}) {
    await this._maybeSweepExpiredReservations();

    const match = { status: "success", isActive: true };
    const dateMatch = this._redemptionDateMatch(dateFrom, dateTo);
    if (dateMatch) match.redeemedAt = dateMatch;

    const maxRows = Math.min(200, Math.max(1, Number(limit) || 50));
    const sortSpec = this._analyticsSort(sort);

    const [summary, perCoupon, usageOverTime, nearingLimits, expiredUnused, statusCounts] =
      await Promise.all([
        this._analyticsSummary(match),
        this._perCouponAnalytics(match, sortSpec, maxRows),
        this._usageOverTime(match),
        this._nearingLimits(),
        this._expiredUnused(),
        this._couponStatusCounts(),
      ]);

    return {
      summary: {
        ...summary,
        totalCoupons: statusCounts.totalCoupons,
        activeCoupons: statusCounts.activeCoupons,
        scheduledCoupons: statusCounts.scheduledCoupons,
        expiredCoupons: statusCounts.expiredCoupons,
        exhaustedCoupons: statusCounts.exhaustedCoupons,
        pendingReservations: statusCounts.pendingReservations,
      },
      mostUsed: perCoupon,
      usageOverTime,
      nearingLimits,
      expiredUnused,
      generatedAt: new Date().toISOString(),
      range: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
    };
  }

  async exportAnalyticsCsv({ dateFrom, dateTo, limit = 200 } = {}) {
    const analytics = await this.getAnalytics({
      dateFrom,
      dateTo,
      limit: Math.min(200, Math.max(1, Number(limit) || 200)),
    });

    const headers = [
      "Coupon Code",
      "Coupon Name",
      "Discount Type",
      "Status",
      "Redemptions",
      "Unique Customers",
      "Discount Granted",
      "Gross Order Value",
      "Net Revenue",
      "Average Order Value",
      "Usage Count",
      "Usage Limit",
      "Pending Reservations",
      "Starts At",
      "Expires At",
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = (analytics.mostUsed || []).map((entry) => [
      entry.code || "",
      entry.name || "",
      entry.discountType || "",
      entry.status || "",
      entry.totalRedemptions,
      entry.uniqueCustomers,
      entry.totalDiscount,
      entry.grossOrderValue,
      entry.netRevenue,
      entry.averageOrderValue,
      entry.usageCount ?? 0,
      entry.usageLimit ?? "Unlimited",
      entry.pendingCount ?? 0,
      entry.startDate ? new Date(entry.startDate).toISOString() : "",
      entry.expiryDate ? new Date(entry.expiryDate).toISOString() : "",
    ]);

    return [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join(
      "\r\n"
    );
  }

  async _analyticsSummary(match) {
    const baseMatch = { isActive: true, status: "success", ...match };

    const result = await CouponRedemption.aggregate([
      { $match: baseMatch },
      ...this._validOrderLookupStages(),
      { $unwind: "$orderDoc" },
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: 1 },
          uniqueCustomers: { $addToSet: "$customer" },
          totalDiscountGranted: { $sum: "$discountAmount" },
          itemDiscountGranted: { $sum: "$itemDiscountAmount" },
          shippingDiscountGranted: { $sum: "$shippingDiscountAmount" },
          gross: {
            $sum: {
              $add: [
                { $ifNull: ["$orderDoc.itemsPrice", 0] },
                { $ifNull: ["$orderDoc.taxAmount", 0] },
                { $ifNull: ["$orderDoc.shippingAmount", 0] },
                { $ifNull: ["$orderDoc.packagingAmount", 0] },
              ],
            },
          },
          payable: { $sum: { $ifNull: ["$orderDoc.totalAmount", 0] } },
          refunded: {
            $sum: {
              $reduce: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$orderDoc.refunds", []] },
                    as: "refund",
                    cond: { $eq: ["$$refund.status", "Completed"] },
                  },
                },
                initialValue: 0,
                in: { $add: ["$$value", "$$this.amount"] },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalRedemptions: 1,
          uniqueCustomers: { $size: "$uniqueCustomers" },
          totalDiscountGranted: 1,
          itemDiscountGranted: 1,
          shippingDiscountGranted: 1,
          gross: 1,
          payable: 1,
          refunded: 1,
        },
      },
    ]);

    const summary = result[0] || {
      totalRedemptions: 0,
      uniqueCustomers: 0,
      totalDiscountGranted: 0,
      itemDiscountGranted: 0,
      shippingDiscountGranted: 0,
      gross: 0,
      payable: 0,
      refunded: 0,
    };
    const netRevenue = Math.max(
      0,
      toMoney(Number(summary.payable || 0) - Number(summary.refunded || 0))
    );
    const averageOrderValue = summary.totalRedemptions
      ? toMoney(netRevenue / summary.totalRedemptions)
      : 0;

    return {
      totalRedemptions: summary.totalRedemptions || 0,
      uniqueCustomers: summary.uniqueCustomers || 0,
      totalDiscountGranted: toMoney(summary.totalDiscountGranted || 0),
      itemDiscountGranted: toMoney(summary.itemDiscountGranted || 0),
      shippingDiscountGranted: toMoney(summary.shippingDiscountGranted || 0),
      grossOrderValue: toMoney(summary.gross || 0),
      netRevenue,
      refundedAmount: toMoney(summary.refunded || 0),
      totalOrders: summary.totalRedemptions || 0,
      averageOrderValue,
    };
  }

  async _perCouponAnalytics(match, sortSpec, limit) {
    return CouponRedemption.aggregate([
      { $match: match },
      ...this._validOrderLookupStages(),
      { $unwind: "$orderDoc" },
      {
        $group: {
          _id: "$coupon",
          code: { $first: "$couponCode" },
          totalRedemptions: { $sum: 1 },
          totalDiscount: { $sum: "$discountAmount" },
          itemDiscount: { $sum: "$itemDiscountAmount" },
          shippingDiscount: { $sum: "$shippingDiscountAmount" },
          uniqueCustomers: { $addToSet: "$customer" },
          grossOrderValue: {
            $sum: {
              $add: [
                { $ifNull: ["$orderDoc.itemsPrice", 0] },
                { $ifNull: ["$orderDoc.taxAmount", 0] },
                { $ifNull: ["$orderDoc.shippingAmount", 0] },
                { $ifNull: ["$orderDoc.packagingAmount", 0] },
              ],
            },
          },
          netRevenue: {
            $sum: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$orderDoc.totalAmount", 0] },
                    {
                      $reduce: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$orderDoc.refunds", []] },
                            as: "refund",
                            cond: { $eq: ["$$refund.status", "Completed"] },
                          },
                        },
                        initialValue: 0,
                        in: { $add: ["$$value", "$$this.amount"] },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "coupons",
          localField: "_id",
          foreignField: "_id",
          as: "couponDoc",
        },
      },
      { $unwind: { path: "$couponDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          couponId: "$_id",
          code: { $ifNull: ["$couponDoc.code", "$code"] },
          name: { $ifNull: ["$couponDoc.name", ""] },
          discountType: "$couponDoc.discountType",
          status: "$couponDoc.status",
          isActive: "$couponDoc.isActive",
          isArchived: "$couponDoc.isArchived",
          startDate: "$couponDoc.startDate",
          expiryDate: "$couponDoc.expiryDate",
          usageLimit: "$couponDoc.usageLimit",
          usageCount: "$couponDoc.usageCount",
          pendingCount: "$couponDoc.pendingCount",
          totalRedemptions: 1,
          totalDiscount: 1,
          itemDiscount: 1,
          shippingDiscount: 1,
          uniqueCustomers: { $size: "$uniqueCustomers" },
          grossOrderValue: 1,
          netRevenue: 1,
          averageOrderValue: {
            $cond: [
              { $gt: ["$totalRedemptions", 0] },
              { $divide: ["$netRevenue", "$totalRedemptions"] },
              0,
            ],
          },
        },
      },
      { $sort: sortSpec },
      { $limit: limit },
    ]);
  }

  async _usageOverTime(match) {
    return CouponRedemption.aggregate([
      { $match: match },
      ...this._validOrderLookupStages(),
      { $unwind: "$orderDoc" },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$redeemedAt",
              timezone: "Asia/Kolkata",
            },
          },
          redemptions: { $sum: 1 },
          discount: { $sum: "$discountAmount" },
          netRevenue: { $sum: { $ifNull: ["$orderDoc.totalAmount", 0] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          redemptions: 1,
          discount: 1,
          netRevenue: 1,
        },
      },
    ]);
  }

  async _nearingLimits() {
    return Coupon.aggregate([
      {
        $match: {
          isArchived: false,
          isActive: true,
          usageLimit: { $ne: null, $gt: 0 },
          expiryDate: { $gte: now() },
        },
      },
      {
        $addFields: {
          consumed: {
            $add: [
              { $ifNull: ["$usageCount", 0] },
              { $ifNull: ["$pendingCount", 0] },
            ],
          },
        },
      },
      {
        $addFields: {
          pctUsed: { $divide: ["$consumed", "$usageLimit"] },
          remaining: {
            $max: [0, { $subtract: ["$usageLimit", "$consumed"] }],
          },
        },
      },
      { $match: { pctUsed: { $gte: 0.8 } } },
      { $sort: { pctUsed: -1 } },
      { $limit: 20 },
      {
        $project: {
          code: 1,
          name: 1,
          discountType: 1,
          usageLimit: 1,
          usageCount: 1,
          pendingCount: 1,
          remaining: 1,
          pctUsed: 1,
          expiryDate: 1,
        },
      },
    ]);
  }

  async _expiredUnused() {
    return Coupon.aggregate([
      {
        $match: {
          isArchived: false,
          expiryDate: { $lt: now() },
          $and: [
            {
              $or: [
                { usageCount: 0 },
                { usageCount: { $exists: false } },
              ],
            },
            {
              $or: [
                { pendingCount: 0 },
                { pendingCount: { $exists: false } },
              ],
            },
          ],
        },
      },
      { $sort: { expiryDate: -1 } },
      { $limit: 20 },
      {
        $project: {
          code: 1,
          name: 1,
          discountType: 1,
          discountValue: 1,
          startDate: 1,
          expiryDate: 1,
          usageLimit: 1,
          usageCount: 1,
          pendingCount: 1,
        },
      },
    ]);
  }

  async _couponStatusCounts() {
    const present = now();
    const [totalCoupons, activeCoupons, scheduledCoupons, expiredCoupons, exhaustedCoupons, pendingReservations] =
      await Promise.all([
        Coupon.countDocuments({ isArchived: false }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          startDate: { $lte: present },
          expiryDate: { $gte: present },
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
          ],
        }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          startDate: { $gt: present },
        }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          expiryDate: { $lt: present },
        }),
        Coupon.countDocuments({
          isArchived: false,
          isActive: true,
          usageLimit: { $ne: null },
          $expr: { $gte: ["$usageCount", "$usageLimit"] },
        }),
        CouponRedemption.countDocuments({
          status: "pending",
          isActive: true,
          expiresAt: { $gt: present },
        }),
      ]);
    return {
      totalCoupons,
      activeCoupons,
      scheduledCoupons,
      expiredCoupons,
      exhaustedCoupons,
      pendingReservations,
    };
  }

  _validOrderLookupStages() {
    return [
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderDoc",
          pipeline: [
            {
              $match: {
                orderStatus: { $nin: ["Cancelled", "Refunded"] },
                paymentStatus: { $nin: ["Failed", "Cancelled"] },
              },
            },
          ],
        },
      },
    ];
  }

  _redemptionDateMatch(dateFrom, dateTo) {
    if (!dateFrom && !dateTo) return null;
    const match = {};
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!Number.isNaN(from.getTime())) match.$gte = from;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        match.$lte = to;
      }
    }
    return Object.keys(match).length ? match : null;
  }

  _analyticsSort(sort) {
    switch (sort) {
      case "totalRedemptions":
        return { totalRedemptions: 1, code: 1 };
      case "-totalDiscount":
        return { totalDiscount: -1, code: 1 };
      case "totalDiscount":
        return { totalDiscount: 1, code: 1 };
      case "-netRevenue":
        return { netRevenue: -1, code: 1 };
      case "netRevenue":
        return { netRevenue: 1, code: 1 };
      case "code":
        return { code: 1 };
      case "-totalRedemptions":
      default:
        return { totalRedemptions: -1, code: 1 };
    }
  }

  // ── Internals: eligibility & item calculation ─────────────────────────

  async _validateCouponEligibility(coupon, user, { shippingMethod = "standard" } = {}) {
    const present = now();

    if (coupon.isArchived) {
      return { valid: false, message: "This coupon is no longer available." };
    }
    if (!coupon.isActive) {
      return { valid: false, message: "This coupon has been disabled." };
    }
    if (coupon.startDate && present < new Date(coupon.startDate)) {
      return {
        valid: false,
        message: "This coupon is not yet active. It starts on a future date.",
      };
    }
    if (coupon.expiryDate && present > new Date(coupon.expiryDate)) {
      return { valid: false, message: "This coupon has expired." };
    }

    const usageLimit = coupon.usageLimit == null ? null : Number(coupon.usageLimit);
    if (
      usageLimit != null &&
      Number(coupon.usageCount || 0) + Number(coupon.pendingCount || 0) >= usageLimit
    ) {
      return { valid: false, message: "This coupon has reached its usage limit." };
    }

    const restrictedMethods = (coupon.shippingMethods || []).filter((method) =>
      VALID_SHIPPING_METHODS.includes(method)
    );
    if (restrictedMethods.length && !restrictedMethods.includes(shippingMethod)) {
      return {
        valid: false,
        message: `This coupon is only valid with ${restrictedMethods.join(
          " or "
        )} shipping.`,
      };
    }

    if (coupon.firstOrderOnly && user?._id) {
      const priorOrder = await Order.findOne({
        user: user._id,
        paymentStatus: { $in: ["Paid", "Partially Refunded"] },
        orderStatus: { $nin: ["Cancelled", "Refunded"] },
      })
        .select("_id")
        .lean();
      if (priorOrder) {
        return { valid: false, message: "This coupon is for first-time customers only." };
      }
    }

    if ((coupon.eligibleCustomers || []).length > 0) {
      if (!user?._id) {
        return { valid: false, message: "Please sign in to use this coupon." };
      }
      const allowed = coupon.eligibleCustomers.some(
        (id) => String(id) === String(user._id)
      );
      if (!allowed) {
        return { valid: false, message: "This coupon is not eligible for your account." };
      }
    }

    if (user?._id) {
      const usage = await CouponCustomerUsage.findOne({
        coupon: coupon._id,
        customer: user._id,
      })
        .select("usedCount")
        .lean();
      const limit = Math.max(1, Number(coupon.perCustomerLimit || 1));
      if ((usage?.usedCount || 0) >= limit) {
        return {
          valid: false,
          message: "You have reached the maximum number of uses for this coupon.",
        };
      }
    }

    return { valid: true };
  }

  async _computeEligibleItems(coupon, items = []) {
    const requested = Array.isArray(items) ? items : [];
    const productIds = [
      ...new Set(
        requested
          .map((item) => item?.productId)
          .filter((id) => id && mongoose.isValidObjectId(id))
          .map(String)
      ),
    ];

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } })
          .select(
            "name price stock images category sizes variants status"
          )
          .lean()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const eligibleCategoryIds = new Set(objectIdStrings(coupon.eligibleCategories));
    const excludedCategoryIds = new Set(objectIdStrings(coupon.excludedCategories));
    const eligibleProductIds = new Set(objectIdStrings(coupon.eligibleProducts));
    const excludedProductIds = new Set(objectIdStrings(coupon.excludedProducts));
    const needsCategories = eligibleCategoryIds.size > 0 || excludedCategoryIds.size > 0;
    const categoryMap = needsCategories ? await this._loadCategoryMap() : null;

    const eligibleItems = [];
    const excludedItems = [];
    let eligibleSubtotalInINR = 0;
    let eligibleQuantity = 0;

    for (const item of requested) {
      const productId = item?.productId ? String(item.productId) : "";
      const product = productMap.get(productId);
      if (!product) {
        excludedItems.push({
          ...item,
          name: "",
          reason: "Product not found",
        });
        continue;
      }

      const target = resolveInventoryTarget(product, item);
      if (!target.ok) {
        excludedItems.push({
          ...item,
          name: product.name,
          reason: target.reason,
        });
        continue;
      }

      const quantity = Math.max(1, Number(item.quantity) || 1);
      const price = Number(target.price) || 0;
      const lineTotal = toMoney(price * quantity);

      let eligible = true;
      let reason = "";

      if (excludedProductIds.has(productId)) {
        eligible = false;
        reason = "Product is excluded from this coupon";
      }

      if (eligible && eligibleProductIds.size > 0 && !eligibleProductIds.has(productId)) {
        eligible = false;
        reason = "Product is not eligible for this coupon";
      }

      if (eligible && categoryMap) {
        const categoryChain = this._categoryChain(product.category, categoryMap);

        if (
          excludedCategoryIds.size > 0 &&
          [...categoryChain].some((id) => excludedCategoryIds.has(id))
        ) {
          eligible = false;
          reason = "Product category is excluded from this coupon";
        }

        if (
          eligible &&
          eligibleCategoryIds.size > 0 &&
          ![...categoryChain].some((id) => eligibleCategoryIds.has(id))
        ) {
          eligible = false;
          reason = "Product category is not eligible for this coupon";
        }
      }

      if (eligible) {
        eligibleItems.push({
          ...item,
          productId: product._id,
          name: product.name,
          product,
          price,
          quantity,
          lineTotal,
        });
        eligibleSubtotalInINR += lineTotal;
        eligibleQuantity += quantity;
      } else {
        excludedItems.push({
          ...item,
          productId: product._id,
          name: product.name,
          price,
          lineTotal,
          reason,
        });
      }
    }

    return {
      eligibleItems,
      excludedItems,
      eligibleQuantity,
      eligibleSubtotalInINR: toMoney(eligibleSubtotalInINR),
      eligibleSubtotal: toMoney(eligibleSubtotalInINR),
      breakdown: {
        eligibleSubtotalInINR: toMoney(eligibleSubtotalInINR),
        eligibleQuantity,
      },
    };
  }

  async _loadCategoryMap() {
    if (categoryCache.map && Date.now() - categoryCache.at < 60 * 1000) {
      return categoryCache.map;
    }
    const categories = await Category.find({})
      .select("_id name parentCategory parent")
      .lean();
    const map = new Map(categories.map((category) => [String(category._id), category]));
    categoryCache = { at: Date.now(), map };
    return map;
  }

  _categoryChain(categoryId, categoryMap) {
    const chain = new Set();
    let current = categoryId ? String(categoryId) : null;
    let guard = 0;
    while (current && categoryMap.has(current) && guard < 20) {
      if (chain.has(current)) break;
      chain.add(current);
      const category = categoryMap.get(current);
      current = category?.parentCategory || category?.parent
        ? String(category.parentCategory || category.parent)
        : null;
      guard += 1;
    }
    return chain;
  }

  // ── Internals: validation / normalization ────────────────────────────

  _sanitizeCouponPayload(
    data = {},
    { partial = false, fallbackDiscountType = null } = {}
  ) {
    const source = data && typeof data === "object" ? data : {};
    const has = (key) => Object.prototype.hasOwnProperty.call(source, key);
    const payload = {};

    const assign = (key, value) => {
      if (!partial || has(key)) payload[key] = value;
    };

    if (has("code")) {
      const code = source.code ? this._normalizeCode(source.code) : "";
      if (code) payload.code = code;
    }

    if (has("name") || !partial) {
      const name = String(source.name || "").trim();
      if (name.length < 2) throw httpError("Coupon name must be at least 2 characters.");
      payload.name = name.slice(0, 120);
    }

    if (has("description") || !partial) {
      payload.description = String(source.description || "").trim().slice(0, 500);
    }

    if (has("discountType") || !partial) {
      const type = String(source.discountType || "");
      if (!["percentage", "fixed", "free_shipping"].includes(type)) {
        throw httpError("Please choose a valid discount type.");
      }
      payload.discountType = type;
    }

    const discountType =
      payload.discountType || source.discountType || fallbackDiscountType;
    if (has("discountValue") || !partial) {
      const value = Number(source.discountValue || 0);
      if (!Number.isFinite(value) || value < 0) {
        throw httpError("Discount value must be a non-negative number.");
      }
      if (discountType === "percentage" && value > 100) {
        throw httpError("Percentage discount cannot exceed 100%.");
      }
      if (discountType === "free_shipping" && value !== 0) {
        throw httpError("Free-shipping coupons do not take a discount value.");
      }
      if (["percentage", "fixed"].includes(discountType) && value <= 0) {
        throw httpError("Discount value must be greater than zero.");
      }
      payload.discountValue = toMoney(value);
    }

    if (has("maxDiscount") || !partial) {
      const value = Number(source.maxDiscount || 0);
      if (!Number.isFinite(value) || value < 0) {
        throw httpError("Maximum discount must be a non-negative number.");
      }
      payload.maxDiscount = discountType === "percentage" ? toMoney(value) : 0;
    }

    if (has("minOrderValue") || !partial) {
      const value = Number(source.minOrderValue || 0);
      if (!Number.isFinite(value) || value < 0) {
        throw httpError("Minimum order value must be a non-negative number.");
      }
      payload.minOrderValue = toMoney(value);
    }

    if (has("minQuantity") || !partial) {
      const value = Number(source.minQuantity ?? 1);
      if (!Number.isInteger(value) || value < 1) {
        throw httpError("Minimum quantity must be a whole number of at least 1.");
      }
      payload.minQuantity = value;
    }

    if (has("startDate") || !partial) {
      const date = new Date(source.startDate);
      if (Number.isNaN(date.getTime())) throw httpError("Start date must be a valid date.");
      payload.startDate = date;
    }

    if (has("expiryDate") || !partial) {
      const date = new Date(source.expiryDate);
      if (Number.isNaN(date.getTime())) throw httpError("Expiry date must be a valid date.");
      payload.expiryDate = date;
    }

    if (
      payload.startDate &&
      payload.expiryDate &&
      payload.expiryDate.getTime() <= payload.startDate.getTime()
    ) {
      throw httpError("Expiry date must be after the start date.");
    }

    if (has("usageLimit") || !partial) {
      if (source.usageLimit === null || source.usageLimit === "" || source.usageLimit === undefined) {
        payload.usageLimit = null;
      } else {
        const value = Number(source.usageLimit);
        if (!Number.isInteger(value) || value < 1) {
          throw httpError("Usage limit must be a whole number of at least 1.");
        }
        payload.usageLimit = value;
      }
    }

    if (has("perCustomerLimit") || !partial) {
      const value = Number(source.perCustomerLimit ?? 1);
      if (!Number.isInteger(value) || value < 1) {
        throw httpError("Per-customer limit must be a whole number of at least 1.");
      }
      payload.perCustomerLimit = value;
    }

    if (has("firstOrderOnly") || !partial) {
      payload.firstOrderOnly = Boolean(source.firstOrderOnly);
    }
    if (has("combinable") || !partial) {
      payload.combinable = source.combinable === undefined ? true : Boolean(source.combinable);
    }
    if (has("isActive") || !partial) {
      payload.isActive = source.isActive === undefined ? true : Boolean(source.isActive);
    }

    if (has("shippingMethods") || !partial) {
      payload.shippingMethods = Array.isArray(source.shippingMethods)
        ? [...new Set(source.shippingMethods.filter((method) => VALID_SHIPPING_METHODS.includes(method)))]
        : [];
    }

    for (const key of [
      "eligibleCategories",
      "eligibleProducts",
      "excludedCategories",
      "excludedProducts",
      "eligibleCustomers",
    ]) {
      if (has(key) || !partial) payload[key] = objectIdStrings(source[key]);
    }

    if (!partial && (!payload.startDate || !payload.expiryDate)) {
      throw httpError("Start date and expiry date are required.");
    }

    return payload;
  }

  _normalizeCode(code) {
    return String(code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  async _generateUniqueCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `DLX-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      if (!(await Coupon.exists({ code }))) return code;
    }
    throw httpError("Could not generate a unique coupon code. Please try again.", 500);
  }

  async _generateCopyCode(baseCode) {
    const cleanBase = String(baseCode || "COUPON").slice(0, 20);
    let candidate = `${cleanBase}-COPY`;
    let suffix = 2;
    while (await Coupon.exists({ code: candidate })) {
      candidate = `${cleanBase}-COPY-${suffix++}`.slice(0, 30);
    }
    return candidate;
  }

  _parseSort(sort) {
    const allowed = new Set([
      "createdAt",
      "updatedAt",
      "code",
      "name",
      "usageCount",
      "expiryDate",
      "startDate",
      "discountValue",
      "minOrderValue",
    ]);
    const raw = String(sort || "-createdAt");
    const direction = raw.startsWith("-") ? -1 : 1;
    const field = raw.replace(/^[-+]/, "");
    return allowed.has(field) ? { [field]: direction } : { createdAt: -1 };
  }

  _decorateCoupon(coupon, present = now()) {
    const usageLimit = coupon.usageLimit == null ? null : Number(coupon.usageLimit);
    const consumed = Number(coupon.usageCount || 0) + Number(coupon.pendingCount || 0);
    return {
      ...coupon,
      id: coupon._id,
      status: this._computedStatus(coupon, present),
      availableUses: usageLimit == null ? null : Math.max(0, usageLimit - consumed),
    };
  }

  _computedStatus(coupon, present = now()) {
    if (coupon.isArchived) return "archived";
    if (!coupon.isActive) return "disabled";
    if (coupon.startDate && present < new Date(coupon.startDate)) return "scheduled";
    if (coupon.expiryDate && present > new Date(coupon.expiryDate)) return "expired";
    if (
      coupon.usageLimit != null &&
      Number(coupon.usageCount || 0) >= Number(coupon.usageLimit)
    ) {
      return "exhausted";
    }
    return "active";
  }

  _couponSummary(coupon) {
    return {
      id: coupon._id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minOrderValue: coupon.minOrderValue,
      minQuantity: coupon.minQuantity,
      shippingMethods: coupon.shippingMethods || [],
      isActive: coupon.isActive,
      isArchived: coupon.isArchived,
      startDate: coupon.startDate,
      expiryDate: coupon.expiryDate,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      pendingCount: coupon.pendingCount,
      perCustomerLimit: coupon.perCustomerLimit,
      firstOrderOnly: coupon.firstOrderOnly,
      combinable: coupon.combinable,
    };
  }

  _formatMoney(amount, currency = "INR") {
    try {
      return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-AU", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return String(amount);
    }
  }
}

// Backwards-compatible helper used by older diagnostics.
export const getLastReservationSweepAt = () => lastSweepAt;

export default new CouponService();
