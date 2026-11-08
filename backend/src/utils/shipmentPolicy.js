/**
 * Shipment workflow helpers.
 *
 * Orders and shipments have separate status vocabularies. When an admin moves
 * an order forward, an existing shipment should mirror the equivalent milestone
 * without ever moving backwards or inventing courier events.
 */

export const SHIPMENT_STATUS_RANK = Object.freeze({
  "Order Confirmed": 0,
  "Shipment Created": 0,
  Processing: 1,
  Packed: 1,
  "Ready to Ship": 2,
  "Ready for Pickup": 2,
  "Picked Up": 3,
  Shipped: 4,
  Dispatched: 4,
  "In Transit": 5,
  "Reached Destination Hub": 6,
  "Arrived at Hub": 6,
  "Out for Delivery": 7,
  Delivered: 8,
  Returned: 9,
  "Return Received": 9,
  "Return to Origin": 9,
  Cancelled: 10,
  "Delivery Attempt Failed": 4,
  "Delivery Failed": 4,
  "Delivery Attempted": 4,
  "Customer Unavailable": 4,
  Rescheduled: 4,
});

export const SHIPMENT_STATUS_FOR_ORDER_STATUS = Object.freeze({
  Packed: "Packed",
  Shipped: "Dispatched",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
});

export const shipmentStatusForOrderStatus = (status) =>
  SHIPMENT_STATUS_FOR_ORDER_STATUS[status] || null;

export const shouldAdvanceShipmentStatus = (current, target) => {
  if (!target || current === target) return false;
  if (target === "Cancelled") return current !== "Cancelled";
  return (SHIPMENT_STATUS_RANK[current] ?? 0) < (SHIPMENT_STATUS_RANK[target] ?? 0);
};

export default {
  SHIPMENT_STATUS_RANK,
  SHIPMENT_STATUS_FOR_ORDER_STATUS,
  shipmentStatusForOrderStatus,
  shouldAdvanceShipmentStatus,
};
