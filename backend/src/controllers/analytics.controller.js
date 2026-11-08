import { AnalyticsService } from "../services/analytics.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendResponse } from "../helpers/response.js";
import * as XLSX from "xlsx";

export const getOverview = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getOverview(req.query);
  return sendResponse(res, 200, true, "Overview analytics retrieved successfully", data);
});

export const getRevenue = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getRevenue(req.query);
  return sendResponse(res, 200, true, "Revenue analytics retrieved successfully", data);
});

export const getSales = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getSales(req.query);
  return sendResponse(res, 200, true, "Sales reports retrieved successfully", data);
});

export const getProducts = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getProductPerformance(req.query);
  return sendResponse(res, 200, true, "Product performance analytics retrieved successfully", data);
});

export const getCustomers = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getCustomers(req.query);
  return sendResponse(res, 200, true, "Customer analytics retrieved successfully", data);
});

export const getCategories = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getCategoriesAndBrands(req.query);
  return sendResponse(res, 200, true, "Category and brand analytics retrieved successfully", data);
});

export const getPayments = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getOrdersAndPayments(req.query);
  return sendResponse(res, 200, true, "Order and payment analytics retrieved successfully", data);
});

export const getInventory = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getInventory(req.query);
  return sendResponse(res, 200, true, "Inventory reports retrieved successfully", data);
});

export const getCoupons = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getCoupons(req.query);
  return sendResponse(res, 200, true, "Coupon analytics retrieved successfully", data);
});

export const getReturns = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getReturns(req.query);
  return sendResponse(res, 200, true, "Returns and refund analytics retrieved successfully", data);
});

export const exportAnalytics = asyncHandler(async (req, res) => {
  const type = req.query.type || "sales";
  const format = (req.query.format || "json").toLowerCase();

  const exportData = await AnalyticsService.getExportData(type, req.query);

  if (format === "xlsx" || format === "excel") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([exportData.headers, ...exportData.rows]);
    XLSX.utils.book_append_sheet(wb, ws, exportData.sheetName || "Report");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportData.filename}.xlsx"`
    );
    return res.send(buffer);
  }

  if (format === "csv") {
    const csvContent = [exportData.headers, ...exportData.rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportData.filename}.csv"`
    );
    return res.send(csvContent);
  }

  return sendResponse(res, 200, true, "Export data prepared", exportData);
});
