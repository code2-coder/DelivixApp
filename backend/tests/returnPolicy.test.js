import test from "node:test";
import assert from "node:assert/strict";
import {
  returnStatusForOrderStatus,
  shouldAdvanceReturnStatus,
} from "../src/utils/returnPolicy.js";

test("order statuses map to the matching return workflow status", () => {
  assert.equal(returnStatusForOrderStatus("Return Approved").status, "Approved");
  assert.equal(returnStatusForOrderStatus("Returned").status, "Product Received");
  assert.equal(returnStatusForOrderStatus("Refund Pending").status, "Refund Processing");
  assert.equal(returnStatusForOrderStatus("Refunded").status, "Refund Completed");
  assert.equal(returnStatusForOrderStatus("Delivered"), null);
});

test("return statuses only move forward", () => {
  assert.equal(shouldAdvanceReturnStatus("Pending Review", "Approved"), true);
  assert.equal(shouldAdvanceReturnStatus("Approved", "Product Received"), true);
  assert.equal(shouldAdvanceReturnStatus("Product Received", "Approved"), false);
  assert.equal(shouldAdvanceReturnStatus("Approved", "Approved"), false);
});

test("a rejected return is final", () => {
  assert.equal(shouldAdvanceReturnStatus("Rejected", "Approved"), false);
  assert.equal(shouldAdvanceReturnStatus("Refund Completed", "Rejected"), false);
  assert.equal(shouldAdvanceReturnStatus("Approved", "Rejected"), true);
});

test("refund statuses do not touch replacement or exchange returns", () => {
  assert.equal(
    shouldAdvanceReturnStatus("Product Received", "Refund Processing", {
      returnType: "Replacement",
    }),
    false
  );
  assert.equal(
    shouldAdvanceReturnStatus("Product Received", "Refund Completed", {
      returnType: "Exchange",
    }),
    false
  );
  assert.equal(
    shouldAdvanceReturnStatus("Product Received", "Refund Processing", {
      returnType: "Refund",
    }),
    true
  );
});

test("unknown statuses are ignored instead of guessed", () => {
  assert.equal(shouldAdvanceReturnStatus("Mystery", "Approved"), false);
  assert.equal(shouldAdvanceReturnStatus("Approved", "Mystery"), false);
});
