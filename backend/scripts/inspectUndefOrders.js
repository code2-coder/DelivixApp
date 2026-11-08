import "../src/config/env.js";
import mongoose from "mongoose";
import Order from "../src/models/order.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const undefOrders = await Order.find({ totalAmount: { $exists: false } }).lean();
  console.log("Orders without totalAmount:", undefOrders.length);
  for (const o of undefOrders) {
    console.log(o._id, o.orderNumber, o.itemsPrice, o.totalAmount, o.orderItems);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

