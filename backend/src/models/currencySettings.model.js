import mongoose from "mongoose";

const currencySettingsSchema = new mongoose.Schema(
  {
    defaultCurrency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    currencySymbol: {
      type: String,
      default: "₹",
    },
    currencyPosition: {
      type: String,
      enum: ["left", "right", "left_with_space", "right_with_space"],
      default: "left",
    },
    decimalPlaces: {
      type: Number,
      default: 2,
      min: 0,
      max: 4,
    },
    numberFormat: {
      type: String,
      enum: ["indian", "international"], // indian: 1,00,000 | international: 100,000
      default: "indian",
    },
    defaultCountry: {
      type: String,
      default: "India",
      trim: true,
    },
    defaultState: {
      type: String,
      default: "Maharashtra",
      trim: true,
    },
    timeZone: {
      type: String,
      default: "Asia/Kolkata",
    },
    dateFormat: {
      type: String,
      enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MMM-YYYY"],
      default: "DD/MM/YYYY",
    },
    timeFormat: {
      type: String,
      enum: ["12h", "24h"],
      default: "12h",
    },
    language: {
      type: String,
      default: "en",
    },
    measurementUnit: {
      type: String,
      enum: ["cm", "inch", "mm", "m"],
      default: "cm",
    },
    weightUnit: {
      type: String,
      enum: ["kg", "g", "lb", "oz"],
      default: "kg",
    },
    baseCurrency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    exchangeRates: {
      type: Map,
      of: Number,
      default: {
        INR: 1.0,
        AUD: 0.0165,
        USD: 0.012,
        EUR: 0.011,
        GBP: 0.0095,
        AED: 0.044,
        CAD: 0.016,
        SGD: 0.016,
      },
    },
    autoUpdateRates: {
      type: Boolean,
      default: false,
    },
    lastRateUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CurrencySettings", currencySettingsSchema);

