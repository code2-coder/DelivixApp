import test from "node:test";
import assert from "node:assert/strict";
import {
  updateCustomerSchema,
  updateCustomerStatusSchema,
  addCustomerNoteSchema,
} from "../src/validators/customer.validator.js";

test("updateCustomerSchema accepts permitted profile fields", () => {
  const parsed = updateCustomerSchema.parse({
    body: {
      name: "Aarav Sharma",
      phoneNumber: "+91 98765 43210",
      altPhoneNumber: "+91 91234 56789",
      isVerified: true,
      status: "active",
    },
  });

  assert.equal(parsed.body.name, "Aarav Sharma");
  assert.equal(parsed.body.phoneNumber, "+91 98765 43210");
  assert.equal(parsed.body.isVerified, true);
  assert.equal(parsed.body.status, "active");
});

test("updateCustomerSchema rejects short names", () => {
  const result = updateCustomerSchema.safeParse({
    body: { name: "A" },
  });
  assert.equal(result.success, false);
});

test("updateCustomerSchema rejects unsupported account statuses", () => {
  const result = updateCustomerSchema.safeParse({
    body: { status: "deleted_forever" },
  });
  assert.equal(result.success, false);
});

test("updateCustomerStatusSchema accepts valid statuses", () => {
  const valid = ["active", "inactive", "suspended", "blocked"];
  for (const status of valid) {
    const parsed = updateCustomerStatusSchema.parse({
      body: { status, reason: "Administrative review" },
    });
    assert.equal(parsed.body.status, status);
  }
});

test("updateCustomerStatusSchema rejects invalid status", () => {
  const result = updateCustomerStatusSchema.safeParse({
    body: { status: "unknown_status" },
  });
  assert.equal(result.success, false);
});

test("addCustomerNoteSchema requires non-empty note content", () => {
  const empty = addCustomerNoteSchema.safeParse({
    body: { note: "   " },
  });
  assert.equal(empty.success, false);

  const valid = addCustomerNoteSchema.parse({
    body: { note: "Customer contacted support regarding order delivery." },
  });
  assert.equal(valid.body.note, "Customer contacted support regarding order delivery.");
});
