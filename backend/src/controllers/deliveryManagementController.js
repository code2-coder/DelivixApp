import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import Shipment, { SHIPMENT_STATUSES } from "../models/shipment.js";
import Courier from "../models/courier.js";
import DeliveryZone from "../models/deliveryZone.js";
import DeliveryPincode from "../models/deliveryPincode.js";
import DeliveryPersonnel from "../models/deliveryPersonnel.js";
import DeliverySettings from "../models/deliverySettings.js";
import Order from "../models/order.js";
import InventoryService from "../services/InventoryService.js";
import * as XLSX from "xlsx";
import { checkServiceability as checkDelhiveryPincode } from "../utils/delhiveryService.js";

// Helper to ensure default shipping settings exist
export const getOrCreateDeliverySettings = async () => {
  let settings = await DeliverySettings.findOne();
  if (!settings) {
    settings = await DeliverySettings.create({});
  }
  return settings;
};

// Seed default shipping partners if courier collection is empty
export const seedDefaultCouriers = async () => {
  const count = await Courier.countDocuments();
  if (count === 0) {
    const defaults = [
      {
        name: "Delhivery",
        partnerCode: "DELHIVERY",
        contactPerson: "Enterprise Logistics Team",
        phoneNumber: "+91 124 6719500",
        email: "support@delhivery.com",
        website: "https://www.delhivery.com",
        trackingUrlTemplate: "https://www.delhivery.com/track/package/{trackingNumber}",
        serviceTypes: ["Standard", "Express", "Surface"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: false },
        isActive: true,
      },
      {
        name: "Shiprocket",
        partnerCode: "SHIPROCKET",
        contactPerson: "Courier Aggregation Desk",
        phoneNumber: "+91 92666 23006",
        email: "support@shiprocket.com",
        website: "https://www.shiprocket.in",
        trackingUrlTemplate: "https://shiprocket.co/tracking/{trackingNumber}",
        serviceTypes: ["Standard", "Express", "Air"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: true },
        isActive: true,
      },
      {
        name: "Blue Dart",
        partnerCode: "BLUEDART",
        contactPerson: "Express Dispatch Hub",
        phoneNumber: "1860 233 1234",
        email: "customerservice@bluedart.com",
        website: "https://www.bluedart.com",
        trackingUrlTemplate: "https://www.bluedart.com/tracking?handler=traking_param&numbers={trackingNumber}",
        serviceTypes: ["Express", "Air"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: true },
        isActive: true,
      },
      {
        name: "DTDC",
        partnerCode: "DTDC",
        contactPerson: "Parcel Booking Desk",
        phoneNumber: "080-25365032",
        email: "customersupport@dtdc.com",
        website: "https://www.dtdc.in",
        trackingUrlTemplate: "https://www.dtdc.in/tracking/shipment-tracking.asp?strCNNo={trackingNumber}",
        serviceTypes: ["Standard", "Express", "Surface"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: false },
        isActive: true,
      },
      {
        name: "India Post",
        partnerCode: "INDIAPOST",
        contactPerson: "Speed Post Desk",
        phoneNumber: "1800 266 6868",
        email: "support@indiapost.gov.in",
        website: "https://www.indiapost.gov.in",
        trackingUrlTemplate: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx",
        serviceTypes: ["Standard", "Surface"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: true },
        isActive: true,
      },
      {
        name: "Xpressbees",
        partnerCode: "XPRESSBEES",
        contactPerson: "eCommerce Fulfillment",
        phoneNumber: "+91 20 4911 6100",
        email: "customercare@xpressbees.com",
        website: "https://www.xpressbees.com",
        trackingUrlTemplate: "https://www.xpressbees.com/track?awbNumber={trackingNumber}",
        serviceTypes: ["Standard", "Express"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: false },
        isActive: true,
      },
      {
        name: "Ecom Express",
        partnerCode: "ECOMEXPRESS",
        contactPerson: "Last Mile Support",
        phoneNumber: "083768 88888",
        email: "care@ecomexpress.in",
        website: "https://ecomexpress.in",
        trackingUrlTemplate: "https://ecomexpress.in/tracking/?awb={trackingNumber}",
        serviceTypes: ["Standard", "Surface", "COD"],
        serviceAvailability: { allIndia: true, codAvailable: true, international: false },
        isActive: true,
      },
    ];
    await Courier.insertMany(defaults);
  }
};

