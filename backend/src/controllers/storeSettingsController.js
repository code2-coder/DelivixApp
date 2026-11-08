import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import StoreSettingsService from "../services/StoreSettingsService.js";

// GET ALL SETTINGS (Admin only, secrets masked)
export const getAllSettings = catchAsyncErrors(async (req, res) => {
  const settings = await StoreSettingsService.getAllSettings();
  res.status(200).json({
    success: true,
    settings,
  });
});

// GET PUBLIC SETTINGS (Storefront accessible)
export const getPublicSettings = catchAsyncErrors(async (req, res) => {
  const settings = await StoreSettingsService.getPublicSettings();
  res.status(200).json({
    success: true,
    settings,
  });
});

// UPDATE SPECIFIC SETTINGS SECTION (Admin only)
export const updateSectionSettings = catchAsyncErrors(async (req, res, next) => {
  const { section } = req.params;
  const data = req.body;

  if (!section) {
    return next(new ErrorHandler("Settings section identifier is required", 400));
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  const updated = await StoreSettingsService.updateSection(section, data, req.user, clientIp);

  res.status(200).json({
    success: true,
    message: `${section.charAt(0).toUpperCase() + section.slice(1)} settings updated successfully`,
    data: updated,
  });
});

// RESET SECTION TO DEFAULTS (Admin only)
export const resetSectionSettings = catchAsyncErrors(async (req, res, next) => {
  const { section } = req.params;
  if (!section) {
    return next(new ErrorHandler("Settings section identifier is required", 400));
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  const resetDoc = await StoreSettingsService.resetSection(section, req.user, clientIp);

  res.status(200).json({
    success: true,
    message: `${section.charAt(0).toUpperCase() + section.slice(1)} settings reset to factory defaults`,
    data: resetDoc,
  });
});

// SEND TEST EMAIL (Admin only)
export const sendTestEmail = catchAsyncErrors(async (req, res, next) => {
  const { toEmail, provider, customConfig } = req.body;

  if (!toEmail) {
    return next(new ErrorHandler("Please provide an email address for testing", 400));
  }

  try {
    const result = await StoreSettingsService.sendTestEmail({
      toEmail,
      provider,
      customConfig,
    });

    res.status(200).json({
      success: true,
      message: result.message || "Test email dispatched successfully",
      details: result,
    });
  } catch (error) {
    return next(new ErrorHandler(`Test email delivery failed: ${error.message}`, 500));
  }
});

// SEND TEST SMS / WHATSAPP (Admin only)
export const sendTestSms = catchAsyncErrors(async (req, res, next) => {
  const { toPhone, channel } = req.body;

  if (!toPhone) {
    return next(new ErrorHandler("Please provide a phone number for testing", 400));
  }

  const result = await StoreSettingsService.sendTestSms({ toPhone, channel });

  res.status(200).json({
    success: true,
    message: result.message,
    details: result,
  });
});

// CREATE BACKUP SNAPSHOT (Admin only)
export const createBackup = catchAsyncErrors(async (req, res) => {
  const { notes } = req.body || {};
  const backup = await StoreSettingsService.createBackup(req.user, notes);

  res.status(201).json({
    success: true,
    message: "Store backup created successfully",
    backup,
  });
});

// GET BACKUP HISTORY (Admin only)
export const getBackupHistory = catchAsyncErrors(async (req, res) => {
  const history = await StoreSettingsService.getBackupHistory();

  res.status(200).json({
    success: true,
    history,
  });
});

// DOWNLOAD BACKUP FILE (Admin only)
export const downloadBackup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const backup = await StoreSettingsService.getBackupDownload(id);

  res.setHeader("Content-Disposition", `attachment; filename="${backup.fileName}"`);
  res.setHeader("Content-Type", "application/json");
  res.send(backup.data);
});

// RESTORE FROM BACKUP (Admin only)
export const restoreBackup = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const result = await StoreSettingsService.restoreBackup(id, req.user);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

// EXPORT STORE DATA (Admin only)
export const exportData = catchAsyncErrors(async (req, res, next) => {
  const { entity = "products", format = "json" } = req.query;
  const data = await StoreSettingsService.exportData(entity, format);

  if (format === "csv") {
    res.setHeader("Content-Disposition", `attachment; filename="delivix_${entity}_export.csv"`);
    res.setHeader("Content-Type", "text/csv");
    return res.send(data);
  }

  res.status(200).json({
    success: true,
    entity,
    totalRecords: Array.isArray(data) ? data.length : 0,
    records: data,
  });
});

// GET AUDIT LOGS (Admin only)
export const getAuditLogs = catchAsyncErrors(async (req, res) => {
  const logs = await StoreSettingsService.getAuditLogs();

  res.status(200).json({
    success: true,
    logs,
  });
});

// GET ROBOTS.TXT (Public)
export const getRobotsTxt = catchAsyncErrors(async (req, res) => {
  const content = await StoreSettingsService.getRobotsTxt();
  res.setHeader("Content-Type", "text/plain");
  res.send(content);
});

// GET SITEMAP.XML (Public)
export const getSitemapXml = catchAsyncErrors(async (req, res) => {
  const content = await StoreSettingsService.getSitemapXml();
  res.setHeader("Content-Type", "application/xml");
  res.send(content);
});

