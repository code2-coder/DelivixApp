import mongoose from "mongoose";

const paymentSettingsSchema = new mongoose.Schema(
  {
    // Razorpay (India & UPI)
    razorpay: {
      enabled: { type: Boolean, default: true },
      testMode: { type: Boolean, default: true },
      keyId: { type: String, default: "" },
      keySecret: { type: String, default: "" }, // stored encrypted
      webhookSecret: { type: String, default: "" }, // stored encrypted
      autoCapture: { type: Boolean, default: true },
    },

    // Stripe (International / Cards)
    stripe: {
      enabled: { type: Boolean, default: false },
      testMode: { type: Boolean, default: true },
      publishableKey: { type: String, default: "" },
      secretKey: { type: String, default: "" }, // stored encrypted
      webhookSecret: { type: String, default: "" }, // stored encrypted
    },

    // Cash on Delivery
    cod: {
      enabled: { type: Boolean, default: true },
      minOrderAmount: { type: Number, default: 0 },
      maxOrderAmount: { type: Number, default: 25000 },
      fee: { type: Number, default: 0 },
      verificationRequired: { type: Boolean, default: false }, // OTP verification before placing COD
      instructions: {
        type: String,
        default: "Pay with exact cash or scan the courier UPI QR code upon parcel delivery.",
      },
    },

    // Direct Bank Transfer / NEFT / IMPS
    bankTransfer: {
      enabled: { type: Boolean, default: false },
      bankName: { type: String, default: "HDFC Bank" },
      accountHolderName: { type: String, default: "Delivix E-Commerce Pvt Ltd" },
      accountNumber: { type: String, default: "" }, // encrypted or masked
      ifscCode: { type: String, default: "" },
      branchName: { type: String, default: "BKC Branch, Mumbai" },
      instructions: {
        type: String,
        default: "Please transfer the exact order amount to the bank account above and upload the payment receipt with your Order ID.",
      },
    },

    // Global Payment Preferences
    defaultGateway: {
      type: String,
      enum: ["razorpay", "stripe", "cod", "bankTransfer"],
      default: "razorpay",
    },
    enableWebhookVerification: {
      type: Boolean,
      default: true,
    },
    paymentTimeoutMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 180,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentSettings", paymentSettingsSchema);