// Seed default zones if empty
export const seedDefaultZones = async () => {
  const count = await DeliveryZone.countDocuments();
  if (count === 0) {
    const defaultZones = [
      {
        name: "Metro Cities (Tier 1)",
        code: "ZONE-METRO",
        states: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana", "West Bengal"],
        cities: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"],
        standardDeliveryDays: 2,
        expressDeliveryDays: 1,
        standardRate: 39,
        expressRate: 79,
        codAvailable: true,
        isActive: true,
      },
      {
        name: "North Region",
        code: "ZONE-NORTH",
        states: ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh", "Uttarakhand", "Himachal Pradesh", "Jammu and Kashmir"],
        cities: ["Jaipur", "Lucknow", "Chandigarh", "Noida", "Gurugram", "Agra", "Dehradun"],
        standardDeliveryDays: 3,
        expressDeliveryDays: 2,
        standardRate: 49,
        expressRate: 99,
        codAvailable: true,
        isActive: true,
      },
      {
        name: "South & West Region",
        code: "ZONE-SOUTHWEST",
        states: ["Gujarat", "Kerala", "Goa", "Andhra Pradesh"],
        cities: ["Surat", "Vadodara", "Kochi", "Thiruvananthapuram", "Visakhapatnam"],
        standardDeliveryDays: 3,
        expressDeliveryDays: 2,
        standardRate: 49,
        expressRate: 99,
        codAvailable: true,
        isActive: true,
      },
      {
        name: "East & North-East / Special",
        code: "ZONE-SPECIAL",
        states: ["Assam", "Bihar", "Jharkhand", "Odisha", "Meghalaya", "Manipur", "Nagaland", "Tripura"],
        cities: ["Patna", "Ranchi", "Bhubaneswar", "Guwahati"],
        standardDeliveryDays: 5,
        expressDeliveryDays: 3,
        standardRate: 69,
        expressRate: 129,
        codAvailable: true,
        isActive: true,
      },
    ];
    await DeliveryZone.insertMany(defaultZones);
  }
};

