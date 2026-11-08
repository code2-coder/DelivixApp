import Coupon from "../models/Coupon.js";
import logger from "../utils/logger.js";

/**
 * Normalize coupons created by the legacy promotion schema.
 *
 * The original data set used:
 *   discountType: "PERCENTAGE" | "FLAT" | "FREE_SHIPPING"
 *   minOrderAmount, maxDiscountAmount, usedCount, perUserLimit,
 *   validFrom, validUntil
 *
 * The current coupon engine expects the fields declared in `models/Coupon.js`.
 * This migration is idempotent and only touches documents that still contain
 * legacy fields, so existing coupon codes and redemption counts are preserved.
 */
const LEGACY_TYPE_MAP = {
  PERCENTAGE: "percentage",
  FLAT: "fixed",
  FIXED: "fixed",
  AMOUNT: "fixed",
  FREE_SHIPPING: "free_shipping",
  FREE_SHIPPING_ONLY: "free_shipping",
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toDate = (value, fallback) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : fallback;
};

export const migrateLegacyCoupons = async () => {
  const legacyFilter = {
    $or: [
      { discountType: { $in: Object.keys(LEGACY_TYPE_MAP) } },
      { minOrderAmount: { $exists: true } },
      { maxDiscountAmount: { $exists: true } },
      { validFrom: { $exists: true } },
      { validUntil: { $exists: true } },
      { startDate: { $exists: false } },
      { expiryDate: { $exists: false } },
      { name: { $exists: false } },
    ],
  };

  const legacyCoupons = await Coupon.collection.find(legacyFilter).toArray();
  if (!legacyCoupons.length) return { migrated: 0 };

  let migrated = 0;
  for (const coupon of legacyCoupons) {
    const startDate = toDate(
      coupon.startDate ?? coupon.validFrom,
      new Date()
    );
    const expiryDate = toDate(
      coupon.expiryDate ?? coupon.validUntil,
      new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000)
    );
    if (expiryDate <= startDate) {
      expiryDate.setTime(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const rawType = String(coupon.discountType || "").toUpperCase();
    const discountType =
      LEGACY_TYPE_MAP[rawType] ||
      (rawType === "PERCENTAGE" ? "percentage" : rawType === "FLAT" ? "fixed" : "fixed");
    const discountValue =
      discountType === "free_shipping"
        ? 0
        : Math.max(0, toNumber(coupon.discountValue ?? coupon.value, 0));

    const update = {
      $set: {
        name: coupon.name || coupon.title || coupon.code || "Legacy coupon",
        description: coupon.description || "",
        discountType,
        discountValue,
        maxDiscount: discountType === "percentage"
          ? Math.max(0, toNumber(coupon.maxDiscount ?? coupon.maxDiscountAmount, 0))
          : 0,
        minOrderValue: Math.max(
          0,
          toNumber(coupon.minOrderValue ?? coupon.minOrderAmount, 0)
        ),
        minQuantity: Math.max(1, toNumber(coupon.minQuantity, 1)),
        startDate,
        expiryDate,
        usageLimit:
          coupon.usageLimit === null || coupon.usageLimit === undefined
            ? null
            : Math.max(1, toNumber(coupon.usageLimit, 1)),
        usageCount: Math.max(0, toNumber(coupon.usageCount ?? coupon.usedCount, 0)),
        pendingCount: Math.max(0, toNumber(coupon.pendingCount, 0)),
        perCustomerLimit: Math.max(
          1,
          toNumber(coupon.perCustomerLimit ?? coupon.perUserLimit, 1)
        ),
        firstOrderOnly: Boolean(coupon.firstOrderOnly),
        combinable: coupon.combinable !== false,
        shippingMethods: Array.isArray(coupon.shippingMethods)
          ? coupon.shippingMethods.filter((method) =>
              ["standard", "express"].includes(method)
            )
          : [],
        eligibleCategories: Array.isArray(coupon.eligibleCategories)
          ? coupon.eligibleCategories
          : [],
        eligibleProducts: Array.isArray(coupon.eligibleProducts)
          ? coupon.eligibleProducts
          : [],
        excludedCategories: Array.isArray(coupon.excludedCategories)
          ? coupon.excludedCategories
          : [],
        excludedProducts: Array.isArray(coupon.excludedProducts)
          ? coupon.excludedProducts
          : [],
        eligibleCustomers: Array.isArray(coupon.eligibleCustomers)
          ? coupon.eligibleCustomers
          : [],
        isActive: coupon.isActive !== false,
        isArchived: Boolean(coupon.isArchived),
      },
      $unset: {
        minOrderAmount: "",
        maxDiscountAmount: "",
        usedCount: "",
        perUserLimit: "",
        validFrom: "",
        validUntil: "",
        value: "",
        title: "",
      },
    };

    await Coupon.collection.updateOne({ _id: coupon._id }, update);
    migrated += 1;
  }

  logger.info("Legacy coupons migrated", { migrated });
  return { migrated };
};

export default migrateLegacyCoupons;
