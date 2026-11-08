import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import { sendResponse } from "../helpers/response.js";
import Order from "../models/order.js";
import OrderService from "../services/OrderService.js";
import PaymentService from "../services/PaymentService.js";

const isAdminUser = (user) => user?.role === "admin" || user?.role === "staff";

export const quoteOrder = catchAsyncErrors(async (req, res, next) => {
  const quote = await OrderService.quoteOrder(req.body, req.user);
  return sendResponse(res, 200, true, "Order quote calculated", { quote });
});

export const newOrder = catchAsyncErrors(async (req, res, next) => {
  const idempotencyKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body?.idempotencyKey;
  const { order, idempotent } = await OrderService.createOrder(
    req.body,
    req.user,
    idempotencyKey ? String(idempotencyKey).slice(0, 200) : undefined
  );
  return sendResponse(
    res,
    idempotent ? 200 : 201,
    true,
    idempotent ? "Order already created" : "Order created successfully",
    { order, idempotent: Boolean(idempotent) }
  );
});

export const myOrders = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.getUserOrders(req.user._id, req.query);
  return sendResponse(res, 200, true, "User orders fetched successfully", result);
});

export const getOrderDetails = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.getOrderDetails(req.params.id, {
    userId: req.user._id,
    isAdmin: isAdminUser(req.user),
  });
  return sendResponse(res, 200, true, "Order details fetched successfully", result);
});

export const cancelMyOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await OrderService.cancelOrder(req.params.id, req.body, req.user, {
    isAdmin: false,
  });
  return sendResponse(res, 200, true, "Order cancelled successfully", { order });
});

export const requestReturn = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.requestReturn(req.params.id, req.body, req.user);
  return sendResponse(res, 201, true, "Return request submitted successfully", result);
});

export const getInvoice = catchAsyncErrors(async (req, res, next) => {
  const invoice = await OrderService.getInvoice(req.params.id, {
    userId: req.user._id,
    isAdmin: isAdminUser(req.user),
  });
  return sendResponse(res, 200, true, "Invoice fetched successfully", { invoice });
});

// ── Admin ──────────────────────────────────────────────────────────────────

export const allOrders = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.getAllOrders(req.query);
  return sendResponse(res, 200, true, "All orders fetched successfully", result);
});

export const getOrderStats = catchAsyncErrors(async (req, res, next) => {
  const stats = await OrderService.getAdminOrderStats();
  return sendResponse(res, 200, true, "Order statistics fetched successfully", stats);
});

export const getAdminOrderDetails = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.getOrderDetails(req.params.id, {
    userId: req.user._id,
    isAdmin: true,
  });
  return sendResponse(res, 200, true, "Order details fetched successfully", result);
});

export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const order = await OrderService.updateStatus(req.params.id, req.body, req.user, {
    system: false,
  });
  return sendResponse(res, 200, true, "Order status updated successfully", { order });
});

export const bulkUpdateOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderIds, status, note, codCollected } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return next(Object.assign(new Error("Select at least one order."), { statusCode: 400 }));
  }
  if (orderIds.length > 100) {
    return next(Object.assign(new Error("Bulk updates are limited to 100 orders at a time."), { statusCode: 400 }));
  }

  const updated = [];
  const failed = [];
  for (const orderId of orderIds) {
    try {
      const order = await OrderService.updateStatus(
        orderId,
        { status, note, codCollected },
        req.user,
        { system: false }
      );
      updated.push({ orderId, orderNumber: order.orderNumber, status: order.orderStatus });
    } catch (error) {
      failed.push({ orderId, message: error.message });
    }
  }

  return sendResponse(
    res,
    200,
    true,
    `${updated.length} order(s) updated${failed.length ? `, ${failed.length} skipped` : ""}.`,
    { updated, failed }
  );
});

export const updateOrderShipment = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.updateShipment(req.params.id, req.body, req.user);
  return sendResponse(res, 200, true, "Shipment details saved", result);
});

export const refundOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(Object.assign(new Error("Order not found."), { statusCode: 404 }));
  }
  const updated = await PaymentService.refundOrder(order, {
    ...req.body,
    actor: req.user,
  });
  const pending = updated.paymentStatus === "Refund Pending";
  return sendResponse(
    res,
    200,
    true,
    pending
      ? "Refund submitted to the payment provider and awaiting confirmation"
      : "Refund confirmed and recorded",
    { order: updated }
  );
});

export const exportOrders = catchAsyncErrors(async (req, res, next) => {
  const csv = await OrderService.exportCsv(req.query);
  const filename = `delivix-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

export const deleteOrder = catchAsyncErrors(async (req, res, next) => {
  await OrderService.deleteOrder(req.params.id);
  return sendResponse(res, 200, true, "Order deleted successfully");
});

export const retryNotification = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.retryNotification(req.params.id, req.body?.event);
  return sendResponse(res, 200, true, "Notification retry attempted", { notification: result });
});

export default {
  quoteOrder,
  newOrder,
  myOrders,
  getOrderDetails,
  cancelMyOrder,
  requestReturn,
  getInvoice,
  allOrders,
  getOrderStats,
  getAdminOrderDetails,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  updateOrderShipment,
  refundOrder,
  exportOrders,
  deleteOrder,
  retryNotification,
};
