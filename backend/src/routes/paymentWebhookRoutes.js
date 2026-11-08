import express from "express";
import { stripeWebhook, razorpayWebhook } from "../controllers/paymentController.js";

const router = express.Router();

// Webhooks must receive the raw request body so signatures can be verified.
router.post(
  "/payments/stripe/webhook",
  express.raw({ type: "application/json", limit: "2mb" }),
  stripeWebhook
);
router.post(
  "/payments/razorpay/webhook",
  express.raw({ type: "application/json", limit: "2mb" }),
  razorpayWebhook
);

export default router;
