import express from "express";
import {
  createReturn,
  myReturns,
  getReturnDetails,
  allReturns,
  getAdminReturnDetails,
  updateReturnStatus,
} from "../controllers/returnController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// CUSTOMER ROUTES
router.route("/returns/me").get(isAuthenticatedUser, myReturns);
router.route("/returns").post(isAuthenticatedUser, createReturn);
router.route("/returns/:id").get(isAuthenticatedUser, getReturnDetails);

// ADMIN ROUTES
router
  .route("/admin/returns")
  .get(isAuthenticatedUser, authorizeRoles("admin"), allReturns);

router
  .route("/admin/returns/:id")
  .get(isAuthenticatedUser, authorizeRoles("admin"), getAdminReturnDetails)
  .patch(isAuthenticatedUser, authorizeRoles("admin"), updateReturnStatus);

export default router;
