import "dotenv/config";
import mongoose from "mongoose";
import Coupon from "../src/models/Coupon.js";
import CouponRedemption from "../src/models/CouponRedemption.js";
import CouponCustomerUsage from "../src/models/CouponCustomerUsage.js";
import CouponAuditLog from "../src/models/CouponAuditLog.js";
import Order from "../src/models/order.js";
import Product from "../src/models/product.js";

/**
 * End-to-end coupon smoke test against a running backend.
 *
 * Usage:
 *   node scripts/couponSmoke.js
 *
 * Requires the API on localhost:8085, the development OTP flow, and the same
 * MongoDB that the backend uses. Test coupons and orders are removed on exit.
 */

const API = (process.env.COUPON_SMOKE_API || "http://localhost:8085/api/v1").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.COUPON_SMOKE_ADMIN || "admin@delivix.com";
const CUSTOMER_EMAIL = process.env.COUPON_SMOKE_CUSTOMER || "priya.patel@delivix-customer.com";

const results = [];
const createdCodes = new Set();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pass = (message) => {
  results.push(message);
  console.log(`PASS  ${message}`);
};

async function call(method, path, { token, body, headers = {} } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: response.status, data, text };
}

const expectStatus = (response, expected, label) => {
  assert(
    response.status === expected,
    `${label}: expected HTTP ${expected}, got ${response.status} (${response.text.slice(0, 300)})`
  );
  return response.data;
};

async function login(email) {
  const sent = await call("POST", "/auth/send-otp", { body: { email } });
  const sentData = expectStatus(sent, 200, `send-otp ${email}`);
  assert(sentData.devOtp, `send-otp ${email}: devOtp missing`);
  const verified = await call("POST", "/auth/verify-otp", {
    body: { email, otp: sentData.devOtp },
  });
  const verifiedData = expectStatus(verified, 200, `verify-otp ${email}`);
  assert(verifiedData.token, `verify-otp ${email}: token missing`);
  return { token: verifiedData.token, user: verifiedData.user };
}

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

