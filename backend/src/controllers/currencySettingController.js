import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import CurrencySetting from "../models/currencySetting.js";

// Helper to initialize default currency settings document if none exists
const initCurrencySettings = async () => {
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
  return settings;
};

//
// 💱 GET CURRENCY SETTINGS
//
export const getCurrencySettings = catchAsyncErrors(async (req, res, next) => {
  let settings = await CurrencySetting.findOne();
  if (!settings) {
    settings = await initCurrencySettings();
  }

  res.status(200).json({
    success: true,
    settings,
  });
});

//
// 👑 ADMIN: UPDATE CURRENCY SETTINGS
//
export const updateCurrencySettings = catchAsyncErrors(async (req, res, next) => {
  const { rates } = req.body;

  if (!rates || typeof rates !== "object") {
    return next(new ErrorHandler("Rates object is required", 400));
  }

  // Validate all rates are greater than 0
  const keys = Object.keys(rates);
  for (const key of keys) {
    const rateValue = Number(rates[key]);
    if (Number.isNaN(rateValue) || rateValue <= 0) {
      return next(
        new ErrorHandler(
          `Exchange rate for ${key} must be a positive number greater than 0`,
          400
        )
      );
    }
  }

  // Ensure base currency INR remains exactly 1.0
  rates.INR = 1.0;

  let settings = await CurrencySetting.findOne();
  if (!settings) {
    settings = await initCurrencySettings();
  }

  settings.rates = rates;
  settings.updatedBy = req.user?.name || req.user?.email || "Admin User";
  await settings.save();

  res.status(200).json({
    success: true,
    message: "Currency settings saved successfully!",
    settings,
  });
});
