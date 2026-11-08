import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Printer,
  FileText,
  UserCheck,
  MapPin,
  Settings,
  Download,
  Eye,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  Sliders,
  DollarSign,
  Compass,
  Phone,
  Mail,
  User,
  Check,
  AlertCircle,
  FileSpreadsheet,
  QrCode,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  fetchDeliveryDashboard,
  fetchShipments,
  fetchOrdersReadyForShipment,
  createShipment,
  updateShipment,
  updateShipmentStatus,
  deleteShipment,
  assignShipmentPersonnel,
  reattemptShipmentDelivery,
  processShipmentRto,
  fetchCouriers,
  createCourierPartner,
  updateCourierPartner,
  toggleCourierPartner,
  deleteCourierPartner,
  fetchDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  fetchPincodes,
  createPincode,
  deletePincode,
  bulkImportPincodes,
  fetchDeliveryPersonnel,
  createDeliveryPersonnel,
  updateDeliveryPersonnel,
  deleteDeliveryPersonnel,
  fetchFailedDeliveries,
  fetchDeliverySettings,
  updateDeliverySettings,
  exportDeliveryReportUrl,
  type DeliveryDashboardKPIs,
  type DeliveryDashboardCharts,
  type ShipmentItem,
  type CourierPartnerItem,
  type DeliveryZoneItem,
  type DeliveryPincodeItem,
  type DeliveryPersonnelItem,
  type DeliverySettingsData,
} from "../../services/deliveryApi";
import { formatPrice } from "../../utils/currency";
import { printShippingLabel, printPackingSlip, printInvoice } from "../orders/OrderBits";

const STATUS_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  "Order Confirmed": { bg: "#f3f4f6", text: "#374151" },
  "Processing": { bg: "#eff6ff", text: "#1d4ed8" },
  "Packed": { bg: "#fef3c7", text: "#b45309" },
  "Ready to Ship": { bg: "#e0e7ff", text: "#4338ca" },
  "Shipped": { bg: "#dbeafe", text: "#1e40af" },
  "Dispatched": { bg: "#dbeafe", text: "#1e40af" },
  "In Transit": { bg: "#dbeafe", text: "#0284c7" },
  "Reached Destination Hub": { bg: "#e0f2fe", text: "#0369a1" },
  "Out for Delivery": { bg: "#ffedd5", text: "#c2410c" },
  "Delivered": { bg: "#d1fae5", text: "#047857" },
  "Delivery Attempt Failed": { bg: "#fee2e2", text: "#b91c1c" },
  "Return to Origin": { bg: "#fee2e2", text: "#991b1b" },
  "Returned": { bg: "#f1f5f9", text: "#475569" },
  "Cancelled": { bg: "#f1f5f9", text: "#64748b" },
};

const ALL_13_STATUSES = [
  "Order Confirmed",
  "Processing",
  "Packed",
  "Ready to Ship",
  "Shipped",
  "In Transit",
  "Reached Destination Hub",
  "Out for Delivery",
  "Delivered",
  "Delivery Attempt Failed",
  "Return to Origin",
  "Returned",
  "Cancelled",
];

type DeliveryTab =
  | "dashboard"
  | "shipments"
  | "partners"
  | "zones_pincodes"
  | "personnel"
  | "failed_returns"
  | "settings"
  | "reports";

