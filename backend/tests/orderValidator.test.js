import test from "node:test";
import assert from "node:assert/strict";
import {
  quoteOrderSchema,
  updateShipmentSchema,
} from "../src/validators/order.validator.js";

const shippingInfo = {
  fullName: "Test Customer",
  email: "test@example.com",
  address: "1 Test Street",
  city: "Mumbai",
  phoneNo: "9876543210",
  zipCode: "400001",
  country: "India",
};

const quoteBody = {
  items: [{ productId: "507f1f77bcf86cd799439011", quantity: 2 }],
  shippingInfo,
};

test("client-supplied discounts are stripped by validation", () => {
  const parsed = quoteOrderSchema.parse({
    body: { ...quoteBody, discountAmount: 500 },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.body, "discountAmount"), false);
});

test("shipment validation accepts known statuses and dates", () => {
  const parsed = updateShipmentSchema.parse({
    body: {
      courierName: "Delhivery",
      trackingNumber: "AWB123",
      status: "In Transit",
      shipmentDate: "2026-10-01T10:00:00.000Z",
      estimatedDeliveryDate: "2026-10-04T10:00:00.000Z",
    },
  });
  assert.equal(parsed.body.status, "In Transit");
});

test("shipment validation rejects unknown statuses", () => {
  const result = updateShipmentSchema.safeParse({
    body: { status: "Teleported" },
  });
  assert.equal(result.success, false);
});

test("shipment validation rejects impossible dates", () => {
  assert.equal(
    updateShipmentSchema.safeParse({ body: { shipmentDate: "not-a-date" } }).success,
    false
  );
  assert.equal(
    updateShipmentSchema.safeParse({
      body: {
        shipmentDate: "2026-10-05T10:00:00.000Z",
        estimatedDeliveryDate: "2026-10-01T10:00:00.000Z",
      },
    }).success,
    false
  );
});
