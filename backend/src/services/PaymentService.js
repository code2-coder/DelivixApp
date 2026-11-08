import crypto from "crypto";
import Stripe from "stripe";
import Razorpay from "razorpay";
import Order from "../models/order.js";
import PaymentEvent from "../models/paymentEvent.js";
import NotificationService from "./NotificationService.js";
import ReturnSyncService from "./ReturnSyncService.js";
import CouponService from "./CouponService.js";
import logger from "../utils/logger.js";
import {
  isPaidPaymentStatus,
  normalizePaymentStatus,
  normalizeOrderStatus,
  sumCompletedRefunds,
} from "../utils/orderPolicy.js";
import {
  failedRefundOrderState,
  getAvailableRefundableAmount,
  normalizeProviderRefundStatus,
  sumPendingRefunds,
} from "../utils/refundPolicy.js";

import PaymentSettings from "../models/paymentSettings.model.js";
import { decryptSecret } from "../utils/cryptoUtil.js";

const money = (value) => Number(Number(value || 0).toFixed(2));

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

const pushHistory = (order, { status, note, source, actor, at = new Date() }) => {
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status,
    note,
    source,
    changedBy: actor?._id,
    changedByName: actor?.name,
    at,
  });
};

export class PaymentService {
  async _confirmCoupon(order) {
    if (!order?.coupon?.code) return;
    try {
      await CouponService.confirmRedemption({ orderId: order._id });
    } catch (error) {
      // Payment confirmation must never fail because the coupon ledger could
      // not be updated. The pending reservation remains available for the
      // sweeper / a retry and the discrepancy is logged for support.
      logger.error("Coupon confirmation failed after payment", {
        order: order._id,
        coupon: order.coupon.code,
        error: error.message,
      });
    }
  }