export default function DeliveryAdmin({
  adminUser,
  onRefresh,
}: {
  adminUser?: any;
  onRefresh?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DeliveryTab>("dashboard");
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [kpis, setKpis] = useState<DeliveryDashboardKPIs | null>(null);
  const [charts, setCharts] = useState<DeliveryDashboardCharts | null>(null);

  // Shipments Table State
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [courierFilter, setCourierFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Create Shipment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [unshippedOrders, setUnshippedOrders] = useState<any[]>([]);
  const [selectedOrderToShip, setSelectedOrderToShip] = useState<any | null>(null);
  const [newShipCourier, setNewShipCourier] = useState("");
  const [newShipTracking, setNewShipTracking] = useState("");
  const [newShipMethod, setNewShipMethod] = useState("standard");
  const [newShipWeight, setNewShipWeight] = useState("0.5 kg");
  const [creatingShipment, setCreatingShipment] = useState(false);

  // View / Timeline & Status Modal
  const [selectedShipment, setSelectedShipment] = useState<ShipmentItem | null>(null);
  const [statusUpdateTarget, setStatusUpdateTarget] = useState("");
  const [statusRemark, setStatusRemark] = useState("");
  const [statusLocation, setStatusLocation] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Reattempt & RTO Modals
  const [showReattemptModal, setShowReattemptModal] = useState(false);
  const [reattemptDate, setReattemptDate] = useState("");
  const [reattemptReason, setReattemptReason] = useState("Customer unavailable");
  const [reattemptRemarks, setReattemptRemarks] = useState("");

  const [showRtoModal, setShowRtoModal] = useState(false);
  const [rtoReason, setRtoReason] = useState("Multiple failed attempts / Undeliverable");
  const [rtoRemarks, setRtoRemarks] = useState("");
  const [rtoRestoreStock, setRtoRestoreStock] = useState(true);

  // Shipping Partners State
  const [couriers, setCouriers] = useState<CourierPartnerItem[]>([]);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<CourierPartnerItem | null>(null);
  const [pName, setPName] = useState("");
  const [pCode, setPCode] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pWebsite, setPWebsite] = useState("");
  const [pTrackingUrl, setPTrackingUrl] = useState("");
  const [pApiKey, setPApiKey] = useState("");
  const [pApiSecret, setPApiSecret] = useState("");

  // Zones & Pincodes State
  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [pincodes, setPincodes] = useState<DeliveryPincodeItem[]>([]);
  const [pincodeSearch, setPincodeSearch] = useState("");
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zName, setZName] = useState("");
  const [zCode, setZCode] = useState("");
  const [zStdDays, setZStdDays] = useState("3");
  const [zExpDays, setZExpDays] = useState("1");
  const [zStdRate, setZStdRate] = useState("49");
  const [zExpRate, setZExpRate] = useState("99");
  const [showBulkPincodeModal, setShowBulkPincodeModal] = useState(false);
  const [bulkPinText, setBulkPinText] = useState("");

  // Personnel State
  const [personnel, setPersonnel] = useState<DeliveryPersonnelItem[]>([]);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<DeliveryPersonnelItem | null>(null);
  const [dpName, setDpName] = useState("");
  const [dpPhone, setDpPhone] = useState("");
  const [dpEmail, setDpEmail] = useState("");
  const [dpVehicleNo, setDpVehicleNo] = useState("");
  const [dpVehicleType, setDpVehicleType] = useState<any>("Bike");
  const [dpRoute, setDpRoute] = useState("");

  // Assign Rider Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");

  // Failed Deliveries List
  const [failedShipments, setFailedShipments] = useState<ShipmentItem[]>([]);

  // Delivery Settings State
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsData | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Load Dashboard Data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchDeliveryDashboard();
      setKpis(res.kpis);
      setCharts(res.charts);
    } catch (err: any) {
      toast.error(err.message || "Failed to load delivery overview");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Shipments
  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchShipments({
        search,
        status: statusFilter,
        courier: courierFilter,
        paymentType: paymentFilter,
      });
      setShipments(res.shipments || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, courierFilter, paymentFilter]);

  // Tab switching loader
  useEffect(() => {
    if (activeTab === "dashboard") {
      loadDashboard();
    } else if (activeTab === "shipments") {
      loadShipments();
      fetchCouriers().then(setCouriers).catch(console.error);
    } else if (activeTab === "partners") {
      fetchCouriers().then(setCouriers).catch(console.error);
    } else if (activeTab === "zones_pincodes") {
      fetchDeliveryZones().then(setZones).catch(console.error);
      fetchPincodes({ search: pincodeSearch }).then((r) => setPincodes(r.pincodes)).catch(console.error);
    } else if (activeTab === "personnel") {
      fetchDeliveryPersonnel().then(setPersonnel).catch(console.error);
    } else if (activeTab === "failed_returns") {
      fetchFailedDeliveries().then(setFailedShipments).catch(console.error);
    } else if (activeTab === "settings") {
      fetchDeliverySettings().then(setDeliverySettings).catch(console.error);
    }
  }, [activeTab, loadDashboard, loadShipments, pincodeSearch]);

  // Open Create Shipment modal
  const openCreateShipment = async () => {
    try {
      const orders = await fetchOrdersReadyForShipment();
      setUnshippedOrders(orders);
      if (orders.length > 0) {
        setSelectedOrderToShip(orders[0]);
      }
      const c = await fetchCouriers();
      setCouriers(c);
      if (c.length > 0) setNewShipCourier(c[0].name);
      setNewShipTracking(`TRK-${Date.now().toString().slice(-8)}`);
      setShowCreateModal(true);
    } catch (err: any) {
      toast.error("Failed to fetch unshipped orders");
    }
  };

  const handleCreateShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderToShip) {
      toast.error("Select an order to ship");
      return;
    }
    setCreatingShipment(true);
    try {
      const address = selectedOrderToShip.shippingAddress || {};
      const payload = {
        order: selectedOrderToShip._id,
        customerName: selectedOrderToShip.user?.name || address.fullName || "Customer",
        customerPhone: selectedOrderToShip.user?.phoneNumber || address.mobileNumber || "9876543210",
        customerEmail: selectedOrderToShip.user?.email || "",
        shippingAddress: {
          fullName: address.fullName || selectedOrderToShip.user?.name || "Customer",
          mobileNumber: address.mobileNumber || selectedOrderToShip.user?.phoneNumber || "9876543210",
          addressLine1: address.addressLine1 || address.street || "Main Street",
          city: address.city || "Mumbai",
          state: address.state || "Maharashtra",
          country: address.country || "India",
          pincode: address.pincode || address.pinCode || "400001",
        },
        courierName: newShipCourier,
        trackingNumber: newShipTracking.trim(),
        awbNumber: newShipTracking.trim(),
        shippingMethod: newShipMethod,
        packageWeight: newShipWeight,
        paymentType: selectedOrderToShip.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid",
        status: "Order Confirmed",
      };

      await createShipment(payload);
      toast.success("Shipment created successfully!");
      setShowCreateModal(false);
      loadShipments();
      loadDashboard();
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create shipment");
    } finally {
      setCreatingShipment(false);
    }
  };

  // Status update
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !statusUpdateTarget) return;

    setStatusUpdating(true);
    try {
      const updated = await updateShipmentStatus(selectedShipment._id, {
        status: statusUpdateTarget,
        remark: statusRemark || `Status advanced to ${statusUpdateTarget}`,
        location: statusLocation,
      });
      toast.success(`Shipment status updated to ${statusUpdateTarget}`);
      setSelectedShipment(updated);
      loadShipments();
      loadDashboard();
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update shipment status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Reattempt delivery
  const handleConfirmReattempt = async () => {
    if (!selectedShipment) return;
    try {
      await reattemptShipmentDelivery(selectedShipment._id, {
        nextAttemptDate: reattemptDate || undefined,
        reason: reattemptReason,
        remarks: reattemptRemarks,
      });
      toast.success("Delivery reattempt scheduled!");
      setShowReattemptModal(false);
      loadShipments();
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || "Failed to reattempt");
    }
  };

  // Process RTO
  const handleConfirmRto = async () => {
    if (!selectedShipment) return;
    try {
      await processShipmentRto(selectedShipment._id, {
        reason: rtoReason,
        remarks: rtoRemarks,
        restoreStock: rtoRestoreStock,
      });
      toast.success("Package marked Return to Origin (RTO)");
      setShowRtoModal(false);
      loadShipments();
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || "Failed to process RTO");
    }
  };

  // Assign Rider
  const handleAssignRider = async () => {
    if (!selectedShipment || !selectedPersonnelId) return;
    try {
      await assignShipmentPersonnel(selectedShipment._id, selectedPersonnelId);
      toast.success("Delivery agent assigned successfully!");
      setShowAssignModal(false);
      loadShipments();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign delivery agent");
    }
  };

  // Save Courier Partner
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) {
      toast.error("Courier partner name is required");
      return;
    }
    try {
      const payload = {
        name: pName.trim(),
        partnerCode: pCode.trim().toUpperCase() || pName.slice(0, 4).toUpperCase(),
        phoneNumber: pPhone.trim(),
        email: pEmail.trim(),
        website: pWebsite.trim(),
        trackingUrlTemplate: pTrackingUrl.trim(),
        apiConfig: {
          apiKey: pApiKey.trim(),
          apiSecret: pApiSecret.trim(),
        },
      };

      if (editingPartner) {
        await updateCourierPartner(editingPartner._id, payload);
        toast.success("Partner details updated!");
      } else {
        await createCourierPartner(payload);
        toast.success("New shipping partner onboarded!");
      }
      setShowPartnerModal(false);
      setEditingPartner(null);
      fetchCouriers().then(setCouriers);
    } catch (err: any) {
      toast.error(err.message || "Failed to save partner");
    }
  };

  // Save Zone
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zName.trim() || !zCode.trim()) {
      toast.error("Zone name and code required");
      return;
    }
    try {
      await createDeliveryZone({
        name: zName.trim(),
        code: zCode.trim().toUpperCase(),
        standardDeliveryDays: Number(zStdDays) || 3,
        expressDeliveryDays: Number(zExpDays) || 1,
        standardRate: Number(zStdRate) || 49,
        expressRate: Number(zExpRate) || 99,
      });
      toast.success("Delivery zone created!");
      setShowZoneModal(false);
      setZName("");
      setZCode("");
      fetchDeliveryZones().then(setZones);
    } catch (err: any) {
      toast.error(err.message || "Failed to create zone");
    }
  };

  // Bulk Pincodes Import
  const handleBulkImportPins = async () => {
    if (!bulkPinText.trim()) return;
    const lines = bulkPinText.trim().split("\n");
    const pins = lines
      .map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        if (parts.length < 2) return null;
        return {
          pincode: parts[0],
          city: parts[1],
          state: parts[2] || "Maharashtra",
          estimatedDays: parseInt(parts[3] || "3", 10),
        };
      })
      .filter(Boolean);

    if (pins.length === 0) {
      toast.error("Please enter rows in format: Pincode, City, State, Days");
      return;
    }

    try {
      const res = await bulkImportPincodes(pins);
      toast.success(`Imported ${res.count} pincodes!`);
      setShowBulkPincodeModal(false);
      setBulkPinText("");
      fetchPincodes({}).then((r) => setPincodes(r.pincodes));
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed");
    }
  };

  // Save Personnel
  const handleSavePersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpName.trim() || !dpPhone.trim()) {
      toast.error("Name and phone number required");
      return;
    }
    try {
      const payload = {
        name: dpName.trim(),
        phone: dpPhone.trim(),
        email: dpEmail.trim(),
        vehicleNumber: dpVehicleNo.trim(),
        vehicleType: dpVehicleType,
        currentRoute: dpRoute.trim(),
      };
      if (editingPersonnel) {
        await updateDeliveryPersonnel(editingPersonnel._id, payload);
        toast.success("Delivery agent updated!");
      } else {
        await createDeliveryPersonnel(payload);
        toast.success("Delivery agent added to fleet!");
      }
      setShowPersonnelModal(false);
      setEditingPersonnel(null);
      fetchDeliveryPersonnel().then(setPersonnel);
    } catch (err: any) {
      toast.error(err.message || "Failed to save personnel");
    }
  };

  // Save Delivery Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverySettings) return;
    setSettingsSaving(true);
    try {
      const updated = await updateDeliverySettings(deliverySettings);
      setDeliverySettings(updated);
      toast.success("Delivery rules & settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="admin-tab-view delivery-admin">
      {/* Top Header */}
      <div className="admin-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Logistics &amp; Dispatch</p>
          <h2 style={{ font: '600 22px "Manrope", sans-serif', margin: "4px 0 0", color: "#111" }}>
            Delivery Management System
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="coupon-btn coupon-btn--ghost"
            onClick={() => {
              loadDashboard();
              loadShipments();
              toast.success("Shipments re-synchronized");
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>

          <a
            href={exportDeliveryReportUrl("shipments", "xlsx")}
            className="coupon-btn coupon-btn--ghost"
            download
            style={{ textDecoration: "none" }}
          >
            <FileSpreadsheet size={14} /> Export Manifest
          </a>

          <button
            type="button"
            className="coupon-btn coupon-btn--primary"
            onClick={openCreateShipment}
          >
            <Plus size={15} /> Create Shipment
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="delivery-nav-tabs" style={{ display: "flex", gap: 6, borderBottom: "1px solid #e5e7eb", margin: "16px 0 20px", overflowX: "auto" }}>
        {[
          { key: "dashboard", label: "Overview", icon: Truck },
          { key: "shipments", label: "Shipments Management", icon: Package },
          { key: "partners", label: "Shipping Partners", icon: Compass },
          { key: "zones_pincodes", label: "Zones & Pincodes", icon: MapPin },
          { key: "personnel", label: "Delivery Fleet", icon: UserCheck },
          { key: "failed_returns", label: "Failed & RTO", icon: RotateCcw, count: kpis?.failedDeliveries },
          { key: "settings", label: "Shipping Rules & Settings", icon: Settings },
          { key: "reports", label: "Logistics Reports", icon: FileText },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as DeliveryTab)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 14px",
                border: "none",
                background: "transparent",
                borderBottom: isActive ? "2.5px solid #111" : "2.5px solid transparent",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#111" : "#6b7280",
                cursor: "pointer",
                fontSize: 13.5,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <TabIcon size={16} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#fee2e2",
                    color: "#b91c1c",
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DELIVERY OVERVIEW DASHBOARD
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="delivery-overview-tab">
          {/* 13 Status KPI Cards Grid */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Total Shipments</span>
                <Package size={17} color="#3b82f6" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8 }}>
                {kpis?.totalShipments ?? 0}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Total dispatches booked</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Pending / Processing</span>
                <Clock size={17} color="#f59e0b" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#f59e0b" }}>
                {kpis?.pendingDeliveries ?? 0}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Awaiting courier dispatch</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>In Transit</span>
                <Truck size={17} color="#0284c7" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#0284c7" }}>
                {kpis?.inTransit ?? 0}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Moving between hubs</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Out for Delivery</span>
                <MapPin size={17} color="#ea580c" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#ea580c" }}>
                {kpis?.outForDelivery ?? 0}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>With last-mile delivery rider</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Delivered</span>
                <CheckCircle2 size={17} color="#10b981" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#10b981" }}>
                {kpis?.successfullyDelivered ?? 0}
              </strong>
              <small style={{ color: "#047857", fontSize: 11.5, fontWeight: 500 }}>Successfully completed</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Failed / RTO</span>
                <AlertTriangle size={17} color="#ef4444" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#ef4444" }}>
                {kpis?.failedDeliveries ?? 0}
              </strong>
              <small style={{ color: "#b91c1c", fontSize: 11.5 }}>Pending reattempt or return</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Avg Delivery Speed</span>
                <Clock size={17} color="#6366f1" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#111" }}>
                {kpis?.avgDeliveryTimeDays || "2.8"} days
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>From dispatch to customer door</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Shipping Revenue</span>
                <DollarSign size={17} color="#10b981" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#111" }}>
                {formatPrice(kpis?.totalShippingCharges || 0)}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Freight charges collected</small>
            </div>
          </div>

          {/* Interactive Delivery Trend Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginTop: 20 }}>
            {/* 14-day Delivery Activity Area Chart */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 14px", font: '600 15px "Manrope"' }}>Delivery Volume Trends (Last 14 Days)</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.dailyTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="created" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCreated)" name="Dispatched" />
                    <Area type="monotone" dataKey="delivered" stroke="#10b981" fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Carrier Partner Performance Comparison */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 14px", font: '600 15px "Manrope"' }}>Shipping Partner Performance</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.partnerComparison || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#93c5fd" name="Total Assigned" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed / RTO" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SHIPMENTS MANAGEMENT TABLE
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "shipments" && (
        <div className="delivery-shipments-tab">
          {/* Filters Bar */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Search by Shipment ID, tracking #, customer name, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 32px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="All">All 13 Statuses</option>
              {ALL_13_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              value={courierFilter}
              onChange={(e) => {
                setCourierFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="All">All Couriers</option>
              {couriers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="All">All Payment Types</option>
              <option value="Prepaid">Prepaid</option>
              <option value="Cash on Delivery">Cash on Delivery (COD)</option>
            </select>
          </div>

          {/* Shipments Table */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 12px" }}>Shipment &amp; Order ID</th>
                    <th style={{ padding: "10px 12px" }}>Customer &amp; Phone</th>
                    <th style={{ padding: "10px 12px" }}>Destination Address</th>
                    <th style={{ padding: "10px 12px" }}>Shipping Partner</th>
                    <th style={{ padding: "10px 12px" }}>Tracking Number</th>
                    <th style={{ padding: "10px 12px" }}>Method</th>
                    <th style={{ padding: "10px 12px" }}>Payment</th>
                    <th style={{ padding: "10px 12px" }}>Status</th>
                    <th style={{ padding: "10px 12px" }}>Dispatch Date</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        No shipment records found. Click "Create Shipment" to dispatch an order.
                      </td>
                    </tr>
                  ) : (
                    shipments.map((s) => {
                      const colors = STATUS_COLORS[s.status] || { bg: "#f3f4f6", text: "#374151" };
                      return (
                        <tr key={s._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <strong style={{ fontFamily: "monospace", color: "#111", display: "block" }}>{s.shipmentId}</strong>
                            <span style={{ fontSize: 11.5, color: "#6b7280" }}>
                              Order #{String(s.order?._id || s.order || "").slice(-8).toUpperCase()}
                            </span>
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <strong style={{ display: "block" }}>{s.customerName}</strong>
                            <span style={{ fontSize: 12, color: "#4b5563" }}>{s.customerPhone}</span>
                          </td>

                          <td style={{ padding: "10px 12px", fontSize: 12, maxWidth: 180 }}>
                            <div style={{ fontWeight: 500 }}>
                              {s.shippingAddress?.city}, {s.shippingAddress?.state || "State"}
                            </div>
                            <div style={{ color: "#6b7280" }}>PIN: {s.shippingAddress?.pincode}</div>
                          </td>

                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.courierName || "Standard Partner"}</td>

                          <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                            {s.trackingNumber || s.awbNumber ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{s.trackingNumber || s.awbNumber}</span>
                                {s.trackingUrl && (
                                  <a href={s.trackingUrl} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>Pending</span>
                            )}
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ textTransform: "capitalize", fontSize: 12 }}>{s.shippingMethod}</span>
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: s.paymentType === "Cash on Delivery" ? "#fef3c7" : "#d1fae5",
                                color: s.paymentType === "Cash on Delivery" ? "#b45309" : "#047857",
                              }}
                            >
                              {s.paymentType === "Cash on Delivery" ? "COD" : "Prepaid"}
                            </span>
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: colors.bg,
                                color: colors.text,
                                display: "inline-block",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.status}
                            </span>
                          </td>

                          <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>
                            {s.dispatchDate ? new Date(s.dispatchDate).toLocaleDateString() : "Pending"}
                          </td>

                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 5 }}>
                              <button
                                type="button"
                                className="coupon-btn coupon-btn--ghost"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                onClick={() => {
                                  setSelectedShipment(s);
                                  setStatusUpdateTarget(s.status);
                                  setStatusRemark("");
                                  setStatusLocation(s.shippingAddress?.city || "");
                                }}
                                title="View details, interactive status timeline & change status"
                              >
                                Timeline
                              </button>

                              <button
                                type="button"
                                className="coupon-btn coupon-btn--ghost"
                                style={{ padding: "4px 6px" }}
                                onClick={() => printShippingLabel(s.order || s)}
                                title="Print Shipping Label with Barcode"
                              >
                                <Printer size={13} />
                              </button>

                              <button
                                type="button"
                                className="coupon-btn coupon-btn--ghost"
                                style={{ padding: "4px 6px" }}
                                onClick={() => printPackingSlip(s.order || s)}
                                title="Print Packing Slip / Invoice"
                              >
                                <FileText size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SHIPPING PARTNERS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "partners" && (
        <div className="delivery-partners-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Integrated Shipping Companies</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Courier integrations for Delhivery, Shiprocket, Blue Dart, DTDC, India Post, Xpressbees &amp; Ecom Express
              </p>
            </div>
            <button
              type="button"
              className="coupon-btn coupon-btn--primary"
              onClick={() => {
                setEditingPartner(null);
                setPName("");
                setPCode("");
                setPPhone("");
                setPEmail("");
                setPWebsite("");
                setPTrackingUrl("");
                setPApiKey("");
                setPApiSecret("");
                setShowPartnerModal(true);
              }}
            >
              <Plus size={14} /> Add Shipping Partner
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {couriers.map((c) => (
              <div
                key={c._id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: c.isActive ? "1px solid #e5e7eb" : "1px solid #fee2e2",
                  padding: 18,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "#f0fdf4", display: "grid", placeItems: "center" }}>
                      <Truck size={20} color="#10b981" />
                    </div>
                    <div>
                      <h5 style={{ margin: 0, font: '600 16px "Manrope"' }}>{c.name}</h5>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>
                        CODE: {c.partnerCode || "COURIER"}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: c.isActive ? "#d1fae5" : "#fee2e2",
                      color: c.isActive ? "#047857" : "#b91c1c",
                    }}
                  >
                    {c.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                <div style={{ margin: "14px 0", fontSize: 12.5, color: "#4b5563" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Phone size={13} color="#9ca3af" />
                    <span>{c.phoneNumber || "1800-LOGISTICS"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <Mail size={13} color="#9ca3af" />
                    <span>{c.email || "support@carrier.com"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <ExternalLink size={13} color="#9ca3af" />
                    <a href={c.website || "#"} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>
                      {c.website || "carrier portal"}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>Services:</span>
                  <strong style={{ color: "#111" }}>{(c.serviceTypes || ["Standard", "Express"]).join(", ")}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="coupon-btn coupon-btn--ghost"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={async () => {
                      await toggleCourierPartner(c._id);
                      toast.success(`Toggled ${c.name} status`);
                      fetchCouriers().then(setCouriers);
                    }}
                  >
                    {c.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    type="button"
                    className="coupon-btn coupon-btn--ghost"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => {
                      setEditingPartner(c);
                      setPName(c.name);
                      setPCode(c.partnerCode || "");
                      setPPhone(c.phoneNumber || "");
                      setPEmail(c.email || "");
                      setPWebsite(c.website || "");
                      setPTrackingUrl(c.trackingUrlTemplate || "");
                      setPApiKey(c.apiConfig?.apiKey || "");
                      setPApiSecret(c.apiConfig?.apiSecret || "");
                      setShowPartnerModal(true);
                    }}
                  >
                    Configure API
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: DELIVERY ZONES & PINCODES
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "zones_pincodes" && (
        <div className="delivery-zones-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Delivery Zones &amp; Serviceable Pincodes</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Configure regional delivery speed SLAs, shipping rates, and manage serviceable postal codes
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => setShowBulkPincodeModal(true)}
              >
                <FileSpreadsheet size={14} /> Bulk Import Pincodes
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--primary"
                onClick={() => setShowZoneModal(true)}
              >
                <Plus size={14} /> Add Delivery Zone
              </button>
            </div>
          </div>

          {/* Zones Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 24 }}>
            {zones.map((z) => (
              <div key={z._id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h5 style={{ margin: 0, font: '600 15px "Manrope"' }}>{z.name}</h5>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>{z.code}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#4b5563" }}>
                  <div>
                    <strong>Standard Delivery:</strong> {z.standardDeliveryDays} days (₹{z.standardRate})
                  </div>
                  <div>
                    <strong>Express Delivery:</strong> {z.expressDeliveryDays} day(s) (₹{z.expressRate})
                  </div>
                  <div>
                    <strong>COD Serviceable:</strong> {z.codAvailable ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pincodes Listing */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h5 style={{ margin: 0, font: '600 15px "Manrope"' }}>Postal Codes Directory</h5>
              <input
                type="text"
                placeholder="Search pincode or city..."
                value={pincodeSearch}
                onChange={(e) => setPincodeSearch(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 12.5, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>

            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 12px" }}>Pincode</th>
                  <th style={{ padding: "8px 12px" }}>City / Area</th>
                  <th style={{ padding: "8px 12px" }}>State</th>
                  <th style={{ padding: "8px 12px" }}>Estimated SLA</th>
                  <th style={{ padding: "8px 12px" }}>COD Available</th>
                  <th style={{ padding: "8px 12px" }}>Serviceable</th>
                </tr>
              </thead>
              <tbody>
                {pincodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
                      No custom postal codes loaded. Fallback applies standard Indian pin rules. Use "Bulk Import Pincodes" to upload list.
                    </td>
                  </tr>
                ) : (
                  pincodes.slice(0, 15).map((p) => (
                    <tr key={p._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700 }}>{p.pincode}</td>
                      <td style={{ padding: "8px 12px" }}>{p.city}</td>
                      <td style={{ padding: "8px 12px" }}>{p.state}</td>
                      <td style={{ padding: "8px 12px" }}>{p.estimatedDays} business days</td>
                      <td style={{ padding: "8px 12px" }}>{p.codAvailable ? "Yes" : "No"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ color: p.isServiceable ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                          {p.isServiceable ? "Serviceable" : "Unserviceable"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: DELIVERY PERSONNEL / FLEET
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "personnel" && (
        <div className="delivery-personnel-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Delivery Fleet &amp; Personnel</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Manage local delivery riders, vehicle information, assigned routes, and delivery performance metrics
              </p>
            </div>
            <button
              type="button"
              className="coupon-btn coupon-btn--primary"
              onClick={() => {
                setEditingPersonnel(null);
                setDpName("");
                setDpPhone("");
                setDpEmail("");
                setDpVehicleNo("");
                setDpRoute("");
                setShowPersonnelModal(true);
              }}
            >
              <Plus size={14} /> Add Delivery Rider
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {personnel.map((rider) => (
              <div key={rider._id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, background: "#f3f4f6", display: "grid", placeItems: "center" }}>
                      <User size={18} color="#4b5563" />
                    </div>
                    <div>
                      <h5 style={{ margin: 0, font: '600 15px "Manrope"' }}>{rider.name}</h5>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{rider.phone}</span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: rider.status === "Available" ? "#d1fae5" : "#fef3c7",
                      color: rider.status === "Available" ? "#047857" : "#b45309",
                    }}
                  >
                    {rider.status}
                  </span>
                </div>

                <div style={{ margin: "14px 0", fontSize: 12.5, color: "#4b5563" }}>
                  <div>
                    <strong>Vehicle:</strong> {rider.vehicleType} ({rider.vehicleNumber || "Standard"})
                  </div>
                  <div>
                    <strong>Route:</strong> {rider.currentRoute || "Central Urban Delivery"}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>Deliveries Done:</span>
                    <strong style={{ color: "#10b981" }}>{rider.completedDeliveries}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Rating:</span>
                    <strong>★ {rider.rating.toFixed(1)}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    className="coupon-btn coupon-btn--ghost"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => {
                      setEditingPersonnel(rider);
                      setDpName(rider.name);
                      setDpPhone(rider.phone);
                      setDpEmail(rider.email || "");
                      setDpVehicleNo(rider.vehicleNumber || "");
                      setDpVehicleType(rider.vehicleType);
                      setDpRoute(rider.currentRoute || "");
                      setShowPersonnelModal(true);
                    }}
                  >
                    Edit Rider
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: FAILED DELIVERIES & RTO
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "failed_returns" && (
        <div className="delivery-failed-tab">
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Failed Deliveries &amp; Return to Origin (RTO)</h4>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Action center for customer-unavailable attempts, rescheduling, reattempts, or return-to-origin processing
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Shipment ID</th>
                  <th style={{ padding: "10px 12px" }}>Customer &amp; Phone</th>
                  <th style={{ padding: "10px 12px" }}>City / Area</th>
                  <th style={{ padding: "10px 12px" }}>Failure Reason</th>
                  <th style={{ padding: "10px 12px" }}>Attempts</th>
                  <th style={{ padding: "10px 12px" }}>Current Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedShipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#10b981" }}>
                      <CheckCircle2 size={32} style={{ margin: "0 auto 8px" }} />
                      No failed or returned shipments. Excellent delivery completion rate!
                    </td>
                  </tr>
                ) : (
                  failedShipments.map((s) => (
                    <tr key={s._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700 }}>{s.shipmentId}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{s.customerName}</strong>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{s.customerPhone}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {s.shippingAddress?.city}, {s.shippingAddress?.pincode}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#b91c1c", fontWeight: 500 }}>
                        {s.failedDeliveryReason || "Customer Unavailable"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{s.reattemptCount || 1} of 3</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--primary"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => {
                              setSelectedShipment(s);
                              setReattemptDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
                              setShowReattemptModal(true);
                            }}
                          >
                            Reattempt
                          </button>
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--ghost"
                            style={{ padding: "4px 8px", fontSize: 12, color: "#991b1b" }}
                            onClick={() => {
                              setSelectedShipment(s);
                              setShowRtoModal(true);
                            }}
                          >
                            RTO Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 7: DELIVERY SETTINGS & CONFIGURABLE SHIPPING CHARGES
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "settings" && deliverySettings && (
        <div className="delivery-settings-tab" style={{ maxWidth: 780 }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Shipping Charges &amp; Automation Settings</h4>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Configure shipping fees, free shipping order threshold, COD surcharges, origin and return warehouse hubs
            </p>
          </div>

          <form onSubmit={handleSaveSettings} style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <h5 style={{ margin: "0 0 12px", font: '600 15px "Manrope"', borderBottom: "1px solid #f3f4f6", paddingBottom: 8 }}>
              Shipping Rate Rules
            </h5>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Standard Shipping Fee</label>
                <input
                  type="number"
                  min="0"
                  value={deliverySettings.standardShippingFee}
                  onChange={(e) =>
                    setDeliverySettings({ ...deliverySettings, standardShippingFee: Number(e.target.value) || 0 })
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Express Shipping Fee</label>
                <input
                  type="number"
                  min="0"
                  value={deliverySettings.expressShippingFee}
                  onChange={(e) =>
                    setDeliverySettings({ ...deliverySettings, expressShippingFee: Number(e.target.value) || 0 })
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Free Shipping Min Order</label>
                <input
                  type="number"
                  min="0"
                  value={deliverySettings.freeShippingThreshold}
                  onChange={(e) =>
                    setDeliverySettings({ ...deliverySettings, freeShippingThreshold: Number(e.target.value) || 0 })
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>COD Extra Convenience Fee</label>
                <input
                  type="number"
                  min="0"
                  value={deliverySettings.codFee}
                  onChange={(e) => setDeliverySettings({ ...deliverySettings, codFee: Number(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Default Carrier Partner</label>
                <select
                  value={deliverySettings.defaultPartner}
                  onChange={(e) => setDeliverySettings({ ...deliverySettings, defaultPartner: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="Shiprocket">Shiprocket</option>
                  <option value="Blue Dart">Blue Dart</option>
                  <option value="DTDC">DTDC</option>
                  <option value="India Post">India Post</option>
                </select>
              </div>
            </div>

            <h5 style={{ margin: "20px 0 12px", font: '600 15px "Manrope"', borderBottom: "1px solid #f3f4f6", paddingBottom: 8 }}>
              Dispatch Origin Facility Address
            </h5>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>Hub / Facility Name</label>
                <input
                  type="text"
                  value={deliverySettings.originAddress?.companyName || ""}
                  onChange={(e) =>
                    setDeliverySettings({
                      ...deliverySettings,
                      originAddress: { ...deliverySettings.originAddress, companyName: e.target.value },
                    })
                  }
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>Address Line</label>
                <input
                  type="text"
                  value={deliverySettings.originAddress?.street || ""}
                  onChange={(e) =>
                    setDeliverySettings({
                      ...deliverySettings,
                      originAddress: { ...deliverySettings.originAddress, street: e.target.value },
                    })
                  }
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>City &amp; State</label>
                <input
                  type="text"
                  value={`${deliverySettings.originAddress?.city || "Mumbai"}, ${deliverySettings.originAddress?.state || "Maharashtra"}`}
                  onChange={(e) => {
                    const [city, state] = e.target.value.split(",");
                    setDeliverySettings({
                      ...deliverySettings,
                      originAddress: {
                        ...deliverySettings.originAddress,
                        city: city?.trim() || "Mumbai",
                        state: state?.trim() || "Maharashtra",
                      },
                    });
                  }}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>Postal Code</label>
                <input
                  type="text"
                  value={deliverySettings.originAddress?.pinCode || ""}
                  onChange={(e) =>
                    setDeliverySettings({
                      ...deliverySettings,
                      originAddress: { ...deliverySettings.originAddress, pinCode: e.target.value },
                    })
                  }
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="coupon-btn coupon-btn--primary"
              disabled={settingsSaving}
              style={{ marginTop: 10 }}
            >
              {settingsSaving ? "Saving Settings..." : "Save Delivery Configuration"}
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 8: REPORTS & EXPORTS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "reports" && (
        <div className="delivery-reports-tab">
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Delivery &amp; Logistics Analytics Reports</h4>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Export delivery manifests, courier SLA performance, failed delivery logs and COD cash reconciliation manifests
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {[
              {
                title: "Complete Dispatch Manifest",
                desc: "All booked shipments with customer details, order value, courier and tracking numbers",
                type: "shipments",
              },
              {
                title: "Delivered Orders & SLA Report",
                desc: "Delivered parcels with actual delivery duration and on-time performance",
                type: "delivered",
              },
              {
                title: "Failed & RTO Deliveries",
                desc: "All non-delivered attempts with detailed failure reasons and reattempt counts",
                type: "failed_returns",
              },
              {
                title: "Courier SLA Performance",
                desc: "Comparison of success rates, transit speeds, and failure rates across carriers",
                type: "partners",
              },
            ].map((rep) => (
              <div key={rep.type} style={{ background: "#fff", padding: 18, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <h5 style={{ margin: "0 0 6px", font: '600 15px "Manrope"' }}>{rep.title}</h5>
                <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#6b7280" }}>{rep.desc}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={exportDeliveryReportUrl(rep.type, "xlsx")}
                    className="coupon-btn coupon-btn--ghost"
                    download
                    style={{ textDecoration: "none", fontSize: 12 }}
                  >
                    <FileSpreadsheet size={13} /> Excel (.xlsx)
                  </a>
                  <a
                    href={exportDeliveryReportUrl(rep.type, "csv")}
                    className="coupon-btn coupon-btn--ghost"
                    download
                    style={{ textDecoration: "none", fontSize: 12 }}
                  >
                    <Download size={13} /> CSV
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE SHIPMENT
         ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 600,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Create Shipment for Order</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateShipmentSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Select Order to Ship</label>
                {unshippedOrders.length === 0 ? (
                  <p style={{ color: "#ef4444", fontSize: 12.5 }}>All active orders already have a shipment booked!</p>
                ) : (
                  <select
                    value={selectedOrderToShip?._id || ""}
                    onChange={(e) => {
                      const sel = unshippedOrders.find((o) => o._id === e.target.value);
                      setSelectedOrderToShip(sel);
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    {unshippedOrders.map((o) => (
                      <option key={o._id} value={o._id}>
                        Order #{String(o._id).slice(-8).toUpperCase()} &middot; {o.user?.name || "Customer"} &middot;{" "}
                        {formatPrice(o.totalAmount)} ({o.paymentMethod})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedOrderToShip && (
                <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 12.5 }}>
                  <div>
                    <strong>Customer:</strong> {selectedOrderToShip.user?.name || "Customer"} (
                    {selectedOrderToShip.user?.phoneNumber || "Phone"})
                  </div>
                  <div>
                    <strong>Delivery City:</strong> {selectedOrderToShip.shippingAddress?.city || "Mumbai"},{" "}
                    {selectedOrderToShip.shippingAddress?.state || "State"}
                  </div>
                  <div>
                    <strong>Items Count:</strong> {selectedOrderToShip.orderItems?.length || 1} product(s)
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600 }}>Courier Partner</label>
                  <select
                    value={newShipCourier}
                    onChange={(e) => setNewShipCourier(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    {couriers.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600 }}>Tracking / AWB #</label>
                  <input
                    type="text"
                    value={newShipTracking}
                    onChange={(e) => setNewShipTracking(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600 }}>Shipping Method</label>
                  <select
                    value={newShipMethod}
                    onChange={(e) => setNewShipMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="standard">Standard Surface Delivery</option>
                    <option value="express">Express Priority Air</option>
                    <option value="surface">Heavy Goods Surface</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600 }}>Package Weight</label>
                  <input
                    type="text"
                    value={newShipWeight}
                    onChange={(e) => setNewShipWeight(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="coupon-btn coupon-btn--primary"
                  disabled={creatingShipment || unshippedOrders.length === 0}
                >
                  {creatingShipment ? "Generating..." : "Generate Shipment & Label"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SHIPMENT TIMELINE & STATUS UPDATE DRAWER
         ───────────────────────────────────────────────────────────── */}
      {selectedShipment && !showReattemptModal && !showRtoModal && !showAssignModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 640,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>
                  Shipment {selectedShipment.shipmentId}
                </h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Tracking #{selectedShipment.trackingNumber || selectedShipment.awbNumber || "N/A"} &middot; {selectedShipment.courierName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions Row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => printShippingLabel(selectedShipment.order || selectedShipment)}
              >
                <Printer size={13} /> Print Label
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => printPackingSlip(selectedShipment.order || selectedShipment)}
              >
                <FileText size={13} /> Packing Slip
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => {
                  fetchDeliveryPersonnel().then(setPersonnel);
                  setShowAssignModal(true);
                }}
              >
                <UserCheck size={13} /> Assign Rider
              </button>
            </div>

            {/* Interactive Timeline */}
            <div style={{ background: "#f9fafb", padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <h5 style={{ margin: "0 0 12px", font: '600 14px "Manrope"' }}>Delivery Status Milestones</h5>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(selectedShipment.statusHistory || []).map((step, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: "#10b981",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      <Check size={12} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 13, color: "#111" }}>{step.status}</strong>
                      <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                        {new Date(step.date).toLocaleString()} {step.location && `&middot; ${step.location}`}
                      </div>
                      {step.remark && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{step.remark}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advance Status Form */}
            <form onSubmit={handleUpdateStatus} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              <h5 style={{ margin: "0 0 10px", font: '600 14px "Manrope"' }}>Advance Delivery Milestone</h5>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Target Status (13 Standard)</label>
                  <select
                    value={statusUpdateTarget}
                    onChange={(e) => setStatusUpdateTarget(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    {ALL_13_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Current Location / Hub</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai Logistics Hub"
                    value={statusLocation}
                    onChange={(e) => setStatusLocation(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Remark / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Scanned into sorting facility"
                  value={statusRemark}
                  onChange={(e) => setStatusRemark(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setSelectedShipment(null)}>
                  Close
                </button>
                <button type="submit" className="coupon-btn coupon-btn--primary" disabled={statusUpdating}>
                  {statusUpdating ? "Updating..." : "Update Milestone Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REATTEMPT DELIVERY
         ───────────────────────────────────────────────────────────── */}
      {showReattemptModal && selectedShipment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, padding: 22 }}>
            <h4 style={{ margin: "0 0 12px", font: '600 17px "Manrope"' }}>Schedule Delivery Reattempt</h4>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Next Attempt Date</label>
              <input
                type="date"
                value={reattemptDate}
                onChange={(e) => setReattemptDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Reason for Previous Failure</label>
              <select
                value={reattemptReason}
                onChange={(e) => setReattemptReason(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                <option value="Customer unavailable">Customer unavailable / Door locked</option>
                <option value="Incorrect address">Incorrect or incomplete address</option>
                <option value="Customer requested reschedule">Customer requested reschedule</option>
                <option value="Cash collection issue">Cash on delivery payment delay</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowReattemptModal(false)}>
                Cancel
              </button>
              <button type="button" className="coupon-btn coupon-btn--primary" onClick={handleConfirmReattempt}>
                Confirm Reattempt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: RETURN TO ORIGIN (RTO)
         ───────────────────────────────────────────────────────────── */}
      {showRtoModal && selectedShipment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, padding: 22 }}>
            <h4 style={{ margin: "0 0 12px", font: '600 17px "Manrope"', color: "#991b1b" }}>Process Return to Origin (RTO)</h4>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#6b7280" }}>
              Shipment will be routed back to origin facility. Inventory stock will automatically be returned to available sellable inventory.
            </p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>RTO Reason</label>
              <input
                type="text"
                value={rtoReason}
                onChange={(e) => setRtoReason(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={rtoRestoreStock}
                onChange={(e) => setRtoRestoreStock(e.target.checked)}
              />
              Automatically restore product stock to inventory ledger
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowRtoModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--primary"
                style={{ background: "#991b1b", borderColor: "#991b1b" }}
                onClick={handleConfirmRto}
              >
                Confirm RTO Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ASSIGN DELIVERY RIDER
         ───────────────────────────────────────────────────────────── */}
      {showAssignModal && selectedShipment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, padding: 22 }}>
            <h4 style={{ margin: "0 0 12px", font: '600 17px "Manrope"' }}>Assign Delivery Personnel</h4>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Select Delivery Rider</label>
              <select
                value={selectedPersonnelId}
                onChange={(e) => setSelectedPersonnelId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                <option value="">Select Rider...</option>
                {personnel.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.phone}) &middot; {p.status}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowAssignModal(false)}>
                Cancel
              </button>
              <button type="button" className="coupon-btn coupon-btn--primary" onClick={handleAssignRider}>
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: BULK PINCODES IMPORT
         ───────────────────────────────────────────────────────────── */}
      {showBulkPincodeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 500, padding: 22 }}>
            <h4 style={{ margin: "0 0 8px", font: '600 17px "Manrope"' }}>Bulk Import Serviceable Pincodes</h4>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>
              Paste comma-separated rows: <code>Pincode, City, State, DeliveryDays</code>
            </p>
            <textarea
              rows={6}
              placeholder="400001, Mumbai, Maharashtra, 2&#10;110001, Delhi, Delhi, 2&#10;560001, Bengaluru, Karnataka, 2"
              value={bulkPinText}
              onChange={(e) => setBulkPinText(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12.5 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowBulkPincodeModal(false)}>
                Cancel
              </button>
              <button type="button" className="coupon-btn coupon-btn--primary" onClick={handleBulkImportPins}>
                Import Pincodes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
