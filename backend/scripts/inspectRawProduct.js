import "../src/config/env.js";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rawProducts = await mongoose.connection.db.collection("products").find().limit(2).toArray();
  console.log("Raw Product 1 keys:", Object.keys(rawProducts[0] || {}));
  console.log("Raw Product 1:", JSON.stringify(rawProducts[0], null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

