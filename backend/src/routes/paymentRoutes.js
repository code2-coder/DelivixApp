import express from "express";
import rateLimit from "express-rate-limit";
import {
  getPaymentConfig,
  createStripeCheckoutSession,
  verifyStripePayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController.js";
import { isAuthenticatedUser } from "../middleware/auth.js";
import { validate } from "../middleware/validator.js";
import {
  paymentOrderSchema,
  verifyStripeSchema,
  verifyRazorpaySchema,
} from "../validators/order.validator.js";

const router = express.Router();

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many payment attempts from this IP, please try again after 15 minutes",
});

router.get("/payments/config", getPaymentConfig);
router.get("/payment/config", getPaymentConfig);

// Stripe (international)
router.post(
  "/payments/stripe/create-checkout-session",
  isAuthenticatedUser,
  paymentLimiter,
  validate(paymentOrderSchema),
  createStripeCheckoutSession
);
router.post(
  "/payments/stripe/verify",
  isAuthenticatedUser,
  paymentLimiter,
  validate(verifyStripeSchema),
  verifyStripePayment
);
router.post(
  "/payment/stripe/create-checkout-session",
  isAuthenticatedUser,
  paymentLimiter,
  validate(paymentOrderSchema),
  createStripeCheckoutSession
);
router.post(
  "/payment/stripe/verify",
  isAuthenticatedUser,
  paymentLimiter,
  validate(verifyStripeSchema),
  verifyStripePayment
);

// Razorpay (India)
router.post(
  "/payments/razorpay/create-order",
  isAuthenticatedUser,
  paymentLimiter,
  validate(paymentOrderSchema),
  createRazorpayOrder
);
router.post(
  "/payments/razorpay/verify",
  isAuthenticatedUser,
  paymentLimiter,
  validate(verifyRazorpaySchema),
  verifyRazorpayPayment
);
router.post(
  "/payment/razorpay/create-order",
  isAuthenticatedUser,
  paymentLimiter,
  validate(paymentOrderSchema),
  createRazorpayOrder
);
router.post(
  "/payment/razorpay/verify",
  isAuthenticatedUser,
  paymentLimiter,
  validate(verifyRazorpaySchema),
  verifyRazorpayPayment
);

export default router;
