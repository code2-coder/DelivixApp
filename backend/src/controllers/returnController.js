import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import Return from "../models/return.js";
import Order from "../models/order.js";
import ErrorHandler from "../utils/errorHandler.js";
import OrderService from "../services/OrderService.js";

const syncOrderStatus = async (orderId, status, user, note) => {
  if (!status) return null;
  try {
    return await OrderService.updateStatus(orderId, { status, note }, user, { system: true });
  } catch (error) {
    console.warn(`[returns] Could not sync order ${orderId} to ${status}:`, error.message);
    return null;
  }
};

// 🛒 CUSTOMER: CREATE RETURN REQUEST
// Delegates to the order workflow so the return, order status, history and
// inventory ledger all stay consistent.
export const createReturn = catchAsyncErrors(async (req, res, next) => {
  const result = await OrderService.requestReturn(req.body.orderId, req.body, req.user);
  res.status(201).json({
    success: true,
    returnRequest: result.returns[0],
    returns: result.returns,
    order: result.order,
  });
});

// 👤 CUSTOMER: GET MY RETURNS
export const myReturns = catchAsyncErrors(async (req, res, next) => {
  const returns = await Return.find({ user: req.user._id })
    .populate("product", "name images")
    .populate("order", "orderItems")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    returns,
  });
});

// 📦 CUSTOMER: GET RETURN DETAILS
export const getReturnDetails = catchAsyncErrors(async (req, res, next) => {
  const returnReq = await Return.findById(req.params.id)
    .populate("product", "name images")
    .populate("order", "shippingInfo paymentMethod totalAmount");

  if (!returnReq) {
    return next(new ErrorHandler("Return request not found", 404));
  }

  // Ensure it belongs to the user
  if (returnReq.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Unauthorized", 403));
  }

  res.status(200).json({
    success: true,
    return: returnReq,
  });
});

// 👑 ADMIN: GET ALL RETURNS
export const allReturns = catchAsyncErrors(async (req, res, next) => {
  const returns = await Return.find()
    .populate("user", "name email")
    .populate("product", "name")
    .sort({ createdAt: -1 });

  // Basic analytics for dashboard cards
  const totalReturns = returns.length;
  const pendingReview = returns.filter((r) => r.status === "Pending Review").length;
  const approved = returns.filter((r) => r.status === "Approved").length;
  const rejected = returns.filter((r) => r.status === "Rejected").length;
  const pickupScheduled = returns.filter((r) => r.status === "Pickup Scheduled").length;
  const pickupCompleted = returns.filter((r) => r.status === "Pickup Completed").length;
  const productsReceived = returns.filter((r) => r.status === "Product Received").length;
  const inspectionPending = returns.filter((r) => r.status === "Quality Inspection").length;
  const refundProcessing = returns.filter((r) => r.status === "Refund Processing").length;
  const refundCompleted = returns.filter((r) => r.status === "Refund Completed").length;
  const replacementRequests = returns.filter((r) => r.returnType === "Replacement").length;
  const exchangeRequests = returns.filter((r) => r.returnType === "Exchange").length;

  res.status(200).json({
    success: true,
    returns,
    analytics: {
      totalReturns,
      pendingReview,
      approved,
      rejected,
      pickupScheduled,
      pickupCompleted,
      productsReceived,
      inspectionPending,
      refundProcessing,
      refundCompleted,
      replacementRequests,
      exchangeRequests,
    },
  });
});

// 👑 ADMIN: GET RETURN DETAILS
export const getAdminReturnDetails = catchAsyncErrors(async (req, res, next) => {
  const returnReq = await Return.findById(req.params.id)
    .populate("user", "name email")
    .populate("product", "name images price")
    .populate("order", "shippingInfo orderItems totalAmount paymentMethod");

  if (!returnReq) {
    return next(new ErrorHandler("Return request not found", 404));
  }

  res.status(200).json({
    success: true,
    return: returnReq,
  });
});

// 👑 ADMIN: UPDATE RETURN STATUS
export const updateReturnStatus = catchAsyncErrors(async (req, res, next) => {
  const { 
    status, 
    adminRemarks, 
    refundAmount, 
    pickupDate,
    pickupTime,
    courierPartner,
    trackingNumber,
    pickupRemarks,
    refundMethod,
    refundTransactionReference,
    replacementProduct,
    shippingProgress
  } = req.body;

  const returnReq = await Return.findById(req.params.id);

  if (!returnReq) {
    return next(new ErrorHandler("Return request not found", 404));
  }

  if (status === "Refund Completed") {
    const order = await Order.findById(returnReq.order);
    if (!order) {
      return next(new ErrorHandler("Order not found for this return", 404));
    }
    if (!["Refunded", "Partially Refunded"].includes(order.paymentStatus)) {
      return next(
        new ErrorHandler(
          "Confirm the provider refund from Order Management before marking this return as refunded.",
          400
        )
      );
    }
  }

  returnReq.status = status || returnReq.status;
  
  if (adminRemarks !== undefined) returnReq.adminRemarks = adminRemarks;
  if (refundAmount !== undefined) returnReq.refundAmount = refundAmount;
  if (pickupDate !== undefined) returnReq.pickupDate = pickupDate;
  if (pickupTime !== undefined) returnReq.pickupTime = pickupTime;
  if (courierPartner !== undefined) returnReq.courierPartner = courierPartner;
  if (trackingNumber !== undefined) returnReq.trackingNumber = trackingNumber;
  if (pickupRemarks !== undefined) returnReq.pickupRemarks = pickupRemarks;
  if (refundMethod !== undefined) returnReq.refundMethod = refundMethod;
  if (refundTransactionReference !== undefined) returnReq.refundTransactionReference = refundTransactionReference;
  if (replacementProduct !== undefined) returnReq.replacementProduct = replacementProduct;
  if (shippingProgress !== undefined) returnReq.shippingProgress = shippingProgress;

  returnReq.approvedBy = req.user._id;

  // Add timeline event
  let timelineMessage = `Status updated to ${status}`;
  if (status === "Approved") timelineMessage = "Return request approved. We will schedule a pickup soon.";
  if (status === "Rejected") timelineMessage = `Return request rejected. Reason: ${adminRemarks || "Not specified"}`;
  if (status === "Pickup Scheduled") timelineMessage = `Pickup scheduled for ${new Date(pickupDate).toLocaleDateString()}`;
  if (status === "Product Received") timelineMessage = "Product has been received at our facility. Quality check in progress.";
  if (status === "Refund Processing") timelineMessage = "Refund is being processed.";
  if (status === "Refund Completed") timelineMessage = `Refund of ${returnReq.refundAmount} has been completed.`;

  returnReq.timeline.push({
    status,
    message: timelineMessage,
  });

  await returnReq.save();

  // Keep the order workflow in sync with the return workflow.
  if (status === "Approved") {
    await syncOrderStatus(returnReq.order, "Return Approved", req.user, "Return request approved");
  } else if (status === "Rejected") {
    await syncOrderStatus(
      returnReq.order,
      "Return Rejected",
      req.user,
      adminRemarks || "Return request rejected"
    );
  } else if (status === "Product Received") {
    await syncOrderStatus(returnReq.order, "Returned", req.user, "Returned product received");
  } else if (status === "Refund Processing") {
    await syncOrderStatus(returnReq.order, "Refund Pending", req.user, "Refund is being processed");
  }

  res.status(200).json({
    success: true,
    return: returnReq,
  });
});
