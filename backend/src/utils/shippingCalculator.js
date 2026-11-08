import Settings from "../models/settings.js";
import Product from "../models/product.js";
import { FALLBACK_RATES, fetchCurrentRates, convertPrice } from "./priceConverter.js";

/**
 * Round a money amount to two decimals without introducing negative zero.
 * Shared by the coupon engine and order pricing so every server-side
 * calculation uses exactly the same rounding rule.
 */
export const toMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const rounded = Number(amount.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
};

/**
 * Calculate shipping cost based on country, order total, and shipping method
 * @param {string} country - Destination country
 * @param {number} orderTotal - Order total in base currency
 * @param {string} shippingMethod - "standard" or "express"
 * @returns {Promise<Object>} Shipping info with amount and details
 */
export const calculateShipping = async (
    country,
    orderTotal,
    shippingMethod = "standard"
) => {
    let settings = await Settings.findOne();

    if (!settings) {
        // Initialize with defaults if not found
        settings = new Settings();
        await settings.save();
    }

    let shippingAmount = 0;
    let isFreeShipping = false;
    let shippingDetails = "";

    const countryLower = (country || "").toLowerCase();
    const decimals = countryLower === "australia" ? 0 : 2;

    if (countryLower === "australia") {
        if (shippingMethod === "express") {
            shippingAmount = Math.round(settings.australiaShipping.expressShippingPrice);
            shippingDetails = `Express Post: A$${shippingAmount.toFixed(decimals)}`;
        } else {
            // Standard shipping
            if (orderTotal >= settings.australiaShipping.freeShippingThreshold) {
                shippingAmount = 0;
                isFreeShipping = true;
                shippingDetails = `Standard Delivery: FREE (Order over A$${Math.round(settings.australiaShipping.freeShippingThreshold).toFixed(decimals)})`;
            } else {
                shippingAmount = Math.round(settings.australiaShipping.standardShippingPrice);
                shippingDetails = `Standard Delivery: A$${shippingAmount.toFixed(decimals)}`;
            }
        }
    } else if (countryLower === "india") {
        if (shippingMethod === "express") {
            shippingAmount = 14.95; // Default express shipping for India (in AUD base)
            shippingDetails = `Express Delivery: A$${shippingAmount.toFixed(2)}`;
        } else {
            shippingAmount = 0; // Standard shipping is FREE for India
            isFreeShipping = true;
            shippingDetails = `Standard Delivery: FREE`;
        }
    } else {
        // Default for other countries
        shippingAmount = 15;
        shippingDetails = `International Shipping: A$${shippingAmount.toFixed(decimals)}`;
    }

    return {
        country,
        shippingMethod,
        shippingAmount: Number(shippingAmount.toFixed(decimals)),
        isFreeShipping,
        shippingDetails,
        freeShippingThreshold:
            countryLower === "australia"
                ? settings.australiaShipping.freeShippingThreshold
                : null,
    };
};

/**
 * Calculate packaging cost
 * @param {string} packagingOption - "standard" or "exquisite"
 * @returns {Promise<Object>} Packaging info
 */
export const calculatePackaging = async (packagingOption = "standard") => {
    let settings = await Settings.findOne();

    if (!settings) {
        settings = new Settings();
        await settings.save();
    }

    let packagingAmount = 0;
    let packagingName = settings.packaging.standardPackagingName;

    if (packagingOption === "exquisite") {
        packagingAmount = settings.packaging.exquisitePackagingPrice;
        packagingName = settings.packaging.exquisitePackagingName;
    }

    return {
        packagingOption,
        packagingName,
        packagingAmount: Math.round(packagingAmount),
    };
};

/**
 * Calculate order totals (items + tax + shipping + packaging)
 * @param {number} itemsPrice - Total price of items
 * @param {number} taxRate - Tax rate (0.1 for 10%)
 * @param {number} shippingAmount - Shipping cost
 * @param {number} packagingAmount - Packaging cost
 * @returns {Object} Breakdown of all costs
 */
export const calculateOrderTotals = (
    itemsPrice,
    taxRate = 0.1,
    shippingAmount = 0,
    packagingAmount = 0
) => {
    const roundedItems = Math.round(itemsPrice);
    const roundedShipping = Math.round(shippingAmount);
    const roundedPackaging = Math.round(packagingAmount);
    const taxAmount = Math.round(roundedItems * taxRate);
    const totalAmount = roundedItems + taxAmount + roundedShipping + roundedPackaging;

    return {
        itemsPrice: roundedItems,
        taxAmount,
        taxRate: taxRate * 100 + "%",
        shippingAmount: roundedShipping,
        packagingAmount: roundedPackaging,
        totalAmount,
        breakdown: {
            items: `A$${roundedItems}`,
            tax: `A$${taxAmount} (${taxRate * 100}%)`,
            shipping: `A$${roundedShipping}`,
            packaging: `A$${roundedPackaging}`,
            total: `A$${totalAmount}`,
        },
    };
};

