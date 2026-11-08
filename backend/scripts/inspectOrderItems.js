import "../src/config/env.js";
import mongoose from "mongoose";
import Order from "../src/models/order.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const sample = await Order.find({ "orderItems.0": { $exists: true } }).limit(3).lean();
  console.log("Orders with items count:", await Order.countDocuments({ "orderItems.0": { $exists: true } }));
  console.log("Sample order items:", JSON.stringify(sample[0]?.orderItems, null, 2));
  console.log("Sample order full:", JSON.stringify({
    orderNumber: sample[0]?.orderNumber,
    customerInfo: sample[0]?.customerInfo,
    shippingInfo: sample[0]?.shippingInfo,
    orderStatus: sample[0]?.orderStatus,
    paymentStatus: sample[0]?.paymentStatus,
    paymentMethod: sample[0]?.paymentMethod,
    itemsPrice: sample[0]?.itemsPrice,
    taxAmount: sample[0]?.taxAmount,
    shippingAmount: sample[0]?.shippingAmount,
    discountAmount: sample[0]?.discountAmount,
    totalAmount: sample[0]?.totalAmount,
    coupon: sample[0]?.coupon,
    refunds: sample[0]?.refunds,
    returnInfo: sample[0]?.returnInfo,
  }, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

