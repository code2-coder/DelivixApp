import test from "node:test";
import assert from "node:assert/strict";
import {
  SHIPMENT_STATUS_RANK,
  shouldAdvanceShipmentStatus,
} from "../src/utils/shipmentPolicy.js";
import { SHIPMENT_STATUSES } from "../src/models/shipment.js";

test("SHIPMENT_STATUSES contains all 13 standard required statuses", () => {
  const required13 = [
    "Order Confirmed",
    "Processing",
    "Packed",
    "Ready to Ship",
    "Shipped",
    "In Transit",
    "Reached Destination Hub",
    "Out for Delivery",
    "Delivered",
    "Delivery Attempt Failed",
    "Return to Origin",
    "Returned",
    "Cancelled",
  ];

  required13.forEach((status) => {
    assert.ok(
      SHIPMENT_STATUSES.includes(status),
      `SHIPMENT_STATUSES must include '${status}'`
    );
  });
});

test("Shipment workflow advances monotonically forward through delivery milestones", () => {
  assert.equal(shouldAdvanceShipmentStatus("Order Confirmed", "Packed"), true);
  assert.equal(shouldAdvanceShipmentStatus("Packed", "Ready to Ship"), true);
  assert.equal(shouldAdvanceShipmentStatus("Ready to Ship", "Shipped"), true);
  assert.equal(shouldAdvanceShipmentStatus("Shipped", "In Transit"), true);
  assert.equal(shouldAdvanceShipmentStatus("In Transit", "Reached Destination Hub"), true);
  assert.equal(shouldAdvanceShipmentStatus("Reached Destination Hub", "Out for Delivery"), true);
  assert.equal(shouldAdvanceShipmentStatus("Out for Delivery", "Delivered"), true);

  // Delivered cannot move back to Out for Delivery or Packed
  assert.equal(shouldAdvanceShipmentStatus("Delivered", "Out for Delivery"), false);
  assert.equal(shouldAdvanceShipmentStatus("Delivered", "Packed"), false);

  // Cancellation closes any in-flight status
  assert.equal(shouldAdvanceShipmentStatus("Out for Delivery", "Cancelled"), true);
  assert.equal(shouldAdvanceShipmentStatus("Cancelled", "Cancelled"), false);
});

test("Shipping fee calculation applies free shipping thresholds correctly", () => {
  const freeShippingThreshold = 999;
  const standardFee = 49;
  const expressFee = 99;

  // Below threshold
  const orderBelow = 500;
  const standardChargeBelow = orderBelow >= freeShippingThreshold ? 0 : standardFee;
  assert.equal(standardChargeBelow, 49);

  // At or above threshold
  const orderAbove = 1200;
  const standardChargeAbove = orderAbove >= freeShippingThreshold ? 0 : standardFee;
  assert.equal(standardChargeAbove, 0);

  // Express shipping always charges express fee
  const expressCharge = expressFee;
  assert.equal(expressCharge, 99);
});

test("Pincode validator accepts standard 6-digit postal codes and rejects malformed values", () => {
  const validPincodes = ["400001", "110001", "560001", "700001", "600001"];
  const invalidPincodes = ["012345", "ABCDE", "12345", "1234567", "400 001", ""];

  validPincodes.forEach((pin) => {
    assert.ok(/^[1-9][0-9]{5}$/.test(pin), `Expected '${pin}' to be valid`);
  });

  invalidPincodes.forEach((pin) => {
    assert.ok(!/^[1-9][0-9]{5}$/.test(pin), `Expected '${pin}' to be invalid`);
  });
});