  async getConfig() {
    let settings = null;
    try {
      settings = await PaymentSettings.findOne();
    } catch {}

    const razorpayKey = settings?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = settings?.razorpay?.keySecret ? decryptSecret(settings.razorpay.keySecret) : process.env.RAZORPAY_KEY_SECRET;
    const stripeKey = settings?.stripe?.secretKey ? decryptSecret(settings.stripe.secretKey) : process.env.STRIPE_SECRET_KEY;

    return {
      cod: settings?.cod?.enabled ?? true,
      codMinAmount: settings?.cod?.minOrderAmount ?? 0,
      codMaxAmount: settings?.cod?.maxOrderAmount ?? 25000,
      codFee: settings?.cod?.fee ?? 0,
      razorpay: Boolean(settings?.razorpay?.enabled !== false && razorpayKey && razorpaySecret),
      razorpayKeyId: razorpayKey || null,
      stripe: Boolean(settings?.stripe?.enabled && stripeKey),
      stripeWebhook: Boolean(settings?.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
      razorpayWebhook: Boolean(settings?.razorpay?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET),
      bankTransfer: Boolean(settings?.bankTransfer?.enabled),
      bankTransferDetails: settings?.bankTransfer?.enabled ? {
        bankName: settings.bankTransfer.bankName,
        accountHolderName: settings.bankTransfer.accountHolderName,
        accountNumber: settings.bankTransfer.accountNumber,
        ifscCode: settings.bankTransfer.ifscCode,
        branchName: settings.bankTransfer.branchName,
        instructions: settings.bankTransfer.instructions,
      } : null,
    };
  }

  async recordAttempt(order, attempt) {
    const transactionId = attempt.transactionId || undefined;
    if (transactionId && (order.paymentTransactions || []).some((t) => t.transactionId === transactionId)) {
      return order;
    }
    order.paymentTransactions = order.paymentTransactions || [];
    order.paymentTransactions.push({
      provider: attempt.provider,
      transactionId,
      providerOrderId: attempt.providerOrderId,
      providerSessionId: attempt.providerSessionId,
      amount: money(attempt.amount),
      currency: attempt.currency || order.currency || "INR",
      status: attempt.status || "Pending",
      method: attempt.method,
    });
    await order.save();
    return order;
  }

  /**
   * Mark an order paid only after a server-side provider verification.
   */
  async markPaid(orderId, payment) {
    let order = await Order.findById(orderId);
    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const amount = money(payment.amount);
    const expected = money(order.totalAmount);
    if (Math.abs(amount - expected) > 0.02) {
      const error = new Error(
        `Verified payment amount (${amount}) does not match the order total (${expected}).`
      );
      error.statusCode = 400;
      throw error;
    }

    if (isPaidPaymentStatus(order.paymentStatus)) {
      // A duplicate webhook or verification must not add a second paid
      // transaction or reset an in-progress/complete refund state.
      if (normalizePaymentStatus(order.paymentStatus) === "Paid") {
        await this._confirmCoupon(order);
      }
      return order;
    }

    const duplicate = (order.paymentTransactions || []).find(
      (tx) => payment.transactionId && tx.transactionId === payment.transactionId && tx.status === "Paid"
    );
    if (duplicate) {
      await this._confirmCoupon(order);
      return order;
    }

    const now = new Date();
    const wasCancelled = order.orderStatus === "Cancelled";
    const previousStatus = order.orderStatus;

    order.paymentTransactions = order.paymentTransactions || [];
    order.paymentTransactions.push({
      provider: payment.provider,
      transactionId: payment.transactionId,
      providerOrderId: payment.providerOrderId,
      providerSessionId: payment.providerSessionId,
      amount,
      currency: payment.currency || order.currency || "INR",
      status: "Paid",
      method: payment.method,
      verifiedAt: now,
    });

    order.paymentInfo = {
      id: payment.transactionId,
      status: "Paid",
    };
    order.paidAt = now;
    order.paymentStatus = wasCancelled ? "Refund Pending" : "Paid";

    if (wasCancelled) {
      order.cancellation = order.cancellation || {};
      order.cancellation.refundStatus = "Pending";
      pushHistory(order, {
        status: order.orderStatus,
        note: "Payment captured after cancellation. Refund is now pending.",
        source: "payment",
        at: now,
      });
    } else if (order.orderStatus === "Pending") {
      order.orderStatus = "Confirmed";
      pushHistory(order, {
        status: "Confirmed",
        note: "Payment verified with the payment provider.",
        source: "payment",
        at: now,
      });
    } else {
      pushHistory(order, {
        status: previousStatus,
        note: "Payment verified with the payment provider.",
        source: "payment",
        at: now,
      });
    }

    try {
      await order.save();
    } catch (error) {
      if (error?.code === 11000) {
        order = await Order.findById(orderId);
        await this._confirmCoupon(order);
        return order;
      }
      throw error;
    }

    // The coupon reservation becomes a confirmed redemption only after the
    // provider has verified the payment. Cancelled orders are excluded because
    // their coupon was already released during cancellation.
    if (!wasCancelled) {
      await this._confirmCoupon(order);
    }

    NotificationService.notifyOrder(order, "payment_received").catch(() => {});
    if (wasCancelled) {
      NotificationService.notifyOrder(order, "cancelled").catch(() => {});
    }
    return order;
  }

  async markFailed(orderId, payment) {
    const order = await Order.findById(orderId);
    if (!order) return null;
    if (isPaidPaymentStatus(order.paymentStatus)) return order;
    if (["Cancelled", "Refunded"].includes(order.orderStatus)) return order;

    const now = new Date();
    order.paymentTransactions = order.paymentTransactions || [];
    const exists = (order.paymentTransactions || []).some(
      (tx) => payment.transactionId && tx.transactionId === payment.transactionId && tx.status === "Failed"
    );
    if (!exists) {
      order.paymentTransactions.push({
        provider: payment.provider,
        transactionId: payment.transactionId,
        providerOrderId: payment.providerOrderId,
        amount: money(payment.amount ?? order.totalAmount),
        currency: payment.currency || order.currency || "INR",
        status: "Failed",
        method: payment.method,
        failureReason: payment.failureReason,
      });
    }
    order.paymentStatus = "Failed";
    pushHistory(order, {
      status: order.orderStatus,
      note: payment.failureReason || "Payment attempt failed.",
      source: "payment",
      at: now,
    });
    await order.save();
    NotificationService.notifyOrder(order, "payment_failed").catch(() => {});
    return order;
  }

  /**
   * Apply a provider (or manually confirmed) refund to the order ledger.
   *
   * Only a Completed status changes the captured total. Pending refunds reserve
   * part of the balance so a retry cannot over-refund, and failed refunds are
   * retained for audit without pretending the money was returned.
   */
  async _applyRefundResult(
    order,
    { provider, refundId, amount, status, reference, reason, actor } = {}
  ) {
    if (!order) return { order, status: "Failed", fullyRefunded: false };
    const normalized = ["Completed", "Pending", "Failed"].includes(status)
      ? status
      : "Pending";
    const now = new Date();

    order.refunds = order.refunds || [];
    const existing = refundId
      ? order.refunds.find(
          (entry) => entry.refundId && String(entry.refundId) === String(refundId)
        )
      : null;

    const completedBefore = sumCompletedRefunds(order);
    const wasFullyRefunded = completedBefore >= money(order.totalAmount) - 0.01;
    if (existing && existing.status === normalized) {
      return {
        order,
        status: normalized,
        unchanged: true,
        fullyRefunded: completedBefore >= money(order.totalAmount) - 0.01,
      };
    }

    if (existing) {
      existing.status = normalized;
      existing.amount = money(amount ?? existing.amount);
      existing.provider = provider || existing.provider;
      existing.reference = reference || existing.reference;
      existing.reason = reason || existing.reason;
      if (normalized === "Completed") existing.processedAt = existing.processedAt || now;
      if (actor?._id) {
        existing.processedBy = actor._id;
        existing.processedByName = actor.name;
      }
    } else {
      order.refunds.push({
        amount: money(amount),
        status: normalized,
        provider,
        refundId,
        reference: reference || refundId,
        reason,
        processedBy: actor?._id,
        processedByName: actor?.name,
        processedAt: normalized === "Completed" ? now : undefined,
      });
    }

    const completedTotal = sumCompletedRefunds(order);
    const pendingTotal = sumPendingRefunds(order);
    const fullyRefunded = completedTotal >= money(order.totalAmount) - 0.01;
    const previousOrderStatus = normalizeOrderStatus(order.orderStatus);

    if (normalized === "Failed") {
      const rollback = failedRefundOrderState(order, {
        completedTotal,
        pendingTotal,
      });
      order.paymentStatus = rollback.paymentStatus;
      order.orderStatus = rollback.orderStatus;
      if (rollback.returnInfoStatus) {
        order.returnInfo = order.returnInfo || {};
        order.returnInfo.status = rollback.returnInfoStatus;
      }
      if (rollback.cancellationRefundStatus && order.cancellation) {
        order.cancellation.refundStatus = rollback.cancellationRefundStatus;
      }
    } else if (normalized === "Pending") {
      order.paymentStatus = "Refund Pending";
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Refund Pending";
      order.returnInfo.refundPendingAt = order.returnInfo.refundPendingAt || now;
      if (order.cancellation) order.cancellation.refundStatus = "Pending";
      if (["Returned", "Return Approved"].includes(previousOrderStatus)) {
        order.orderStatus = "Refund Pending";
      }
    } else if (fullyRefunded) {
      order.paymentStatus = "Refunded";
      order.orderStatus = "Refunded";
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Refunded";
      order.returnInfo.refundedAt = now;
      if (order.cancellation) order.cancellation.refundStatus = "Completed";
    } else {
      order.paymentStatus = "Partially Refunded";
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Refund Pending";
      if (order.cancellation) order.cancellation.refundStatus = "Pending";
    }

    const note =
      normalized === "Failed"
        ? `Refund failed at ${provider || "payment provider"}${reason ? `: ${reason}` : ""}.`
        : normalized === "Pending"
          ? `Refund of ${money(amount)} ${order.currency || "INR"} submitted to ${provider}; awaiting provider confirmation.`
          : `Refund of ${money(amount)} ${order.currency || "INR"} confirmed by ${provider}${refundId ? ` (${refundId})` : ""}.`;

    pushHistory(order, {
      status: order.orderStatus,
      note,
      source: "payment",
      actor,
      at: now,
    });

    await order.save();

    // A full refund releases the coupon so the customer can use it again.
    // Partial refunds keep the coupon consumed because the order still stands.
    if (fullyRefunded && !wasFullyRefunded) {
      try {
        await CouponService.releaseRedemptionForOrder(order._id, {
          status: "refunded",
          reason: "Order fully refunded",
        });
      } catch (error) {
        logger.error("Coupon release failed after full refund", {
          order: order._id,
          coupon: order.coupon?.code,
          error: error.message,
        });
      }
    }

    if (normalized !== "Failed" || order.orderStatus !== previousOrderStatus) {
      const syncStatus =
        normalized === "Failed"
          ? order.orderStatus
          : fullyRefunded
            ? "Refunded"
            : normalized === "Pending" || pendingTotal > 0
              ? "Refund Pending"
              : null;
      if (syncStatus) {
        await ReturnSyncService.syncForOrderStatus(order, syncStatus, {
          actor,
          note,
        }).catch((error) => {
          console.warn(
            `[payments] Could not sync returns for order ${order._id}:`,
            error.message
          );
        });
      }
    }

    const event =
      normalized === "Failed"
        ? "refund_failed"
        : normalized === "Pending"
          ? "refund_pending"
          : "refunded";
    NotificationService.notifyOrder(order, event).catch(() => {});
    return { order, status: normalized, fullyRefunded };
  }

  /**
   * Refunds are only marked complete when the provider confirms them. COD is
   * the only manual path and requires an explicit admin confirmation + reference.
   */
  async refundOrder(order, { amount, reason, reference, confirmManual = false, actor } = {}) {
    if (!["Paid", "Partially Refunded", "Refund Pending"].includes(normalizePaymentStatus(order.paymentStatus))) {
      const error = new Error("Only captured payments can be refunded.");
      error.statusCode = 400;
      throw error;
    }

    const refundable = getAvailableRefundableAmount(order);
    if (refundable <= 0) {
      const error = new Error("This order has no refundable balance.");
      error.statusCode = 400;
      throw error;
    }

    const requested = amount === undefined || amount === null ? refundable : money(amount);
    if (!(requested > 0) || requested > refundable + 0.01) {
      const error = new Error(`Refund amount must be between 0.01 and ${refundable}.`);
      error.statusCode = 400;
      throw error;
    }

    const paidTransaction = (order.paymentTransactions || []).find(
      (tx) => tx.status === "Paid" || tx.status === "Partially Refunded"
    );

    let refundId;
    let provider;
    let providerStatus = "Completed";

    if (order.paymentMethod === "COD") {
      if (!confirmManual) {
        const error = new Error(
          "COD refunds must be confirmed manually after the money has been returned to the customer."
        );
        error.statusCode = 400;
        throw error;
      }
      if (!reference) {
        const error = new Error("A manual refund reference (UTR / bank reference) is required.");
        error.statusCode = 400;
        throw error;
      }
      provider = "Manual";
      refundId = reference;
    } else if (order.paymentMethod === "Razorpay") {
      const razorpay = getRazorpay();
      if (!razorpay) {
        const error = new Error(
          "Razorpay is not configured on this server, so an online refund cannot be confirmed. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then retry."
        );
        error.statusCode = 503;
        throw error;
      }
      if (!paidTransaction?.transactionId) {
        const error = new Error("No captured Razorpay payment was found for this order.");
        error.statusCode = 400;
        throw error;
      }
      const refund = await razorpay.payments.refund(paidTransaction.transactionId, {
        amount: Math.round(requested * 100),
        notes: {
          orderId: String(order._id),
          reason: reason || "Admin refund",
        },
      });
      provider = "Razorpay";
      refundId = refund.id;
      providerStatus = normalizeProviderRefundStatus("Razorpay", refund.status);
    } else if (order.paymentMethod === "Stripe") {
      const stripe = getStripe();
      if (!stripe) {
        const error = new Error(
          "Stripe is not configured on this server, so an online refund cannot be confirmed. Add STRIPE_SECRET_KEY, then retry."
        );
        error.statusCode = 503;
        throw error;
      }
      if (!paidTransaction?.transactionId) {
        const error = new Error("No captured Stripe payment was found for this order.");
        error.statusCode = 400;
        throw error;
      }
      const refund = await stripe.refunds.create({
        payment_intent: paidTransaction.transactionId,
        amount: Math.round(requested * 100),
        reason: "requested_by_customer",
        metadata: {
          orderId: String(order._id),
          reason: reason || "Admin refund",
        },
      });
      provider = "Stripe";
      refundId = refund.id;
      providerStatus = normalizeProviderRefundStatus("Stripe", refund.status);
    } else {
      const error = new Error("This payment method does not support automated refunds.");
      error.statusCode = 400;
      throw error;
    }

    const result = await this._applyRefundResult(order, {
      provider,
      refundId,
      amount: requested,
      status: providerStatus,
      reference: reference || refundId,
      reason,
      actor,
    });

    if (result.status === "Failed") {
      const error = new Error(
        `${provider} rejected the refund. The failed attempt has been logged; please retry or contact the provider.`
      );
      error.statusCode = 502;
      throw error;
    }

    return result.order;
  }

  async processStripeEvent(event) {
    const existing = await PaymentEvent.findOne({ eventId: event.id });
    if (existing?.processed) return { duplicate: true };

    const log =
      existing ||
      (await PaymentEvent.create({
        provider: "Stripe",
        eventId: event.id,
        type: event.type,
        payloadSummary: `${event.type} ${event.data?.object?.id || ""}`.slice(0, 500),
      }));

    try {
      const object = event.data?.object || {};
      const orderId =
        object.client_reference_id ||
        object.metadata?.orderId ||
        null;

      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const order = orderId
          ? await Order.findById(orderId)
          : await Order.findOne({ "paymentTransactions.transactionId": object.payment_intent });
        if (order && object.payment_status === "paid") {
          await this.markPaid(order._id, {
            provider: "Stripe",
            transactionId: object.payment_intent,
            providerSessionId: object.id,
            amount: Number(object.amount_total || 0) / 100,
            currency: String(object.currency || order.currency || "inr").toUpperCase(),
            method: "card",
          });
          log.order = order._id;
        }
      } else if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
        const order = orderId
          ? await Order.findById(orderId)
          : await Order.findOne({ "paymentTransactions.transactionId": object.id || object.payment_intent });
        if (order) {
          await this.markFailed(order._id, {
            provider: "Stripe",
            transactionId: object.payment_intent || object.id,
            providerSessionId: object.id,
            amount: Number(object.amount_total || object.amount || 0) / 100,
            currency: String(object.currency || order.currency || "inr").toUpperCase(),
            failureReason: object.last_payment_error?.message || "Stripe payment failed",
          });
          log.order = order._id;
        }
      } else if (
        ["charge.refunded", "charge.refund.updated", "refund.updated", "refund.failed"].includes(
          event.type
        )
      ) {
        // charge.refunded embeds every refund on the charge; refund.* events
        // carry a single refund object. Normalising both shapes keeps the
        // local ledger in sync even when a refund was created outside our API.
        const providerRefunds = Array.isArray(object.refunds?.data)
          ? object.refunds.data
          : [object];
        const paymentIntentId =
          object.payment_intent || providerRefunds[0]?.payment_intent || null;
        const order = paymentIntentId
          ? await Order.findOne({
              "paymentTransactions.transactionId": paymentIntentId,
            })
          : null;
        if (order) {
          log.order = order._id;
          for (const providerRefund of providerRefunds) {
            if (!providerRefund?.id) continue;
            await this._applyRefundResult(order, {
              provider: "Stripe",
              refundId: providerRefund.id,
              amount: Number(providerRefund.amount || 0) / 100,
              status: normalizeProviderRefundStatus("Stripe", providerRefund.status),
              reason: providerRefund.failure_reason || providerRefund.reason,
            });
          }
        }
      }

      log.processed = true;
      await log.save();
      return { processed: true };
    } catch (error) {
      log.error = String(error.message || error).slice(0, 1000);
      await log.save();
      throw error;
    }
  }

  async processRazorpayEvent(body) {
    const eventId =
      body?.event_id ||
      body?.id ||
      `${body?.event || "event"}:${body?.payload?.payment?.entity?.id || body?.payload?.refund?.entity?.id || crypto.randomUUID()}`;

    const existing = await PaymentEvent.findOne({ eventId });
    if (existing?.processed) return { duplicate: true };

    const log =
      existing ||
      (await PaymentEvent.create({
        provider: "Razorpay",
        eventId,
        type: body?.event || "unknown",
        payloadSummary: String(body?.event || "").slice(0, 500),
      }));

    try {
      const event = body?.event;
      const payment = body?.payload?.payment?.entity;
      const refund = body?.payload?.refund?.entity;

      if (event === "payment.captured" || event === "order.paid") {
        const order = payment
          ? await Order.findOne({
              $or: [
                { "paymentTransactions.providerOrderId": payment.order_id },
                { "paymentTransactions.transactionId": payment.id },
              ],
            })
          : null;
        if (order) {
          await this.markPaid(order._id, {
            provider: "Razorpay",
            transactionId: payment.id,
            providerOrderId: payment.order_id,
            amount: Number(payment.amount || 0) / 100,
            currency: String(payment.currency || order.currency || "INR").toUpperCase(),
            method: payment.method,
          });
          log.order = order._id;
        }
      } else if (event === "payment.failed") {
        const order = payment
          ? await Order.findOne({ "paymentTransactions.providerOrderId": payment.order_id })
          : null;
        if (order) {
          await this.markFailed(order._id, {
            provider: "Razorpay",
            transactionId: payment.id,
            providerOrderId: payment.order_id,
            amount: Number(payment.amount || 0) / 100,
            currency: String(payment.currency || order.currency || "INR").toUpperCase(),
            failureReason: payment.error_description || "Razorpay payment failed",
          });
          log.order = order._id;
        }
      } else if (
        ["refund.created", "refund.processed", "refund.failed", "refund.updated"].includes(
          event
        ) &&
        refund
      ) {
        const order = await Order.findOne({
          "paymentTransactions.transactionId": refund.payment_id,
        });
        if (order) {
          log.order = order._id;
          await this._applyRefundResult(order, {
            provider: "Razorpay",
            refundId: refund.id,
            amount: Number(refund.amount || 0) / 100,
            status: normalizeProviderRefundStatus("Razorpay", refund.status),
            reason: refund.notes?.reason,
          });
        }
      }

      log.processed = true;
      await log.save();
      return { processed: true };
    } catch (error) {
      log.error = String(error.message || error).slice(0, 1000);
      await log.save();
      throw error;
    }
  }
}

export default new PaymentService();
