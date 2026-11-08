import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidTransition,
  getNextStatuses,
  getAdvancePath,
  isCustomerCancellable,
  isAdminCancellable,
  isReturnEligible,
  getRefundableAmount,
  normalizePaymentStatus,
  isPaidPaymentStatus,
} from "../src/utils/orderPolicy.js";

test("the happy-path lifecycle accepts every forward step", () => {
  const lifecycle = [
    "Pending",
    "Confirmed",
    "Processing",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
  ];
  for (let index = 0; index < lifecycle.length - 1; index += 1) {
    assert.equal(
      isValidTransition(lifecycle[index], lifecycle[index + 1]),
      true,
      `${lifecycle[index]} -> ${lifecycle[index + 1]}`
    );
  }
});

test("skipping workflow steps is rejected", () => {
  assert.equal(isValidTransition("Pending", "Shipped"), false);
  assert.equal(isValidTransition("Processing", "Delivered"), false);
  assert.equal(isValidTransition("Delivered", "Processing"), false);
  assert.deepEqual(getNextStatuses("Pending"), ["Confirmed", "Cancelled"]);
});

test("duplicate status updates are idempotent", () => {
  assert.equal(isValidTransition("Processing", "Processing"), true);
});

test("courier sync advances through Out for Delivery before Delivered", () => {
  assert.deepEqual(getAdvancePath("Shipped", "Delivered"), [
    "Out for Delivery",
    "Delivered",
  ]);
  assert.deepEqual(getAdvancePath("Packed", "Delivered"), [
    "Shipped",
    "Out for Delivery",
    "Delivered",
  ]);
});

test("customers can only cancel before packing", () => {
  assert.equal(isCustomerCancellable("Pending"), true);
  assert.equal(isCustomerCancellable("Confirmed"), true);
  assert.equal(isCustomerCancellable("Processing"), true);
  assert.equal(isCustomerCancellable("Packed"), false);
  assert.equal(isCustomerCancellable("Shipped"), false);
  assert.equal(isAdminCancellable("Packed"), true);
  assert.equal(isAdminCancellable("Shipped"), false);
});

test("returns are only eligible inside the delivered window", () => {
  const deliveredAt = new Date("2026-10-01T10:00:00.000Z");
  const inside = isReturnEligible(
    { orderStatus: "Delivered", deliveredAt },
    new Date("2026-10-05T10:00:00.000Z")
  );
  assert.equal(inside.eligible, true);

  const outside = isReturnEligible(
    { orderStatus: "Delivered", deliveredAt },
    new Date("2026-10-20T10:00:00.000Z")
  );
  assert.equal(outside.eligible, false);

  const notDelivered = isReturnEligible(
    { orderStatus: "Shipped", deliveredAt },
    new Date("2026-10-02T10:00:00.000Z")
  );
  assert.equal(notDelivered.eligible, false);
});

test("refundable amount subtracts only completed refunds", () => {
  const order = {
    totalAmount: 1000,
    refunds: [
      { amount: 250, status: "Completed" },
      { amount: 100, status: "Failed" },
      { amount: 50, status: "Pending" },
    ],
  };
  assert.equal(getRefundableAmount(order), 750);
  assert.equal(getRefundableAmount({ totalAmount: 100, refunds: [] }), 100);
});

test("payment status normalization keeps legacy values safe", () => {
  assert.equal(normalizePaymentStatus("paid"), "Paid");
  assert.equal(normalizePaymentStatus("captured"), "Paid");
  assert.equal(normalizePaymentStatus("failed"), "Failed");
  assert.equal(normalizePaymentStatus(undefined), "Pending");
  assert.equal(isPaidPaymentStatus("Paid"), true);
  assert.equal(isPaidPaymentStatus("Pending"), false);
});
