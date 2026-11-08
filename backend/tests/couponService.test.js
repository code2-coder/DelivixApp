import test from "node:test";
import assert from "node:assert/strict";
import CouponService from "../src/services/CouponService.js";
import {
  couponCreateSchema,
  couponUpdateSchema,
} from "../src/validators/coupon.validator.js";

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const validCoupon = (overrides = {}) => ({
  code: "QA-TEST-10",
  name: "QA Test Coupon",
  description: "Temporary coupon",
  discountType: "percentage",
  discountValue: 10,
  maxDiscount: 200,
  minOrderValue: 500,
  minQuantity: 1,
  startDate: iso(-60 * 60 * 1000),
  expiryDate: iso(7 * DAY),
  usageLimit: 100,
  perCustomerLimit: 2,
  firstOrderOnly: false,
  combinable: true,
  shippingMethods: ["standard", "express"],
  eligibleCategories: [],
  eligibleProducts: [],
  excludedCategories: [],
  excludedProducts: [],
  eligibleCustomers: [],
  isActive: true,
  ...overrides,
});

test("coupon create schema accepts a complete valid payload", () => {
  const parsed = couponCreateSchema.parse({ body: validCoupon() });
  assert.equal(parsed.body.code, "QA-TEST-10");
  assert.equal(parsed.body.discountValue, 10);
  assert.deepEqual(parsed.body.shippingMethods, ["standard", "express"]);
});

test("coupon create schema rejects unsafe or contradictory rules", () => {
  assert.throws(
    () => couponCreateSchema.parse({ body: validCoupon({ discountValue: 101 }) }),
    /cannot exceed 100/i
  );
  assert.throws(
    () => couponCreateSchema.parse({ body: validCoupon({ discountValue: 0 }) }),
    /greater than zero/i
  );
  assert.throws(
    () =>
      couponCreateSchema.parse({
        body: validCoupon({ discountType: "fixed", discountValue: 0 }),
      }),
    /greater than zero/i
  );
  assert.throws(
    () =>
      couponCreateSchema.parse({
        body: validCoupon({ discountType: "free_shipping", discountValue: 25 }),
      }),
    /value of 0/i
  );
  assert.throws(
    () =>
      couponCreateSchema.parse({
        body: validCoupon({
          startDate: iso(DAY),
          expiryDate: iso(-DAY),
        }),
      }),
    /after the start date/i
  );
  assert.throws(
    () => couponCreateSchema.parse({ body: validCoupon({ code: "bad code!" }) }),
    /uppercase letters/i
  );
  assert.throws(
    () =>
      couponCreateSchema.parse({
        body: validCoupon({ eligibleProducts: ["not-an-object-id"] }),
      }),
    /valid id/i
  );
  assert.throws(
    () => couponCreateSchema.parse({ body: validCoupon({ minQuantity: 0 }) }),
    /(>=1|greater than or equal to 1|at least 1)/i
  );
});

test("coupon update schema never injects create-time defaults", () => {
  const parsed = couponUpdateSchema.parse({
    params: { id: "6ae44795309ead53c0accbac" },
    body: { description: "Only the description changes" },
  });

  assert.deepEqual(parsed.body, { description: "Only the description changes" });
  assert.equal("shippingMethods" in parsed.body, false);
  assert.equal("eligibleProducts" in parsed.body, false);
  assert.equal("eligibleCustomers" in parsed.body, false);
  assert.equal("isActive" in parsed.body, false);
});

