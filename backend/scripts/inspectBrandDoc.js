import "../src/config/env.js";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const sample = await mongoose.connection.db.collection("brands").findOne();
  console.log("Sample brand:", sample);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

