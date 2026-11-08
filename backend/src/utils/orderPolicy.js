/**
 * Central order workflow policy.
 *
 * Keeping the state machine in one dependency-free module makes it easy to
 * enforce the same rules from controllers, services, shipment sync and tests.
 */

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Return Approved",
  "Return Rejected",
  "Returned",
  "Refund Pending",
  "Refunded",
];

export const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Failed",
  "Refund Pending",
  "Partially Refunded",
  "Refunded",
  "Cancelled",
];

export const PAYMENT_METHODS = ["COD", "Card", "Stripe", "Razorpay"];

/**
 * Allowed forward transitions. A status may always transition to itself so
 * duplicate admin requests are idempotent.
 */
export const ORDER_TRANSITIONS = Object.freeze({
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Out for Delivery"],
  "Out for Delivery": ["Delivered"],
  Delivered: ["Return Requested"],
  Cancelled: ["Refunded"],
  "Return Requested": ["Return Approved", "Return Rejected"],
  "Return Approved": ["Returned", "Refund Pending"],
  "Return Rejected": [],
  Returned: ["Refund Pending"],
  "Refund Pending": ["Refunded"],
  Refunded: [],
});

export const CUSTOMER_CANCELLABLE_STATUSES = ["Pending", "Confirmed", "Processing"];
export const ADMIN_CANCELLABLE_STATUSES = ["Pending", "Confirmed", "Processing", "Packed"];

export const TERMINAL_STATUSES = ["Cancelled", "Refunded", "Return Rejected"];

export const PAID_PAYMENT_STATUSES = ["Paid", "Partially Refunded", "Refund Pending", "Refunded"];

export const normalizeOrderStatus = (status) => {
  if (!status) return "Pending";
  return ORDER_STATUSES.includes(status) ? status : "Pending";
};

export const normalizePaymentStatus = (status) => {
  if (!status) return "Pending";
  const value = String(status).trim();
  if (PAYMENT_STATUSES.includes(value)) return value;
  const lower = value.toLowerCase();
  if (lower === "paid" || lower === "captured" || lower === "succeeded") return "Paid";
  if (lower === "failed" || lower === "cancelled" || lower === "canceled") {
    return lower.startsWith("cancel") ? "Cancelled" : "Failed";
  }
  if (lower === "refunded") return "Refunded";
  if (lower === "pending" || lower === "created") return "Pending";
  return "Pending";
};

export const isValidTransition = (from, to, { allowSame = true } = {}) => {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  if (current === next) return allowSame;
  return (ORDER_TRANSITIONS[current] || []).includes(next);
};

export const getNextStatuses = (status) => {
  const current = normalizeOrderStatus(status);
  return [...(ORDER_TRANSITIONS[current] || [])];
};

/**
 * Find a valid path from one status to another. This is used by the courier
 * sync where a shipment may jump from "Shipped" straight to "Delivered"; the
 * order still receives an honest "Out for Delivery" history entry first.
 */
export const getAdvancePath = (from, to) => {
  const start = normalizeOrderStatus(from);
  const target = normalizeOrderStatus(to);
  if (start === target) return [];

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const next of ORDER_TRANSITIONS[current] || []) {
      if (next === target) return [...path.slice(1), next];
      if (visited.has(next)) continue;
      // Do not route a courier update through cancellation/return branches.
      if (["Cancelled", "Refunded", "Return Requested", "Return Approved", "Return Rejected", "Returned", "Refund Pending"].includes(next)) {
        continue;
      }
      visited.add(next);
      queue.push([...path, next]);
    }
  }

  return null;
};

export const isCustomerCancellable = (status) =>
  CUSTOMER_CANCELLABLE_STATUSES.includes(normalizeOrderStatus(status));

export const isAdminCancellable = (status) =>
  ADMIN_CANCELLABLE_STATUSES.includes(normalizeOrderStatus(status));

export const getReturnWindowDays = () => {
  const configured = Number(process.env.RETURN_WINDOW_DAYS);
  return Number.isFinite(configured) && configured > 0 ? configured : 7;
};

export const isReturnEligible = (order, now = new Date()) => {
  if (!order) return { eligible: false, reason: "Order not found" };
  const status = normalizeOrderStatus(order.orderStatus);
  if (status !== "Delivered") {
    return { eligible: false, reason: "Returns are only available for delivered orders" };
  }
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
  if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
    return { eligible: false, reason: "Delivery date is not recorded for this order" };
  }
  const windowDays = getReturnWindowDays();
  const deadline = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  if (now > deadline) {
    return {
      eligible: false,
      reason: `The ${windowDays}-day return window closed on ${deadline.toLocaleDateString("en-IN")}`,
    };
  }
  return { eligible: true, deadline, windowDays };
};

export const sumCompletedRefunds = (order) =>
  (order?.refunds || [])
    .filter((refund) => refund.status === "Completed")
    .reduce((total, refund) => total + (Number(refund.amount) || 0), 0);

export const getRefundableAmount = (order) => {
  const total = Number(order?.totalAmount) || 0;
  const refunded = sumCompletedRefunds(order);
  return Math.max(0, Number((total - refunded).toFixed(2)));
};

export const isPaidPaymentStatus = (status) =>
  PAID_PAYMENT_STATUSES.includes(normalizePaymentStatus(status));

export const requiresInventoryRestore = (status) =>
  ["Cancelled", "Returned", "Refunded"].includes(normalizeOrderStatus(status));

export const statusLabel = (status) => normalizeOrderStatus(status);

export default {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  ORDER_TRANSITIONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  ADMIN_CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  PAID_PAYMENT_STATUSES,
  normalizeOrderStatus,
  normalizePaymentStatus,
  isValidTransition,
  getNextStatuses,
  getAdvancePath,
  isCustomerCancellable,
  isAdminCancellable,
  getReturnWindowDays,
  isReturnEligible,
  sumCompletedRefunds,
  getRefundableAmount,
  isPaidPaymentStatus,
  requiresInventoryRestore,
  statusLabel,
};
