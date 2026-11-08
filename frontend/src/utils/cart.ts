import type { ProductItem, ProductOption, ProductVariant } from "../services/api";

/**
 * The cart is stored as a `{ lineKey: quantity }` map so it can be persisted in
 * localStorage. A line key contains the product plus the selected variant/size,
 * which lets the same product appear twice with different options.
 *
 * Legacy carts used the bare product id as the key; `parseCartLineKey` still
 * accepts that shape and treats it as a simple product.
 */
const SEPARATOR = "::";

export interface CartSelection {
  productId: string;
  size?: string;
  variantName?: string;
}

export interface CartLine extends CartSelection {
  key: string;
  quantity: number;
}

export type CartMap = Record<string, number>;

export const cartLineKey = ({ productId, size, variantName }: CartSelection): string =>
  [String(productId), size || "", variantName || ""].join(SEPARATOR);

export const parseCartLineKey = (key: string): CartSelection => {
  const [productId, size, variantName] = String(key).split(SEPARATOR);
  return {
    productId: productId || String(key),
    size: size || undefined,
    variantName: variantName || undefined,
  };
};

export const getCartLines = (cart: CartMap): CartLine[] =>
  Object.entries(cart || {})
    .map(([key, quantity]) => ({
      key,
      ...parseCartLineKey(key),
      quantity: Math.max(0, Number(quantity) || 0),
    }))
    .filter((line) => line.productId && line.quantity > 0);

export const getCartCount = (cart: CartMap): number =>
  getCartLines(cart).reduce((total, line) => total + line.quantity, 0);

export const addCartSelection = (
  cart: CartMap,
  selection: CartSelection,
  quantity = 1
): CartMap => {
  const key = cartLineKey(selection);
  return {
    ...cart,
    [key]: Math.max(0, (Number(cart[key]) || 0) + Math.max(1, Number(quantity) || 1)),
  };
};

export const setCartLineQuantity = (
  cart: CartMap,
  key: string,
  quantity: number
): CartMap => {
  const next = { ...cart };
  if (quantity <= 0) delete next[key];
  else next[key] = quantity;
  return next;
};

export const findProductOption = (
  product: ProductItem,
  selection: Pick<CartSelection, "size" | "variantName">
): { price: number; stock: number; option?: ProductOption; variant?: ProductVariant } => {
  const size = selection.size ? String(selection.size) : "";
  const variantName = selection.variantName ? String(selection.variantName) : "";
  const activeVariants = (product.variants || []).filter((variant) => variant.isActive !== false);

  if (size) {
    const rootOption = (product.sizes || []).find((entry) => entry.size === size);
    if (rootOption) {
      return {
        price: Number(rootOption.price ?? product.price) || 0,
        stock: Number(rootOption.stock ?? 0) || 0,
        option: rootOption,
      };
    }

    const variants = variantName
      ? activeVariants.filter(
          (variant) => variant.variantName === variantName || variant.colorName === variantName
        )
      : activeVariants;

    for (const variant of variants) {
      const option = (variant.sizes || []).find((entry) => entry.size === size);
      if (option) {
        return {
          price: Number(option.price ?? variant.price ?? product.price) || 0,
          stock: Number(option.stock ?? 0) || 0,
          option,
          variant,
        };
      }
    }
  }

  // Colour-only / custom variant without sizes: the variant itself carries the
  // price and stock for that option.
  if (variantName) {
    const variant = activeVariants.find(
      (entry) => entry.variantName === variantName || entry.colorName === variantName
    );
    if (variant) {
      return {
        price: Number(variant.price ?? product.price) || 0,
        stock: Number(variant.stock ?? 0) || 0,
        variant,
      };
    }
  }

  return {
    price: Number(product.price) || 0,
    stock: Number(product.stock ?? 0) || 0,
  };
};

export const cartLineLabel = (selection: Pick<CartSelection, "size" | "variantName">): string => {
  const parts = [selection.variantName, selection.size].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Standard";
};