/**
 * Get all available shipping options for a country
 * @param {string} country - Destination country
 * @param {number} orderTotal - Order total
 * @returns {Promise<Array>} Array of shipping options
 */
export const getShippingOptions = async (country, orderTotal) => {
    const standardShipping = await calculateShipping(country, orderTotal, "standard");
    const expressShipping = await calculateShipping(country, orderTotal, "express");

    return [
        {
            id: "standard",
            name: "Standard Delivery",
            description: standardShipping.shippingDetails,
            price: standardShipping.shippingAmount,
            isFree: standardShipping.isFreeShipping,
            deliveryDays: "5-7 business days",
        },
        {
            id: "express",
            name: "Express Post",
            description: expressShipping.shippingDetails,
            price: expressShipping.shippingAmount,
            isFree: false,
            deliveryDays: "2-3 business days",
        },
    ];
};

/**
 * Settings shipping/packaging values are stored in AUD. Convert them to the
 * checkout currency using the INR-based exchange rates.
 */
export const convertFromAUD = (amount, targetCurrency = "INR", rates = null) => {
    const value = Number(amount) || 0;
    if (!value) return 0;

    const target = String(targetCurrency || "INR").toUpperCase();
    if (target === "AUD") return value;

    const rateSet = rates || FALLBACK_RATES;
    const audRate = Number(rateSet.AUD) || FALLBACK_RATES.AUD;
    const amountInINR = value / audRate;

    if (target === "INR") return amountInINR;
    return convertPrice(amountInINR, target, rateSet);
};

/**
 * Compute the authoritative order totals from trusted line items.
 * Client-supplied prices are never accepted.
 *
 * @param {Object} params
 * @param {Array<{price:number, quantity:number}>} params.trustedItems
 * @param {Object} params.shippingInfo
 * @param {string} params.shippingMethod
 * @param {string} params.packagingOption
 * @param {string} params.currency
 * @param {number} params.discountAmount
 * @returns {Promise<Object>} totals in the checkout currency
 */
export const computeOrderTotals = async ({
  trustedItems = [],
  shippingInfo = {},
  shippingMethod = "standard",
  packagingOption = "standard",
  currency = "INR",
  discountAmount = 0,
  shippingDiscount = 0,
}) => {
  const rates = await fetchCurrentRates();
  const checkoutCurrency = String(currency || "INR").toUpperCase();
  const country = shippingInfo?.country || "";
  const countryLower = String(country).toLowerCase();
  const decimals = checkoutCurrency === "AUD" ? 0 : 2;

  const itemsPriceInINR = trustedItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const itemsPrice = Number(
    convertPrice(itemsPriceInINR, checkoutCurrency, rates).toFixed(decimals)
  );

  const itemsPriceInAUD = convertPrice(itemsPriceInINR, "AUD", rates);
  const shippingInfoCalculated = await calculateShipping(
    country,
    itemsPriceInAUD,
    shippingMethod
  );
  const shippingAmount = Number(
    convertFromAUD(shippingInfoCalculated.shippingAmount, checkoutCurrency, rates).toFixed(decimals)
  );

  let packagingAmount = 0;
  let packagingName = "Standard packaging";
  if (countryLower !== "india") {
    const packaging = await calculatePackaging(packagingOption);
    packagingName = packaging.packagingName;
    packagingAmount = Number(
      convertFromAUD(packaging.packagingAmount, checkoutCurrency, rates).toFixed(decimals)
    );
  }

  const taxRate = Number(process.env.TAX_RATE) || 0;

  // Pricing sequence: items → item discount → shipping discount → tax → total.
  // Discounts are clamped so a malicious or stale coupon can never create a
  // negative total or discount more than the order is worth.
  const safeDiscount = Number(
    Math.min(Math.max(0, Number(discountAmount) || 0), itemsPrice).toFixed(decimals)
  );
  const safeShippingDiscount = Number(
    Math.min(Math.max(0, Number(shippingDiscount) || 0), shippingAmount).toFixed(decimals)
  );
  const taxableItems = Math.max(0, itemsPrice - safeDiscount);
  const taxAmount = Number((taxableItems * taxRate).toFixed(decimals));
  const payableShipping = Math.max(0, shippingAmount - safeShippingDiscount);

  const totalAmount = Number(
    Math.max(0, taxableItems + taxAmount + payableShipping + packagingAmount).toFixed(
      decimals
    )
  );

  return {
    currency: checkoutCurrency,
    itemsPrice,
    taxAmount,
    taxRate,
    shippingAmount,
    shippingDiscount: safeShippingDiscount,
    payableShipping,
    packagingAmount,
    discountAmount: safeDiscount,
    couponDiscountAmount: safeDiscount,
    totalAmount,
    // `isFreeShipping` only describes the configured shipping threshold; a
    // coupon-provided free shipping must not be confused with it.
    isFreeShipping: shippingInfoCalculated.isFreeShipping || safeShippingDiscount >= shippingAmount,
    shippingDetails: safeShippingDiscount > 0
      ? `${shippingInfoCalculated.shippingDetails} (discounted by coupon)`
      : shippingInfoCalculated.shippingDetails,
    packagingName,
    rates,
  };
};

