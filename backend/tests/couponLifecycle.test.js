import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import { connectDB, disconnectDB } from "../src/config/database.js";
import User from "../src/models/User.js";
import Product from "../src/models/product.js";
import Order from "../src/models/order.js";
import Coupon from "../src/models/Coupon.js";
import CouponRedemption from "../src/models/CouponRedemption.js";
import CouponCustomerUsage from "../src/models/CouponCustomerUsage.js";
import CouponAuditLog from "../src/models/CouponAuditLog.js";
import InventoryTransaction from "../src/models/inventoryTransaction.js";
import NotificationLog from "../src/models/notificationLog.js";
import Return from "../src/models/return.js";
import CouponService from "../src/services/CouponService.js";
import OrderService from "../src/services/OrderService.js";
import PaymentService from "../src/services/PaymentService.js";
import NotificationService from "../src/services/NotificationService.js";

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const orderPayload = (productId, couponCode, overrides = {}) => ({
  items: [{ productId: String(productId), quantity: 1 }],
  shippingInfo: {
    fullName: "Coupon Lifecycle QA",
    addressLine1: "42 Coupon Test Road",
    city: "Mumbai",
    state: "Maharashtra",
    phoneNo: "+919999999999",
    zipCode: "400001",
    country: "India",
  },
  shippingMethod: "standard",
  packagingOption: "standard",
  currency: "INR",
  paymentMethod: "Razorpay",
  couponCode,
  ...overrides,
});

