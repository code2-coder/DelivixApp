import mongoose from "mongoose";

const categoryTaxRateSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    hsnCode: { type: String, default: "" },
  },
  { _id: false }
);

const taxSettingsSchema = new mongoose.Schema(
  {
    enableTaxes: {
      type: Boolean,
      default: true,
    },
    gstRegistrationType: {
      type: String,
      enum: ["Regular", "Composition", "Unregistered"],
      default: "Regular",
    },
    gstin: {
      type: String,
      default: "27AABCD1234E1Z5",
      trim: true,
    },
    storeOriginState: {
      type: String,
      default: "Maharashtra",
      trim: true,
    },
    pricesIncludeTax: {
      type: Boolean,
      default: false, // false: exclusive (tax added at checkout), true: inclusive
    },
    defaultTaxRate: {
      type: Number,
      default: 18, // 18%
      min: 0,
      max: 100,
    },
    intraStateCGST: {
      type: Number,
      default: 9, // 9%
      min: 0,
      max: 50,
    },
    intraStateSGST: {
      type: Number,
      default: 9, // 9%
      min: 0,
      max: 50,
    },
    interStateIGST: {
      type: Number,
      default: 18, // 18%
      min: 0,
      max: 100,
    },
    categoryTaxRates: [categoryTaxRateSchema],
    defaultHsnCode: {
      type: String,
      default: "8517",
      trim: true,
    },
    showTaxBreakdownOnInvoice: {
      type: Boolean,
      default: true,
    },
    calculateTaxOnShipping: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TaxSettings", taxSettingsSchema);

