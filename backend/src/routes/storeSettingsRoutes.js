import express from "express";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import {
  getAllSettings,
  getPublicSettings,
  updateSectionSettings,
  resetSectionSettings,
  sendTestEmail,
  sendTestSms,
  createBackup,
  getBackupHistory,
  downloadBackup,
  restoreBackup,
  exportData,
  getAuditLogs,
} from "../controllers/storeSettingsController.js";

const router = express.Router();

// Public routes
router.get("/settings/public", getPublicSettings);

// Protected Admin Routes
const adminAuth = [isAuthenticatedUser, authorizeRoles("admin")];

router.get("/settings/all", adminAuth, getAllSettings);
router.put("/settings/section/:section", adminAuth, updateSectionSettings);
router.post("/settings/section/:section/reset", adminAuth, resetSectionSettings);

router.post("/settings/test-email", adminAuth, sendTestEmail);
router.post("/settings/test-sms", adminAuth, sendTestSms);

router.post("/settings/backup", adminAuth, createBackup);
router.get("/settings/backup/history", adminAuth, getBackupHistory);
router.get("/settings/backup/download/:id", adminAuth, downloadBackup);
router.post("/settings/backup/restore/:id", adminAuth, restoreBackup);

router.get("/settings/export", adminAuth, exportData);
router.get("/settings/audit-logs", adminAuth, getAuditLogs);

export default router;

