/**
 * Backfill legacy orders into the order-management schema.
 *
 * Legacy documents predate orderNumber, orderStatus, paymentStatus,
 * customerInfo, address snapshots, status history and line-item subtotals.
 * This script is idempotent and safe to run repeatedly.
 *
 * Usage:
 *   npm run orders:backfill
 *   npm run orders:backfill -- --dry-run
 */
import "../src/config/env.js";
import mongoose from "mongoose";
import crypto from "crypto";
import Order from "../src/models/order.js";
import "../src/models/user.js";
import { normalizeOrderStatus, normalizePaymentStatus } from "../src/utils/orderPolicy.js";

const dryRun = process.argv.includes("--dry-run");
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/delivix";

const makeOrderNumber = (createdAt) => {
  const date = new Date(createdAt || Date.now());
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `ORD-${stamp}-${crypto.randomInt(100000, 999999)}`;
};

const uniqueOrderNumber = async (createdAt) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = makeOrderNumber(createdAt);
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }
  return `ORD-${Date.now()}-${crypto.randomInt(100000, 999999)}`;
};

const toAddressSnapshot = (shippingInfo = {}) => ({
  fullName: shippingInfo.fullName,
  phone: shippingInfo.phoneNo,
  addressLine1: shippingInfo.addressLine1 || shippingInfo.address,
  addressLine2: shippingInfo.addressLine2,
  landmark: shippingInfo.landmark,
  city: shippingInfo.city,
  state: shippingInfo.state,
  country: shippingInfo.country,
  pincode: shippingInfo.zipCode,
});

const legacyPaymentStatus = (order) => {
  if (order.paymentStatus) return normalizePaymentStatus(order.paymentStatus);
  const infoStatus = String(order.paymentInfo?.status || "").toLowerCase();
  if (["paid", "succeeded", "captured", "completed"].includes(infoStatus)) return "Paid";
  if (["failed", "canceled", "cancelled"].includes(infoStatus)) return "Failed";
  if (order.paidAt) return "Paid";
  return "Pending";
};

const run = async () => {
  console.log(`Connecting to MongoDB${dryRun ? " (dry run)" : ""}...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const orders = await Order.find({}).populate("user", "name email phoneNumber");
  let changed = 0;

  for (const order of orders) {
    let dirty = false;

    if (!order.orderNumber) {
      order.orderNumber = await uniqueOrderNumber(order.createdAt);
      dirty = true;
    }

    const status = normalizeOrderStatus(order.orderStatus);
    if (order.orderStatus !== status) {
      order.orderStatus = status;
      dirty = true;
    }

    const paymentStatus = legacyPaymentStatus(order);
    if (order.paymentStatus !== paymentStatus) {
      order.paymentStatus = paymentStatus;
      dirty = true;
    }

    if (!order.customerInfo?.email && (order.user || order.shippingInfo)) {
      order.customerInfo = {
        name: order.shippingInfo?.fullName || order.user?.name,
        email: order.shippingInfo?.email || order.user?.email,
        phone: order.shippingInfo?.phoneNo || order.user?.phoneNumber,
      };
      dirty = true;
    }

    if (!order.shippingAddress?.addressLine1 && order.shippingInfo?.address) {
      order.shippingAddress = toAddressSnapshot(order.shippingInfo);
      dirty = true;
    }

    if (!Array.isArray(order.statusHistory) || order.statusHistory.length === 0) {
      order.statusHistory = [
        {
          status,
          note: "Legacy order imported into order management.",
          source: "system",
          at: order.createdAt || new Date(),
        },
      ];
      dirty = true;
    }

    order.orderItems.forEach((item) => {
      if (item.subtotal === undefined || item.subtotal === null) {
        item.subtotal = Number((Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2));
        dirty = true;
      }
      if (item.taxAmount === undefined) {
        item.taxAmount = 0;
        dirty = true;
      }
      if (item.discountAmount === undefined) {
        item.discountAmount = 0;
        dirty = true;
      }
    });

    if (!order.currency) {
      order.currency = "INR";
      dirty = true;
    }

    if (dirty) {
      changed += 1;
      console.log(
        `${dryRun ? "[dry-run] " : ""}Backfill ${order._id} -> ${order.orderNumber} / ${order.orderStatus} / ${order.paymentStatus}`
      );
      if (!dryRun) {
        await order.save({ validateBeforeSave: false });
      }
    }
  }

  if (!dryRun) {
    await Order.syncIndexes();
    console.log("Order indexes synchronized.");
  }

  console.log(`Done. ${changed} of ${orders.length} order(s) needed updates.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Order backfill failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
