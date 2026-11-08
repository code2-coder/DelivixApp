import mongoose from "mongoose";

const whatsappSmsSettingsSchema = new mongoose.Schema(
  {
    smsEnabled: {
      type: Boolean,
      default: false,
    },
    whatsappEnabled: {
      type: Boolean,
      default: false,
    },

    // MSG91 Configuration
    msg91: {
      authKey: { type: String, default: "" }, // stored encrypted
      senderId: { type: String, default: "DELIVX" },
      otpTemplateId: { type: String, default: "" },
    },

    // WhatsApp Business API
    whatsapp: {
      provider: {
        type: String,
        enum: ["meta", "msg91", "twilio"],
        default: "meta",
      },
      phoneNumberId: { type: String, default: "" },
      businessAccountId: { type: String, default: "" },
      apiToken: { type: String, default: "" }, // stored encrypted
      customerSupportNumber: { type: String, default: "+91 98765 43210" },
    },

    // OTP Configuration
    otp: {
      length: { type: Number, default: 6, min: 4, max: 8 },
      expiryMinutes: { type: Number, default: 10, min: 2, max: 30 },
      maxAttempts: { type: Number, default: 5 },
    },

    // Templates
    templates: {
      orderConfirmation: {
        type: String,
        default: "Hello {CUSTOMER_NAME}, your order {ORDER_ID} of ₹{AMOUNT} has been received. Track here: {TRACK_URL}",
      },
      orderShipped: {
        type: String,
        default: "Good news! Your order {ORDER_ID} has been shipped via {COURIER} with AWB {AWB}. Track here: {TRACK_URL}",
      },
      orderDelivered: {
        type: String,
        default: "Your order {ORDER_ID} has been delivered successfully. Thank you for choosing DELIVIX!",
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("WhatsAppSMSSettings", whatsappSmsSettingsSchema);

