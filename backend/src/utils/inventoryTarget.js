/**
 * Resolve which price/stock row an order line refers to.
 *
 * Products can be:
 *  - simple (root price + root stock)
 *  - sold in root sizes
 *  - sold in colour/other variants that optionally contain sizes
 *  - sold in colour-only variants (variant price/stock/sku, no sizes)
 *
 * The checkout only sends a product id, quantity and optional size/variant, so
 * all price and stock information must be resolved from trusted product data
 * on the server.
 */

const firstImage = (product, variant) =>
  variant?.images?.[0]?.url || product?.images?.[0]?.url || "no-image";

const variantIsActive = (variant) => variant?.isActive !== false;

export const resolveInventoryTarget = (product, item = {}) => {
  if (!product) {
    return { ok: false, reason: "Product not found" };
  }

  const sizeName = item.size ? String(item.size).trim() : "";
  const variantName = item.variantName ? String(item.variantName).trim() : "";
  const variants = (product.variants || []).filter(variantIsActive);

  // ── 1. Root-level sizes ───────────────────────────────────────────────────
  if (sizeName) {
    const rootSize = (product.sizes || []).find((entry) => entry.size === sizeName);
    if (rootSize) {
      if (rootSize.status === "Draft") {
        return { ok: false, reason: `Size ${sizeName} is not available` };
      }
      return {
        ok: true,
        kind: "size",
        size: rootSize.size,
        variantName: null,
        sku: rootSize.sku || product.sku || null,
        price: Number(rootSize.price ?? product.price),
        stock: Number(rootSize.stock ?? 0),
        image: firstImage(product),
        variantSku: rootSize.sku || null,
      };
    }
  }

  // ── 2. Named colour / custom variants ────────────────────────────────────
  if (variantName) {
    const variant = variants.find(
      (entry) => entry.variantName === variantName || entry.colorName === variantName
    );

    if (!variant) {
      return { ok: false, reason: `Selected option "${variantName}" is no longer available` };
    }

    const variantSizes = variant.sizes || [];

    if (sizeName) {
      const variantSize = variantSizes.find((entry) => entry.size === sizeName);
      if (!variantSize) {
        return { ok: false, reason: `Size ${sizeName} is not available for ${variantName}` };
      }
      if (variantSize.status === "Draft") {
        return { ok: false, reason: `Size ${sizeName} is not available` };
      }
      return {
        ok: true,
        kind: "variantSize",
        size: variantSize.size,
        variantName: variant.variantName || variant.colorName,
        sku: variantSize.sku || variant.sku || null,
        price: Number(variantSize.price ?? variant.price ?? product.price),
        stock: Number(variantSize.stock ?? 0),
        image: firstImage(product, variant),
        variantSku: variantSize.sku || variant.sku || null,
      };
    }

    // Variant with sizes requires a size selection.
    if (variantSizes.length > 0) {
      return {
        ok: false,
        reason: `Please select a size for ${variantName} before adding this product to your bag`,
      };
    }

    // Colour-only variant: the variant row itself is the sellable target.
    return {
      ok: true,
      kind: "variant",
      size: null,
      variantName: variant.variantName || variant.colorName,
      sku: variant.sku || product.sku || null,
      price: Number(variant.price ?? product.price),
      stock: Number(variant.stock ?? 0),
      image: firstImage(product, variant),
      variantSku: variant.sku || null,
    };
  }

  // ── 3. Size supplied without a variant (shared sizes) ────────────────────
  if (sizeName) {
    const matchingVariants = variants.filter((variant) =>
      (variant.sizes || []).some((entry) => entry.size === sizeName)
    );
    if (matchingVariants.length > 1) {
      return { ok: false, reason: `Please select a variant for size ${sizeName}` };
    }
    const variant = matchingVariants[0];
    if (variant) {
      const variantSize = (variant.sizes || []).find((entry) => entry.size === sizeName);
      if (variantSize?.status === "Draft") {
        return { ok: false, reason: `Size ${sizeName} is not available` };
      }
      return {
        ok: true,
        kind: "variantSize",
        size: variantSize.size,
        variantName: variant.variantName || variant.colorName,
        sku: variantSize.sku || variant.sku || null,
        price: Number(variantSize.price ?? variant.price ?? product.price),
        stock: Number(variantSize.stock ?? 0),
        image: firstImage(product, variant),
        variantSku: variantSize.sku || variant.sku || null,
      };
    }
    return { ok: false, reason: `Selected option "${sizeName}" is no longer available` };
  }

  // ── 4. Products with selectable options must not fall back to root stock ─
  const hasRootSizes = (product.sizes || []).length > 0;
  const hasVariantOptions = variants.length > 0;
  if (hasRootSizes || hasVariantOptions) {
    return {
      ok: false,
      reason: "Please select a size or colour before adding this product to your bag",
    };
  }

  return {
    ok: true,
    kind: "product",
    size: null,
    variantName: null,
    sku: product.sku || null,
    price: Number(product.price || 0),
    stock: Number(product.stock ?? 0),
    image: firstImage(product),
    variantSku: null,
  };
};

export default { resolveInventoryTarget };