//
// 1. DELIVERY DASHBOARD OVERVIEW & ANALYTICS
//
export const getDeliveryDashboard = catchAsyncErrors(async (req, res) => {
  await seedDefaultCouriers();
  await seedDefaultZones();

  const shipments = await Shipment.find({ isArchived: false })
    .populate("order", "orderItems totalAmount paymentMethod createdAt")
    .lean();

  const countBy = (fn) => shipments.filter(fn).length;

  const totalShipments = shipments.length;
  const pendingDeliveries = countBy((s) => ["Order Confirmed", "Processing", "Shipment Created"].includes(s.status));
  const processingShipments = countBy((s) => ["Processing"].includes(s.status));
  const readyToShip = countBy((s) => ["Ready to Ship", "Ready for Pickup", "Packed"].includes(s.status));
  const shippedOrders = countBy((s) => ["Shipped", "Dispatched", "Picked Up"].includes(s.status));
  const inTransit = countBy((s) => ["In Transit"].includes(s.status));
  const outForDelivery = countBy((s) => ["Out for Delivery"].includes(s.status));
  const successfullyDelivered = countBy((s) => ["Delivered"].includes(s.status));
  const failedDeliveries = countBy((s) =>
    ["Delivery Attempt Failed", "Delivery Failed", "Delivery Attempted", "Customer Unavailable", "Rescheduled"].includes(s.status)
  );
  const returnedShipments = countBy((s) => ["Return to Origin", "Returned", "Return Received"].includes(s.status));
  const cancelledShipments = countBy((s) => ["Cancelled"].includes(s.status));

  // Calculate Average Delivery Time (days) for delivered orders
  let totalDeliveryTimeMs = 0;
  let deliveredCount = 0;
  shipments.forEach((s) => {
    if (s.status === "Delivered" && s.deliveredDate) {
      const start = s.dispatchDate || s.createdAt;
      const duration = new Date(s.deliveredDate).getTime() - new Date(start).getTime();
      if (duration > 0) {
        totalDeliveryTimeMs += duration;
        deliveredCount++;
      }
    }
  });
  const avgDeliveryTimeDays = deliveredCount > 0 ? (totalDeliveryTimeMs / (deliveredCount * 86400000)).toFixed(1) : "2.8";

  // Total shipping charges collected
  const totalShippingCharges = shipments.reduce((sum, s) => sum + Number(s.shippingCharges || 0) + Number(s.codCharges || 0), 0);

  // Time Series Chart Data (Last 14 days)
  const days = 14;
  const chartMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    chartMap[key] = {
      date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      created: 0,
      delivered: 0,
      failed: 0,
      inTransit: 0,
    };
  }

  shipments.forEach((s) => {
    const createdKey = new Date(s.createdAt).toISOString().split("T")[0];
    if (chartMap[createdKey]) {
      chartMap[createdKey].created++;
    }
    if (s.status === "Delivered" && s.deliveredDate) {
      const delKey = new Date(s.deliveredDate).toISOString().split("T")[0];
      if (chartMap[delKey]) chartMap[delKey].delivered++;
    }
    if (["Delivery Attempt Failed", "Delivery Failed", "Customer Unavailable"].includes(s.status)) {
      const fKey = new Date(s.updatedAt || s.createdAt).toISOString().split("T")[0];
      if (chartMap[fKey]) chartMap[fKey].failed++;
    }
    if (["In Transit", "Out for Delivery", "Shipped"].includes(s.status)) {
      const tKey = new Date(s.dispatchDate || s.createdAt).toISOString().split("T")[0];
      if (chartMap[tKey]) chartMap[tKey].inTransit++;
    }
  });

  const dailyTrend = Object.values(chartMap);

  // Status Distribution for Donut Chart
  const statusDistribution = [
    { name: "Delivered", value: successfullyDelivered, color: "#10b981" },
    { name: "In Transit", value: inTransit + shippedOrders, color: "#3b82f6" },
    { name: "Out for Delivery", value: outForDelivery, color: "#f59e0b" },
    { name: "Pending / Packed", value: pendingDeliveries + readyToShip, color: "#6366f1" },
    { name: "Failed / RTO", value: failedDeliveries + returnedShipments, color: "#ef4444" },
    { name: "Cancelled", value: cancelledShipments, color: "#9ca3af" },
  ].filter((i) => i.value > 0);

  // Partner Performance Comparison
  const courierStats = {};
  shipments.forEach((s) => {
    const partner = s.courierName || "Unassigned";
    if (!courierStats[partner]) {
      courierStats[partner] = { name: partner, total: 0, delivered: 0, failed: 0 };
    }
    courierStats[partner].total++;
    if (s.status === "Delivered") courierStats[partner].delivered++;
    if (["Delivery Attempt Failed", "Delivery Failed", "Returned"].includes(s.status)) courierStats[partner].failed++;
  });
  const partnerComparison = Object.values(courierStats);

  res.status(200).json({
    success: true,
    data: {
      kpis: {
        totalShipments,
        pendingDeliveries,
        processingShipments,
        readyToShip,
        shippedOrders,
        inTransit,
        outForDelivery,
        successfullyDelivered,
        failedDeliveries,
        returnedShipments,
        cancelledShipments,
        avgDeliveryTimeDays,
        totalShippingCharges,
      },
      charts: {
        dailyTrend,
        statusDistribution,
        partnerComparison,
      },
    },
  });
});

//
// 2. DELIVERY ZONES MANAGEMENT
//
export const getZones = catchAsyncErrors(async (req, res) => {
  await seedDefaultZones();
  const zones = await DeliveryZone.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, zones });
});

export const createZone = catchAsyncErrors(async (req, res) => {
  const { name, code, states, cities, standardDeliveryDays, expressDeliveryDays, standardRate, expressRate, codAvailable } = req.body;
  if (!name || !code) throw new ErrorHandler("Zone name and code are required", 400);

  const existing = await DeliveryZone.findOne({ code: code.toUpperCase() });
  if (existing) throw new ErrorHandler("Zone code already exists", 400);

  const zone = await DeliveryZone.create({
    name,
    code: code.toUpperCase(),
    states: states || [],
    cities: cities || [],
    standardDeliveryDays: Number(standardDeliveryDays) || 3,
    expressDeliveryDays: Number(expressDeliveryDays) || 1,
    standardRate: Number(standardRate) || 49,
    expressRate: Number(expressRate) || 99,
    codAvailable: codAvailable !== false,
  });

  res.status(201).json({ success: true, message: "Delivery zone created", zone });
});

export const updateZone = catchAsyncErrors(async (req, res) => {
  const zone = await DeliveryZone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!zone) throw new ErrorHandler("Zone not found", 404);
  res.status(200).json({ success: true, message: "Zone updated", zone });
});

