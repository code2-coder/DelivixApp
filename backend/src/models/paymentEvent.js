import mongoose from "mongoose";

/**
 * Webhook idempotency ledger. Providers retry webhooks aggressively; each
 * provider event id is processed at most once.
 */
const paymentEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["Stripe", "Razorpay"],
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    processed: {
      type: Boolean,
      default: false,
    },
    error: String,
    payloadSummary: String,
  },
  { timestamps: true }
);

paymentEventSchema.index({ provider: 1, createdAt: -1 });
paymentEventSchema.index({ processed: 1, createdAt: -1 });

export default mongoose.model("PaymentEvent", paymentEventSchema);
