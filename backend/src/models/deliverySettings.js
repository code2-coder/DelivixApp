import mongoose from "mongoose";

const deliverySettingsSchema = new mongoose.Schema(
  {
    defaultPartner: {
      type: String,
      default: "Delhivery",
    },
    defaultMethod: {
      type: String,
      enum: ["standard", "express", "surface", "air"],
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
    codFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    codEnabled: {
      type: Boolean,
      default: true,
    },
    weightRules: [
      {
        minWeightKg: { type: Number, default: 0 },
        maxWeightKg: { type: Number, default: 5 },
        additionalCharge: { type: Number, default: 0 },
      },
    ],
    originAddress: {
      companyName: { type: String, default: "Delivix Central Fulfilment Hub" },
      street: { type: String, default: "123 Logistics Boulevard, Industrial Area" },
      landmark: { type: String, default: "Near Cargo Terminal" },
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
      landmark: { type: String, default: "Gate 3" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pinCode: { type: String, default: "400001" },
      country: { type: String, default: "India" },
      phone: { type: String, default: "+91 98765 43210" },
      email: { type: String, default: "returns@delivix.com" },
    },
    labelConfig: {
      companyLogoUrl: { type: String, default: "" },
      showBarcode: { type: Boolean, default: true },
      showReturnAddress: { type: Boolean, default: true },
      paperSize: { type: String, default: "A6 (4x6 inch thermal)" },
      declarationText: {
        type: String,
        default: "This shipment contains goods ordered via Delivix eCommerce. Not for resale.",
      },
    },
    notificationPrefs: {
      notifyOnPacked: { type: Boolean, default: true },
      notifyOnDispatched: { type: Boolean, default: true },
      notifyOnOutForDelivery: { type: Boolean, default: true },
      notifyOnDelivered: { type: Boolean, default: true },
      notifyOnFailed: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      whatsappEnabled: { type: Boolean, default: false },
    },
    autoStatusAdvance: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DeliverySettings", deliverySettingsSchema);

