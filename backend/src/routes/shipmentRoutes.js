import express from "express";
import {
  getAllShipments,
  getOrdersForShipment,
  getShipmentDetails,
  createShipment,
  updateShipment,
  updateShipmentStatus,
  syncTrackingNow,
  addShipmentNote,
  addDeliveryProof,
  duplicateShipment,
  deleteShipment,
  bulkShipmentAction,
  exportShipments,
} from "../controllers/shipmentController.js";
import {
  getAllCouriers,
  createCourier,
  updateCourier,
  toggleCourier,
  deleteCourier,
} from "../controllers/courierController.js";
import {
  getDeliveryDashboard,
  getZones,
  createZone,
  updateZone,
  deleteZone,
  getPincodes,
  createPincode,
  updatePincode,
  deletePincode,
  bulkImportPincodes,
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  deletePersonnel,
  assignShipmentToPersonnel,
  getFailedDeliveries,
  reattemptDelivery,
  processRto,
  getDeliverySettings,
  updateDeliverySettings,
  getPublicTracking,
  checkPincodeServiceability,
  calculateShippingQuote,
  getDeliveryReports,
} from "../controllers/deliveryManagementController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

const adminOrStaff = authorizeRoles("admin", "staff");
const adminOnly = authorizeRoles("admin");

// -------------------------------------------------------------
// PUBLIC DELIVERY ENDPOINTS (Storefront, Checkout, Tracking)
// -------------------------------------------------------------
router.get("/shipments/track/:identifier", getPublicTracking);
router.get("/shipments/check-pincode/:pincode", checkPincodeServiceability);
router.post("/shipments/calculate-shipping", calculateShippingQuote);

// -------------------------------------------------------------
// ADMIN DELIVERY DASHBOARD & OVERVIEW
// -------------------------------------------------------------
router.get("/admin/delivery/dashboard", isAuthenticatedUser, adminOrStaff, getDeliveryDashboard);
router.get("/admin/delivery/reports", isAuthenticatedUser, adminOrStaff, getDeliveryReports);

// -------------------------------------------------------------
// SHIPMENT CORE WORKFLOW
// -------------------------------------------------------------
router
  .route("/admin/shipments")
  .get(isAuthenticatedUser, adminOrStaff, getAllShipments)
  .post(isAuthenticatedUser, adminOnly, createShipment);

router
  .route("/admin/shipments/orders")
  .get(isAuthenticatedUser, adminOnly, getOrdersForShipment);

router
  .route("/admin/shipments/export")
  .get(isAuthenticatedUser, adminOnly, exportShipments);

router
  .route("/admin/shipments/bulk")
  .post(isAuthenticatedUser, adminOnly, bulkShipmentAction);

router
  .route("/admin/shipments/:id")
  .get(isAuthenticatedUser, adminOrStaff, getShipmentDetails)
  .put(isAuthenticatedUser, adminOnly, updateShipment)
  .delete(isAuthenticatedUser, adminOnly, deleteShipment);

router
  .route("/admin/shipments/:id/status")
  .patch(isAuthenticatedUser, adminOrStaff, updateShipmentStatus);

router
  .route("/admin/shipments/:id/notes")
  .post(isAuthenticatedUser, adminOrStaff, addShipmentNote);

router
  .route("/admin/shipments/:id/delivery-proof")
  .post(isAuthenticatedUser, adminOnly, addDeliveryProof);

router
  .route("/admin/shipments/:id/sync-tracking")
  .post(isAuthenticatedUser, adminOnly, syncTrackingNow);

router
  .route("/admin/shipments/:id/duplicate")
  .post(isAuthenticatedUser, adminOnly, duplicateShipment);

router
  .route("/admin/shipments/:shipmentId/assign")
  .post(isAuthenticatedUser, adminOnly, assignShipmentToPersonnel);

router
  .route("/admin/shipments/:shipmentId/reattempt")
  .post(isAuthenticatedUser, adminOnly, reattemptDelivery);

router
  .route("/admin/shipments/:shipmentId/rto")
  .post(isAuthenticatedUser, adminOnly, processRto);

// -------------------------------------------------------------
// COURIER / SHIPPING PARTNER ROUTES
// -------------------------------------------------------------
router
  .route("/admin/couriers")
  .get(isAuthenticatedUser, adminOrStaff, getAllCouriers)
  .post(isAuthenticatedUser, adminOnly, createCourier);

router
  .route("/admin/couriers/:id")
  .put(isAuthenticatedUser, adminOnly, updateCourier)
  .delete(isAuthenticatedUser, adminOnly, deleteCourier);

router
  .route("/admin/couriers/:id/toggle")
  .patch(isAuthenticatedUser, adminOnly, toggleCourier);

// -------------------------------------------------------------
// DELIVERY ZONES
// -------------------------------------------------------------
router
  .route("/admin/delivery/zones")
  .get(isAuthenticatedUser, adminOrStaff, getZones)
  .post(isAuthenticatedUser, adminOnly, createZone);

router
  .route("/admin/delivery/zones/:id")
  .put(isAuthenticatedUser, adminOnly, updateZone)
  .delete(isAuthenticatedUser, adminOnly, deleteZone);

// -------------------------------------------------------------
// PINCODES & BULK IMPORT
// -------------------------------------------------------------
router
  .route("/admin/delivery/pincodes")
  .get(isAuthenticatedUser, adminOrStaff, getPincodes)
  .post(isAuthenticatedUser, adminOnly, createPincode);

router
  .route("/admin/delivery/pincodes/bulk-import")
  .post(isAuthenticatedUser, adminOnly, bulkImportPincodes);

router
  .route("/admin/delivery/pincodes/:id")
  .put(isAuthenticatedUser, adminOnly, updatePincode)
  .delete(isAuthenticatedUser, adminOnly, deletePincode);

// -------------------------------------------------------------
// DELIVERY PERSONNEL / RIDERS
// -------------------------------------------------------------
router
  .route("/admin/delivery/personnel")
  .get(isAuthenticatedUser, adminOrStaff, getPersonnel)
  .post(isAuthenticatedUser, adminOnly, createPersonnel);

router
  .route("/admin/delivery/personnel/:id")
  .put(isAuthenticatedUser, adminOnly, updatePersonnel)
  .delete(isAuthenticatedUser, adminOnly, deletePersonnel);

// -------------------------------------------------------------
// FAILED DELIVERIES & RETURNS (RTO)
// -------------------------------------------------------------
router
  .route("/admin/delivery/failed-returns")
  .get(isAuthenticatedUser, adminOrStaff, getFailedDeliveries);

// -------------------------------------------------------------
// DELIVERY SETTINGS (CONFIGURABLE SHIPPING CHARGES & RULES)
// -------------------------------------------------------------
router
  .route("/admin/delivery/settings")
  .get(isAuthenticatedUser, adminOrStaff, getDeliverySettings)
  .put(isAuthenticatedUser, adminOnly, updateDeliverySettings);

export default router;
