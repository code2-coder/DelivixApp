import mongoose from "mongoose";

const weightRuleSchema = new mongoose.Schema(
  {
    minWeightKg: { type: Number, default: 0 },
    maxWeightKg: { type: Number, default: 5 },
    additionalCharge: { type: Number, default: 0 },
  },
  { _id: false }
);

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    states: [{ type: String }],
    deliveryDays: { type: String, default: "3-5 days" },
    additionalFee: { type: Number, default: 0 },
  },
  { _id: false }
);

const shippingSettingsSchema = new mongoose.Schema(
  {
    defaultMethod: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },
    standardShippingFee: {
      type: Number,
      default: 49,
      min: 0,
    },
    expressShippingFee: {
      type: Number,
      default: 99,
      min: 0,
    },
    freeShippingThreshold: {
      type: Number,
      default: 999,
      min: 0,
    },
    flatShippingRate: {
      type: Number,
      default: 49,
      min: 0,
    },
    standardDeliveryEstimate: {
      type: String,
      default: "3-5 business days",
    },
    expressDeliveryEstimate: {
      type: String,
      default: "1-2 business days",
    },
    internationalShippingEnabled: {
      type: Boolean,
      default: true,
    },
    internationalShippingFee: {
      type: Number,
      default: 999,
    },
    internationalFreeThreshold: {
      type: Number,
      default: 4999,
    },
    codFee: {
      type: Number,
      default: 0,
    },
    codEnabled: {
      type: Boolean,
      default: true,
    },
    weightRules: [weightRuleSchema],
    deliveryZones: [deliveryZoneSchema],
    originAddress: {
      companyName: { type: String, default: "Delivix Central Fulfilment Hub" },
      street: { type: String, default: "123 Logistics Boulevard, Industrial Area" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pinCode: { type: String, default: "400001" },
      country: { type: String, default: "India" },
      phone: { type: String, default: "+91 98765 43210" },
      email: { type: String, default: "logistics@delivix.com" },
    },
    returnAddress: {
      companyName: { type: String, default: "Delivix Returns Processing Facility" },
      street: { type: String, default: "Plot 45-B, Sector 18, Return Hub" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pinCode: { type: String, default: "400001" },
      country: { type: String, default: "India" },
      phone: { type: String, default: "+91 98765 43210" },
      email: { type: String, default: "returns@delivix.com" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("ShippingSettings", shippingSettingsSchema);

