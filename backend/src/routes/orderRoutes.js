import express from "express";
import orderController from "../controllers/OrderController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validator.js";
import {
  quoteOrderSchema,
  createOrderSchema,
  cancelOrderSchema,
  returnRequestSchema,
  updateOrderStatusSchema,
  bulkUpdateOrderStatusSchema,
  updateShipmentSchema,
  refundOrderSchema,
} from "../validators/order.validator.js";

const router = express.Router();

const adminOrStaff = authorizeRoles("admin", "staff");
const adminOnly = authorizeRoles("admin");

// ── Customer routes ────────────────────────────────────────────────────────
router.post("/orders/quote", isAuthenticatedUser, validate(quoteOrderSchema), orderController.quoteOrder);
router.post("/orders/new", isAuthenticatedUser, validate(createOrderSchema), orderController.newOrder);
router.get("/me/orders", isAuthenticatedUser, orderController.myOrders);
router.get("/orders/:id", isAuthenticatedUser, orderController.getOrderDetails);
router.patch(
  "/orders/:id/cancel",
  isAuthenticatedUser,
  validate(cancelOrderSchema),
  orderController.cancelMyOrder
);
router.post(
  "/orders/:id/returns",
  isAuthenticatedUser,
  validate(returnRequestSchema),
  orderController.requestReturn
);
router.get("/orders/:id/invoice", isAuthenticatedUser, orderController.getInvoice);

// ── Admin routes (static paths must be declared before /:id) ──────────────
router.get(
  "/admin/orders/stats",
  isAuthenticatedUser,
  adminOrStaff,
  orderController.getOrderStats
);
router.get(
  "/admin/orders/export",
  isAuthenticatedUser,
  adminOrStaff,
  orderController.exportOrders
);
router.patch(
  "/admin/orders/bulk-status",
  isAuthenticatedUser,
  adminOrStaff,
  validate(bulkUpdateOrderStatusSchema),
  orderController.bulkUpdateOrderStatus
);
router.get(
  "/admin/orders",
  isAuthenticatedUser,
  adminOrStaff,
  orderController.allOrders
);
router.get(
  "/admin/orders/:id",
  isAuthenticatedUser,
  adminOrStaff,
  orderController.getAdminOrderDetails
);
router.patch(
  "/admin/orders/:id/status",
  isAuthenticatedUser,
  adminOrStaff,
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);
router.put(
  "/admin/orders/:id",
  isAuthenticatedUser,
  adminOrStaff,
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);
router.patch(
  "/admin/orders/:id/shipment",
  isAuthenticatedUser,
  adminOrStaff,
  validate(updateShipmentSchema),
  orderController.updateOrderShipment
);
router.post(
  "/admin/orders/:id/refund",
  isAuthenticatedUser,
  adminOnly,
  validate(refundOrderSchema),
  orderController.refundOrder
);
router.post(
  "/admin/orders/:id/notifications/retry",
  isAuthenticatedUser,
  adminOrStaff,
  orderController.retryNotification
);
router.delete(
  "/admin/orders/:id",
  isAuthenticatedUser,
  adminOnly,
  orderController.deleteOrder
);

export default router;
