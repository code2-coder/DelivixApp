import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import Shipment, { SHIPMENT_STATUSES } from "../models/shipment.js";
import Courier from "../models/courier.js";
import Order from "../models/order.js";
import OrderService from "../services/OrderService.js";
import ErrorHandler from "../utils/errorHandler.js";
import { buildCourierTrackingUrl } from "../utils/tracking.js";

const generateShipmentId = () =>
  `SHP-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;

const formatTime = (date = new Date()) =>
  date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const logActivity = (shipment, action, user, previousValue, newValue) => {
  shipment.activityLog.push({
    action,
    adminName: user.name,
    performedBy: user._id,
    previousValue: previousValue ?? undefined,
    newValue: newValue ?? undefined,
  });
};

const TRACKING_ACTIVE_STATUSES = [
  "Picked Up", "Dispatched", "In Transit", "Arrived at Hub",
  "Out for Delivery", "Delivery Failed", "Delivery Attempted",
  "Customer Unavailable", "Rescheduled", "Delivered",
];

const syncTrackingToOrder = async (shipment, overrideStatus) => {
  const status = overrideStatus || shipment.status;
  if (!shipment.order) return;

  const trackingId = shipment.trackingNumber || shipment.awbNumber || null;
  if (!trackingId && !TRACKING_ACTIVE_STATUSES.includes(status)) return;

  const trackingUrl = buildCourierTrackingUrl(shipment.courierName, shipment.trackingNumber);
  const updatePayload = { shipment: shipment._id };
  if (trackingId) updatePayload.trackingId = trackingId;
  if (trackingUrl) updatePayload.trackingUrl = trackingUrl;
  if (shipment.awbNumber) updatePayload.awbNumber = shipment.awbNumber;
  if (shipment.courierName) updatePayload.courierName = shipment.courierName;
  if (shipment.dispatchDate) updatePayload.shipmentDate = shipment.dispatchDate;
  if (shipment.estimatedDeliveryDate) updatePayload.estimatedDeliveryDate = shipment.estimatedDeliveryDate;

  await Order.findByIdAndUpdate(shipment.order, updatePayload);

  if (TRACKING_ACTIVE_STATUSES.includes(status)) {
    const actor = shipment.createdBy
      ? { _id: shipment.createdBy, name: shipment.createdByName }
      : undefined;
    await OrderService.syncShipmentStatus(
      shipment.order,
      status,
      actor,
      `Courier status: ${status}`
    );
  }
};

const buildAnalytics = (shipments) => {
  const countByStatus = (status) =>
    shipments.filter((s) => s.status === status).length;

  return {
    totalShipments: shipments.length,
    pendingDispatch: countByStatus("Shipment Created"),
    packed: countByStatus("Packed"),
    readyForPickup: countByStatus("Ready for Pickup"),
    dispatched: countByStatus("Dispatched"),
    inTransit: countByStatus("In Transit"),
    outForDelivery: countByStatus("Out for Delivery"),
    delivered: countByStatus("Delivered"),
    returned: countByStatus("Returned") + countByStatus("Return Received"),
    cancelled: countByStatus("Cancelled"),
  };
};

const buildChartData = (shipments) => {
  const dailyMap = {};
  const monthlyMap = {};
  const courierMap = {};
  const statusMap = {};

  shipments.forEach((s) => {
    const created = new Date(s.createdAt);
    const dayKey = created.toISOString().split("T")[0];
    const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;

    dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;

    const courier = s.courierName || "Unassigned";
    courierMap[courier] = (courierMap[courier] || 0) + 1;
    statusMap[s.status] = (statusMap[s.status] || 0) + 1;
  });

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    last7Days.push({
      date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      count: dailyMap[key] || 0,
    });
  }

  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  const courierWise = Object.entries(courierMap).map(([name, count]) => ({
    name,
    count,
  }));

  const statusDistribution = Object.entries(statusMap).map(([name, count]) => ({
    name,
    count,
  }));

  return { daily: last7Days, monthly, courierWise, statusDistribution };
};

const populateShipment = (query) =>
  query
    .populate("order", "orderItems totalAmount paymentMethod createdAt orderStatus")
    .populate("courierProvider", "name phoneNumber email website")
    .populate("createdBy", "name email");

const validateDates = (body) => {
  const { orderDate, dispatchDate, deliveredDate } = body;
  if (orderDate && dispatchDate && new Date(dispatchDate) < new Date(orderDate)) {
    return "Dispatch date cannot be earlier than order date";
  }
  if (dispatchDate && deliveredDate && new Date(deliveredDate) < new Date(dispatchDate)) {
    return "Delivered date cannot be earlier than dispatch date";
  }
  return null;
};

const mapOrderPaymentType = (paymentMethod) =>
  paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid";

// GET all shipments with analytics
export const getAllShipments = catchAsyncErrors(async (req, res) => {
  const {
    search,
    status,
    courier,
    paymentType,
    state,
    city,
    dateFrom,
    dateTo,
    sort = "latest",
    includeArchived,
  } = req.query;

  const filter = {};
  if (includeArchived !== "true") filter.isArchived = false;

  if (status) filter.status = status;
  if (courier) filter.courierProvider = courier;
  if (paymentType) filter.paymentType = paymentType;
  if (state) filter["shippingAddress.state"] = new RegExp(state, "i");
  if (city) filter["shippingAddress.city"] = new RegExp(city, "i");

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search?.trim()) {
    const q = search.trim();
    filter.$or = [
      { shipmentId: new RegExp(q, "i") },
      { customerName: new RegExp(q, "i") },
      { customerPhone: new RegExp(q, "i") },
      { trackingNumber: new RegExp(q, "i") },
      { awbNumber: new RegExp(q, "i") },
    ];
  }

  let sortOption = { createdAt: -1 };
  if (sort === "oldest") sortOption = { createdAt: 1 };
  if (sort === "dispatch") sortOption = { dispatchDate: -1 };
  if (sort === "delivery") sortOption = { deliveredDate: -1 };

  const shipments = await populateShipment(
    Shipment.find(filter).sort(sortOption)
  );

  const activeShipments = shipments.filter((s) => !s.isArchived);
  const analytics = buildAnalytics(activeShipments);
  const charts = buildChartData(activeShipments);

  res.status(200).json({ success: true, shipments, analytics, charts });
});

// GET orders available for shipment creation
export const getOrdersForShipment = catchAsyncErrors(async (req, res) => {
  // Find all order IDs that already have an active (non-archived) shipment
  const existingShipments = await Shipment.find({ isArchived: false }).select("order").lean();
  const shippedOrderIds = existingShipments.map((s) => String(s.order));

  // Exclude orders that already have a shipment
  const orders = await Order.find({ _id: { $nin: shippedOrderIds } })
    .populate("user", "name email phoneNumber addresses")
    .sort({ createdAt: -1 })
    .limit(200);

  res.status(200).json({ success: true, orders });
});

// GET single shipment
export const getShipmentDetails = catchAsyncErrors(async (req, res, next) => {
  const shipment = await populateShipment(Shipment.findById(req.params.id));

  if (!shipment) {
    return next(new ErrorHandler("Shipment not found", 404));
  }

  res.status(200).json({ success: true, shipment });
});

// CREATE shipment
export const createShipment = catchAsyncErrors(async (req, res, next) => {
  const dateError = validateDates(req.body);
  if (dateError) return next(new ErrorHandler(dateError, 400));

  const { orderId, trackingNumber, awbNumber, courierProvider, shipmentId } = req.body;

  const order = await Order.findById(orderId).populate("user", "name email phoneNumber");
  if (!order) return next(new ErrorHandler("Order not found", 404));

  let finalShipmentId = shipmentId?.trim();
  if (finalShipmentId) {
    const existingShipmentId = await Shipment.findOne({ shipmentId: finalShipmentId, isArchived: false });
    if (existingShipmentId) {
      return next(new ErrorHandler("Shipment ID already exists", 400));
    }
  } else {
    finalShipmentId = generateShipmentId();
  }

  if (trackingNumber) {
    const existing = await Shipment.findOne({ trackingNumber, isArchived: false });
    if (existing) return next(new ErrorHandler("Tracking number already exists", 400));
  }

  if (awbNumber) {
    const existing = await Shipment.findOne({ awbNumber, isArchived: false });
    if (existing) return next(new ErrorHandler("AWB number already exists", 400));
  }

  let courierName = req.body.courierName;
  if (courierProvider) {
    const courier = await Courier.findById(courierProvider);
    if (courier) courierName = courier.name;
  }

  const now = new Date();
  const shipmentData = {
    shipmentId: finalShipmentId,
    order: orderId,
    customerName: req.body.customerName || order.shippingInfo?.fullName || order.user?.name,
    customerPhone: req.body.customerPhone || order.shippingInfo?.phoneNo,
    customerEmail: req.body.customerEmail || order.user?.email,
    shippingAddress: req.body.shippingAddress || {
      fullName: order.shippingInfo.fullName,
      mobileNumber: order.shippingInfo.phoneNo,
      addressLine1: order.shippingInfo.address,
      city: order.shippingInfo.city,
      country: order.shippingInfo.country,
      pincode: order.shippingInfo.zipCode,
    },
    courierProvider: courierProvider || undefined,
    courierName,
    trackingNumber: trackingNumber || undefined,
    awbNumber: awbNumber || undefined,
    shippingMethod: req.body.shippingMethod || order.shippingMethod || "standard",
    packageWeight: req.body.packageWeight,
    packageDimensions: req.body.packageDimensions,
    numberOfPackages: req.body.numberOfPackages || 1,
    orderDate: req.body.orderDate || order.createdAt,
    packingDate: req.body.packingDate,
    dispatchDate: req.body.dispatchDate,
    estimatedDeliveryDate: req.body.estimatedDeliveryDate,
    deliveredDate: req.body.deliveredDate,
    paymentType: req.body.paymentType || mapOrderPaymentType(order.paymentMethod),
    status: req.body.status || "Shipment Created",
    remarks: req.body.remarks,
    specialInstructions: req.body.specialInstructions,
    createdBy: req.user._id,
    createdByName: req.user.name,
    statusHistory: [
      {
        status: req.body.status || "Shipment Created",
        date: now,
        time: formatTime(now),
        remark: "Shipment record created",
        updatedBy: req.user._id,
        adminName: req.user.name,
      },
    ],
    activityLog: [
      {
        action: "Shipment Created",
        adminName: req.user.name,
        performedBy: req.user._id,
        newValue: generateShipmentId(),
      },
    ],
  };

  // Fix activity log newValue with actual shipmentId
  shipmentData.activityLog[0].newValue = shipmentData.shipmentId;

  const shipment = await Shipment.create(shipmentData);
  await syncTrackingToOrder(shipment);
  const populated = await populateShipment(Shipment.findById(shipment._id));

  res.status(201).json({ success: true, shipment: populated });
});

// UPDATE shipment
export const updateShipment = catchAsyncErrors(async (req, res, next) => {
  const dateError = validateDates(req.body);
  if (dateError) return next(new ErrorHandler(dateError, 400));

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));
  if (shipment.isArchived) return next(new ErrorHandler("Cannot edit archived shipment", 400));

  const { trackingNumber, awbNumber, courierProvider, shipmentId } = req.body;

  if (shipmentId && shipmentId !== shipment.shipmentId) {
    const existing = await Shipment.findOne({
      shipmentId,
      isArchived: false,
      _id: { $ne: shipment._id },
    });
    if (existing) return next(new ErrorHandler("Shipment ID already exists", 400));
    logActivity(shipment, "Shipment ID Changed", req.user, shipment.shipmentId, shipmentId);
    shipment.shipmentId = shipmentId;
  }

  if (trackingNumber && trackingNumber !== shipment.trackingNumber) {
    const existing = await Shipment.findOne({
      trackingNumber,
      isArchived: false,
      _id: { $ne: shipment._id },
    });
    if (existing) return next(new ErrorHandler("Tracking number already exists", 400));
    logActivity(shipment, "Tracking Number Changed", req.user, shipment.trackingNumber, trackingNumber);
    shipment.trackingNumber = trackingNumber;
  }

  if (awbNumber && awbNumber !== shipment.awbNumber) {
    const existing = await Shipment.findOne({
      awbNumber,
      isArchived: false,
      _id: { $ne: shipment._id },
    });
    if (existing) return next(new ErrorHandler("AWB number already exists", 400));
    logActivity(shipment, "AWB Number Changed", req.user, shipment.awbNumber, awbNumber);
    shipment.awbNumber = awbNumber;
  }

  const editableFields = [
    "customerName", "customerPhone", "customerEmail", "shippingAddress",
    "shippingMethod", "packageWeight", "packageDimensions", "numberOfPackages",
    "orderDate", "packingDate", "dispatchDate", "estimatedDeliveryDate",
    "deliveredDate", "paymentType", "remarks", "specialInstructions", "returnInfo",
  ];

  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) shipment[field] = req.body[field];
  });

  if (courierProvider !== undefined) {
    shipment.courierProvider = courierProvider || null;
    if (courierProvider) {
      const courier = await Courier.findById(courierProvider);
      if (courier) {
        logActivity(shipment, "Courier Updated", req.user, shipment.courierName, courier.name);
        shipment.courierName = courier.name;
      }
    }
  }

  logActivity(shipment, "Shipment Edited", req.user);
  await shipment.save();

  // Sync tracking to Order if shipment already has an active status and tracking data
  await syncTrackingToOrder(shipment);

  const populated = await populateShipment(Shipment.findById(shipment._id));
  res.status(200).json({ success: true, shipment: populated });
});

// UPDATE status
export const updateShipmentStatus = catchAsyncErrors(async (req, res, next) => {
  const { status, remark, date, time } = req.body;

  if (!status || !SHIPMENT_STATUSES.includes(status)) {
    return next(new ErrorHandler("Invalid shipment status", 400));
  }

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));
  if (shipment.isArchived) return next(new ErrorHandler("Cannot update archived shipment", 400));

  const previousStatus = shipment.status;
  const statusDate = date ? new Date(date) : new Date();

  shipment.status = status;
  shipment.statusHistory.push({
    status,
    date: statusDate,
    time: time || formatTime(statusDate),
    remark,
    updatedBy: req.user._id,
    adminName: req.user.name,
  });

  if (status === "Delivered" && !shipment.deliveredDate) {
    shipment.deliveredDate = statusDate;
  }
  if (status === "Dispatched" && !shipment.dispatchDate) {
    shipment.dispatchDate = statusDate;
  }
  if (status === "Packed" && !shipment.packingDate) {
    shipment.packingDate = statusDate;
  }

  logActivity(shipment, "Status Updated", req.user, previousStatus, status);
  await shipment.save();

  // Sync tracking info to linked Order
  await syncTrackingToOrder(shipment, status);

  const populated = await populateShipment(Shipment.findById(shipment._id));
  res.status(200).json({ success: true, shipment: populated });
});

// ADD note
// FORCE SYNC tracking from shipment → Order (backfill / manual trigger)
export const syncTrackingNow = catchAsyncErrors(async (req, res, next) => {
  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));

  await syncTrackingToOrder(shipment);

  res.status(200).json({ success: true, message: "Tracking synced to order successfully" });
});

// ADD note
export const addShipmentNote = catchAsyncErrors(async (req, res, next) => {
  const { note } = req.body;
  if (!note?.trim()) return next(new ErrorHandler("Note is required", 400));

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));

  shipment.notes.push({
    note: note.trim(),
    adminName: req.user.name,
    createdBy: req.user._id,
  });

  logActivity(shipment, "Note Added", req.user, null, note.trim());
  await shipment.save();

  const populated = await populateShipment(Shipment.findById(shipment._id));
  res.status(200).json({ success: true, shipment: populated });
});

// ADD delivery proof
export const addDeliveryProof = catchAsyncErrors(async (req, res, next) => {
  const { type, url, publicId } = req.body;
  if (!type || !url) return next(new ErrorHandler("Proof type and URL are required", 400));

  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));

  shipment.deliveryProof.push({
    type,
    url,
    publicId,
    uploadedBy: req.user._id,
    adminName: req.user.name,
  });

  logActivity(shipment, "Delivery Proof Uploaded", req.user, null, type);
  await shipment.save();

  const populated = await populateShipment(Shipment.findById(shipment._id));
  res.status(200).json({ success: true, shipment: populated });
});

// DUPLICATE shipment
export const duplicateShipment = catchAsyncErrors(async (req, res, next) => {
  const original = await Shipment.findById(req.params.id);
  if (!original) return next(new ErrorHandler("Shipment not found", 404));

  const newId = generateShipmentId();
  const now = new Date();

  const duplicate = await Shipment.create({
    shipmentId: newId,
    order: original.order,
    customerName: original.customerName,
    customerPhone: original.customerPhone,
    customerEmail: original.customerEmail,
    shippingAddress: original.shippingAddress,
    courierProvider: original.courierProvider,
    courierName: original.courierName,
    shippingMethod: original.shippingMethod,
    packageWeight: original.packageWeight,
    packageDimensions: original.packageDimensions,
    numberOfPackages: original.numberOfPackages,
    orderDate: original.orderDate,
    paymentType: original.paymentType,
    status: "Shipment Created",
    remarks: original.remarks,
    specialInstructions: original.specialInstructions,
    createdBy: req.user._id,
    createdByName: req.user.name,
    statusHistory: [
      {
        status: "Shipment Created",
        date: now,
        time: formatTime(now),
        remark: `Duplicated from ${original.shipmentId}`,
        updatedBy: req.user._id,
        adminName: req.user.name,
      },
    ],
    activityLog: [
      {
        action: "Shipment Created",
        adminName: req.user.name,
        performedBy: req.user._id,
        newValue: `Duplicated from ${original.shipmentId}`,
      },
    ],
  });

  const populated = await populateShipment(Shipment.findById(duplicate._id));
  res.status(201).json({ success: true, shipment: populated });
});

// SOFT DELETE (archive)
export const deleteShipment = catchAsyncErrors(async (req, res, next) => {
  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) return next(new ErrorHandler("Shipment not found", 404));

  shipment.isArchived = true;
  shipment.archivedAt = new Date();
  shipment.archivedBy = req.user._id;
  logActivity(shipment, "Shipment Deleted", req.user);
  await shipment.save();

  res.status(200).json({ success: true, message: "Shipment archived successfully" });
});

// BULK actions
export const bulkShipmentAction = catchAsyncErrors(async (req, res, next) => {
  const { ids, action, status, courierProvider } = req.body;

  if (!ids?.length) return next(new ErrorHandler("No shipments selected", 400));

  const shipments = await Shipment.find({ _id: { $in: ids }, isArchived: false });

  if (action === "delete") {
    await Shipment.updateMany(
      { _id: { $in: ids } },
      { isArchived: true, archivedAt: new Date(), archivedBy: req.user._id }
    );
    return res.status(200).json({ success: true, message: `${shipments.length} shipments archived` });
  }

  if (action === "updateStatus" && status) {
    const now = new Date();
    for (const shipment of shipments) {
      const prev = shipment.status;
      shipment.status = status;
      shipment.statusHistory.push({
        status,
        date: now,
        time: formatTime(now),
        remark: "Bulk status update",
        updatedBy: req.user._id,
        adminName: req.user.name,
      });
      logActivity(shipment, "Status Updated", req.user, prev, status);
      await shipment.save();
    }
    return res.status(200).json({ success: true, message: `Status updated for ${shipments.length} shipments` });
  }

  if (action === "changeCourier" && courierProvider) {
    const courier = await Courier.findById(courierProvider);
    if (!courier) return next(new ErrorHandler("Courier not found", 404));

    for (const shipment of shipments) {
      logActivity(shipment, "Courier Updated", req.user, shipment.courierName, courier.name);
      shipment.courierProvider = courier._id;
      shipment.courierName = courier.name;
      await shipment.save();
    }
    return res.status(200).json({ success: true, message: `Courier updated for ${shipments.length} shipments` });
  }

  return next(new ErrorHandler("Invalid bulk action", 400));
});

// EXPORT shipments as JSON (frontend handles CSV/PDF)
export const exportShipments = catchAsyncErrors(async (req, res) => {
  const filter = { isArchived: false };
  const shipments = await populateShipment(Shipment.find(filter).sort({ createdAt: -1 }));

  res.status(200).json({ success: true, shipments });
});

export { SHIPMENT_STATUSES };
