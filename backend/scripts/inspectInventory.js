import "../src/config/env.js";
import mongoose from "mongoose";
import Product from "../src/models/product.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find().lean();
  console.log(`Total products: ${products.length}`);
  
  products.forEach(p => {
    console.log(`\nProduct: "${p.title || p.name}" (ID: ${p._id})`);
    console.log(`  Top-level stock: ${p.stock}, price: ${p.basePrice || p.price}`);
    console.log(`  SKU: ${p.sku || 'N/A'}, Barcode: ${p.barcode || 'N/A'}`);
    if (p.variants && p.variants.length > 0) {
      console.log(`  Variants count: ${p.variants.length}`);
      p.variants.forEach((v, vi) => {
        console.log(`    Variant [${vi}]: title="${v.title || v.variantName}", sku="${v.sku}", stock=${v.stock}, price=${v.price}, attrs=${JSON.stringify(v.attributes || {})}`);
      });
    } else {
      console.log(`  Variants: None`);
    }
    if (p.sizes && p.sizes.length > 0) {
      console.log(`  Sizes count: ${p.sizes.length}`);
    }
  });

  await mongoose.disconnect();
}

main().catch(console.error);
