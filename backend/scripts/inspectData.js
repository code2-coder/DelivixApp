import "../src/config/env.js";
import mongoose from "mongoose";
import Order from "../src/models/order.js";
import Product from "../src/models/product.js";
import User from "../src/models/User.js";
import Return from "../src/models/return.js";
import Coupon from "../src/models/Coupon.js";
import CouponRedemption from "../src/models/CouponRedemption.js";
import Category from "../src/models/category.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const [orderCount, productCount, userCount, returnCount, couponCount, redemptionCount, catCount] = await Promise.all([
    Order.countDocuments(),
    Product.countDocuments(),
    User.countDocuments(),
    Return.countDocuments(),
    Coupon.countDocuments(),
    CouponRedemption.countDocuments(),
    Category.countDocuments(),
  ]);

  console.log({
    orders: orderCount,
    products: productCount,
    users: userCount,
    returns: returnCount,
    coupons: couponCount,
    couponRedemptions: redemptionCount,
    categories: catCount,
  });

  const sampleOrders = await Order.find().limit(3).lean();
  console.log("Sample order statuses:", sampleOrders.map(o => ({
    id: o._id,
    orderNumber: o.orderNumber,
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt,
    hasCustomer: !!o.user || !!o.customerInfo,
    itemCount: o.orderItems?.length
  })));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

