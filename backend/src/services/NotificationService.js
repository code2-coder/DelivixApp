import EmailService from "./EmailService.js";
import NotificationLog from "../models/notificationLog.js";
import Order from "../models/order.js";
import { normalizeOrderStatus } from "../utils/orderPolicy.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
};

const EVENT_COPY = {
  order_placed: {
    subject: "We received your DELIVIX order",
    title: "Your order is in.",
    intro: "Thank you for shopping with DELIVIX. We have received your order and will keep you updated at every step.",
  },
  order_confirmed: {
    subject: "Your DELIVIX order is confirmed",
    title: "Order confirmed.",
    intro: "Your order has been confirmed and is being prepared by our team.",
  },
  payment_received: {
    subject: "Payment received for your DELIVIX order",
    title: "Payment received.",
    intro: "We have securely verified your payment. Your order is now confirmed.",
  },
  payment_failed: {
    subject: "Payment could not be completed",
    title: "Payment failed.",
    intro: "Your payment could not be completed. Your order is still on hold — you can retry payment from your account.",
  },
  shipped: {
    subject: "Your DELIVIX order has shipped",
    title: "On the move.",
    intro: "Your order has been handed to our courier partner. Tracking details are below.",
  },
  out_for_delivery: {
    subject: "Your DELIVIX order is out for delivery",
    title: "Arriving today.",
    intro: "Your order is out for delivery. Please keep your phone nearby for the courier.",
  },
  delivered: {
    subject: "Your DELIVIX order has been delivered",
    title: "Delivered.",
    intro: "Your order has been delivered. We hope you love it.",
  },
  cancelled: {
    subject: "Your DELIVIX order has been cancelled",
    title: "Order cancelled.",
    intro: "Your order has been cancelled. If a payment was captured, a refund will follow the original payment method.",
  },
  refunded: {
    subject: "Your DELIVIX refund has been processed",
    title: "Refund processed.",
    intro: "Your refund has been confirmed by the payment provider. Bank processing times may vary.",
  },
  refund_pending: {
    subject: "Your DELIVIX refund is being processed",
    title: "Refund in progress.",
    intro: "We have submitted your refund to the payment provider. It will be marked complete only after the provider confirms it.",
  },
  refund_failed: {
    subject: "Action needed for your DELIVIX refund",
    title: "Refund could not be completed.",
    intro: "The payment provider did not complete your refund. Our support team will contact you with the next steps.",
  },
  return_requested: {
    subject: "We received your return request",
    title: "Return requested.",
    intro: "Our team will review your return request and contact you with the next steps.",
  },
  return_approved: {
    subject: "Your return request was approved",
    title: "Return approved.",
    intro: "Your return has been approved. We will arrange the pickup or share drop-off instructions.",
  },
  return_rejected: {
    subject: "Update on your return request",
    title: "Return request update.",
    intro: "After review, we are unable to approve this return. Please contact support if you need more details.",
  },
};

const getRecipient = (order) =>
  order?.customerInfo?.email ||
  order?.shippingInfo?.email ||
  order?.user?.email ||
  null;