export const deleteZone = catchAsyncErrors(async (req, res) => {
  const zone = await DeliveryZone.findByIdAndDelete(req.params.id);
  if (!zone) throw new ErrorHandler("Zone not found", 404);
  res.status(200).json({ success: true, message: "Zone deleted" });
});

//
// 3. DELIVERY PINCODES MANAGEMENT & BULK IMPORT
//
export const getPincodes = catchAsyncErrors(async (req, res) => {
  const { search, state, serviceable, cod, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [
      { pincode: new RegExp(search, "i") },
      { city: new RegExp(search, "i") },
      { state: new RegExp(search, "i") },
    ];
  }
  if (state) filter.state = new RegExp(state, "i");
  if (serviceable !== undefined) filter.isServiceable = serviceable === "true";
  if (cod !== undefined) filter.codAvailable = cod === "true";

  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));

  const [pincodes, total] = await Promise.all([
    DeliveryPincode.find(filter).sort({ pincode: 1 }).skip((p - 1) * l).limit(l).lean(),
    DeliveryPincode.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    pincodes,
    total,
    page: p,
    pages: Math.ceil(total / l),
  });
});

export const createPincode = catchAsyncErrors(async (req, res) => {
  const { pincode, city, state, zone, isServiceable, codAvailable, estimatedDays, courierPartners } = req.body;
  if (!pincode || !city || !state) throw new ErrorHandler("Pincode, city and state are required", 400);

  const existing = await DeliveryPincode.findOne({ pincode });
  if (existing) throw new ErrorHandler(`Pincode ${pincode} already exists`, 400);

  const newPincode = await DeliveryPincode.create({
    pincode,
    city,
    state,
    zone: zone || undefined,
    isServiceable: isServiceable !== false,
    codAvailable: codAvailable !== false,
    estimatedDays: Number(estimatedDays) || 3,
    courierPartners: courierPartners || ["Delhivery", "Blue Dart"],
  });

  res.status(201).json({ success: true, message: "Pincode added", pincode: newPincode });
});

export const updatePincode = catchAsyncErrors(async (req, res) => {
  const updated = await DeliveryPincode.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) throw new ErrorHandler("Pincode record not found", 404);
  res.status(200).json({ success: true, message: "Pincode updated", pincode: updated });
});

export const deletePincode = catchAsyncErrors(async (req, res) => {
  const deleted = await DeliveryPincode.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ErrorHandler("Pincode record not found", 404);
  res.status(200).json({ success: true, message: "Pincode deleted" });
});

