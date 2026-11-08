/**
 * Refund helpers shared by the order service, payment service and webhooks.
 *
 * A refund that a provider has only accepted (for example Razorpay's
 * "pending" status) must never be counted as money returned to the customer.
 * Only provider-confirmed refunds count towards the captured amount.
 */

import { normalizeOrderStatus, sumCompletedRefunds } from "./orderPolicy.js";

export const REFUND_PENDING_STATUSES = ["Pending"];
export const REFUND_COMPLETED_STATUSES = ["Completed"];

export const sumPendingRefunds = (order) =>
  (order?.refunds || [])
    .filter((refund) => REFUND_PENDING_STATUSES.includes(refund.status))
    .reduce((total, refund) => total + (Number(refund.amount) || 0), 0);

/**
 * Amount an admin may still request without over-refunding. Refunds that are
 * pending at the provider already reserve part of the captured balance.
 */
export const getAvailableRefundableAmount = (order) => {
  const total = Number(order?.totalAmount) || 0;
  const committed = sumCompletedRefunds(order) + sumPendingRefunds(order);
  return Math.max(0, Number((total - committed).toFixed(2)));
};

/**
 * Map a provider refund status onto the local ledger.
 *
 * Unknown statuses are treated as pending: the safe choice is to wait for the
 * provider webhook instead of claiming the money has been returned.
 */
export const normalizeProviderRefundStatus = (provider, status) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "Pending";
  if (["succeeded", "processed", "completed", "complete"].includes(value)) {
    return "Completed";
  }
  if (["failed", "canceled", "cancelled", "rejected"].includes(value)) {
    return "Failed";
  }
  if (["pending", "created", "processing", "requires_action", "authorized"].includes(value)) {
    return "Pending";
  }
  // Manual/COD refunds are only recorded after an admin confirms the transfer.
  if (String(provider || "").toLowerCase() === "manual") return "Completed";
  return "Pending";
};

/**
 * Decide how a failed refund attempt should leave the order.
 *
 * A provider rejection means no money moved. The order must return to a
 * retryable state instead of remaining stuck in "Refund Pending" with no
 * pending refund. Return documents stay at "Refund Processing" because their
 * statuses are forward-only; the admin simply retries from the order.
 */
export const failedRefundOrderState = (
  order,
  { completedTotal = 0, pendingTotal = 0 } = {}
) => {
  const total = Number(order?.totalAmount) || 0;
  const fullyRefunded = completedTotal >= total - 0.01;
  const previousStatus = normalizeOrderStatus(order?.orderStatus);

  const state = {
    paymentStatus: fullyRefunded
      ? "Refunded"
      : completedTotal > 0
        ? "Partially Refunded"
        : pendingTotal > 0
          ? "Refund Pending"
          : "Paid",
    orderStatus: previousStatus,
    returnInfoStatus: order?.returnInfo?.status,
    cancellationRefundStatus: order?.cancellation?.refundStatus,
  };

  // Another refund is still pending at the provider, or the order is fully
  // refunded: there is nothing to roll back.
  if (pendingTotal > 0 || fullyRefunded) return state;

  if (previousStatus === "Cancelled" || order?.cancellation?.cancelledAt) {
    state.orderStatus = "Cancelled";
    state.cancellationRefundStatus = "Failed";
    return state;
  }

  if (previousStatus === "Refund Pending") {
    if (order?.returnInfo?.returnedAt) {
      state.orderStatus = "Returned";
      state.returnInfoStatus = "Returned";
    } else if (order?.returnInfo?.approvedAt) {
      state.orderStatus = "Return Approved";
      state.returnInfoStatus = "Approved";
    }
  }

  return state;
};

export default {
  REFUND_PENDING_STATUSES,
  REFUND_COMPLETED_STATUSES,
  sumPendingRefunds,
  getAvailableRefundableAmount,
  normalizeProviderRefundStatus,
  failedRefundOrderState,
};
