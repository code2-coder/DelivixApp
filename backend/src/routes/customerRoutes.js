import express from "express";
import CustomerController from "../controllers/CustomerController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validator.js";
import {
  updateCustomerSchema,
  updateCustomerStatusSchema,
  addCustomerNoteSchema,
} from "../validators/customer.validator.js";

const router = express.Router();
const adminOrStaff = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

// ── Static routes (must precede /:id) ──────────────────────────────────────
router.get("/admin/customers/stats", adminOrStaff, CustomerController.getCustomerStats);
router.get("/admin/customers/export", adminOrStaff, CustomerController.exportCustomers);
router.get("/admin/customers", adminOrStaff, CustomerController.getAllCustomers);

// ── Customer specific routes ──────────────────────────────────────────────
router.get("/admin/customers/:id", adminOrStaff, CustomerController.getCustomerDetails);
router.patch(
  "/admin/customers/:id",
  adminOrStaff,
  validate(updateCustomerSchema),
  CustomerController.updateCustomer
);
router.patch(
  "/admin/customers/:id/status",
  adminOrStaff,
  validate(updateCustomerStatusSchema),
  CustomerController.updateCustomerStatus
);
router.post(
  "/admin/customers/:id/notes",
  adminOrStaff,
  validate(addCustomerNoteSchema),
  CustomerController.addAdminNote
);
router.delete(
  "/admin/customers/:id/notes/:noteId",
  adminOrStaff,
  CustomerController.deleteAdminNote
);
router.get(
  "/admin/customers/:id/orders",
  adminOrStaff,
  CustomerController.getCustomerOrders
);

export default router;
