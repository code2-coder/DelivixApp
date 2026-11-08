import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import CurrencySetting from "../models/currencySetting.js";

// Fallback rates for reliability
const FALLBACK_RATES = {
  INR: 1.0,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AED: 0.044,
  AUD: 0.0165,
};

//
// 💱 GET EXCHANGE RATES
//
export const getExchangeRates = catchAsyncErrors(async (req, res, next) => {
  const baseCurrency = req.query.base || "INR";

  try {
    let settings = await CurrencySetting.findOne();
    if (!settings) {
      settings = await CurrencySetting.create({
        baseCurrency: "INR",
        rates: {
          INR: 1.0,
          AUD: 0.0165,
          USD: 0.012,
          EUR: 0.011,
          GBP: 0.0095,
          AED: 0.044,
        },
        updatedBy: "System Initializer",
      });
    }

    const baseRates = Object.fromEntries(settings.rates);

    if (baseCurrency === "INR") {
      return res.status(200).json({
        success: true,
        cached: false,
        timestamp: Date.now(),
        rates: baseRates,
      });
    }

    const baseRate = baseRates[baseCurrency];
    if (!baseRate) {
      return next(new ErrorHandler(`Unsupported base currency: ${baseCurrency}`, 400));
    }

    const calculatedRates = {};
    for (const cur of Object.keys(baseRates)) {
      calculatedRates[cur] = Number((baseRates[cur] / baseRate).toFixed(6));
    }

    return res.status(200).json({
      success: true,
      rates: calculatedRates,
    });
  } catch (error) {
    console.error("Exchange Rate DB Fetch Error:", error);
    return res.status(200).json({
      success: true,
      fallback: true,
      rates: FALLBACK_RATES,
    });
  }
});

//
// 💰 CONVERT PRICE (Single or Bulk)
//
export const convertPrice = catchAsyncErrors(async (req, res, next) => {
  const { amount, targetCurrency = "AUD", baseCurrency = "INR" } = req.body;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return next(new ErrorHandler("Invalid amount provided", 400));
  }

  if (!targetCurrency || targetCurrency === baseCurrency) {
    return res.status(200).json({
      success: true,
      originalAmount: amount,
      baseCurrency,
      targetCurrency: baseCurrency,
      convertedAmount: amount,
      rate: 1,
    });
  }

  try {
    let settings = await CurrencySetting.findOne();
    if (!settings) {
      settings = await CurrencySetting.create({
        baseCurrency: "INR",
        rates: {
          INR: 1.0,
          AUD: 0.0165,
          USD: 0.012,
          EUR: 0.011,
          GBP: 0.0095,
          AED: 0.044,
        },
        updatedBy: "System Initializer",
      });
    }

    const baseRates = Object.fromEntries(settings.rates);
    const fromRate = baseRates[baseCurrency];
    const toRate = baseRates[targetCurrency];

    if (!fromRate || !toRate) {
      return next(new ErrorHandler(`Unsupported currency pair: ${baseCurrency} to ${targetCurrency}`, 400));
    }

    const rate = toRate / fromRate;
    const convertedAmount = amount * rate;

    return res.status(200).json({
      success: true,
      originalAmount: amount,
      baseCurrency,
      targetCurrency,
      rate,
      convertedAmount,
      rounded: targetCurrency === 'AUD' ? Math.round(convertedAmount) : Math.round(convertedAmount * 100) / 100,
    });
  } catch (error) {
    console.error("Price Conversion DB Error:", error);
    return next(new ErrorHandler("Error converting price", 500));
  }
});
