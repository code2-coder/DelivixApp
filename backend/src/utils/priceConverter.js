/**
 * Price Conversion Utility for Multi-Currency Support
 * Handles conversion of product prices from INR to other currencies
 */

// Fallback rates for reliability (last known good rates as of 2024-2025)
export const FALLBACK_RATES = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095,
    AED: 0.044,
    AUD: 0.015, // ₹1 ≈ A$0.015 (₹66-67 = A$1)
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_RATES);

let ratesCache = {
  rates: null,
  timestamp: 0
};

export const fetchCurrentRates = async () => {
  const now = Date.now();
  if (ratesCache.rates && (now - ratesCache.timestamp < 3600000)) {
    return ratesCache.rates;
  }
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/INR");
    const data = await response.json();
    if (data.result === "success" && data.rates) {
      ratesCache.rates = data.rates;
      ratesCache.timestamp = now;
      return data.rates;
    }
  } catch (err) {
    console.error("Failed to fetch rates, using fallback", err);
  }
  return FALLBACK_RATES;
};

/**
 * Convert a price from INR to target currency
 * @param {number} priceInINR - Price in Indian Rupees
 * @param {string} targetCurrency - Target currency code (default: 'AUD')
 * @param {Object} rates - Exchange rates object (optional, uses fallback if not provided)
 * @returns {number} Converted price
 */
export const convertPrice = (priceInINR, targetCurrency = 'AUD', rates = null) => {
    if (!priceInINR || typeof priceInINR !== 'number' || priceInINR <= 0) {
        return 0;
    }

    if (targetCurrency === 'INR') {
        return priceInINR;
    }

    const rateToUse = rates || FALLBACK_RATES;
    const rate = rateToUse[targetCurrency];

    if (!rate) {
        console.warn(`No rate available for ${targetCurrency}, returning original price`);
        return priceInINR;
    }

    const converted = priceInINR * rate;
    if (targetCurrency === 'AUD') {
        return Math.round(converted);
    }
    return converted;
};

/**
 * Format a price for display with currency symbol
 * @param {number} price - Price amount
 * @param {string} currency - Currency code (default: 'AUD')
 * @returns {string} Formatted price string with symbol
 */
export const formatCurrency = (price, currency = 'AUD') => {
    const currencySymbols = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
        AED: 'د.إ',
        AUD: 'A$',
    };

    const symbol = currencySymbols[currency] || currency;
    const maxDigits = currency === 'AUD' ? 0 : 2;
    const formatted = typeof price === 'number'
        ? price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxDigits })
        : '0';

    return `${symbol}${formatted}`;
};

/**
 * Get price info with multiple currency options
 * @param {number} priceInINR - Price in Indian Rupees
 * @param {Object} rates - Exchange rates object
 * @returns {Object} Price object with INR and other currencies
 */
export const getPriceInMultipleCurrencies = (priceInINR, rates = null) => {
    const rateToUse = rates || FALLBACK_RATES;

    return {
        INR: {
            value: priceInINR,
            formatted: formatCurrency(priceInINR, 'INR'),
        },
        USD: {
            value: convertPrice(priceInINR, 'USD', rateToUse),
            formatted: formatCurrency(convertPrice(priceInINR, 'USD', rateToUse), 'USD'),
        },
        EUR: {
            value: convertPrice(priceInINR, 'EUR', rateToUse),
            formatted: formatCurrency(convertPrice(priceInINR, 'EUR', rateToUse), 'EUR'),
        },
        GBP: {
            value: convertPrice(priceInINR, 'GBP', rateToUse),
            formatted: formatCurrency(convertPrice(priceInINR, 'GBP', rateToUse), 'GBP'),
        },
        AED: {
            value: convertPrice(priceInINR, 'AED', rateToUse),
            formatted: formatCurrency(convertPrice(priceInINR, 'AED', rateToUse), 'AED'),
        },
        AUD: {
            value: convertPrice(priceInINR, 'AUD', rateToUse),
            formatted: formatCurrency(convertPrice(priceInINR, 'AUD', rateToUse), 'AUD'),
        },
    };
};

/**
 * Add currency conversion to product object
 * @param {Object} product - Product object
 * @param {string} targetCurrency - Target currency (default: 'AUD')
 * @param {Object} rates - Exchange rates
 * @returns {Object} Product with price in target currency
 */
export const addConvertedPrice = (product, targetCurrency = 'AUD', rates = null) => {
    return {
        ...product,
        priceINR: product.price,
        price: convertPrice(product.price, targetCurrency, rates),
        displayPrice: formatCurrency(convertPrice(product.price, targetCurrency, rates), targetCurrency),
        currency: targetCurrency,
        priceInAllCurrencies: getPriceInMultipleCurrencies(product.price, rates),
    };
};

/**
 * Add currency conversion to multiple products
 * @param {Array} products - Array of product objects
 * @param {string} targetCurrency - Target currency (default: 'AUD')
 * @param {Object} rates - Exchange rates
 * @returns {Array} Products with converted prices
 */
export const addConvertedPricesToProducts = (products, targetCurrency = 'AUD', rates = null) => {
    return products.map(product => addConvertedPrice(product, targetCurrency, rates));
};
