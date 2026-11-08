/**
 * Return workflow helpers.
 *
 * Return documents have their own, more granular statuses than orders. Admin
 * order actions must advance the linked return records without ever moving a
 * return backwards (for example from "Product Received" back to "Approved").
 */

export const RETURN_STATUS_RANK = Object.freeze({
  "Pending Review": 0,
  Approved: 1,
  "Pickup Scheduled": 2,
  "Pickup Completed": 3,
  "Product Received": 4,
  "Quality Inspection": 5,
  "Refund Processing": 6,
  "Refund Completed": 7,
  "Replacement Preparing": 4,
  "Replacement Shipped": 5,
  "Replacement Delivered": 6,
  "Exchange Approved": 4,
  "Exchange Shipped": 5,
  "Exchange Delivered": 6,
  "Return Closed": 8,
});

export const RETURN_STATUS_FOR_ORDER_STATUS = Object.freeze({
  "Return Approved": {
    status: "Approved",
    message: "Return approved from order management.",
  },
  "Return Rejected": {
    status: "Rejected",
    message: "Return rejected from order management.",
  },
  Returned: {
    status: "Product Received",
    message: "Returned item received and marked by order management.",
  },
  "Refund Pending": {
    status: "Refund Processing",
    message: "Refund is being processed through the original payment method.",
  },
  Refunded: {
    status: "Refund Completed",
    message: "Refund confirmed by the payment provider.",
  },
});

export const returnStatusForOrderStatus = (orderStatus) =>
  RETURN_STATUS_FOR_ORDER_STATUS[orderStatus] || null;

const isRefundStatus = (status) =>
  String(status || "").startsWith("Refund") || status === "Return Closed";

/**
 * Decide whether a linked return may move to the mapped status.
 *
 * - Rejections are final and may be applied from any non-closed state.
 * - Refund-only statuses never apply to replacement/exchange returns.
 * - Otherwise only forward movement is allowed; repeats are no-ops.
 */
export const shouldAdvanceReturnStatus = (current, next, { returnType } = {}) => {
  if (!next || current === next) return false;
  if (next === "Rejected") {
    return !["Refund Completed", "Return Closed"].includes(current);
  }
  if (["Rejected", "Return Closed"].includes(current)) return false;
  if (isRefundStatus(next) && returnType && returnType !== "Refund") {
    return false;
  }
  const currentRank = RETURN_STATUS_RANK[current];
  const nextRank = RETURN_STATUS_RANK[next];
  if (currentRank === undefined || nextRank === undefined) return false;
  return nextRank > currentRank;
};

export default {
  RETURN_STATUS_RANK,
  RETURN_STATUS_FOR_ORDER_STATUS,
  returnStatusForOrderStatus,
  shouldAdvanceReturnStatus,
};
