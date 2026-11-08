import test from "node:test";
import assert from "node:assert/strict";
import { resolveInventoryTarget } from "../src/utils/inventoryTarget.js";

const simpleProduct = {
  _id: "p1",
  name: "Simple product",
  price: 500,
  stock: 8,
  images: [{ url: "simple.jpg" }],
};

test("simple products use root price and stock", () => {
  const target = resolveInventoryTarget(simpleProduct, { quantity: 1 });
  assert.equal(target.ok, true);
  assert.equal(target.kind, "product");
  assert.equal(target.price, 500);
  assert.equal(target.stock, 8);
  assert.equal(target.image, "simple.jpg");
});

test("root sizes take precedence and carry their own stock", () => {
  const product = {
    ...simpleProduct,
    sizes: [
      { size: "M", price: 600, stock: 3, sku: "SKU-M" },
      { size: "L", price: 650, stock: 0, sku: "SKU-L" },
    ],
  };
  const target = resolveInventoryTarget(product, { size: "M" });
  assert.equal(target.ok, true);
  assert.equal(target.kind, "size");
  assert.equal(target.price, 600);
  assert.equal(target.stock, 3);
  assert.equal(target.sku, "SKU-M");
});

test("variant sizes resolve the correct variant and sku", () => {
  const product = {
    ...simpleProduct,
    variants: [
      {
        variantName: "Black",
        skuPrefix: "BLK",
        images: [{ url: "black.jpg" }],
        sizes: [{ size: "M", price: 750, stock: 2, sku: "BLK-M" }],
      },
      {
        variantName: "White",
        sizes: [{ size: "M", price: 700, stock: 4, sku: "WHT-M" }],
      },
    ],
  };
  const target = resolveInventoryTarget(product, { size: "M", variantName: "White" });
  assert.equal(target.ok, true);
  assert.equal(target.kind, "variantSize");
  assert.equal(target.variantName, "White");
  assert.equal(target.price, 700);
  assert.equal(target.stock, 4);
  assert.equal(target.sku, "WHT-M");
});

test("unknown options are rejected instead of falling back to base price", () => {
  const product = {
    ...simpleProduct,
    sizes: [{ size: "M", price: 600, stock: 3 }],
  };
  const target = resolveInventoryTarget(product, { size: "XXL" });
  assert.equal(target.ok, false);
  assert.match(target.reason, /no longer available/i);
});

test("draft options cannot be sold", () => {
  const product = {
    ...simpleProduct,
    sizes: [{ size: "M", price: 600, stock: 3, status: "Draft" }],
  };
  const target = resolveInventoryTarget(product, { size: "M" });
  assert.equal(target.ok, false);
});

test("sized products require a size instead of falling back to root stock", () => {
  const product = {
    ...simpleProduct,
    sizes: [{ size: "M", price: 600, stock: 3 }],
  };
  const target = resolveInventoryTarget(product, { quantity: 1 });
  assert.equal(target.ok, false);
  assert.match(target.reason, /select a size/i);
});

test("variant products require a variant when a size exists in several variants", () => {
  const product = {
    ...simpleProduct,
    variants: [
      { variantName: "Black", sizes: [{ size: "M", price: 750, stock: 2 }] },
      { variantName: "White", sizes: [{ size: "M", price: 700, stock: 4 }] },
    ],
  };
  const ambiguous = resolveInventoryTarget(product, { size: "M" });
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.reason, /select a variant/i);

  const explicit = resolveInventoryTarget(product, { size: "M", variantName: "White" });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.variantName, "White");
});
