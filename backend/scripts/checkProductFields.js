import "../src/config/env.js";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await mongoose.connection.db.collection("products").find().toArray();
  console.log("Total products in DB:", products.length);
  for (const p of products.slice(0, 5)) {
    console.log({
      id: p._id,
      title: p.title,
      name: p.name,
      basePrice: p.basePrice,
      price: p.price,
      brand: p.brand,
      category: p.category,
      stock: p.stock
    });
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

