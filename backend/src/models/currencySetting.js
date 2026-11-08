import mongoose from "mongoose";

const currencySettingSchema = new mongoose.Schema(
  {
    baseCurrency: {
      type: String,
      default: "INR",
      required: true,
      immutable: true,
    },
    rates: {
      type: Map,
      of: Number,
      required: true,
      default: {
        INR: 1.0,
        AUD: 0.0165,
        USD: 0.012,
        EUR: 0.011,
        GBP: 0.0095,
        AED: 0.044,
      },
    },
    updatedBy: {
      type: String,
      required: true,
      default: "System Seeder",
    },
  },
  { timestamps: true }
);

export default mongoose.model("CurrencySetting", currencySettingSchema);
