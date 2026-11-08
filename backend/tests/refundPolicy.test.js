import test from "node:test";
import assert from "node:assert/strict";
import {
  failedRefundOrderState,
  getAvailableRefundableAmount,
  normalizeProviderRefundStatus,
  sumPendingRefunds,
} from "../src/utils/refundPolicy.js";

test("pending refunds reserve part of the captured balance", () => {
  const order = {
    totalAmount: 1000,
    refunds: [
      { amount: 250, status: "Completed" },
      { amount: 100, status: "Pending" },
      { amount: 50, status: "Failed" },
    ],
  };
  assert.equal(sumPendingRefunds(order), 100);
  assert.equal(getAvailableRefundableAmount(order), 650);
});

test("refundable balance never goes negative or exceeds the order total", () => {
  assert.equal(
    getAvailableRefundableAmount({ totalAmount: 100, refunds: [] }),
    100
  );
  assert.equal(
    getAvailableRefundableAmount({
      totalAmount: 100,
      refunds: [{ amount: 150, status: "Completed" }],
    }),
    0
  );
  assert.equal(getAvailableRefundableAmount({}), 0);
});

test("provider refund statuses are normalised conservatively", () => {
  assert.equal(normalizeProviderRefundStatus("Stripe", "succeeded"), "Completed");
  assert.equal(normalizeProviderRefundStatus("Stripe", "pending"), "Pending");
  assert.equal(normalizeProviderRefundStatus("Stripe", "failed"), "Failed");
  assert.equal(normalizeProviderRefundStatus("Stripe", "canceled"), "Failed");
  assert.equal(normalizeProviderRefundStatus("Razorpay", "processed"), "Completed");
  assert.equal(normalizeProviderRefundStatus("Razorpay", "created"), "Pending");
  assert.equal(normalizeProviderRefundStatus("Razorpay", "failed"), "Failed");
  // Unknown provider states must not be treated as money returned.
  assert.equal(normalizeProviderRefundStatus("Stripe", "something-new"), "Pending");
  assert.equal(normalizeProviderRefundStatus("Stripe", ""), "Pending");
  // A manual refund is only recorded after an admin confirms the transfer.
  assert.equal(normalizeProviderRefundStatus("Manual", "succeeded"), "Completed");
});

test("a failed refund returns the order to a retryable state", () => {
  const state = failedRefundOrderState(
    {
      totalAmount: 1000,
      orderStatus: "Refund Pending",
      paymentStatus: "Refund Pending",
      returnInfo: { status: "Refund Pending", returnedAt: new Date() },
    },
    { completedTotal: 0, pendingTotal: 0 }
  );
  assert.equal(state.paymentStatus, "Paid");
  assert.equal(state.orderStatus, "Returned");
  assert.equal(state.returnInfoStatus, "Returned");
});

test("a failed refund before the item was returned falls back to Return Approved", () => {
  const state = failedRefundOrderState(
    {
      totalAmount: 500,
      orderStatus: "Refund Pending",
      returnInfo: { status: "Refund Pending", approvedAt: new Date() },
    },
    { completedTotal: 0, pendingTotal: 0 }
  );
  assert.equal(state.orderStatus, "Return Approved");
  assert.equal(state.returnInfoStatus, "Approved");
});

test("a failed cancellation refund stays cancelled and is marked failed", () => {
  const state = failedRefundOrderState(
    {
      totalAmount: 300,
      orderStatus: "Cancelled",
      paymentStatus: "Refund Pending",
      cancellation: { cancelledAt: new Date(), refundStatus: "Pending" },
    },
    { completedTotal: 0, pendingTotal: 0 }
  );
  assert.equal(state.paymentStatus, "Paid");
  assert.equal(state.orderStatus, "Cancelled");
  assert.equal(state.cancellationRefundStatus, "Failed");
});

test("a failed refund does not roll back while another refund is pending", () => {
  const state = failedRefundOrderState(
    {
      totalAmount: 1000,
      orderStatus: "Refund Pending",
      returnInfo: { status: "Refund Pending", returnedAt: new Date() },
    },
    { completedTotal: 0, pendingTotal: 250 }
  );
  assert.equal(state.paymentStatus, "Refund Pending");
  assert.equal(state.orderStatus, "Refund Pending");
  assert.equal(state.returnInfoStatus, "Refund Pending");
});
