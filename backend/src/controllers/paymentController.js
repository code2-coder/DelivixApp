import crypto from "crypto";
import Stripe from "stripe";
import Razorpay from "razorpay";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import Order from "../models/order.js";
import PaymentService from "../services/PaymentService.js";
import { isPaidPaymentStatus } from "../utils/orderPolicy.js";

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const loadOwnedOrder = async (orderId, user, next) => {
  if (!orderId) {
    next(new ErrorHandler("Order ID is required before starting a payment.", 400));
    return null;
  }
  const order = await Order.findById(orderId);
  if (!order) {
    next(new ErrorHandler("Order not found.", 404));
    return null;
  }
  if (String(order.user) !== String(user._id)) {
    next(new ErrorHandler("You are not authorized to pay for this order.", 403));
    return null;
  }
  if (isPaidPaymentStatus(order.paymentStatus)) {
    next(new ErrorHandler("This order has already been paid.", 400));
    return null;
  }
  if (["Cancelled", "Refunded", "Delivered", "Return Requested", "Returned"].includes(order.orderStatus)) {
    next(new ErrorHandler(`A ${order.orderStatus.toLowerCase()} order cannot be paid online.`, 400));
    return null;
  }
  return order;
};

export const getPaymentConfig = catchAsyncErrors(async (req, res) => {
  res.status(200).json({
    success: true,
    config: await PaymentService.getConfig(),
  });
});

// ==========================================
// STRIPE (international / AUD)
// ==========================================

