import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import { sendResponse } from "../helpers/response.js";
import CustomerService from "../services/CustomerService.js";

export const getCustomerStats = catchAsyncErrors(async (req, res) => {
  const stats = await CustomerService.getCustomerStats();
  return sendResponse(res, 200, true, "Customer statistics fetched successfully", { stats, ...stats });
});

export const getAllCustomers = catchAsyncErrors(async (req, res) => {
  const result = await CustomerService.getAllCustomers(req.query);
  return sendResponse(res, 200, true, "Customers retrieved successfully", result);
});

export const getCustomerDetails = catchAsyncErrors(async (req, res) => {
  const result = await CustomerService.getCustomerDetails(req.params.id);
  return sendResponse(res, 200, true, "Customer details fetched successfully", result);
});

export const updateCustomer = catchAsyncErrors(async (req, res) => {
  const result = await CustomerService.updateCustomer(req.params.id, req.body, req.user);
  return sendResponse(res, 200, true, "Customer updated successfully", result);
});

export const updateCustomerStatus = catchAsyncErrors(async (req, res) => {
  const { status, reason } = req.body;
  const result = await CustomerService.updateCustomerStatus(
    req.params.id,
    status,
    reason,
    req.user
  );
  return sendResponse(res, 200, true, `Customer status updated to ${status}`, result);
});

export const addAdminNote = catchAsyncErrors(async (req, res) => {
  const note = await CustomerService.addAdminNote(req.params.id, req.body.note, req.user);
  return sendResponse(res, 201, true, "Admin note added successfully", { note });
});

export const deleteAdminNote = catchAsyncErrors(async (req, res) => {
  const result = await CustomerService.deleteAdminNote(req.params.id, req.params.noteId);
  return sendResponse(res, 200, true, "Admin note deleted successfully", result);
});

export const getCustomerOrders = catchAsyncErrors(async (req, res) => {
  const result = await CustomerService.getCustomerOrders(req.params.id, req.query);
  return sendResponse(res, 200, true, "Customer orders fetched successfully", result);
});

export const exportCustomers = catchAsyncErrors(async (req, res) => {
  const csvData = await CustomerService.exportCustomers(req.query);
  const filename = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.status(200).send(csvData);
});

export default {
  getCustomerStats,
  getAllCustomers,
  getCustomerDetails,
  updateCustomer,
  updateCustomerStatus,
  addAdminNote,
  deleteAdminNote,
  getCustomerOrders,
  exportCustomers,
};
