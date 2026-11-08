import mongoose from "mongoose";

const notificationSettingsSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["zeptomail", "smtp", "resend"],
      default: "zeptomail",
    },
    senderName: {
      type: String,
      default: "DELIVIX Orders",
      trim: true,
    },
    senderEmail: {
      type: String,
      default: "noreply@delivix.com",
      trim: true,
    },
    adminNotificationEmail: {
      type: String,
      default: "admin@delivix.com",
      trim: true,
    },

    // ZeptoMail Settings
    zeptomail: {
      apiUrl: {
        type: String,
        default: "https://api.zeptomail.in/v1.1/email",
      },
      apiKey: {
        type: String,
        default: "", // stored encrypted
      },
    },

    // SMTP Settings
    smtp: {
      host: { type: String, default: "smtp.mailtrap.io" },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      username: { type: String, default: "" },
      password: { type: String, default: "" }, // stored encrypted
    },

    // Email Triggers
    triggers: {
      orderConfirmation: { type: Boolean, default: true },
      paymentConfirmation: { type: Boolean, default: true },
      orderShipped: { type: Boolean, default: true },
      orderDelivered: { type: Boolean, default: true },
      orderCancelled: { type: Boolean, default: true },
      refundProcessed: { type: Boolean, default: true },
      lowStockAlerts: { type: Boolean, default: true },
      customerRegistration: { type: Boolean, default: true },
      passwordReset: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationSettings", notificationSettingsSchema);