const couponPayload = (overrides = {}) => ({
  name: "QA Coupon Smoke",
  description: "Temporary coupon created by the automated smoke test.",
  discountType: "percentage",
  discountValue: 10,
  maxDiscount: 500,
  minOrderValue: 100,
  minQuantity: 1,
  startDate: iso(-60 * 60 * 1000),
  expiryDate: iso(7 * DAY),
  usageLimit: 10,
  perCustomerLimit: 3,
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

const orderPayload = (productId, couponCode, extra = {}) => ({
  items: [{ productId: String(productId), quantity: 1 }],
  shippingInfo: {
    fullName: "Coupon QA",
    email: CUSTOMER_EMAIL,
    addressLine1: "12 Coupon Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    phoneNo: "+919999999999",
    zipCode: "400001",
    country: "India",
  },
  shippingMethod: "standard",
  packagingOption: "standard",
  currency: "INR",
  couponCode,
  ...extra,
});

let adminToken;
let customerToken;
let customerUser;

async function run() {
  const admin = await login(ADMIN_EMAIL);
  adminToken = admin.token;
  const customer = await login(CUSTOMER_EMAIL);
  customerToken = customer.token;
  customerUser = customer.user;
  pass("Admin and customer authenticated through the development OTP flow");

  const products = await Product.find({ status: "published", stock: { $gte: 2 } })
    .sort({ price: 1 })
    .limit(5)
    .lean();
  assert(products.length >= 2, "At least two published products with stock are required");
  const mainProduct = products[0];
  const otherProduct = products.find(
    (product) => String(product._id) !== String(mainProduct._id)
  );
  assert(otherProduct, "A second product is required for scope tests");
  const unitPrice = Number(mainProduct.price);
  pass(`Using product ${mainProduct.name} (INR ${unitPrice}) for checkout tests`);

  // ── Existing data & guards ───────────────────────────────────────────────
  const list = expectStatus(
    await call("GET", "/admin/coupons?page=1&limit=100", { token: adminToken }),
    200,
    "coupon list"
  );
  assert(Array.isArray(list.coupons) && list.coupons.length >= 3, "Coupon list is empty");
  assert(Array.isArray(list.coupons) && list.pagination, "Coupon pagination missing");
  const legacy = list.coupons.find((coupon) => coupon.code === "TECH10");
  assert(legacy, "Migrated TECH10 coupon is missing");
  assert(legacy.discountType === "percentage", "TECH10 was not migrated to lowercase type");
  assert(legacy.minOrderAmount === undefined, "TECH10 still contains legacy minOrderAmount");
  pass("Coupon list and legacy schema migration verified");

  const stats = expectStatus(
    await call("GET", "/admin/coupons/stats", { token: adminToken }),
    200,
    "coupon stats"
  );
  assert(stats.stats && Number(stats.stats.totalCoupons) >= 3, "Coupon stats missing");
  pass("Coupon summary stats endpoint verified");

  const initialAnalytics = expectStatus(
    await call("GET", "/admin/coupons/analytics", { token: adminToken }),
    200,
    "coupon analytics"
  );
  assert(initialAnalytics.summary, "Coupon analytics summary missing");
  assert(Array.isArray(initialAnalytics.mostUsed), "Coupon analytics mostUsed missing");
  const initialDiscount = Number(initialAnalytics.summary.totalDiscountGranted || 0);
  pass("Coupon analytics endpoint verified");

  const csv = await call("GET", "/admin/coupons/analytics/export", { token: adminToken });
  expectStatus(csv, 200, "coupon CSV export");
  assert(
    csv.text.split(/\r?\n/)[0].startsWith("Coupon Code,Coupon Name"),
    "Coupon CSV header is wrong"
  );
  pass("Coupon analytics CSV export verified");

  const forbidden = await call("GET", "/admin/coupons", { token: customerToken });
  expectStatus(forbidden, 403, "customer admin access");
  pass("Customer is blocked from admin coupon endpoints");

  // ── Create / update / toggle ─────────────────────────────────────────────
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const mainCode = `QA-${suffix}`;
  const scopedCode = `QASCOPE-${suffix}`;
  const shippingCode = `QASHIP-${suffix}`;
  const expiredCode = `QAEXP-${suffix}`;
  const scheduledCode = `QASCHED-${suffix}`;
  const raceCode = `QARACE-${suffix}`;
  [mainCode, scopedCode, shippingCode, expiredCode, scheduledCode, raceCode].forEach((code) =>
    createdCodes.add(code)
  );

  const created = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({ code: mainCode, discountValue: 15, maxDiscount: 700 }),
    }),
    201,
    "create coupon"
  );
  const couponId = created.coupon.id;
  assert(created.coupon.code === mainCode, "Created coupon code mismatch");
  pass("Coupon created through the admin API");

  const updated = expectStatus(
    await call("PUT", `/admin/coupons/${couponId}`, {
      token: adminToken,
      body: { description: "Updated by coupon smoke test.", maxDiscount: 700 },
    }),
    200,
    "update coupon"
  );
  assert(updated.coupon.description.includes("Updated"), "Coupon update was not persisted");
  assert(Number(updated.coupon.maxDiscount) === 700, "Partial update reset maxDiscount");
  assert(
    Array.isArray(updated.coupon.shippingMethods) &&
      updated.coupon.shippingMethods.includes("express"),
    "Partial update reset shipping methods"
  );
  pass("Coupon update preserves untouched targeting and discount settings");

  const disabled = expectStatus(
    await call("PATCH", `/admin/coupons/${couponId}/active`, {
      token: adminToken,
      body: { isActive: false },
    }),
    200,
    "disable coupon"
  );
  assert(disabled.coupon.status === "disabled", "Disabled coupon status is wrong");
  const disabledValidation = await call("POST", "/coupons/validate", {
    token: customerToken,
    body: {
      code: mainCode,
      items: [{ productId: String(mainProduct._id), quantity: 1 }],
      shippingInfo: { country: "India" },
      shippingMethod: "standard",
      currency: "INR",
      shippingAmount: 0,
    },
  });
  expectStatus(disabledValidation, 400, "validate disabled coupon");
  pass("Disabled coupons are rejected at validation");

  const enabled = expectStatus(
    await call("PATCH", `/admin/coupons/${couponId}/active`, {
      token: adminToken,
      body: { isActive: true },
    }),
    200,
    "enable coupon"
  );
  assert(enabled.coupon.status === "active", "Enabled coupon status is wrong");
  pass("Coupon enable/disable verified");

  // ── Validation, quote, order lifecycle ───────────────────────────────────
  const validationBody = {
    code: mainCode,
    items: [{ productId: String(mainProduct._id), quantity: 1 }],
    shippingInfo: { country: "India" },
    shippingMethod: "standard",
    currency: "INR",
    shippingAmount: 0,
  };
  const validation = expectStatus(
    await call("POST", "/coupons/validate", { token: customerToken, body: validationBody }),
    200,
    "validate coupon"
  );
  const expectedDiscount = Number((unitPrice * 0.15).toFixed(2));
  assert(
    Number(validation.discountAmount) === expectedDiscount,
    `Expected discount ${expectedDiscount}, got ${validation.discountAmount}`
  );
  assert(
    validation.coupon.eligibleCustomers === undefined,
    "Validation response leaked coupon customer eligibility data"
  );
  pass("Coupon validation calculates the server-side discount");

  const quote = expectStatus(
    await call("POST", "/orders/quote", {
      token: customerToken,
      body: orderPayload(mainProduct._id, mainCode),
    }),
    200,
    "quote with coupon"
  );
  assert(Number(quote.quote.amounts.discountAmount) === expectedDiscount, "Quote discount mismatch");
  assert(
    Number(quote.quote.amounts.couponDiscount) === expectedDiscount,
    "Quote coupon discount mismatch"
  );
  assert(
    Number(quote.quote.amounts.totalAmount) ===
      Number((unitPrice - expectedDiscount).toFixed(2)),
    `Quote total mismatch: ${quote.quote.amounts.totalAmount}`
  );
  pass("Order quote applies the coupon and matches the payable total");

  const idempotencyKey = `coupon-smoke-${suffix}-1`;
  const orderResponse = await call("POST", "/orders/new", {
    token: customerToken,
    body: orderPayload(mainProduct._id, mainCode, {
      paymentMethod: "COD",
      idempotencyKey,
    }),
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const orderData = expectStatus(orderResponse, 201, "create COD order");
  const order = orderData.order;
  assert(order.coupon && order.coupon.code === mainCode, "Order coupon snapshot missing");
  assert(
    Number(order.coupon.discountAmount) === expectedDiscount,
    "Order coupon snapshot discount mismatch"
  );
  assert(Number(order.totalAmount) === Number((unitPrice - expectedDiscount).toFixed(2)), "Order total mismatch");

  let couponDoc = await Coupon.findById(couponId).lean();
  assert(Number(couponDoc.usageCount) === 1, `Coupon usageCount is ${couponDoc.usageCount}`);
  assert(Number(couponDoc.pendingCount) === 0, `Coupon pendingCount is ${couponDoc.pendingCount}`);
  let redemption = await CouponRedemption.findOne({ order: order._id }).lean();
  assert(redemption && redemption.status === "success", "COD redemption was not confirmed");
  let usage = await CouponCustomerUsage.findOne({
    coupon: couponId,
    customer: customerUser.id,
  }).lean();
  assert(usage && Number(usage.usedCount) === 1, "Per-customer usage was not incremented");
  pass("COD order consumes the coupon atomically and stores an immutable snapshot");

  const retry = expectStatus(
    await call("POST", "/orders/new", {
      token: customerToken,
      body: orderPayload(mainProduct._id, mainCode, {
        paymentMethod: "COD",
        idempotencyKey,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    }),
    200,
    "idempotent order retry"
  );
  assert(String(retry.order._id) === String(order._id), "Idempotent retry created a second order");
  couponDoc = await Coupon.findById(couponId).lean();
  assert(Number(couponDoc.usageCount) === 1, "Idempotent retry consumed the coupon twice");
  pass("Order retries with the same idempotency key are idempotent");

  const analyticsAfterOrder = expectStatus(
    await call("GET", "/admin/coupons/analytics", { token: adminToken }),
    200,
    "analytics after redemption"
  );
  const row = analyticsAfterOrder.mostUsed.find((entry) => entry.code === mainCode);
  assert(row && Number(row.totalRedemptions) === 1, "Analytics did not record the redemption");
  assert(
    Number(analyticsAfterOrder.summary.totalDiscountGranted) >=
      initialDiscount + expectedDiscount - 0.01,
    "Analytics discount total did not increase"
  );
  assert(
    analyticsAfterOrder.usageOverTime.some((entry) => Number(entry.redemptions) >= 1),
    "Analytics usage-over-time is empty"
  );
  pass("Analytics records successful redemptions, discounts and usage over time");

  const analyticsCsv = await call("GET", "/admin/coupons/analytics/export", {
    token: adminToken,
  });
  expectStatus(analyticsCsv, 200, "analytics CSV after redemption");
  assert(analyticsCsv.text.includes(mainCode), "CSV export does not contain the redeemed coupon");
  pass("CSV export contains the redeemed coupon row");

  const cancelled = expectStatus(
    await call("PATCH", `/orders/${order._id}/cancel`, {
      token: customerToken,
      body: { reason: "Coupon smoke test cleanup" },
    }),
    200,
    "cancel order"
  );
  assert(cancelled.order.orderStatus === "Cancelled", "Order was not cancelled");
  couponDoc = await Coupon.findById(couponId).lean();
  assert(Number(couponDoc.usageCount) === 0, "Cancellation did not release the coupon usage");
  redemption = await CouponRedemption.findOne({ order: order._id }).lean();
  assert(redemption && redemption.status === "reversed", "Redemption was not reversed");
  usage = await CouponCustomerUsage.findOne({
    coupon: couponId,
    customer: customerUser.id,
  }).lean();
  assert(usage && Number(usage.usedCount) === 0, "Per-customer usage was not restored");
  pass("Order cancellation releases the coupon usage and redemption");

  const analyticsAfterCancel = expectStatus(
    await call("GET", "/admin/coupons/analytics", { token: adminToken }),
    200,
    "analytics after cancellation"
  );
  assert(
    !analyticsAfterCancel.mostUsed.some((entry) => entry.code === mainCode),
    "Cancelled order still appears in coupon analytics"
  );
  assert(
    Number(analyticsAfterCancel.summary.totalDiscountGranted) === initialDiscount,
    "Cancelled order is still counted in discount analytics"
  );
  pass("Cancelled orders are excluded from coupon analytics");

  const reusable = expectStatus(
    await call("POST", "/coupons/validate", { token: customerToken, body: validationBody }),
    200,
    "validate coupon after cancel"
  );
  assert(Number(reusable.discountAmount) === expectedDiscount, "Released coupon is not reusable");
  pass("Released coupon can be reused by the same customer");

  // ── Scope, schedule and shipping rules ──────────────────────────────────
  const scoped = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({
        code: scopedCode,
        eligibleProducts: [String(otherProduct._id)],
      }),
    }),
    201,
    "create scoped coupon"
  );
  assert(scoped.coupon.code === scopedCode, "Scoped coupon code mismatch");
  const scopedValidation = await call("POST", "/coupons/validate", {
    token: customerToken,
    body: { ...validationBody, code: scopedCode },
  });
  expectStatus(scopedValidation, 400, "validate out-of-scope product");
  assert(
    /eligible/i.test(scopedValidation.data.message),
    `Unexpected out-of-scope message: ${scopedValidation.data.message}`
  );
  pass("Product-scoped coupons reject ineligible cart items");

  const expired = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({
        code: expiredCode,
        startDate: iso(-2 * DAY),
        expiryDate: iso(-1 * DAY),
      }),
    }),
    201,
    "create expired coupon"
  );
  assert(expired.coupon.code === expiredCode, "Expired coupon code mismatch");
  const expiredValidation = await call("POST", "/coupons/validate", {
    token: customerToken,
    body: { ...validationBody, code: expiredCode },
  });
  expectStatus(expiredValidation, 400, "validate expired coupon");
  pass("Expired coupons are rejected using server time");

  const scheduled = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({
        code: scheduledCode,
        startDate: iso(DAY),
        expiryDate: iso(5 * DAY),
      }),
    }),
    201,
    "create scheduled coupon"
  );
  assert(scheduled.coupon.code === scheduledCode, "Scheduled coupon code mismatch");
  const scheduledValidation = await call("POST", "/coupons/validate", {
    token: customerToken,
    body: { ...validationBody, code: scheduledCode },
  });
  expectStatus(scheduledValidation, 400, "validate scheduled coupon");
  pass("Scheduled coupons cannot be used before their start date");

  const expressQuote = expectStatus(
    await call("POST", "/orders/quote", {
      token: customerToken,
      body: orderPayload(mainProduct._id, null, { shippingMethod: "express" }),
    }),
    200,
    "express quote without coupon"
  );
  const expressShipping = Number(expressQuote.quote.amounts.shippingAmount);
  assert(expressShipping > 0, "Express shipping amount should be greater than zero");

  const shippingCoupon = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({
        code: shippingCode,
        discountType: "free_shipping",
        discountValue: 0,
        maxDiscount: 0,
        minOrderValue: 0,
      }),
    }),
    201,
    "create free-shipping coupon"
  );
  assert(shippingCoupon.coupon.discountType === "free_shipping", "Free-shipping type mismatch");
  const shippingValidation = expectStatus(
    await call("POST", "/coupons/validate", {
      token: customerToken,
      body: {
        ...validationBody,
        code: shippingCode,
        shippingMethod: "express",
        shippingAmount: expressShipping,
      },
    }),
    200,
    "validate free-shipping coupon"
  );
  assert(
    Number(shippingValidation.shippingDiscount) === expressShipping,
    "Free-shipping discount does not match the shipping amount"
  );
  const shippingQuote = expectStatus(
    await call("POST", "/orders/quote", {
      token: customerToken,
      body: orderPayload(mainProduct._id, shippingCode, { shippingMethod: "express" }),
    }),
    200,
    "quote with free-shipping coupon"
  );
  assert(
    Number(shippingQuote.quote.amounts.shippingDiscount) === expressShipping,
    "Quote shipping discount mismatch"
  );
  assert(Number(shippingQuote.quote.amounts.payableShipping) === 0, "Payable shipping is not zero");
  assert(
    Number(shippingQuote.quote.amounts.discountAmount) === 0,
    "Free shipping must not discount item prices"
  );
  pass("Free-shipping coupons discount shipping only, without double counting");

  const usdQuote = expectStatus(
    await call("POST", "/orders/quote", {
      token: customerToken,
      body: orderPayload(mainProduct._id, mainCode, { currency: "USD" }),
    }),
    200,
    "USD quote with coupon"
  );
  assert(usdQuote.quote.amounts.currency === "USD", "Quote currency was not converted");
  assert(
    Number(usdQuote.quote.amounts.couponDiscount) > 0 &&
      Number(usdQuote.quote.amounts.couponDiscount) < Number(usdQuote.quote.amounts.itemsPrice),
    "USD coupon discount is out of range"
  );
  assert(Number(usdQuote.quote.amounts.totalAmount) >= 0, "USD total is negative");
  pass("Coupon values are converted safely to the checkout currency");

  // ── Concurrency ─────────────────────────────────────────────────────────
  const raceCoupon = expectStatus(
    await call("POST", "/admin/coupons", {
      token: adminToken,
      body: couponPayload({
        code: raceCode,
        usageLimit: 1,
        perCustomerLimit: 5,
      }),
    }),
    201,
    "create race coupon"
  );
  assert(raceCoupon.coupon.code === raceCode, "Race coupon code mismatch");

  const racePayload = (key) =>
    orderPayload(mainProduct._id, raceCode, {
      paymentMethod: "COD",
      idempotencyKey: key,
    });
  const [raceA, raceB] = await Promise.all([
    call("POST", "/orders/new", {
      token: customerToken,
      body: racePayload(`coupon-smoke-${suffix}-race-a`),
      headers: { "Idempotency-Key": `coupon-smoke-${suffix}-race-a` },
    }),
    call("POST", "/orders/new", {
      token: customerToken,
      body: racePayload(`coupon-smoke-${suffix}-race-b`),
      headers: { "Idempotency-Key": `coupon-smoke-${suffix}-race-b` },
    }),
  ]);
  const raceStatuses = [raceA.status, raceB.status].sort();
  assert(
    raceStatuses[0] === 201 && raceStatuses[1] === 409,
    `Concurrent checkouts should produce one success and one conflict, got ${raceStatuses.join(",")} (${raceA.text.slice(0, 160)} | ${raceB.text.slice(0, 160)})`
  );
  const raceCouponDoc = await Coupon.findById(raceCoupon.coupon.id).lean();
  assert(Number(raceCouponDoc.usageCount) === 1, "Race winner did not consume the coupon");
  assert(Number(raceCouponDoc.pendingCount) === 0, "Race coupon left a pending reservation");
  const raceWinner = raceA.status === 201 ? raceA.data.order : raceB.data.order;
  expectStatus(
    await call("PATCH", `/orders/${raceWinner._id}/cancel`, {
      token: customerToken,
      body: { reason: "Coupon concurrency test cleanup" },
    }),
    200,
    "cancel race winner"
  );
  pass("Concurrent checkouts cannot exceed the coupon usage limit");

  // ── Duplicate / archive / delete protections ────────────────────────────
  const duplicate = expectStatus(
    await call("POST", `/admin/coupons/${couponId}/duplicate`, { token: adminToken }),
    201,
    "duplicate coupon"
  );
  assert(duplicate.coupon.code !== mainCode, "Duplicate reused the source code");
  createdCodes.add(duplicate.coupon.code);
  pass("Coupon duplication creates a new unique code");

  const archivedDuplicate = expectStatus(
    await call("PATCH", `/admin/coupons/${duplicate.coupon.id}/archive`, {
      token: adminToken,
      body: {},
    }),
    200,
    "archive duplicate"
  );
  assert(archivedDuplicate.action === "archived", "Duplicate was not archived");
  expectStatus(
    await call("GET", `/admin/coupons/${duplicate.coupon.id}`, { token: adminToken }),
    404,
    "fetch archived coupon"
  );
  expectStatus(
    await call("DELETE", `/admin/coupons/${duplicate.coupon.id}`, {
      token: adminToken,
      body: {},
    }),
    200,
    "delete archived duplicate"
  );
  pass("Archive hides a coupon and archived coupons can be deleted");

  const deleteProtected = await call("DELETE", `/admin/coupons/${couponId}`, {
    token: adminToken,
    body: {},
  });
  expectStatus(deleteProtected, 409, "delete coupon with redemption history");
  pass("Coupons with redemption history cannot be hard-deleted");

  const archived = expectStatus(
    await call("PATCH", `/admin/coupons/${couponId}/archive`, {
      token: adminToken,
      body: {},
    }),
    200,
    "archive redeemed coupon"
  );
  assert(
    archived.action === "deactivated",
    `Redeemed coupon should be deactivated, got ${archived.action}`
  );
  pass("Redeemed coupons are deactivated instead of archived");

  const auditActions = await CouponAuditLog.find({
    $or: [{ coupon: couponId }, { code: duplicate.coupon.code }],
  })
    .select("action")
    .lean();
  const actionNames = new Set(auditActions.map((entry) => entry.action));
  for (const expected of [
    "coupon.created",
    "coupon.updated",
    "coupon.disabled",
    "coupon.activated",
    "coupon.deactivated",
    "coupon.duplicated",
  ]) {
    assert(actionNames.has(expected), `Missing audit action ${expected}`);
  }
  pass("Admin coupon actions are written to the persistent audit log");

  return { mainCode, raceCode };
}

async function cleanup() {
  if (!createdCodes.size) return;
  const codes = [...createdCodes];
  const coupons = await Coupon.find({ code: { $in: codes } }).select("_id").lean();
  const couponIds = coupons.map((coupon) => coupon._id);
  const orders = await Order.find({ "coupon.code": { $in: codes } }).select("_id").lean();
  const orderIds = orders.map((order) => order._id);

  await CouponRedemption.deleteMany({ coupon: { $in: couponIds } });
  await CouponCustomerUsage.deleteMany({ coupon: { $in: couponIds } });
  await CouponAuditLog.deleteMany({
    $or: [{ coupon: { $in: couponIds } }, { code: { $in: codes } }],
  });
  await Order.deleteMany({ _id: { $in: orderIds } });
  await Coupon.deleteMany({ _id: { $in: couponIds } });
  console.log(`CLEAN  Removed ${codes.length} test coupons and ${orderIds.length} test orders`);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const summary = await run();
  console.log(`\n${results.length} coupon smoke checks passed (${summary.mainCode}).`);
} finally {
  await cleanup();
  await mongoose.disconnect();
}