export const createStripeCheckoutSession = catchAsyncErrors(async (req, res, next) => {
  const order = await loadOwnedOrder(req.body?.orderId, req.user, next);
  if (!order) return;

  if (order.paymentMethod !== "Stripe") {
    return next(new ErrorHandler("This order was not created for Stripe payment.", 400));
  }
  if (String(order.currency).toUpperCase() === "INR" || String(order.shippingInfo?.country).toLowerCase() === "india") {
    return next(new ErrorHandler("Orders for India must be processed via Razorpay or COD.", 400));
  }

  const stripe = getStripe();
  if (!stripe) {
    return next(
      new ErrorHandler(
        "Stripe is not configured on this server. Add STRIPE_SECRET_KEY to enable online card payments.",
        503
      )
    );
  }

  const origin = req.headers.origin || process.env.CLIENT_URL || "http://localhost:5173";
  const currency = String(order.currency || "AUD").toLowerCase();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: req.user.email,
    client_reference_id: String(order._id),
    metadata: {
      orderId: String(order._id),
      userId: String(req.user._id),
      orderNumber: order.orderNumber || "",
    },
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `DELIVIX order ${order.orderNumber || order._id}`,
            description: `${order.orderItems?.length || 0} item(s) · ${order.shippingMethod} delivery`,
          },
          unit_amount: Math.round(Number(order.totalAmount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/account?tab=My%20orders&order_id=${order._id}&stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?payment=cancelled`,
  });

  await PaymentService.recordAttempt(order, {
    provider: "Stripe",
    providerSessionId: session.id,
    amount: order.totalAmount,
    currency: order.currency,
    status: "Pending",
  });

  res.status(200).json({
    success: true,
    sessionId: session.id,
    url: session.url,
  });
});

export const verifyStripePayment = catchAsyncErrors(async (req, res, next) => {
  const { orderId, sessionId } = req.body || {};
  const order = await loadOwnedOrder(orderId, req.user, next);
  if (!order) return;
  if (!sessionId) return next(new ErrorHandler("Stripe session ID is required.", 400));

  const stripe = getStripe();
  if (!stripe) {
    return next(new ErrorHandler("Stripe is not configured on this server.", 503));
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return next(new ErrorHandler("Stripe has not confirmed this payment as paid.", 400));
  }
  if (String(session.client_reference_id) !== String(order._id)) {
    return next(new ErrorHandler("This Stripe session does not belong to the order.", 400));
  }
  if (String(session.currency || "").toUpperCase() !== String(order.currency || "").toUpperCase()) {
    return next(new ErrorHandler("Stripe session currency does not match the order currency.", 400));
  }
  const paidAmount = Number(session.amount_total || 0) / 100;
  if (Math.abs(paidAmount - Number(order.totalAmount)) > 0.02) {
    return next(new ErrorHandler("Stripe session amount does not match the order total.", 400));
  }

  const updated = await PaymentService.markPaid(order._id, {
    provider: "Stripe",
    transactionId: session.payment_intent,
    providerSessionId: session.id,
    amount: paidAmount,
    currency: order.currency,
    method: "card",
  });

  res.status(200).json({
    success: true,
    message: "Stripe payment verified successfully",
    order: updated,
  });
});

// ==========================================
// RAZORPAY (India / INR)
// ==========================================

export const createRazorpayOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await loadOwnedOrder(req.body?.orderId, req.user, next);
  if (!order) return;

  if (order.paymentMethod !== "Razorpay") {
    return next(new ErrorHandler("This order was not created for Razorpay payment.", 400));
  }
  if (String(order.currency).toUpperCase() === "AUD" || String(order.shippingInfo?.country).toLowerCase() === "australia") {
    return next(new ErrorHandler("Orders for Australia must be processed via Stripe.", 400));
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    return next(
      new ErrorHandler(
        "Razorpay is not configured on this server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable online payments.",
        503
      )
    );
  }

  const providerOrder = await razorpay.orders.create({
    amount: Math.round(Number(order.totalAmount) * 100),
    currency: String(order.currency || "INR").toUpperCase(),
    receipt: String(order.orderNumber || order._id).slice(0, 40),
    notes: {
      orderId: String(order._id),
      userId: String(req.user._id),
      customerEmail: req.user.email,
      customerName: order.shippingInfo?.fullName || req.user.name || "Customer",
    },
  });

  await PaymentService.recordAttempt(order, {
    provider: "Razorpay",
    providerOrderId: providerOrder.id,
    amount: order.totalAmount,
    currency: order.currency,
    status: "Pending",
  });

  res.status(200).json({
    success: true,
    order: providerOrder,
    keyId: process.env.RAZORPAY_KEY_ID,
    amount: providerOrder.amount,
    currency: providerOrder.currency,
  });
});

export const verifyRazorpayPayment = catchAsyncErrors(async (req, res, next) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body || {};

  const order = await loadOwnedOrder(orderId, req.user, next);
  if (!order) return;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return next(new ErrorHandler("Razorpay transaction tokens are required.", 400));
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return next(new ErrorHandler("Razorpay is not configured on this server.", 503));
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const provided = Buffer.from(String(razorpay_signature), "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return next(new ErrorHandler("Razorpay payment signature verification failed.", 400));
  }

  const recordedOrder = (order.paymentTransactions || []).find(
    (tx) => tx.providerOrderId === razorpay_order_id
  );
  if (!recordedOrder) {
    return next(new ErrorHandler("This Razorpay order was not created for this order.", 400));
  }

  // If credentials are available, fetch the payment and verify the captured
  // amount/status server-side before recording it as paid.
  const razorpay = getRazorpay();
  if (razorpay) {
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      if (payment.order_id !== razorpay_order_id) {
        return next(new ErrorHandler("Razorpay payment does not belong to this order.", 400));
      }
      if (payment.status !== "captured") {
        return next(new ErrorHandler(`Razorpay payment is not captured (status: ${payment.status}).`, 400));
      }
      if (Math.abs(Number(payment.amount || 0) / 100 - Number(order.totalAmount)) > 0.02) {
        return next(new ErrorHandler("Razorpay payment amount does not match the order total.", 400));
      }
    } catch (error) {
      // Signature verification already succeeded. If the fetch fails due to a
      // transient provider error, the webhook remains the source of truth.
      console.warn("[payments] Razorpay fetch verification failed:", error.message);
    }
  }

  const updated = await PaymentService.markPaid(order._id, {
    provider: "Razorpay",
    transactionId: razorpay_payment_id,
    providerOrderId: razorpay_order_id,
    amount: order.totalAmount,
    currency: order.currency,
    method: "razorpay",
  });

  res.status(200).json({
    success: true,
    message: "Razorpay payment verified successfully",
    order: updated,
  });
});

// ==========================================
// WEBHOOKS (raw body, signature verified)
// ==========================================

export const stripeWebhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: "Stripe webhook secret is not configured." });
  }
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Stripe is not configured." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      secret
    );
  } catch (error) {
    return res.status(400).json({ success: false, message: `Stripe webhook signature failed: ${error.message}` });
  }

  try {
    await PaymentService.processStripeEvent(event);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[payments] Stripe webhook processing failed:", error.message);
    return res.status(500).json({ received: false });
  }
};

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: "Razorpay webhook secret is not configured." });
  }

  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing Razorpay webhook signature." });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(String(signature), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    return res.status(400).json({ success: false, message: "Razorpay webhook signature verification failed." });
  }

  try {
    const body = JSON.parse(rawBody.toString("utf8"));
    await PaymentService.processRazorpayEvent(body);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[payments] Razorpay webhook processing failed:", error.message);
    return res.status(500).json({ received: false });
  }
};

export default {
  getPaymentConfig,
  createStripeCheckoutSession,
  verifyStripePayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  stripeWebhook,
  razorpayWebhook,
};
