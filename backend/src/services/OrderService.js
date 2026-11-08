import mongoose from "mongoose";
import crypto from "crypto";
import Order from "../models/order.js";
import Product from "../models/product.js";
import Shipment, { SHIPMENT_STATUSES } from "../models/shipment.js";
import Return from "../models/return.js";
import InventoryService from "./InventoryService.js";
import NotificationService from "./NotificationService.js";
import ReturnSyncService from "./ReturnSyncService.js";
import { computeOrderTotals } from "../utils/shippingCalculator.js";
import { resolveInventoryTarget } from "../utils/inventoryTarget.js";
import CouponService from "./CouponService.js";
import logger from "../utils/logger.js";
import { buildCourierTrackingUrl } from "../utils/tracking.js";
import { withTransaction } from "../utils/transaction.js";
import { SUPPORTED_CURRENCIES } from "../utils/priceConverter.js";
import {
  ORDER_STATUSES,
  normalizeOrderStatus,
  normalizePaymentStatus,
  isValidTransition,
  getNextStatuses,
  getAdvancePath,
  isCustomerCancellable,
  isAdminCancellable,
  isReturnEligible,
  isPaidPaymentStatus,
} from "../utils/orderPolicy.js";
import { getAvailableRefundableAmount } from "../utils/refundPolicy.js";
import {
  shipmentStatusForOrderStatus,
  shouldAdvanceShipmentStatus,
} from "../utils/shipmentPolicy.js";

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toMoney = (value) => Number(Number(value || 0).toFixed(2));

const generateReturnNumber = () =>
  `RET-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

const getProductId = (item) => {
  if (!item) return null;
  if (item.productId) return item.productId;
  if (typeof item.product === "string") return item.product;
  if (item.product?._id) return item.product._id;
  if (item.id) return item.id;
  return null;
};

const normalizeRequestedItems = (payload = {}) => {
  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.orderItems)
      ? payload.orderItems
      : [];

  if (!rawItems.length) {
    throw httpError("Your bag is empty. Add at least one product before checking out.");
  }

  const merged = new Map();
  for (const raw of rawItems) {
    const productId = getProductId(raw);
    if (!productId || !mongoose.isValidObjectId(productId)) {
      throw httpError("One of the products in your bag is invalid. Please refresh your bag.");
    }
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw httpError("Product quantity must be a whole number between 1 and 999.");
    }
    const size = raw.size ? String(raw.size).trim() : null;
    const variantName = raw.variantName ? String(raw.variantName).trim() : null;
    const key = `${productId}|${size || ""}|${variantName || ""}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { productId, quantity, size, variantName });
  }

  return [...merged.values()];
};

const normalizeShippingInfo = (payload, user) => {
  const raw = payload.shippingInfo || {};
  const fullName = String(raw.fullName || user?.name || "").trim();
  const phoneNo = String(raw.phoneNo || raw.phone || user?.phoneNumber || "").trim();
  const addressLine1 = String(raw.addressLine1 || raw.address || "").trim();
  const addressLine2 = String(raw.addressLine2 || "").trim();
  const landmark = String(raw.landmark || "").trim();
  const city = String(raw.city || "").trim();
  const state = String(raw.state || "").trim();
  const zipCode = String(raw.zipCode || raw.pinCode || raw.pincode || "").trim();
  const country = String(raw.country || "India").trim();
  const email = String(raw.email || user?.email || "").trim();

  if (fullName.length < 2) throw httpError("Please enter the recipient's full name.");
  if (!addressLine1 || addressLine1.length < 3) throw httpError("Please enter a valid delivery address.");
  if (city.length < 2) throw httpError("Please enter a valid city.");
  if (phoneNo.replace(/\D/g, "").length < 6) throw httpError("Please enter a valid phone number.");
  if (!zipCode) throw httpError("Please enter a postal / PIN code.");
  if (country.length < 2) throw httpError("Please select a delivery country.");

  const address = [addressLine1, addressLine2, landmark].filter(Boolean).join(", ");

  return {
    fullName,
    email,
    address,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    phoneNo,
    altPhoneNo: raw.altPhoneNo ? String(raw.altPhoneNo).trim() : undefined,
    zipCode,
    country,
  };
};

const buildAddressSnapshot = (shippingInfo, billingInfo) => ({
  fullName: shippingInfo.fullName,
  phone: shippingInfo.phoneNo,
  addressLine1: shippingInfo.addressLine1 || shippingInfo.address,
  addressLine2: shippingInfo.addressLine2,
  landmark: shippingInfo.landmark,
  city: shippingInfo.city,
  state: shippingInfo.state,
  country: shippingInfo.country,
  pincode: shippingInfo.zipCode,
  ...(billingInfo ? { billing: billingInfo } : {}),
});

const notificationEventForStatus = (status) => {
  switch (status) {
    case "Confirmed":
      return "order_confirmed";
    case "Shipped":
      return "shipped";
    case "Out for Delivery":
      return "out_for_delivery";
    case "Delivered":
      return "delivered";
    case "Cancelled":
      return "cancelled";
    case "Return Approved":
      return "return_approved";
    case "Return Rejected":
      return "return_rejected";
    case "Refund Pending":
      return "refund_pending";
    case "Refunded":
      return "refunded";
    default:
      return null;
  }
};

