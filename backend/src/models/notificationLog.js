import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    // `${orderId}:${event}:${channel}` — one notification per event.
    key: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp"],
      default: "email",
    },
    recipient: {
      type: String,
      required: true,
    },
    subject: String,
    status: {
      type: String,
      enum: ["Queued", "Sent", "Failed"],
      default: "Queued",
    },
    provider: {
      type: String,
      default: "ZeptoMail",
    },
    error: String,
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: Date,
    sentAt: Date,
  },
  { timestamps: true }
);

notificationLogSchema.index({ order: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("NotificationLog", notificationLogSchema);
