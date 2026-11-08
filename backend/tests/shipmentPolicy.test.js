import test from "node:test";
import assert from "node:assert/strict";
import {
  shipmentStatusForOrderStatus,
  shouldAdvanceShipmentStatus,
} from "../src/utils/shipmentPolicy.js";

test("order milestones map to the equivalent shipment milestone", () => {
  assert.equal(shipmentStatusForOrderStatus("Packed"), "Packed");
  assert.equal(shipmentStatusForOrderStatus("Shipped"), "Dispatched");
  assert.equal(shipmentStatusForOrderStatus("Out for Delivery"), "Out for Delivery");
  assert.equal(shipmentStatusForOrderStatus("Delivered"), "Delivered");
  assert.equal(shipmentStatusForOrderStatus("Cancelled"), "Cancelled");
});

test("statuses without a shipment equivalent are left untouched", () => {
  assert.equal(shipmentStatusForOrderStatus("Processing"), null);
  assert.equal(shipmentStatusForOrderStatus("Return Requested"), null);
  assert.equal(shipmentStatusForOrderStatus("Refunded"), null);
  assert.equal(shipmentStatusForOrderStatus(""), null);
});

test("shipment mirroring only moves forward", () => {
  assert.equal(shouldAdvanceShipmentStatus("Shipment Created", "Packed"), true);
  assert.equal(shouldAdvanceShipmentStatus("Packed", "Dispatched"), true);
  assert.equal(shouldAdvanceShipmentStatus("In Transit", "Dispatched"), false);
  assert.equal(shouldAdvanceShipmentStatus("Delivered", "Out for Delivery"), false);
  assert.equal(shouldAdvanceShipmentStatus("Packed", "Packed"), false);
});

test("a cancellation closes an in-flight shipment but is idempotent", () => {
  assert.equal(shouldAdvanceShipmentStatus("In Transit", "Cancelled"), true);
  assert.equal(shouldAdvanceShipmentStatus("Cancelled", "Cancelled"), false);
});
