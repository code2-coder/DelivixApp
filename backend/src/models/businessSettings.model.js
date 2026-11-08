import mongoose from "mongoose";

const businessSettingsSchema = new mongoose.Schema(
  {
    legalBusinessName: {
      type: String,
      default: "DELIVIX E-COMMERCE PRIVATE LIMITED",
      trim: true,
      required: true,
    },
    businessType: {
      type: String,
      enum: ["Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "Other"],
      default: "Private Limited",
    },
    registrationNumber: {
      type: String,
      default: "U51909MH2024PTC123456",
      trim: true,
    },
    gstin: {
      type: String,
      default: "27AABCD1234E1Z5",
      trim: true,
    },
    panNumber: {
      type: String,
      default: "AABCD1234E",
      trim: true,
    },
    businessAddress: {
      street: { type: String, default: "123 Commerce Tower, Floor 4, BKC" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pincode: { type: String, default: "400051" },
      country: { type: String, default: "India" },
    },
    billingAddress: {
      street: { type: String, default: "123 Commerce Tower, Floor 4, BKC" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pincode: { type: String, default: "400051" },
      country: { type: String, default: "India" },
    },
    registeredOfficeAddress: {
      street: { type: String, default: "123 Commerce Tower, Floor 4, BKC" },
      city: { type: String, default: "Mumbai" },
      state: { type: String, default: "Maharashtra" },
      pincode: { type: String, default: "400051" },
      country: { type: String, default: "India" },
    },
    contactPhone: {
      type: String,
      default: "+91 22 1234 5678",
    },
    contactEmail: {
      type: String,
      default: "billing@delivix.com",
    },
    invoicePrefix: {
      type: String,
      default: "INV-DLX",
      trim: true,
    },
    invoiceNotes: {
      type: String,
      default: "Thank you for shopping with Delivix. We appreciate your business!",
    },
    invoiceTerms: {
      type: String,
      default: "All disputes subject to Mumbai jurisdiction only. Goods once sold are covered under Delivix 7-day standard return policy.",
    },
  },
  { timestamps: true }
);

export default mongoose.model("BusinessSettings", businessSettingsSchema);