const sanitizeCustomerOrder = (order) => {
  if (!order) return order;
  const plain = order.toObject ? order.toObject() : { ...order };
  delete plain.idempotencyKey;
  delete plain.internalNotes;
  delete plain.inventory;
  delete plain.paymentTransactions;
  delete plain.paymentInfo;
  delete plain.user;
  if (plain.statusHistory) {
    plain.statusHistory = plain.statusHistory.map((entry) => ({
      _id: entry._id,
      status: entry.status,
      note: entry.note,
      source: entry.source,
      at: entry.at,
    }));
  }
  if (plain.refunds) {
    plain.refunds = plain.refunds.map((refund) => ({
      _id: refund._id,
      amount: refund.amount,
      status: refund.status,
      provider: refund.provider,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
    }));
  }
  // Shipment documents contain internal notes, activity logs and staff ids.
  // Customers only need the customer-facing tracking view.
  if (plain.shipment && typeof plain.shipment === "object") {
    const shipment = plain.shipment;
    plain.shipment = {
      _id: shipment._id,
      shipmentId: shipment.shipmentId,
      status: shipment.status,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      awbNumber: shipment.awbNumber,
      shippingMethod: shipment.shippingMethod,
      dispatchDate: shipment.dispatchDate,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate,
      deliveredDate: shipment.deliveredDate,
      statusHistory: (shipment.statusHistory || []).map((entry) => ({
        status: entry.status,
        date: entry.date,
        time: entry.time,
        remark: entry.remark,
      })),
    };
  }
  return plain;
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

export class OrderService {
  // ── Quotes & creation ────────────────────────────────────────────────────

  async _buildQuote(payload = {}, user = null) {
    const requested = normalizeRequestedItems(payload);
    const productIds = [...new Set(requested.map((item) => String(item.productId)))];
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const lineItems = requested.map((requestedItem) => {
      const product = productMap.get(String(requestedItem.productId));
      if (!product) {
        throw httpError("A product in your bag is no longer available. Please refresh your bag.");
      }
      const target = resolveInventoryTarget(product, requestedItem);
      if (!target.ok) throw httpError(target.reason);
      if (target.stock < requestedItem.quantity) {
        throw httpError(
          `Only ${Math.max(0, target.stock)} unit(s) of ${product.name} are available.`
        );
      }

      const subtotal = toMoney(target.price * requestedItem.quantity);
      return {
        _id: new mongoose.Types.ObjectId(),
        product: product._id,
        name: product.name,
        image: target.image,
        price: toMoney(target.price),
        quantity: requestedItem.quantity,
        size: target.size || undefined,
        variantName: target.variantName || undefined,
        sku: target.sku || undefined,
        variantSku: target.variantSku || undefined,
        subtotal,
        taxAmount: 0,
        discountAmount: 0,
        availableStock: target.stock,
      };
    });

    const currency = String(payload.currency || "INR").toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw httpError(`Currency ${currency} is not supported.`);
    }

    const shippingMethod = payload.shippingMethod === "express" ? "express" : "standard";
    const packagingOption = payload.packagingOption === "exquisite" ? "exquisite" : "standard";
    const shippingInfo = normalizeShippingInfo(payload, user);

    // ── Step 1: Base totals without any discount (to determine shipping) ──
    const baseTotals = await computeOrderTotals({
      trustedItems: lineItems,
      shippingInfo,
      shippingMethod,
      packagingOption,
      currency,
      discountAmount: 0,
    });

    // ── Step 2: Server-side coupon validation & discount calculation ──
    // Never trust client-supplied discount values. The coupon code (if any)
    // is validated against the database and the discount is recomputed here.
    let couponResult = null;
    let couponDiscountAmount = 0;
    let couponShippingDiscount = 0;

    const couponCode = payload.couponCode ? String(payload.couponCode).trim() : null;
    if (couponCode) {
      couponResult = await CouponService.calculateDiscount({
        code: couponCode,
        user,
        items: requested.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          variantName: item.variantName,
        })),
        shippingInfo,
        shippingMethod,
        currency,
        shippingAmount: baseTotals.shippingAmount,
      });

      if (couponResult.valid) {
        couponDiscountAmount = Number(couponResult.discountAmount || 0);
        couponShippingDiscount = Number(couponResult.shippingDiscount || 0);
      } else {
        // A supplied coupon that fails validation invalidates the quote so the
        // customer is forced to fix/remove it before placing the order.
        throw httpError(couponResult.message || "Coupon could not be applied.", 400);
      }
    }

    // ── Step 3: Final totals with the trusted coupon discount applied ──
    // Item and shipping discounts are kept separate so free shipping is never
    // subtracted twice from the payable total.
    const totals = await computeOrderTotals({
      trustedItems: lineItems,
      shippingInfo,
      shippingMethod,
      packagingOption,
      currency,
      discountAmount: couponDiscountAmount,
      shippingDiscount: couponShippingDiscount,
    });

    return {
      requested,
      lineItems,
      totals,
      shippingInfo,
      shippingMethod,
      packagingOption,
      currency,
      coupon: couponResult
        ? {
            couponId: couponResult.coupon.id,
            code: couponResult.coupon.code,
            name: couponResult.coupon.name,
            discountType: couponResult.coupon.discountType,
            discountValue: couponResult.coupon.discountValue,
            maxDiscount: couponResult.coupon.maxDiscount,
            minOrderValue: couponResult.coupon.minOrderValue,
            minQuantity: couponResult.coupon.minQuantity,
            discountAmount: couponDiscountAmount,
            shippingDiscount: couponShippingDiscount,
            totalDiscount: toMoney(couponDiscountAmount + couponShippingDiscount),
            eligibleSubtotal: couponResult.eligibleSubtotal,
            breakdown: couponResult.breakdown,
          }
        : null,
    };
  }

  async quoteOrder(payload, user) {
    const quote = await this._buildQuote(payload, user);
    return {
      items: quote.lineItems.map((item) => ({
        productId: item.product,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        variantName: item.variantName,
        sku: item.sku,
        subtotal: item.subtotal,
        availableStock: item.availableStock,
      })),
      amounts: {
        itemsPrice: quote.totals.itemsPrice,
        taxAmount: quote.totals.taxAmount,
        shippingAmount: quote.totals.shippingAmount,
        shippingDiscount: quote.totals.shippingDiscount,
        payableShipping: quote.totals.payableShipping,
        packagingAmount: quote.totals.packagingAmount,
        discountAmount: quote.totals.discountAmount,
        couponDiscount: quote.coupon
          ? toMoney(quote.coupon.discountAmount + quote.coupon.shippingDiscount)
          : 0,
        totalAmount: quote.totals.totalAmount,
        currency: quote.totals.currency,
      },
      shipping: {
        method: quote.shippingMethod,
        packagingOption: quote.packagingOption,
        details: quote.totals.shippingDetails,
        packagingName: quote.totals.packagingName,
        isFreeShipping: quote.totals.isFreeShipping,
      },
      coupon: quote.coupon,
    };
  }

  async createOrder(payload, user, idempotencyKey) {
    if (!user?._id) throw httpError("Please sign in to place an order.", 401);

    if (idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey });
      if (existing) {
        if (String(existing.user) !== String(user._id)) {
          throw httpError("This checkout request key has already been used.", 409);
        }
        return { order: existing, idempotent: true };
      }
    }

    const quote = await this._buildQuote(payload, user);
    const rawPaymentMethod = String(payload.paymentMethod || "COD").trim();
    const paymentMethod =
      rawPaymentMethod.toLowerCase() === "card" ? "Stripe" : rawPaymentMethod;
    if (!["COD", "Razorpay", "Stripe"].includes(paymentMethod)) {
      throw httpError("Please choose a valid payment method.");
    }

    const orderId = new mongoose.Types.ObjectId();
    const now = new Date();
    const billing = payload.billingAddress
      ? normalizeShippingInfo({ shippingInfo: payload.billingAddress }, user)
      : null;

    const couponSnapshot = quote.coupon
      ? {
          couponId: quote.coupon.couponId,
          code: quote.coupon.code,
          name: quote.coupon.name,
          discountType: quote.coupon.discountType,
          discountValue: quote.coupon.discountValue,
          maxDiscount: quote.coupon.maxDiscount,
          minOrderValue: quote.coupon.minOrderValue,
          minQuantity: quote.coupon.minQuantity,
          discountAmount: quote.coupon.discountAmount,
          shippingDiscount: quote.coupon.shippingDiscount,
        }
      : undefined;

    const orderDoc = {
      _id: orderId,
      user: user._id,
      customerInfo: {
        name: quote.shippingInfo.fullName,
        email: quote.shippingInfo.email,
        phone: quote.shippingInfo.phoneNo,
      },
      shippingInfo: quote.shippingInfo,
      shippingAddress: buildAddressSnapshot(quote.shippingInfo),
      billingAddress: billing
        ? {
            fullName: billing.fullName,
            phone: billing.phoneNo,
            addressLine1: billing.addressLine1 || billing.address,
            addressLine2: billing.addressLine2,
            city: billing.city,
            state: billing.state,
            country: billing.country,
            pincode: billing.zipCode,
          }
        : undefined,
      orderItems: quote.lineItems.map(({ availableStock, ...item }) => item),
      itemsPrice: quote.totals.itemsPrice,
      taxAmount: quote.totals.taxAmount,
      shippingAmount: quote.totals.shippingAmount,
      packagingAmount: quote.totals.packagingAmount,
      packagingOption: quote.packagingOption,
      discountAmount: quote.totals.discountAmount,
      shippingMethod: quote.shippingMethod,
      totalAmount: quote.totals.totalAmount,
      currency: quote.currency,
      coupon: couponSnapshot,
      paymentMethod,
      paymentStatus: "Pending",
      orderStatus: "Pending",
      idempotencyKey: idempotencyKey || undefined,
      statusHistory: [
        {
          status: "Pending",
          note: "Order placed. Awaiting confirmation.",
          source: "customer",
          changedBy: user._id,
          changedByName: user.name,
          at: now,
        },
      ],
      inventory: { reserved: false },
    };

    let order;
    try {
      order = await withTransaction(async (session) => {
        await InventoryService.reserveItems({
          orderId,
          items: orderDoc.orderItems,
          actor: user,
          session,
          reason: "Order placed",
        });

        orderDoc.inventory = { reserved: true, reservedAt: now };
        const [created] = await Order.create([orderDoc], session ? { session } : {});

        // Reserve the coupon inside the same transaction. Online payments stay
        // pending until the provider confirms; COD orders are confirmed
        // immediately because the order itself is the commitment.
        if (couponSnapshot) {
          await CouponService.reserveRedemption({
            couponId: couponSnapshot.couponId,
            couponCode: couponSnapshot.code,
            customerId: user._id,
            orderId: created._id,
            discountAmount: toMoney(
              couponSnapshot.discountAmount + couponSnapshot.shippingDiscount
            ),
            itemDiscountAmount: couponSnapshot.discountAmount,
            shippingDiscountAmount: couponSnapshot.shippingDiscount,
            discountType: couponSnapshot.discountType,
            currency: quote.currency,
            session,
          });

          if (paymentMethod === "COD") {
            await CouponService.confirmRedemption({
              orderId: created._id,
              session,
            });
          }
        }

        return created;
      });
    } catch (error) {
      // Compensate the non-transactional fallback path. The transaction path
      // has already rolled back, so this is a no-op there.
      await InventoryService.restoreItems({
        orderId,
        items: orderDoc.orderItems,
        actor: user,
        reason: "Order creation failed",
      }).catch(() => {});

      if (error?.code === 11000 && idempotencyKey) {
        const existing = await Order.findOne({ idempotencyKey });
        if (existing) return { order: existing, idempotent: true };
      }
      throw error;
    }

    NotificationService.notifyOrder(order, "order_placed").catch(() => {});
    return { order, idempotent: false };
  }

  // ── Customer reads ───────────────────────────────────────────────────────

  async getUserOrders(userId, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const filter = { user: userId };

    if (query.status && query.status !== "All") {
      const statuses = String(query.status)
        .split(",")
        .map((status) => status.trim())
        .filter((status) => ORDER_STATUSES.includes(status));
      if (statuses.length) filter.orderStatus = { $in: statuses };
    }

    if (query.search) {
      const term = String(query.search).trim();
      if (term) {
        filter.$or = [
          { orderNumber: { $regex: escapeRegex(term), $options: "i" } },
          { "orderItems.name": { $regex: escapeRegex(term), $options: "i" } },
        ];
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-idempotencyKey -internalNotes -paymentTransactions")
        .populate({ path: "shipment", select: "shipmentId status courierName trackingNumber awbNumber statusHistory estimatedDeliveryDate deliveredDate" })
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      orders: orders.map((order) => sanitizeCustomerOrder(order)),
      pagination: buildPagination(page, limit, total),
    };
  }

  async getOrderDetails(orderId, { userId, isAdmin = false } = {}) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    const order = await Order.findById(orderId)
      .populate("user", "name email phoneNumber")
      .populate("orderItems.returnActive")
      .populate("shipment");
    if (!order) throw httpError("Order not found.", 404);
    if (!isAdmin && String(order.user?._id || order.user) !== String(userId)) {
      throw httpError("You are not authorized to view this order.", 403);
    }

    if (!isAdmin) {
      return { order: sanitizeCustomerOrder(order) };
    }

    const [inventoryTransactions, notifications] = await Promise.all([
      InventoryService.getOrderLedger(order._id),
      NotificationService.listForOrder(order._id),
    ]);

    return {
      order: order.toObject(),
      inventoryTransactions,
      notifications,
      allowedNextStatuses: getNextStatuses(order.orderStatus),
      // Pending provider refunds already reserve part of the captured balance,
      // so the admin UI must not offer the full total again. Unpaid orders
      // (for example COD before delivery) have nothing to refund yet.
      refundableAmount: isPaidPaymentStatus(order.paymentStatus)
        ? getAvailableRefundableAmount(order)
        : 0,
    };
  }

  // ── Admin reads ──────────────────────────────────────────────────────────

  _buildAdminFilter(query = {}) {
    const filter = {};
    if (query.status && query.status !== "All") {
      const statuses = String(query.status)
        .split(",")
        .map((status) => status.trim())
        .filter((status) => ORDER_STATUSES.includes(status));
      if (statuses.length) filter.orderStatus = { $in: statuses };
    }
    if (query.paymentStatus && query.paymentStatus !== "All") {
      filter.paymentStatus = query.paymentStatus;
    }
    if (query.paymentMethod && query.paymentMethod !== "All") {
      filter.paymentMethod = query.paymentMethod;
    }
    if (query.shippingMethod && query.shippingMethod !== "All") {
      filter.shippingMethod = query.shippingMethod;
    }
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) {
        const from = new Date(query.dateFrom);
        if (!Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = to;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    if (query.search) {
      const term = String(query.search).trim();
      if (term) {
        const or = [
          { orderNumber: { $regex: escapeRegex(term), $options: "i" } },
          { "customerInfo.name": { $regex: escapeRegex(term), $options: "i" } },
          { "customerInfo.email": { $regex: escapeRegex(term), $options: "i" } },
          { "customerInfo.phone": { $regex: escapeRegex(term), $options: "i" } },
          { "shippingInfo.fullName": { $regex: escapeRegex(term), $options: "i" } },
          { "shippingInfo.phoneNo": { $regex: escapeRegex(term), $options: "i" } },
          { "orderItems.name": { $regex: escapeRegex(term), $options: "i" } },
        ];
        if (mongoose.isValidObjectId(term)) or.push({ _id: term });
        filter.$or = or;
      }
    }

    return filter;
  }

  _sortFor(query = {}) {
    switch (query.sort) {
      case "oldest":
        return { createdAt: 1 };
      case "amount_desc":
        return { totalAmount: -1 };
      case "amount_asc":
        return { totalAmount: 1 };
      case "status":
        return { orderStatus: 1, createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  async getAllOrders(query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter = this._buildAdminFilter(query);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(this._sortFor(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email phoneNumber")
        .populate("shipment", "shipmentId status courierName trackingNumber awbNumber statusHistory estimatedDeliveryDate deliveredDate")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return { orders, pagination: buildPagination(page, limit, total) };
  }

  async getAdminOrderStats() {
    const [statusAgg, paymentAgg, methodAgg, revenueAgg, totalOrders] = await Promise.all([
      Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$paymentStatus", count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: "$paymentMethod", count: { $sum: 1 } } }]),
      Order.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["Paid", "Partially Refunded", "Refund Pending"] },
          },
        },
        {
          $group: {
            _id: null,
            revenue: {
              $sum: {
                $subtract: [
                  "$totalAmount",
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$refunds", []] },
                            as: "refund",
                            cond: { $eq: ["$$refund.status", "Completed"] },
                          },
                        },
                        as: "refund",
                        in: "$$refund.amount",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
      Order.countDocuments(),
    ]);

    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    statusAgg.forEach((entry) => {
      statusCounts[normalizeOrderStatus(entry._id)] = entry.count;
    });

    const paymentCounts = {};
    paymentAgg.forEach((entry) => {
      paymentCounts[normalizePaymentStatus(entry._id)] = entry.count;
    });

    const methodCounts = {};
    methodAgg.forEach((entry) => {
      if (entry._id) methodCounts[entry._id] = entry.count;
    });

    const grouped = {
      pending: statusCounts.Pending,
      processing: statusCounts.Confirmed + statusCounts.Processing + statusCounts.Packed,
      shipped: statusCounts.Shipped + statusCounts["Out for Delivery"],
      delivered: statusCounts.Delivered,
      cancelled: statusCounts.Cancelled,
      returned:
        statusCounts["Return Requested"] +
        statusCounts["Return Approved"] +
        statusCounts.Returned,
      refunded: statusCounts.Refunded,
      refundPending: statusCounts["Refund Pending"],
    };

    return {
      totalOrders,
      totalRevenue: toMoney(revenueAgg[0]?.revenue || 0),
      statusCounts,
      paymentCounts,
      methodCounts,
      grouped,
    };
  }

  // ── Workflow ─────────────────────────────────────────────────────────────

  async _applyTransition(order, targetStatus, { actor, note, source = "admin", codCollected = false } = {}) {
    const now = new Date();
    const previous = normalizeOrderStatus(order.orderStatus);

    if (targetStatus === "Packed") {
      await InventoryService.markDeducted({
        orderId: order._id,
        items: order.orderItems,
        actor,
        reason: "Order packed",
      });
      order.inventory = order.inventory || {};
      order.inventory.deductedAt = order.inventory.deductedAt || now;
    }

    if (targetStatus === "Delivered") {
      order.deliveredAt = now;
      if (order.paymentMethod === "COD" && codCollected) {
        const codTransactionId = `COD-${order._id}`;
        order.paymentTransactions = order.paymentTransactions || [];
        if (!order.paymentTransactions.some((tx) => tx.transactionId === codTransactionId)) {
          order.paymentTransactions.push({
            provider: "COD",
            transactionId: codTransactionId,
            amount: toMoney(order.totalAmount),
            currency: order.currency || "INR",
            status: "Paid",
            method: "Cash on Delivery",
            verifiedAt: now,
          });
        }
        order.paymentStatus = "Paid";
        order.paidAt = order.paidAt || now;
        order.paymentInfo = { id: codTransactionId, status: "Paid" };
      }
    }

    if (targetStatus === "Returned") {
      // Partial returns must only restore the units that were actually
      // returned. Fall back to the full order for manual legacy transitions.
      const completedReturns = await Return.find({
        order: order._id,
        status: {
          $in: [
            "Approved",
            "Pickup Scheduled",
            "Pickup Completed",
            "Product Received",
            "Quality Inspection",
            "Refund Processing",
            "Refund Completed",
            "Return Closed",
          ],
        },
      }).lean();

      const returnItems = completedReturns
        .map((returnDoc) => {
          const orderItem = order.orderItems.id(returnDoc.orderItemId);
          if (!orderItem) return null;
          return {
            ...orderItem.toObject(),
            quantity: Math.min(Number(returnDoc.quantity) || 1, orderItem.quantity),
          };
        })
        .filter(Boolean);

      await InventoryService.restoreItems({
        orderId: order._id,
        items: returnItems.length ? returnItems : order.orderItems,
        actor,
        reason: "Return completed",
      });
      order.inventory = order.inventory || {};
      order.inventory.restoredAt = order.inventory.restoredAt || now;
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Returned";
      order.returnInfo.returnedAt = now;
    }

    if (targetStatus === "Return Approved") {
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Approved";
      order.returnInfo.approvedAt = now;
    }

    if (targetStatus === "Return Rejected") {
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Rejected";
      order.returnInfo.rejectedAt = now;
    }

    if (targetStatus === "Refund Pending") {
      order.returnInfo = order.returnInfo || {};
      order.returnInfo.status = "Refund Pending";
      order.returnInfo.refundPendingAt = now;
      if (isPaidPaymentStatus(order.paymentStatus)) {
        order.paymentStatus = "Refund Pending";
      }
      if (order.cancellation) order.cancellation.refundStatus = "Pending";
    }

    // Keep the linked return documents and their customer-visible timeline in
    // step with direct admin order transitions.
    await ReturnSyncService.syncForOrderStatus(order, targetStatus, {
      actor,
      note,
    });

    order.orderStatus = targetStatus;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: targetStatus,
      note: note || `Status changed from ${previous} to ${targetStatus}.`,
      source,
      changedBy: actor?._id,
      changedByName: actor?.name,
      at: now,
    });

    await order.save();

    await this._syncShipmentForOrderStatus(order, targetStatus, { actor, note });

    const event = notificationEventForStatus(targetStatus);
    if (event) NotificationService.notifyOrder(order, event).catch(() => {});
    return order;
  }

  async updateStatus(orderId, payload = {}, actor, { system = false } = {}) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    const targetStatus = normalizeOrderStatus(payload.status);
    if (!ORDER_STATUSES.includes(payload.status)) {
      throw httpError("Invalid order status.");
    }

    if (["Cancelled", "Refunded", "Return Requested"].includes(targetStatus)) {
      if (targetStatus === "Cancelled") {
        return this.cancelOrder(orderId, { reason: payload.note || payload.reason }, actor, {
          isAdmin: true,
        });
      }
      throw httpError(
        targetStatus === "Refunded"
          ? "Refunds must be completed through the refund action so the payment provider can confirm them."
          : "Return requests must be created through the return workflow."
      );
    }

    let order = await Order.findById(orderId);
    if (!order) throw httpError("Order not found.", 404);

    const current = normalizeOrderStatus(order.orderStatus);
    if (current === targetStatus) return order;

    let path;
    if (system) {
      path = getAdvancePath(current, targetStatus);
      if (!path) {
        throw httpError(`Cannot move order from ${current} to ${targetStatus}.`);
      }
    } else {
      if (!isValidTransition(current, targetStatus)) {
        throw httpError(
          `Invalid status transition from ${current} to ${targetStatus}. Allowed: ${
            getNextStatuses(current).join(", ") || "none"
          }.`
        );
      }
      path = [targetStatus];
    }

    for (const step of path) {
      order = await this._applyTransition(order, step, {
        actor,
        note: payload.note,
        source: system ? "shipment" : "admin",
        codCollected: Boolean(payload.codCollected),
      });
    }

    return order;
  }

  async cancelOrder(orderId, payload = {}, actor, { isAdmin = false } = {}) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    let order = await Order.findById(orderId);
    if (!order) throw httpError("Order not found.", 404);

    const current = normalizeOrderStatus(order.orderStatus);
    if (current === "Cancelled") return order;
    if (current === "Refunded") throw httpError("A refunded order cannot be cancelled.");

    const allowed = isAdmin ? isAdminCancellable(current) : isCustomerCancellable(current);
    if (!allowed) {
      throw httpError(
        isAdmin
          ? `Orders that are ${current} can no longer be cancelled.`
          : "This order can no longer be cancelled online. Please contact support."
      );
    }

    const reason = String(payload.reason || payload.note || "").trim();
    if (!reason) throw httpError("Please provide a reason for cancelling the order.");

    const now = new Date();
    await withTransaction(async (session) => {
      await InventoryService.restoreItems({
        orderId: order._id,
        items: order.orderItems,
        actor,
        session,
        reason: `Order cancelled: ${reason}`,
      });

      order.inventory = order.inventory || {};
      order.inventory.restoredAt = now;
      order.orderStatus = "Cancelled";
      order.cancellation = {
        requestedAt: now,
        cancelledAt: now,
        reason,
        cancelledBy: actor?._id,
        cancelledByName: actor?.name,
        refundStatus: isPaidPaymentStatus(order.paymentStatus) ? "Pending" : "Not Applicable",
      };

      if (isPaidPaymentStatus(order.paymentStatus)) {
        order.paymentStatus = "Refund Pending";
      } else if (order.paymentStatus !== "Refunded") {
        order.paymentStatus = "Cancelled";
      }

      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: "Cancelled",
        note: `Order cancelled: ${reason}`,
        source: isAdmin ? "admin" : "customer",
        changedBy: actor?._id,
        changedByName: actor?.name,
        at: now,
      });

      await order.save(session ? { session } : {});

      // Release the coupon reservation/usage when an order is cancelled so the
      // customer can reuse the coupon on a future order. Joining the caller's
      // session keeps the order and coupon ledger atomic.
      if (order.coupon && order.coupon.code) {
        try {
          await CouponService.releaseRedemptionForOrder(order._id, {
            session,
            status: "reversed",
            reason: `Order cancelled: ${reason}`,
          });
        } catch (reverseErr) {
          // Never fail a cancellation because a redemption release could not
          // be applied; log it and continue.
          logger.warn("Coupon redemption release failed on cancellation", {
            order: order._id,
            coupon: order.coupon.code,
            error: reverseErr.message,
          });
        }
      }
    });

    NotificationService.notifyOrder(order, "cancelled").catch(() => {});
    return order;
  }

  // ── Returns & refunds ────────────────────────────────────────────────────

  async requestReturn(orderId, payload = {}, user) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    const order = await Order.findById(orderId);
    if (!order) throw httpError("Order not found.", 404);
    if (String(order.user) !== String(user._id)) {
      throw httpError("You are not authorized to return this order.", 403);
    }

    const eligibility = isReturnEligible(order);
    if (!eligibility.eligible) throw httpError(eligibility.reason);

    const requestedItems = Array.isArray(payload.items) && payload.items.length
      ? payload.items
      : [
          {
            orderItemId: payload.orderItemId,
            quantity: payload.quantity || 1,
            reason: payload.reason,
            description: payload.description,
            returnType: payload.returnType,
            media: payload.media,
          },
        ];

    const allowedReasons = [
      "Defective/Damaged",
      "Wrong Item Received",
      "Size Issue",
      "Quality Not as Expected",
      "Other",
    ];

    const prepared = [];
    for (const requested of requestedItems) {
      const orderItem = order.orderItems.id(requested.orderItemId);
      if (!orderItem) throw httpError("One of the selected items does not belong to this order.");
      const quantity = Number(requested.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > orderItem.quantity) {
        throw httpError(`Return quantity for ${orderItem.name} must be between 1 and ${orderItem.quantity}.`);
      }
      if (!allowedReasons.includes(requested.reason)) {
        throw httpError("Please choose a valid return reason.");
      }
      if (!requested.description || String(requested.description).trim().length < 5) {
        throw httpError("Please describe the issue in at least 5 characters.");
      }
      prepared.push({ requested, orderItem, quantity });
    }

    // Prevent returning more units than were purchased across active returns.
    const orderItemIds = prepared.map((entry) => entry.orderItem._id);
    const activeReturns = await Return.find({
      order: order._id,
      orderItemId: { $in: orderItemIds },
      status: { $nin: ["Rejected", "Return Closed"] },
    }).lean();

    for (const entry of prepared) {
      const alreadyRequested = activeReturns
        .filter((ret) => String(ret.orderItemId) === String(entry.orderItem._id))
        .reduce((sum, ret) => sum + (Number(ret.quantity) || 0), 0);
      if (alreadyRequested + entry.quantity > entry.orderItem.quantity) {
        throw httpError(
          `Only ${Math.max(0, entry.orderItem.quantity - alreadyRequested)} unit(s) of ${entry.orderItem.name} can still be returned.`
        );
      }
    }

    const createdReturns = await withTransaction(async (session) => {
      const docs = [];
      for (const entry of prepared) {
        const returnDoc = {
          returnNumber: generateReturnNumber(),
          order: order._id,
          orderItemId: entry.orderItem._id,
          user: user._id,
          product: entry.orderItem.product,
          quantity: entry.quantity,
          reason: entry.requested.reason,
          returnType: ["Refund", "Replacement", "Exchange"].includes(entry.requested.returnType)
            ? entry.requested.returnType
            : "Refund",
          description: String(entry.requested.description).trim(),
          media: Array.isArray(entry.requested.media) ? entry.requested.media : [],
          status: "Pending Review",
          timeline: [
            {
              status: "Pending Review",
              message: "Return request submitted by customer.",
            },
          ],
        };
        const [created] = await Return.create([returnDoc], session ? { session } : {});
        docs.push(created);
        entry.orderItem.returnActive = created._id;
      }

      order.orderStatus = "Return Requested";
      order.returnInfo = {
        ...(order.returnInfo || {}),
        status: "Requested",
        reason: prepared[0].requested.reason,
        requestedAt: new Date(),
        returnIds: docs.map((doc) => doc._id),
      };
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status: "Return Requested",
        note: `Return requested for ${prepared.reduce((sum, entry) => sum + entry.quantity, 0)} item(s).`,
        source: "customer",
        changedBy: user._id,
        changedByName: user.name,
        at: new Date(),
      });
      await order.save(session ? { session } : {});
      return docs;
    });

    NotificationService.notifyOrder(order, "return_requested").catch(() => {});
    return { order, returns: createdReturns };
  }

  // ── Shipment management ─────────────────────────────────────────────────

  _mapShipmentStatusToOrder(status) {
    switch (status) {
      case "Packed":
        return "Packed";
      case "Ready for Pickup":
      case "Picked Up":
      case "Dispatched":
      case "In Transit":
      case "Arrived at Hub":
        return "Shipped";
      case "Out for Delivery":
        return "Out for Delivery";
      case "Delivered":
        return "Delivered";
      case "Cancelled":
        return "Cancelled";
      case "Returned":
      case "Return Received":
        return "Returned";
      default:
        return null;
    }
  }

  /**
   * Mirror an order workflow step onto an existing shipment record.
   *
   * This never creates a shipment or tracking number; it only keeps the
   * manually managed shipment timeline consistent with the order. Updates are
   * forward-only so a late courier event cannot be overwritten by an older
   * admin status change.
   */
  async _syncShipmentForOrderStatus(order, targetStatus, { actor, note } = {}) {
    const target = shipmentStatusForOrderStatus(targetStatus);
    if (!target || !order?._id) return;

    const shipment = await Shipment.findOne({ order: order._id, isArchived: false });
    if (!shipment) return;

    const current = shipment.status || "Shipment Created";
    if (!shouldAdvanceShipmentStatus(current, target)) return;

    const now = new Date();
    shipment.status = target;
    shipment.statusHistory = shipment.statusHistory || [];
    shipment.statusHistory.push({
      status: target,
      date: now,
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      remark: note || `Order marked ${targetStatus}`,
      updatedBy: actor?._id,
      adminName: actor?.name,
    });
    shipment.activityLog = shipment.activityLog || [];
    shipment.activityLog.push({
      action: "Shipment status updated",
      adminName: actor?.name,
      performedBy: actor?._id,
      previousValue: current,
      newValue: target,
    });
    if (target === "Packed") shipment.packingDate = shipment.packingDate || now;
    if (target === "Dispatched") shipment.dispatchDate = shipment.dispatchDate || now;
    if (target === "Delivered") shipment.deliveredDate = shipment.deliveredDate || now;

    await shipment.save();
  }

  /**
   * A shipment event may only move the order forward. Reject contradictory
   * updates (for example marking a delivered order as "Packed") before the
   * shipment document is saved, so the two records cannot drift apart.
   */
  _assertShipmentStatusAllowed(order, shipmentStatus) {
    const target = this._mapShipmentStatusToOrder(shipmentStatus);
    if (!target) return;
    const current = normalizeOrderStatus(order.orderStatus);
    if (current === target) return;

    if (target === "Cancelled") {
      if (!isAdminCancellable(current)) {
        throw httpError(`A ${current} order can no longer be cancelled by a courier update.`);
      }
      return;
    }

    if (target === "Returned") {
      if (!["Return Approved", "Returned"].includes(current)) {
        throw httpError(
          "Approve the customer's return before marking the shipment as returned."
        );
      }
      return;
    }

    if (!getAdvancePath(current, target)) {
      throw httpError(
        `Shipment status "${shipmentStatus}" cannot be applied to a ${current} order.`
      );
    }
  }

  async syncShipmentStatus(orderId, shipmentStatus, actor, note, { codCollected = false } = {}) {
    const target = this._mapShipmentStatusToOrder(shipmentStatus);
    if (!target) return null;
    const order = await Order.findById(orderId);
    if (!order) return null;

    if (target === "Cancelled") {
      if (normalizeOrderStatus(order.orderStatus) === "Cancelled") return order;
      return this.cancelOrder(orderId, { reason: note || "Shipment cancelled by courier" }, actor, {
        isAdmin: true,
      });
    }

    if (target === "Returned") {
      if (!["Return Approved", "Returned"].includes(normalizeOrderStatus(order.orderStatus))) {
        throw httpError(
          "Approve the customer's return before marking the shipment as returned."
        );
      }
    }

    return this.updateStatus(
      orderId,
      { status: target, note, codCollected: Boolean(codCollected) },
      actor,
      { system: true }
    );
  }

  async updateShipment(orderId, payload = {}, actor) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    const order = await Order.findById(orderId);
    if (!order) throw httpError("Order not found.", 404);

    const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    const clean = (value) => (value === undefined || value === null ? "" : String(value).trim());

    const trackingNumber = clean(payload.trackingNumber);
    const awbNumber = clean(payload.awbNumber);
    const courierName = clean(payload.courierName);
    const shippingMethod = ["standard", "express", "surface", "air", "other"].includes(payload.shippingMethod)
      ? payload.shippingMethod
      : undefined;
    const shipmentStatus = clean(payload.status);

    if (trackingNumber.length > 100) throw httpError("Tracking number is too long.");
    if (awbNumber.length > 100) throw httpError("AWB number is too long.");
    if (courierName.length > 100) throw httpError("Courier name is too long.");
    if (shipmentStatus && !SHIPMENT_STATUSES.includes(shipmentStatus)) {
      throw httpError("Invalid shipment status.");
    }

    let trackingUrl = clean(payload.trackingUrl);
    if (trackingUrl) {
      try {
        const parsed = new URL(trackingUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
      } catch {
        throw httpError("Tracking URL must be a valid http(s) URL.");
      }
    }
    if (!trackingUrl && trackingNumber) {
      trackingUrl = buildCourierTrackingUrl(courierName, trackingNumber) || "";
    }

    const identifiers = [trackingNumber, awbNumber].filter(Boolean);
    if (identifiers.length) {
      const duplicate = await Shipment.findOne({
        isArchived: false,
        order: { $ne: order._id },
        $or: [
          { trackingNumber: { $in: identifiers } },
          { awbNumber: { $in: identifiers } },
        ],
      }).lean();
      if (duplicate) {
        const field =
          duplicate.trackingNumber && identifiers.includes(duplicate.trackingNumber)
            ? "tracking number"
            : "AWB number";
        throw httpError(`This ${field} is already linked to another order.`, 409);
      }
    }

    const parseDateInput = (value, label) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) throw httpError(`${label} must be a valid date.`);
      return parsed;
    };

    const dispatchDate = parseDateInput(payload.shipmentDate, "Shipment date");
    const estimatedDeliveryDate = parseDateInput(
      payload.estimatedDeliveryDate,
      "Estimated delivery date"
    );

    if (
      dispatchDate &&
      estimatedDeliveryDate &&
      estimatedDeliveryDate.getTime() < dispatchDate.getTime()
    ) {
      throw httpError("Estimated delivery date cannot be before the shipment date.");
    }

    // Validate the order transition before persisting a shipment status that
    // could contradict the order lifecycle.
    if (shipmentStatus) this._assertShipmentStatusAllowed(order, shipmentStatus);

    let shipment = await Shipment.findOne({ order: order._id, isArchived: false });
    const now = new Date();

    if (!shipment) {
      shipment = new Shipment({
        shipmentId: `SHP-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
        order: order._id,
        customerName: order.shippingInfo?.fullName || order.customerInfo?.name || "Customer",
        customerPhone: order.shippingInfo?.phoneNo || order.customerInfo?.phone || "",
        customerEmail: order.shippingInfo?.email || order.customerInfo?.email,
        shippingAddress: {
          fullName: order.shippingInfo?.fullName || "Customer",
          mobileNumber: order.shippingInfo?.phoneNo || "",
          addressLine1: order.shippingInfo?.address || "",
          addressLine2: order.shippingInfo?.addressLine2,
          landmark: order.shippingInfo?.landmark,
          city: order.shippingInfo?.city || "",
          state: order.shippingInfo?.state,
          country: order.shippingInfo?.country || "India",
          pincode: order.shippingInfo?.zipCode || "",
        },
        paymentType: order.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid",
        shippingMethod: order.shippingMethod || "standard",
        orderDate: order.createdAt,
        status: "Shipment Created",
        createdBy: actor?._id,
        createdByName: actor?.name,
        statusHistory: [
          {
            status: "Shipment Created",
            date: now,
            time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            remark: "Shipment record created from order management",
            updatedBy: actor?._id,
            adminName: actor?.name,
          },
        ],
      });
    }

    if (has("courierName")) shipment.courierName = courierName || undefined;
    if (has("trackingNumber")) shipment.trackingNumber = trackingNumber || undefined;
    if (has("awbNumber")) shipment.awbNumber = awbNumber || undefined;
    if (shippingMethod !== undefined) shipment.shippingMethod = shippingMethod;
    if (dispatchDate !== undefined) shipment.dispatchDate = dispatchDate || undefined;
    if (estimatedDeliveryDate !== undefined) {
      shipment.estimatedDeliveryDate = estimatedDeliveryDate || undefined;
    }
    if (has("remarks")) shipment.remarks = String(payload.remarks || "").slice(0, 1000);

    // Persist courier timeline events so customers see the same tracking
    // history that the admin entered. Repeating the same status is a no-op.
    const previousShipmentStatus = shipment.status || "Shipment Created";
    if (shipmentStatus && shipmentStatus !== previousShipmentStatus) {
      shipment.status = shipmentStatus;
      shipment.statusHistory = shipment.statusHistory || [];
      shipment.statusHistory.push({
        status: shipmentStatus,
        date: now,
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        remark: payload.note || `Shipment marked ${shipmentStatus}`,
        updatedBy: actor?._id,
        adminName: actor?.name,
      });
      shipment.activityLog = shipment.activityLog || [];
      shipment.activityLog.push({
        action: "Shipment status updated",
        adminName: actor?.name,
        performedBy: actor?._id,
        previousValue: previousShipmentStatus,
        newValue: shipmentStatus,
      });
      if (shipmentStatus === "Packed") shipment.packingDate = shipment.packingDate || now;
      if (["Picked Up", "Dispatched", "In Transit"].includes(shipmentStatus)) {
        shipment.dispatchDate = shipment.dispatchDate || now;
      }
      if (shipmentStatus === "Delivered") {
        shipment.deliveredDate = shipment.deliveredDate || now;
      }
    }

    await shipment.save();

    if (has("courierName")) order.courierName = shipment.courierName || undefined;
    if (has("trackingNumber")) order.trackingId = shipment.trackingNumber || undefined;
    if (has("awbNumber")) order.awbNumber = shipment.awbNumber || undefined;
    if (has("trackingUrl")) order.trackingUrl = trackingUrl || undefined;
    order.shipment = shipment._id;
    if (has("shipmentDate")) order.shipmentDate = shipment.dispatchDate || undefined;
    if (has("estimatedDeliveryDate")) {
      order.estimatedDeliveryDate = shipment.estimatedDeliveryDate || undefined;
    }
    await order.save();

    if (shipmentStatus) {
      await this.syncShipmentStatus(
        order._id,
        shipmentStatus,
        actor,
        payload.note || "Shipment status updated",
        { codCollected: payload.codCollected }
      );
    }

    const freshOrder = await Order.findById(order._id)
      .populate("shipment")
      .populate("user", "name email phoneNumber");
    return { order: freshOrder, shipment };
  }

  // ── Invoice, export, deletion ────────────────────────────────────────────

  async getInvoice(orderId, { userId, isAdmin = false } = {}) {
    const { order } = await this.getOrderDetails(orderId, { userId, isAdmin });
    const plain = order.toObject ? order.toObject() : order;
    const refunded = (plain.refunds || [])
      .filter((refund) => refund.status === "Completed")
      .reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);

    return {
      invoiceNumber: `INV-${plain.orderNumber || plain._id}`,
      invoiceDate: plain.paidAt || plain.createdAt,
      orderNumber: plain.orderNumber || String(plain._id),
      orderDate: plain.createdAt,
      seller: {
        name: process.env.COMPANY_NAME || "DELIVIX",
        address: process.env.COMPANY_ADDRESS || "",
        email: process.env.COMPANY_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || "",
        phone: process.env.COMPANY_PHONE || "",
        gstin: process.env.COMPANY_GSTIN || "",
      },
      customer: {
        name: plain.shippingInfo?.fullName || plain.customerInfo?.name,
        email: plain.customerInfo?.email || plain.shippingInfo?.email,
        phone: plain.customerInfo?.phone || plain.shippingInfo?.phoneNo,
        address: plain.shippingAddress || plain.shippingInfo,
        billingAddress: plain.billingAddress || plain.shippingAddress || plain.shippingInfo,
      },
      items: (plain.orderItems || []).map((item) => ({
        name: item.name,
        size: item.size,
        variantName: item.variantName,
        sku: item.sku || item.variantSku,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal ?? toMoney(item.price * item.quantity),
      })),
      amounts: {
        itemsPrice: plain.itemsPrice,
        discountAmount: plain.discountAmount || 0,
        taxAmount: plain.taxAmount || 0,
        shippingAmount: plain.shippingAmount || 0,
        packagingAmount: plain.packagingAmount || 0,
        totalAmount: plain.totalAmount,
        refundedAmount: toMoney(refunded),
        balance: toMoney(Math.max(0, plain.totalAmount - refunded)),
        currency: plain.currency || "INR",
      },
      payment: {
        method: plain.paymentMethod,
        status: plain.paymentStatus,
        paidAt: plain.paidAt,
        transactions: (plain.paymentTransactions || []).map((tx) => ({
          provider: tx.provider,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          method: tx.method,
          verifiedAt: tx.verifiedAt,
        })),
      },
      shipment: plain.shipment || null,
      status: plain.orderStatus,
      notes: process.env.INVOICE_NOTES || "Thank you for shopping with DELIVIX.",
    };
  }

  async exportCsv(query = {}) {
    const filter = this._buildAdminFilter(query);
    const orders = await Order.find(filter)
      .sort(this._sortFor(query))
      .limit(5000)
      .populate("user", "name email")
      .lean();

    const headers = [
      "Order Number",
      "Order Date",
      "Customer",
      "Email",
      "Phone",
      "Items",
      "Total Quantity",
      "Payment Method",
      "Payment Status",
      "Order Status",
      "Currency",
      "Items Price",
      "Discount",
      "Tax",
      "Shipping",
      "Packaging",
      "Total",
      "Courier",
      "Tracking Number",
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = orders.map((order) => {
      const quantity = (order.orderItems || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      );
      return [
        order.orderNumber || order._id,
        order.createdAt ? new Date(order.createdAt).toISOString() : "",
        order.shippingInfo?.fullName || order.customerInfo?.name || order.user?.name || "",
        order.customerInfo?.email || order.user?.email || "",
        order.customerInfo?.phone || order.shippingInfo?.phoneNo || "",
        (order.orderItems || []).map((item) => `${item.name} x${item.quantity}`).join(" | "),
        quantity,
        order.paymentMethod,
        order.paymentStatus,
        order.orderStatus,
        order.currency || "INR",
        order.itemsPrice,
        order.discountAmount || 0,
        order.taxAmount || 0,
        order.shippingAmount || 0,
        order.packagingAmount || 0,
        order.totalAmount,
        order.courierName || "",
        order.trackingId || "",
      ]
        .map(escapeCsv)
        .join(",");
    });

    return [headers.join(","), ...rows].join("\r\n");
  }

  async deleteOrder(orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw httpError("Order not found.", 404);
    const order = await Order.findById(orderId);
    if (!order) throw httpError("Order not found.", 404);
    if (!["Cancelled", "Refunded"].includes(normalizeOrderStatus(order.orderStatus))) {
      throw httpError("Only cancelled or refunded orders can be deleted.");
    }
    await order.deleteOne();
    return order;
  }

  async retryNotification(orderId, event) {
    if (!event) throw httpError("Notification event is required.");
    return NotificationService.retry(orderId, event);
  }
}

export default new OrderService();