const buildEmailHtml = (order, event) => {
  const copy = EVENT_COPY[event] || EVENT_COPY.order_placed;
  const status = normalizeOrderStatus(order.orderStatus);
  const items = (order.orderItems || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#111111;">
          ${escapeHtml(item.name)}${item.size ? ` <span style="color:#6b6b6b;">/ ${escapeHtml(item.size)}</span>` : ""}
          <div style="color:#6b6b6b;font-size:11px;margin-top:2px;">Qty ${Number(item.quantity) || 0}</div>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #eeeeee;font-size:13px;color:#111111;">
          ${formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0), order.currency)}
        </td>
      </tr>`
    )
    .join("");

  const trackingBlock = order.trackingId
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background:#f7f7f5;border:1px solid #e3e3e0;">
        <tr><td style="padding:16px 18px;font-size:12px;color:#6b6b6b;">
          <strong style="display:block;color:#111111;font-size:13px;margin-bottom:4px;">Tracking</strong>
          ${escapeHtml(order.courierName || "Courier")} · ${escapeHtml(order.trackingId)}
          ${order.trackingUrl ? `<div style="margin-top:8px;"><a href="${escapeHtml(order.trackingUrl)}" style="color:#225c3b;">Track your parcel →</a></div>` : ""}
        </td></tr>
      </table>`
    : "";

  return EmailService.getEmailLayout({
    name: order.shippingInfo?.fullName || order.customerInfo?.name || "there",
    title: copy.title,
    bodyContent: `
      <p style="margin-bottom:16px;">${copy.intro}</p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background:#fafafa;border:1px solid #eeeeee;">
        <tr>
          <td style="padding:14px 18px;font-size:12px;color:#6b6b6b;">Order number</td>
          <td align="right" style="padding:14px 18px;font-size:12px;color:#111111;font-weight:700;">${escapeHtml(order.orderNumber || order._id)}</td>
        </tr>
        <tr>
          <td style="padding:0 18px 14px;font-size:12px;color:#6b6b6b;">Status</td>
          <td align="right" style="padding:0 18px 14px;font-size:12px;color:#111111;font-weight:700;">${escapeHtml(status)}</td>
        </tr>
        <tr>
          <td style="padding:0 18px 14px;font-size:12px;color:#6b6b6b;">Total</td>
          <td align="right" style="padding:0 18px 14px;font-size:12px;color:#111111;font-weight:700;">${formatMoney(order.totalAmount, order.currency)}</td>
        </tr>
      </table>
      ${items ? `<table border="0" cellpadding="0" cellspacing="0" width="100%">${items}</table>` : ""}
      ${trackingBlock}
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:26px;">
        <tr><td align="center">
          <a href="${escapeHtml(process.env.CLIENT_URL || "http://localhost:5173")}/account" target="_blank" style="background:#111111;color:#ffffff;padding:13px 26px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase;display:inline-block;">View order</a>
        </td></tr>
      </table>
    `,
  });
};

export class NotificationService {
  /**
   * Send an order lifecycle email. Failures are persisted for retry and never
   * bubble up into the order transaction.
   */
  async notifyOrder(order, event, { force = false } = {}) {
    const recipient = getRecipient(order);
    if (!recipient) {
      return { skipped: true, reason: "No customer email on order" };
    }

    const key = `${order._id}:${event}:email`;
    let log = await NotificationLog.findOne({ key });

    if (log && log.status === "Sent" && !force) {
      return { skipped: true, reason: "Already sent", log };
    }
    if (log && log.status === "Queued" && !force) {
      return { skipped: true, reason: "Already queued", log };
    }
    if (log && log.status === "Failed" && !force) {
      return { skipped: true, reason: "Previous attempt failed; retry explicitly", log };
    }

    const copy = EVENT_COPY[event] || EVENT_COPY.order_placed;
    const html = buildEmailHtml(order, event);

    if (!log) {
      try {
        log = await NotificationLog.create({
          key,
          order: order._id,
          event,
          channel: "email",
          recipient,
          subject: copy.subject,
          provider: "ZeptoMail",
          status: "Queued",
        });
      } catch (error) {
        if (error?.code === 11000) {
          log = await NotificationLog.findOne({ key });
          if (log && log.status !== "Failed") {
            return { skipped: true, reason: "Already queued", log };
          }
        } else {
          throw error;
        }
      }
    }

    log.attempts = (log.attempts || 0) + 1;
    log.lastAttemptAt = new Date();
    log.status = "Queued";
    log.error = undefined;
    await log.save();

    try {
      await EmailService.sendEmail({
        to: recipient,
        subject: copy.subject,
        html,
      });
      log.status = "Sent";
      log.sentAt = new Date();
      await log.save();
      return { sent: true, log };
    } catch (error) {
      log.status = "Failed";
      log.error = String(error?.message || error).slice(0, 1000);
      await log.save();
      console.error(`[notifications] ${event} email failed for order ${order._id}:`, error?.message);
      return { sent: false, error: log.error, log };
    }
  }

  async listForOrder(orderId) {
    return NotificationLog.find({ order: orderId }).sort({ createdAt: -1 }).lean();
  }

  async retry(orderId, event) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }
    return this.notifyOrder(order, event, { force: true });
  }
}

export default new NotificationService();
