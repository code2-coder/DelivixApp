import express from "express";
import { getDashboardStats } from "../controllers/adminDashboardController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

router.get("/admin/dashboard/stats", adminGuard, getDashboardStats);

export default router;