test("coupon payload sanitizer clamps targeting, codes and discount values", () => {
  const payload = CouponService._sanitizeCouponPayload(
    {
      code: "  qa mixed case  ",
      name: "  QA Coupon  ",
      description: "  trimmed  ",
      discountType: "percentage",
      discountValue: 12.345,
      maxDiscount: 50.678,
      minOrderValue: 500,
      minQuantity: 1,
      startDate: iso(-DAY),
      expiryDate: iso(DAY),
      usageLimit: null,
      perCustomerLimit: 2,
      shippingMethods: ["standard", "overnight", "standard", "express"],
      eligibleProducts: ["6ae44795309ead53c0accbac", "6ae44795309ead53c0accbac"],
    },
    { partial: false }
  );

  assert.equal(payload.code, "QAMIXEDCASE");
  assert.equal(payload.name, "QA Coupon");
  assert.equal(payload.description, "trimmed");
  assert.equal(payload.discountValue, 12.35);
  assert.equal(payload.maxDiscount, 50.68);
  assert.deepEqual(payload.shippingMethods, ["standard", "express"]);
  assert.deepEqual(payload.eligibleProducts, ["6ae44795309ead53c0accbac"]);
  assert.equal(payload.usageLimit, null);
  assert.throws(
    () =>
      CouponService._sanitizeCouponPayload(
        { ...validCoupon(), minOrderValue: -1 },
        { partial: false }
      ),
    /non-negative/i
  );
});

test("partial payload sanitizer preserves the existing discount type", () => {
  const payload = CouponService._sanitizeCouponPayload(
    { maxDiscount: 300 },
    { partial: true, fallbackDiscountType: "percentage" }
  );

  assert.deepEqual(payload, { maxDiscount: 300 });
});

test("fixed coupons cannot store a percentage cap", () => {
  const payload = CouponService._sanitizeCouponPayload(
    {
      ...validCoupon(),
      discountType: "fixed",
      discountValue: 250,
      maxDiscount: 500,
    },
    { partial: false }
  );

  assert.equal(payload.discountType, "fixed");
  assert.equal(payload.discountValue, 250);
  assert.equal(payload.maxDiscount, 0);
});

test("coupon summaries never expose customer targeting or audit fields", () => {
  const summary = CouponService._couponSummary({
    _id: "6ae44795309ead53c0accbac",
    code: "SAFE10",
    name: "Safe coupon",
    discountType: "percentage",
    discountValue: 10,
    eligibleCustomers: ["6ae44795309ead53c0accbad"],
    createdBy: "6ae44795309ead53c0accbae",
    createdByName: "admin",
    metadata: { secret: true },
  });

  assert.equal(summary.code, "SAFE10");
  assert.equal(summary.eligibleCustomers, undefined);
  assert.equal(summary.createdBy, undefined);
  assert.equal(summary.createdByName, undefined);
  assert.equal(summary.metadata, undefined);
});

test("computed coupon status follows the administrative lifecycle", () => {
  const present = new Date("2026-06-15T12:00:00.000Z");
  const base = {
    isArchived: false,
    isActive: true,
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    expiryDate: new Date("2026-06-30T00:00:00.000Z"),
    usageLimit: 10,
    usageCount: 0,
  };

  assert.equal(CouponService._computedStatus(base, present), "active");
  assert.equal(
    CouponService._computedStatus({ ...base, isArchived: true }, present),
    "archived"
  );
  assert.equal(
    CouponService._computedStatus({ ...base, isActive: false }, present),
    "disabled"
  );
  assert.equal(
    CouponService._computedStatus(
      { ...base, startDate: new Date("2026-07-01T00:00:00.000Z") },
      present
    ),
    "scheduled"
  );
  assert.equal(
    CouponService._computedStatus(
      { ...base, expiryDate: new Date("2026-06-01T00:00:00.000Z") },
      present
    ),
    "expired"
  );
  assert.equal(
    CouponService._computedStatus(
      { ...base, usageLimit: 5, usageCount: 5 },
      present
    ),
    "exhausted"
  );
});

test("sort parsing only allows whitelisted fields", () => {
  assert.deepEqual(CouponService._parseSort("-usageCount"), { usageCount: -1 });
  assert.deepEqual(CouponService._parseSort("expiryDate"), { expiryDate: 1 });
  assert.deepEqual(CouponService._parseSort("$where"), { createdAt: -1 });
  assert.deepEqual(CouponService._parseSort(undefined), { createdAt: -1 });
});

test("coupon codes are normalized before lookup", () => {
  assert.equal(CouponService._normalizeCode("  save 10 "), "SAVE10");
  assert.equal(CouponService._normalizeCode(null), "");
});