export const bulkImportPincodes = catchAsyncErrors(async (req, res) => {
  const { pincodes } = req.body;
  if (!Array.isArray(pincodes) || pincodes.length === 0) {
    throw new ErrorHandler("Provide an array of pincode objects ({ pincode, city, state, ... })", 400);
  }

  let imported = 0;
  let updated = 0;

  for (const item of pincodes) {
    if (!item.pincode || !item.city) continue;
    const cleanPin = String(item.pincode).trim();
    const cleanCity = String(item.city).trim();
    const cleanState = String(item.state || "Maharashtra").trim();

    const result = await DeliveryPincode.findOneAndUpdate(
      { pincode: cleanPin },
      {
        city: cleanCity,
        state: cleanState,
        isServiceable: item.isServiceable !== false,
        codAvailable: item.codAvailable !== false,
        estimatedDays: Number(item.estimatedDays) || 3,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (result) imported++;
  }

  res.status(200).json({
    success: true,
    message: `Successfully processed ${imported} pincodes`,
    count: imported,
  });
});

//
// 4. DELIVERY PERSONNEL & ASSIGNMENT
//
export const getPersonnel = catchAsyncErrors(async (req, res) => {
  let personnel = await DeliveryPersonnel.find().sort({ name: 1 });
  if (!personnel || personnel.length === 0) {
    // Seed sample personnel
    const seed = [
      {
        name: "Rahul Sharma",
        phone: "+91 98201 11223",
        email: "rahul.s@delivix.com",
        vehicleNumber: "MH-02-CD-4581",
        vehicleType: "Bike",
        status: "Available",
        rating: 4.9,
        currentRoute: "South Mumbai / Colaba",
      },
      {
        name: "Amit Patil",
        phone: "+91 98202 22334",
        email: "amit.p@delivix.com",
        vehicleNumber: "MH-04-AB-9812",
        vehicleType: "Van",
        status: "On Delivery",
        rating: 4.8,
        currentRoute: "Andheri / Bandra / BKC",
      },
      {
        name: "Vikas Verma",
        phone: "+91 98203 33445",
        email: "vikas.v@delivix.com",
        vehicleNumber: "MH-03-EF-1029",
        vehicleType: "Scooter",
        status: "Available",
        rating: 4.7,
        currentRoute: "Navi Mumbai / Vashi",
      },
    ];
    personnel = await DeliveryPersonnel.insertMany(seed);
  }

  res.status(200).json({ success: true, personnel });
});

export const createPersonnel = catchAsyncErrors(async (req, res) => {
  const { name, phone, email, vehicleNumber, vehicleType, currentRoute } = req.body;
  if (!name || !phone) throw new ErrorHandler("Name and phone number are required", 400);

  const existing = await DeliveryPersonnel.findOne({ phone });
  if (existing) throw new ErrorHandler("Personnel with this phone number already exists", 400);

  const person = await DeliveryPersonnel.create({
    name,
    phone,
    email: email || "",
    vehicleNumber: vehicleNumber || "",
    vehicleType: vehicleType || "Bike",
    currentRoute: currentRoute || "",
  });

  res.status(201).json({ success: true, message: "Delivery personnel created", personnel: person });
});

export const updatePersonnel = catchAsyncErrors(async (req, res) => {
  const updated = await DeliveryPersonnel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) throw new ErrorHandler("Personnel not found", 404);
  res.status(200).json({ success: true, message: "Personnel updated", personnel: updated });
});

export const deletePersonnel = catchAsyncErrors(async (req, res) => {
  const deleted = await DeliveryPersonnel.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ErrorHandler("Personnel not found", 404);
  res.status(200).json({ success: true, message: "Personnel deleted" });
});

export const assignShipmentToPersonnel = catchAsyncErrors(async (req, res) => {
  const { shipmentId } = req.params;
  const { personnelId } = req.body;

  const [shipment, personnel] = await Promise.all([
    Shipment.findById(shipmentId),
    DeliveryPersonnel.findById(personnelId),
  ]);

  if (!shipment) throw new ErrorHandler("Shipment not found", 404);
  if (!personnel) throw new ErrorHandler("Delivery personnel not found", 404);

  shipment.assignedPersonnel = {
    personnelId: personnel._id,
    name: personnel.name,
    phone: personnel.phone,
    assignedAt: new Date(),
  };

  shipment.activityLog.push({
    action: `Assigned to delivery agent ${personnel.name} (${personnel.phone})`,
    adminName: req.user?.name || "Admin",
    performedBy: req.user?._id,
  });

  await shipment.save();

  // Increment assigned orders on personnel
  await DeliveryPersonnel.findByIdAndUpdate(personnelId, {
    $inc: { assignedOrdersCount: 1 },
    status: "On Delivery",
  });

  res.status(200).json({ success: true, message: `Assigned to ${personnel.name}`, shipment });
});

//
// 5. FAILED DELIVERIES & RETURN MANAGEMENT (RTO)
//
export const getFailedDeliveries = catchAsyncErrors(async (req, res) => {
  const failedStatuses = [
    "Delivery Attempt Failed",
    "Delivery Failed",
    "Delivery Attempted",
    "Customer Unavailable",
    "Rescheduled",
    "Return to Origin",
    "Returned",
    "Return Received",
  ];

  const shipments = await Shipment.find({
    status: { $in: failedStatuses },
    isArchived: false,
  })
    .populate("order", "orderItems totalAmount paymentMethod")
    .sort({ updatedAt: -1 })
    .lean();

  res.status(200).json({ success: true, shipments });
});

export const reattemptDelivery = catchAsyncErrors(async (req, res) => {
  const { shipmentId } = req.params;
  const { nextAttemptDate, remarks, reason } = req.body;

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new ErrorHandler("Shipment not found", 404);

  const prevStatus = shipment.status;
  shipment.status = "Out for Delivery";
  shipment.reattemptCount = (shipment.reattemptCount || 0) + 1;
  shipment.failedDeliveryReason = reason || shipment.failedDeliveryReason || "";
  if (nextAttemptDate) shipment.nextDeliveryAttemptDate = new Date(nextAttemptDate);

  shipment.statusHistory.push({
    status: "Out for Delivery",
    remark: remarks || `Reattempt #${shipment.reattemptCount} scheduled for ${nextAttemptDate || "today"}`,
    adminName: req.user?.name || "Admin",
    updatedBy: req.user?._id,
  });

  shipment.activityLog.push({
    action: "Delivery reattempt initiated",
    previousValue: prevStatus,
    newValue: "Out for Delivery",
    adminName: req.user?.name || "Admin",
    performedBy: req.user?._id,
  });

  await shipment.save();

  res.status(200).json({ success: true, message: "Delivery reattempt recorded", shipment });
});

export const processRto = catchAsyncErrors(async (req, res) => {
  const { shipmentId } = req.params;
  const { reason, remarks, restoreStock = true } = req.body;

  const shipment = await Shipment.findById(shipmentId).populate("order");
  if (!shipment) throw new ErrorHandler("Shipment not found", 404);

  const prevStatus = shipment.status;
  shipment.status = "Return to Origin";
  shipment.failedDeliveryReason = reason || "Customer Refused / Undeliverable";
  shipment.returnInfo = {
    returnDate: new Date(),
    returnReason: reason || "RTO after failed delivery attempts",
    packageCondition: "Good",
    internalRemarks: remarks || "",
  };

  shipment.statusHistory.push({
    status: "Return to Origin",
    remark: remarks || `Package marked Return to Origin (Reason: ${reason || "Undeliverable"})`,
    adminName: req.user?.name || "Admin",
    updatedBy: req.user?._id,
  });

  await shipment.save();

  // If order items should have their stock restored:
  if (restoreStock && shipment.order) {
    try {
      const order = await Order.findById(shipment.order._id);
      if (order && (!order.inventory || !order.inventory.restoredAt)) {
        await InventoryService.restoreItems({
          orderId: order._id,
          items: order.orderItems,
          reason: `RTO / Return: ${reason || "Failed delivery"}`,
          actor: req.user,
        });
        order.inventory = order.inventory || {};
        order.inventory.restoredAt = new Date();
        await order.save();
      }
    } catch (e) {
      console.warn("Inventory restoration during RTO logged warning:", e.message);
    }
  }

  res.status(200).json({ success: true, message: "Shipment marked as Return to Origin", shipment });
});

//
// 6. DELIVERY SETTINGS (CONFIGURABLE SHIPPING CHARGES & RULES)
//
export const getDeliverySettings = catchAsyncErrors(async (req, res) => {
  const settings = await getOrCreateDeliverySettings();
  res.status(200).json({ success: true, settings });
});

export const updateDeliverySettings = catchAsyncErrors(async (req, res) => {
  const settings = await getOrCreateDeliverySettings();
  Object.assign(settings, req.body);
  await settings.save();
  res.status(200).json({ success: true, message: "Delivery settings updated", settings });
});

//
// 7. PUBLIC LIVE ORDER TRACKING & PINCODE SERVICEABILITY
//
export const getPublicTracking = catchAsyncErrors(async (req, res) => {
  const { identifier } = req.params;
  const { phone } = req.query;

  const cleanId = String(identifier).trim();
  const filter = {
    $or: [
      { trackingNumber: cleanId },
      { awbNumber: cleanId },
      { shipmentId: cleanId },
    ],
  };

  // If identifier looks like a Mongo ObjectId, also check order ID
  if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
    filter.$or.push({ order: cleanId });
  }

  let shipment = await Shipment.findOne(filter)
    .populate("order", "orderItems totalAmount paymentMethod createdAt orderStatus orderNumber")
    .lean();

  if (!shipment) {
    // Try finding by Order Number
    const order = await Order.findOne({
      $or: [{ orderNumber: cleanId }, { _id: /^[0-9a-fA-F]{24}$/.test(cleanId) ? cleanId : null }],
    }).lean();

    if (order) {
      shipment = await Shipment.findOne({ order: order._id }).lean();
      if (shipment) shipment.order = order;
    }
  }

  if (!shipment) {
    throw new ErrorHandler("No shipment or order found with this tracking ID", 404);
  }

  // Security check: if searched by Order ID, verify phone number if provided or return masked info
  if (phone && shipment.customerPhone) {
    const cleanPhone = String(phone).replace(/\D/g, "");
    const cleanShipPhone = String(shipment.customerPhone).replace(/\D/g, "");
    if (!cleanShipPhone.endsWith(cleanPhone) && !cleanPhone.endsWith(cleanShipPhone)) {
      throw new ErrorHandler("Phone number does not match shipment record", 403);
    }
  }

  // Construct customer-safe public response
  const trackingData = {
    shipmentId: shipment.shipmentId,
    orderId: shipment.order?._id || shipment.order,
    status: shipment.status,
    courierName: shipment.courierName || "Standard Logistics Partner",
    trackingNumber: shipment.trackingNumber || shipment.awbNumber || "N/A",
    trackingUrl: shipment.trackingUrl || "",
    shippingMethod: shipment.shippingMethod || "standard",
    orderDate: shipment.orderDate || shipment.createdAt,
    dispatchDate: shipment.dispatchDate || null,
    estimatedDeliveryDate: shipment.estimatedDeliveryDate || null,
    deliveredDate: shipment.deliveredDate || null,
    destinationCity: shipment.shippingAddress?.city || "",
    destinationPinCode: shipment.shippingAddress?.pincode ? `${shipment.shippingAddress.pincode.slice(0, 3)}***` : "",
    statusHistory: (shipment.statusHistory || []).map((h) => ({
      status: h.status,
      date: h.date,
      time: h.time,
      remark: h.remark,
      location: h.location,
    })),
    items: (shipment.order?.orderItems || []).map((it) => ({
      name: it.name,
      quantity: it.quantity,
      image: it.image,
    })),
  };

  res.status(200).json({ success: true, tracking: trackingData });
});

