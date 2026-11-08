import "../src/config/env.js";
import mongoose from "mongoose";
import User from "../src/models/User.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admins = await User.find({ role: { $in: ["admin", "staff"] } }).select("name email role status").lean();
  console.log("Admins:", admins);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

