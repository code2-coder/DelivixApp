import "../src/config/env.js";
import mongoose from "mongoose";
import Order from "../src/models/order.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = await Order.find().lean();
  console.log(`Total orders: ${orders.length}`);
  orders.forEach((o, idx) => {
    console.log(`${idx + 1}. [${o.orderNumber || o._id}] status=${o.orderStatus} payStatus=${o.paymentStatus} method=${o.paymentMethod} total=${o.totalAmount} items=${o.orderItems?.length || 0} date=${o.createdAt?.toISOString?.().slice(0, 10)}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