export const checkPincodeServiceability = catchAsyncErrors(async (req, res) => {
  const { pincode } = req.params;
  const cleanPin = String(pincode).trim();

  // 1. Check local database first
  const dbPin = await DeliveryPincode.findOne({ pincode: cleanPin }).lean();
  if (dbPin) {
    return res.status(200).json({
      success: true,
      serviceable: dbPin.isServiceable,
      city: dbPin.city,
      state: dbPin.state,
      codAvailable: dbPin.codAvailable,
      prepaidAvailable: dbPin.prepaidAvailable,
      estimatedDays: dbPin.estimatedDays,
      courierPartners: dbPin.courierPartners,
    });
  }

  // 2. Fall back to Delhivery API or default zone logic
  try {
    const delhiveryRes = await checkDelhiveryPincode(cleanPin);
    if (delhiveryRes && delhiveryRes.isServiceable) {
      return res.status(200).json({
        success: true,
        serviceable: true,
        city: delhiveryRes.city || "Urban Hub",
        state: delhiveryRes.state || "State",
        codAvailable: delhiveryRes.cod !== false,
        prepaidAvailable: true,
        estimatedDays: 3,
        courierPartners: ["Delhivery"],
      });
    }
  } catch (e) {
    // Continue to standard fallback
  }

  // 3. Standard fallback: standard 6-digit Indian pincode format check
  const isValidFormat = /^[1-9][0-9]{5}$/.test(cleanPin);
  res.status(200).json({
    success: true,
    serviceable: isValidFormat,
    city: isValidFormat ? "Serviceable Hub" : "Unknown",
    state: "India",
    codAvailable: isValidFormat,
    prepaidAvailable: isValidFormat,
    estimatedDays: 4,
    courierPartners: ["Standard Logistics"],
  });
});

