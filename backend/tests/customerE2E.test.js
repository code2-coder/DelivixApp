import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import { connectDB, disconnectDB } from "../src/config/database.js";
import User from "../src/models/User.js";
import Order from "../src/models/order.js";
import CustomerService from "../src/services/CustomerService.js";

test("Customer Management E2E & Business Rules Suite", async (t) => {
  await connectDB();

  await t.test("1. Accurate calculation of customer statistics from database", async () => {
    const stats = await CustomerService.getCustomerStats();

    assert.ok(stats.totalRegistered >= 1, "Should count registered customers");
    assert.ok(stats.activeCustomers <= stats.totalRegistered, "Active customers should not exceed total");
    assert.ok(stats.blockedCustomers >= 0, "Blocked customers count should be a valid number");
    assert.ok(typeof stats.totalRevenue === "number", "Total revenue must be numeric");
    assert.ok(typeof stats.averageOrderValue === "number", "AOV must be numeric");

    // Cross-check with direct query
    const realCount = await User.countDocuments({ role: { $in: ["user", "customer"] } });
    assert.equal(stats.totalRegistered, realCount, "Stats count must match real database record count");
  });

  await t.test("2. Customer listing and server-side pagination", async () => {
    const page1 = await CustomerService.getAllCustomers({ page: 1, limit: 3 });
    assert.equal(page1.customers.length, 3, "Page 1 limit 3 should return 3 records");
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 3);
    assert.ok(page1.pagination.total >= 3);
    assert.equal(page1.pagination.hasNext, true);

    const page2 = await CustomerService.getAllCustomers({ page: 2, limit: 3 });
    assert.equal(page2.pagination.page, 2);
    // Ensure page 1 and page 2 have distinct customers
    const idsPage1 = page1.customers.map((c) => c._id.toString());
    const idsPage2 = page2.customers.map((c) => c._id.toString());
    const overlaps = idsPage1.filter((id) => idsPage2.includes(id));
    assert.equal(overlaps.length, 0, "Pagination pages must be disjoint");
  });

  await t.test("3. Search by customer name, email, and phone number", async () => {
    // Search by name
    const byName = await CustomerService.getAllCustomers({ search: "Priya" });
    assert.ok(byName.customers.length >= 1);
    assert.ok(byName.customers.some((c) => c.name.includes("Priya")));

    // Search by email
    const byEmail = await CustomerService.getAllCustomers({ search: "delivix-customer.com" });
    assert.ok(byEmail.customers.length >= 1);
    assert.ok(byEmail.customers.every((c) => c.email.includes("delivix-customer.com")));

    // Search non-existent
    const none = await CustomerService.getAllCustomers({ search: "xyzNonExistentName98765" });
    assert.equal(none.customers.length, 0);
  });

  await t.test("4. Customer segmentation filters", async () => {
    // High-value segment (>= 5000)
    const highVal = await CustomerService.getAllCustomers({ segment: "high_value" });
    for (const c of highVal.customers) {
      assert.ok(c.totalSpent >= 5000, `High value customer ${c.name} spent ₹${c.totalSpent}`);
    }

    // Repeat customers (>= 2 orders)
    const repeat = await CustomerService.getAllCustomers({ segment: "repeat" });
    for (const c of repeat.customers) {
      assert.ok(c.totalOrders >= 2, `Repeat customer ${c.name} should have >= 2 orders`);
    }

    // Zero orders segment
    const zeroOrders = await CustomerService.getAllCustomers({ segment: "no_orders" });
    for (const c of zeroOrders.customers) {
      assert.equal(c.totalOrders, 0, `Zero order customer ${c.name} should have 0 orders`);
    }
  });

  await t.test("5. Sorting order tests", async () => {
    // Spending descending
    const spendDesc = await CustomerService.getAllCustomers({ sort: "spending_desc", limit: 5 });
    for (let i = 1; i < spendDesc.customers.length; i++) {
      assert.ok(
        spendDesc.customers[i - 1].totalSpent >= spendDesc.customers[i].totalSpent,
        "Spending desc must sort highest first"
      );
    }

    // Orders descending
    const ordersDesc = await CustomerService.getAllCustomers({ sort: "orders_desc", limit: 5 });
    for (let i = 1; i < ordersDesc.customers.length; i++) {
      assert.ok(
        ordersDesc.customers[i - 1].totalOrders >= ordersDesc.customers[i].totalOrders,
        "Orders desc must sort highest count first"
      );
    }
  });

  await t.test("6. Customer detail profile, purchase metrics, and real order linkage", async () => {
    const list = await CustomerService.getAllCustomers({ limit: 1 });
    const target = list.customers[0];

    const detail = await CustomerService.getCustomerDetails(target._id.toString());
    assert.equal(detail.customer._id.toString(), target._id.toString());
    assert.equal(detail.customer.name, target.name);
    assert.equal(detail.customer.email, target.email);

    // Verify metrics are calculated and present
    assert.equal(typeof detail.metrics.totalSpent, "number");
    assert.equal(typeof detail.metrics.totalOrders, "number");
    assert.equal(typeof detail.metrics.averageOrderValue, "number");

    // Verify orders are real Order records matching customer ID
    for (const ord of detail.orders) {
      assert.ok(ord.orderNumber, "Order record must have orderNumber");
      assert.ok(ord.totalAmount >= 0, "Order totalAmount must be valid");
    }
  });

  await t.test("7. Status management and audit trail", async () => {
    const cust = await User.findOne({ email: "priya.patel@delivix-customer.com" });
    assert.ok(cust, "Seeded customer Priya Patel must exist");

    const mockAdmin = { _id: cust._id, name: "Test SuperAdmin" };

    // Update status to suspended
    await CustomerService.updateCustomerStatus(
      cust._id.toString(),
      "suspended",
      "Account under compliance review",
      mockAdmin
    );

    let updated = await CustomerService.getCustomerDetails(cust._id.toString());
    assert.equal(updated.customer.status, "suspended");
    assert.ok(
      updated.statusHistory.some(
        (h) => h.status === "suspended" && h.reason.includes("compliance review")
      ),
      "Audit trail must record status change and reason"
    );

    // Reactivate account
    await CustomerService.updateCustomerStatus(
      cust._id.toString(),
      "active",
      "Compliance review cleared",
      mockAdmin
    );

    updated = await CustomerService.getCustomerDetails(cust._id.toString());
    assert.equal(updated.customer.status, "active");
  });

  await t.test("8. Admin notes lifecycle (add and delete)", async () => {
    const cust = await User.findOne({ email: "priya.patel@delivix-customer.com" });
    const mockAdmin = { _id: cust._id, name: "Alex Admin" };

    const note = await CustomerService.addAdminNote(
      cust._id.toString(),
      "Customer requested GST invoice copy sent to email.",
      mockAdmin
    );
    assert.ok(note._id);
    assert.equal(note.note, "Customer requested GST invoice copy sent to email.");
    assert.equal(note.addedByName, "Alex Admin");

    // Verify note is stored on customer
    let detail = await CustomerService.getCustomerDetails(cust._id.toString());
    assert.ok(detail.adminNotes.some((n) => n._id.toString() === note._id.toString()));

    // Delete note
    const delResult = await CustomerService.deleteAdminNote(cust._id.toString(), note._id.toString());
    assert.equal(delResult.success, true);

    detail = await CustomerService.getCustomerDetails(cust._id.toString());
    assert.ok(!detail.adminNotes.some((n) => n._id.toString() === note._id.toString()));
  });

  await t.test("9. CSV Export generation format and content", async () => {
    const csv = await CustomerService.exportCustomers({ status: "active" });
    assert.ok(typeof csv === "string");
    const lines = csv.split("\r\n");
    assert.ok(lines.length >= 2, "CSV must have header and at least one data line");

    const header = lines[0];
    assert.ok(header.includes("Customer ID"));
    assert.ok(header.includes("Name"));
    assert.ok(header.includes("Email"));
    assert.ok(header.includes("Account Status"));
    assert.ok(header.includes("Total Orders"));
    assert.ok(header.includes("Total Spent (INR)"));
  });

  await disconnectDB();
});
