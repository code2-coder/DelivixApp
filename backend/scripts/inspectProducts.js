import "../src/config/env.js";
import mongoose from "mongoose";
import Product from "../src/models/product.js";
import Category from "../src/models/category.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find().select("name price category stock status").populate("category", "name").lean();
  console.log("Products count:", products.length);
  products.slice(0, 5).forEach(p => console.log(p.name, p.price, p.category?.name, "stock:", p.stock));
  
  const cats = await Category.find().lean();
  console.log("Categories:", cats.map(c => c.name));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

