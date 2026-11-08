import "../src/config/env.js";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("All collections:", collections.map(c => c.name));
  
  if (collections.some(c => c.name === "brands")) {
    const brands = await mongoose.connection.db.collection("brands").find().toArray();
    console.log("Brands:", brands.map(b => ({ id: b._id, name: b.name || b.title })));
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

