import "../src/config/env.js";
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ role: "admin" }).lean();
  if (!admin) {
    console.error("No admin user found");
    process.exit(1);
  }

  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  console.log("Admin email:", admin.email);
  console.log("Generated Admin JWT token:", token.slice(0, 20) + "...");

  const endpoints = [
    "/api/admin/analytics/overview?range=30d",
    "/api/v1/admin/analytics/overview?range=30d",
    "/api/admin/analytics/revenue?range=this_year",
    "/api/admin/analytics/sales?range=this_year&limit=5",
    "/api/admin/analytics/products?range=this_year",
    "/api/admin/analytics/customers?range=this_year",
    "/api/admin/analytics/categories?range=this_year",
    "/api/admin/analytics/payments?range=this_year",
    "/api/admin/analytics/inventory",
    "/api/admin/analytics/coupons?range=this_year",
    "/api/admin/analytics/returns?range=this_year",
    "/api/admin/analytics/export?type=sales&format=json",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:8085${ep}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      console.log(`Endpoint: ${ep} -> Status: ${res.status} Success: ${data.success}`);
      if (!res.ok) {
        console.error("Failed endpoint response:", data);
      }
    } catch (err) {
      console.error(`Endpoint error ${ep}:`, err.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