/**
 * Validate order prices against database and exchange rates
 * @param {Object} reqBody - Request body containing order details
 * @returns {Promise<Object|boolean>} Verified amounts or false if invalid
 */
export const validateOrderPrices = async (reqBody) => {
    const {
        orderItems,
        shippingInfo,
        itemsPrice,
        shippingAmount,
        packagingAmount = 0,
        shippingMethod = "standard",
        packagingOption = "standard",
        totalAmount,
        currency = "INR",
    } = reqBody;

    const rates = await fetchCurrentRates();
    const country = shippingInfo?.country || "";
    const countryLower = country.toLowerCase();
    const checkoutCurrency = currency.toUpperCase();

    // 1. Calculate database items total in INR
    let calculatedItemsPriceInINR = 0;
    for (const item of orderItems) {
        const product = await Product.findById(item.product);
        if (!product) {
            console.error(`Product not found during validation: ${item.product}`);
            return false;
        }

        let basePrice = product.price;
        if (item.size) {
            // Check root sizes first
            const rootSizeObj = product.sizes?.find((s) => s.size === item.size);
            if (rootSizeObj && rootSizeObj.price) {
                basePrice = rootSizeObj.price;
            } else if (product.variants && product.variants.length > 0) {
                // Check within variant sizes
                for (const variant of product.variants) {
                    const variantSizeObj = variant.sizes?.find((s) => s.size === item.size);
                    if (variantSizeObj && variantSizeObj.price) {
                        basePrice = variantSizeObj.price;
                        break;
                    }
                }
            }
        }

        calculatedItemsPriceInINR += basePrice * item.quantity;
    }

    // 2. Convert items total to checkout currency
    const decimals = checkoutCurrency === "AUD" ? 0 : 2;
    const expectedItemsPrice = Number(
        convertPrice(calculatedItemsPriceInINR, checkoutCurrency, rates).toFixed(decimals)
    );

    // 3. Calculate shipping in AUD base first, then convert
    const itemsPriceInAUD = convertPrice(calculatedItemsPriceInINR, "AUD", rates);
    const shippingInfoCalculated = await calculateShipping(
        country,
        itemsPriceInAUD,
        shippingMethod
    );
    const expectedShippingAmount = Number(
        convertFromAUD(
            shippingInfoCalculated.shippingAmount,
            checkoutCurrency,
            rates
        ).toFixed(decimals)
    );

    // 4. Calculate packaging in AUD base, then convert (no packaging upgrade for India)
    let expectedPackagingAmount = 0;
    if (countryLower !== "india") {
        const packagingInfoCalculated = await calculatePackaging(packagingOption);
        expectedPackagingAmount = Number(
            convertFromAUD(
                packagingInfoCalculated.packagingAmount,
                checkoutCurrency,
                rates
            ).toFixed(decimals)
        );
    }

    // 5. Calculate total
    const expectedTotalAmount = Number(
        (
            expectedItemsPrice +
            expectedShippingAmount +
            expectedPackagingAmount
        ).toFixed(decimals)
    );

    // 6. Tolerance checks (allow small diff due to rounding / cache mismatch)
    const tolerance = checkoutCurrency === "INR" ? 15 : 2; // ₹15 tolerance for INR, $2 tolerance for AUD/USD/GBP etc.

    const itemsPriceDiff = Math.abs(itemsPrice - expectedItemsPrice);
    const shippingDiff = Math.abs(shippingAmount - expectedShippingAmount);
    const packagingDiff = Math.abs(packagingAmount - expectedPackagingAmount);
    const totalDiff = Math.abs(totalAmount - expectedTotalAmount);

    if (
        itemsPriceDiff > tolerance ||
        shippingDiff > tolerance ||
        packagingDiff > tolerance ||
        totalDiff > tolerance
    ) {
        console.error(`Price validation failed.
          Expected items: ${expectedItemsPrice}, got: ${itemsPrice} (diff: ${itemsPriceDiff})
          Expected shipping: ${expectedShippingAmount}, got: ${shippingAmount} (diff: ${shippingDiff})
          Expected packaging: ${expectedPackagingAmount}, got: ${packagingAmount} (diff: ${packagingDiff})
          Expected total: ${expectedTotalAmount}, got: ${totalAmount} (diff: ${totalDiff})`);
        return false;
    }

    return {
        itemsPrice: expectedItemsPrice,
        shippingAmount: expectedShippingAmount,
        packagingAmount: expectedPackagingAmount,
        totalAmount: expectedTotalAmount,
        taxAmount: 0,
    };
};