export const calculateShippingQuote = catchAsyncErrors(async (req, res) => {
  const { pincode, shippingMethod = "standard", orderTotal = 0, weightKg = 0.5 } = req.body;
  const settings = await getOrCreateDeliverySettings();

  const total = Number(orderTotal) || 0;
  let isFreeShipping = false;
  let shippingFee = shippingMethod === "express" ? settings.expressShippingFee : settings.standardShippingFee;

  if (shippingMethod === "standard" && total >= settings.freeShippingThreshold) {
    shippingFee = 0;
    isFreeShipping = true;
  }

  // Additional weight charge if weight exceeds base
  let weightSurcharge = 0;
  if (settings.weightRules && settings.weightRules.length > 0) {
    const rule = settings.weightRules.find((r) => weightKg >= r.minWeightKg && weightKg <= r.maxWeightKg);
    if (rule) weightSurcharge = rule.additionalCharge || 0;
  }

  const codCharge = settings.codFee || 0;

  res.status(200).json({
    success: true,
    shippingFee,
    weightSurcharge,
    codCharge,
    totalShippingFee: shippingFee + weightSurcharge,
    isFreeShipping,
    estimatedDays: shippingMethod === "express" ? 1 : 3,
  });
});

//
// 8. DELIVERY REPORTS & EXCEL / CSV EXPORT
//
export const getDeliveryReports = catchAsyncErrors(async (req, res) => {
  const { reportType = "shipments", format = "json", dateFrom, dateTo } = req.query;

  const filter = { isArchived: false };
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const shipments = await Shipment.find(filter)
    .populate("order", "orderItems totalAmount paymentMethod")
    .sort({ createdAt: -1 })
    .lean();

  let headers = [];
  let rows = [];
  let sheetName = "Shipment Report";

  switch (reportType) {
    case "delivered": {
      sheetName = "Delivered Orders";
      headers = ["Shipment ID", "Order ID", "Customer Name", "Customer Phone", "Courier", "Tracking Number", "Payment Type", "Dispatched Date", "Delivered Date", "Delivery Time (Days)"];
      rows = shipments
        .filter((s) => s.status === "Delivered")
        .map((s) => {
          const days = s.deliveredDate && (s.dispatchDate || s.createdAt)
            ? ((new Date(s.deliveredDate) - new Date(s.dispatchDate || s.createdAt)) / 86400000).toFixed(1)
            : "N/A";
          return [
            s.shipmentId,
            String(s.order?._id || s.order || ""),
            s.customerName,
            s.customerPhone,
            s.courierName || "N/A",
            s.trackingNumber || s.awbNumber || "N/A",
            s.paymentType,
            s.dispatchDate ? new Date(s.dispatchDate).toISOString().slice(0, 10) : "",
            s.deliveredDate ? new Date(s.deliveredDate).toISOString().slice(0, 10) : "",
            days,
          ];
        });
      break;
    }

    case "failed_returns": {
      sheetName = "Failed Deliveries & RTO";
      headers = ["Shipment ID", "Customer", "Phone", "Status", "Reason", "Reattempts", "Courier", "Tracking #", "Address", "City", "Pincode"];
      rows = shipments
        .filter((s) =>
          ["Delivery Attempt Failed", "Delivery Failed", "Customer Unavailable", "Return to Origin", "Returned"].includes(s.status)
        )
        .map((s) => [
          s.shipmentId,
          s.customerName,
          s.customerPhone,
          s.status,
          s.failedDeliveryReason || "Undelivered",
          s.reattemptCount || 0,
          s.courierName || "N/A",
          s.trackingNumber || "N/A",
          s.shippingAddress?.addressLine1 || "",
          s.shippingAddress?.city || "",
          s.shippingAddress?.pincode || "",
        ]);
      break;
    }

    case "partners": {
      sheetName = "Partner Performance";
      const partnerStats = {};
      shipments.forEach((s) => {
        const p = s.courierName || "Unassigned";
        if (!partnerStats[p]) {
          partnerStats[p] = { name: p, total: 0, delivered: 0, failed: 0, transit: 0 };
        }
        partnerStats[p].total++;
        if (s.status === "Delivered") partnerStats[p].delivered++;
        else if (["Delivery Attempt Failed", "Delivery Failed", "Returned"].includes(s.status)) partnerStats[p].failed++;
        else partnerStats[p].transit++;
      });
      headers = ["Partner Name", "Total Booked", "Delivered", "In Transit", "Failed / RTO", "Success Rate (%)"];
      rows = Object.values(partnerStats).map((st) => [
        st.name,
        st.total,
        st.delivered,
        st.transit,
        st.failed,
        st.total > 0 ? ((st.delivered / st.total) * 100).toFixed(1) + "%" : "0%",
      ]);
      break;
    }

    case "shipments":
    default: {
      headers = ["Shipment ID", "Order ID", "Customer", "Phone", "City", "Pincode", "Status", "Courier", "Tracking #", "Payment", "Order Amount", "Created Date"];
      rows = shipments.map((s) => [
        s.shipmentId,
        String(s.order?._id || s.order || ""),
        s.customerName,
        s.customerPhone,
        s.shippingAddress?.city || "",
        s.shippingAddress?.pincode || "",
        s.status,
        s.courierName || "N/A",
        s.trackingNumber || s.awbNumber || "N/A",
        s.paymentType,
        s.order?.totalAmount || 0,
        new Date(s.createdAt).toISOString().slice(0, 10),
      ]);
      break;
    }
  }

  if (format === "csv") {
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "");
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${sheetName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${sheetName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.xlsx"`);
    return res.status(200).send(buffer);
  }

  res.status(200).json({ success: true, sheetName, headers, rows });
});