test("online coupon lifecycle: reserve, pay, partial refund, full refund, cancel", async (t) => {
  await connectDB();

  // Automated tests must never send real order emails or leave notification
  // logs behind. The email transport is exercised by its own unit tests.
  const originalNotifyOrder = NotificationService.notifyOrder;
  NotificationService.notifyOrder = async () => ({ skipped: true, reason: "test" });

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const couponCode = `QALIFE-${suffix}`.slice(0, 30);
  const idempotencyKey = `coupon-lifecycle-${suffix}`;
  const orderIds = [];
  let product = null;
  let coupon = null;
  let customer = null;

  try {
    const admin = await User.findOne({ email: "admin@delivix.com" }).lean();
    customer = await User.findOne({
      email: "priya.patel@delivix-customer.com",
    }).lean();
    assert.ok(admin, "Admin account is required for the coupon lifecycle test");
    assert.ok(customer, "Customer account is required for the coupon lifecycle test");

    product = await Product.create({
      name: `QA Coupon Lifecycle ${suffix}`,
      price: 1000,
      description: "Temporary product used by the coupon lifecycle test.",
      images: [
        {
          public_id: `qa_coupon_lifecycle_${suffix}`,
          url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85",
        },
      ],
      stock: 25,
      status: "published",
      user: admin._id,
    });

    coupon = await CouponService.createCoupon(
      {
        code: couponCode,
        name: "QA Coupon Lifecycle",
        description: "Temporary coupon for the online payment lifecycle test.",
        discountType: "fixed",
        discountValue: 100,
        maxDiscount: 0,
        minOrderValue: 0,
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
      },
      admin
    );

    const { order } = await OrderService.createOrder(
      orderPayload(product._id, couponCode),
      customer,
      idempotencyKey
    );
    orderIds.push(order._id);

    await t.test("online checkout keeps the coupon reservation pending", async () => {
      assert.equal(order.coupon?.code, couponCode, "Order coupon snapshot is missing");
      assert.equal(Number(order.coupon.discountAmount), 100);
      assert.equal(Number(order.totalAmount), 900, "Coupon discount was not applied to the order");

      const redemption = await CouponRedemption.findOne({ order: order._id }).lean();
      assert.ok(redemption, "Redemption reservation was not created");
      assert.equal(redemption.status, "pending");
      assert.equal(redemption.isActive, true);

      const couponDoc = await Coupon.findById(coupon.id).lean();
      assert.equal(Number(couponDoc.usageCount), 0, "Pending checkout must not consume a use");
      assert.equal(Number(couponDoc.pendingCount), 1, "Pending reservation was not counted");

      const usage = await CouponCustomerUsage.findOne({
        coupon: coupon.id,
        customer: customer._id,
      }).lean();
      assert.equal(Number(usage.pendingCount), 1);
      assert.equal(Number(usage.usedCount), 0);
    });

    await t.test("markPaid verifies the amount and confirms the redemption once", async () => {
      await assert.rejects(
        PaymentService.markPaid(order._id, {
          provider: "Razorpay",
          transactionId: `pay_wrong_${suffix}`,
          amount: Number(order.totalAmount) - 1,
          currency: order.currency,
          method: "upi",
        }),
        /does not match the order total/i
      );

      const paid = await PaymentService.markPaid(order._id, {
        provider: "Razorpay",
        transactionId: `pay_${suffix}`,
        providerOrderId: `order_${suffix}`,
        amount: Number(order.totalAmount),
        currency: order.currency,
        method: "upi",
      });
      assert.equal(paid.paymentStatus, "Paid");

      let redemption = await CouponRedemption.findOne({ order: order._id }).lean();
      assert.equal(redemption.status, "success");
      assert.equal(redemption.isActive, true);

      let couponDoc = await Coupon.findById(coupon.id).lean();
      assert.equal(Number(couponDoc.usageCount), 1, "Payment did not consume the coupon");
      assert.equal(Number(couponDoc.pendingCount), 0, "Pending count was not moved to usage");

      let usage = await CouponCustomerUsage.findOne({
        coupon: coupon.id,
        customer: customer._id,
      }).lean();
      assert.equal(Number(usage.usedCount), 1);
      assert.equal(Number(usage.pendingCount), 0);

      // Provider webhooks and verification calls can both arrive; replaying
      // markPaid must not consume a second use.
      await PaymentService.markPaid(order._id, {
        provider: "Razorpay",
        transactionId: `pay_${suffix}`,
        providerOrderId: `order_${suffix}`,
        amount: Number(order.totalAmount),
        currency: order.currency,
        method: "upi",
      });
      couponDoc = await Coupon.findById(coupon.id).lean();
      usage = await CouponCustomerUsage.findOne({
        coupon: coupon.id,
        customer: customer._id,
      }).lean();
      redemption = await CouponRedemption.findOne({ order: order._id }).lean();
      assert.equal(Number(couponDoc.usageCount), 1, "Replayed payment consumed the coupon twice");
      assert.equal(Number(usage.usedCount), 1, "Replayed payment inflated customer usage");
      assert.equal(redemption.status, "success");
    });

    await t.test("a partial refund keeps the coupon consumed", async () => {
      const fresh = await Order.findById(order._id);
      const partial = await PaymentService._applyRefundResult(fresh, {
        provider: "Razorpay",
        refundId: `rfnd_partial_${suffix}`,
        amount: 400,
        status: "Completed",
        reason: "Automated partial refund test",
      });

      assert.equal(partial.status, "Completed");
      assert.equal(partial.fullyRefunded, false);
      assert.equal(partial.order.paymentStatus, "Partially Refunded");

      const redemption = await CouponRedemption.findOne({ order: order._id }).lean();
      assert.equal(redemption.status, "success");
      assert.equal(redemption.isActive, true);

      const couponDoc = await Coupon.findById(coupon.id).lean();
      assert.equal(Number(couponDoc.usageCount), 1);
    });

    await t.test("a full refund releases the coupon and restores usage", async () => {
      const fresh = await Order.findById(order._id);
      const remaining = Number(fresh.totalAmount) - 400;
      const refund = await PaymentService._applyRefundResult(fresh, {
        provider: "Razorpay",
        refundId: `rfnd_full_${suffix}`,
        amount: remaining,
        status: "Completed",
        reason: "Automated full refund test",
      });

      assert.equal(refund.fullyRefunded, true);
      assert.equal(refund.order.paymentStatus, "Refunded");
      assert.equal(refund.order.orderStatus, "Refunded");

      const redemption = await CouponRedemption.findOne({ order: order._id }).lean();
      assert.equal(redemption.status, "refunded");
      assert.equal(redemption.isActive, false);

      const couponDoc = await Coupon.findById(coupon.id).lean();
      assert.equal(Number(couponDoc.usageCount), 0, "Full refund did not restore coupon usage");
      assert.equal(Number(couponDoc.pendingCount), 0);

      const usage = await CouponCustomerUsage.findOne({
        coupon: coupon.id,
        customer: customer._id,
      }).lean();
      assert.equal(Number(usage.usedCount), 0, "Full refund did not restore customer usage");
    });

    await t.test("cancelling an abandoned online checkout releases its reservation", async () => {
      const { order: abandoned } = await OrderService.createOrder(
        orderPayload(product._id, couponCode, {
          paymentMethod: "Razorpay",
        }),
        customer,
        `${idempotencyKey}-abandoned`
      );
      orderIds.push(abandoned._id);

      let redemption = await CouponRedemption.findOne({ order: abandoned._id }).lean();
      assert.equal(redemption.status, "pending");

      const cancelled = await OrderService.cancelOrder(
        abandoned._id,
        { reason: "Automated abandoned payment test" },
        customer
      );
      assert.equal(cancelled.orderStatus, "Cancelled");

      redemption = await CouponRedemption.findOne({ order: abandoned._id }).lean();
      assert.equal(redemption.status, "reversed");
      assert.equal(redemption.isActive, false);

      const couponDoc = await Coupon.findById(coupon.id).lean();
      assert.equal(Number(couponDoc.pendingCount), 0);
      assert.equal(Number(couponDoc.usageCount), 0);

      const usage = await CouponCustomerUsage.findOne({
        coupon: coupon.id,
        customer: customer._id,
      }).lean();
      assert.equal(Number(usage.pendingCount), 0);
      assert.equal(Number(usage.usedCount), 0);
    });
  } finally {
    // Let fire-and-forget order notifications settle before removing their
    // logs, otherwise a late write could leak rows after cleanup.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (coupon) {
      await CouponRedemption.deleteMany({ coupon: coupon.id });
      await CouponCustomerUsage.deleteMany({ coupon: coupon.id });
      await CouponAuditLog.deleteMany({ coupon: coupon.id });
      await Coupon.deleteOne({ _id: coupon.id });
    }
    if (orderIds.length) {
      await NotificationLog.deleteMany({
        $or: orderIds.map((id) => ({
          key: { $regex: `^${id}:` },
        })),
      });
      await Return.deleteMany({ order: { $in: orderIds } });
      await InventoryTransaction.deleteMany({ order: { $in: orderIds } });
      await Order.deleteMany({ _id: { $in: orderIds } });
    }
    if (product) {
      await Product.deleteOne({ _id: product._id });
    }

    NotificationService.notifyOrder = originalNotifyOrder;
    await disconnectDB();
  }
});
