import { getStoredAdminToken, API_BASE } from "./api";

const authHeaders = () => {
  const token = getStoredAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface DeliveryDashboardKPIs {
  totalShipments: number;
  pendingDeliveries: number;
  processingShipments: number;
  readyToShip: number;
  shippedOrders: number;
  inTransit: number;
  outForDelivery: number;
  successfullyDelivered: number;
  failedDeliveries: number;
  returnedShipments: number;
  cancelledShipments: number;
  avgDeliveryTimeDays: string;
  totalShippingCharges: number;
}

export interface DeliveryDashboardCharts {
  dailyTrend: { date: string; created: number; delivered: number; failed: number; inTransit: number }[];
  statusDistribution: { name: string; value: number; color: string }[];
  partnerComparison: { name: string; total: number; delivered: number; failed: number }[];
}

export interface ShipmentItem {
  _id: string;
  shipmentId: string;
  order: any;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: {
    fullName: string;
    mobileNumber: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state?: string;
    country: string;
    pincode: string;
  };
  courierProvider?: any;
  courierName?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  shippingMethod: "standard" | "express" | "surface" | "air" | "other";
  packageWeight?: string;
  packageDimensions?: string;
  numberOfPackages?: number;
  shippingCharges?: number;
  codCharges?: number;
  totalCharges?: number;
  orderDate?: string;
  packingDate?: string;
  dispatchDate?: string;
  estimatedDeliveryDate?: string;
  deliveredDate?: string;
  paymentType: "Prepaid" | "Cash on Delivery";
  status: string;
  assignedPersonnel?: {
    personnelId?: string;
    name?: string;
    phone?: string;
    assignedAt?: string;
  };
  failedDeliveryReason?: string;
  reattemptCount?: number;
  nextDeliveryAttemptDate?: string;
  remarks?: string;
  specialInstructions?: string;
  statusHistory?: {
    _id?: string;
    status: string;
    date: string;
    time?: string;
    remark?: string;
    location?: string;
    adminName?: string;
  }[];
  notes?: { _id?: string; note: string; adminName?: string; createdAt?: string }[];
  activityLog?: { action: string; adminName?: string; createdAt?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CourierPartnerItem {
  _id: string;
  name: string;
  partnerCode?: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  trackingUrlTemplate?: string;
  serviceTypes?: string[];
  apiConfig?: {
    provider?: string;
    apiKey?: string;
    apiSecret?: string;
    accountId?: string;
    endpointUrl?: string;
    isLive?: boolean;
    webhookSecret?: string;
  };
  serviceAvailability?: {
    allIndia?: boolean;
    codAvailable?: boolean;
    international?: boolean;
  };
  performance?: {
    totalShipments: number;
    deliveredShipments: number;
    failedShipments: number;
    avgDeliveryDays: number;
    rating: number;
  };
  isActive: boolean;
}

export interface DeliveryZoneItem {
  _id: string;
  name: string;
  code: string;
  states: string[];
  cities: string[];
  standardDeliveryDays: number;
  expressDeliveryDays: number;
  standardRate: number;
  expressRate: number;
  codAvailable: boolean;
  isActive: boolean;
}

export interface DeliveryPincodeItem {
  _id: string;
  pincode: string;
  city: string;
  state: string;
  zone?: any;
  isServiceable: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  estimatedDays: number;
  courierPartners?: string[];
}

export interface DeliveryPersonnelItem {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleNumber?: string;
  vehicleType: "Bike" | "Van" | "Scooter" | "Truck" | "Other";
  status: "Available" | "On Delivery" | "Off Duty";
  assignedOrdersCount: number;
  completedDeliveries: number;
  failedAttempts: number;
  rating: number;
  currentRoute?: string;
  isActive: boolean;
}

export interface DeliverySettingsData {
  defaultPartner: string;
  defaultMethod: string;
  standardShippingFee: number;
  expressShippingFee: number;
  freeShippingThreshold: number;
  codFee: number;
  codEnabled: boolean;
  originAddress: {
    companyName: string;
    street: string;
    landmark?: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    phone: string;
    email: string;
  };
  returnAddress: {
    companyName: string;
    street: string;
    landmark?: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    phone: string;
    email: string;
  };
  labelConfig: {
    companyLogoUrl?: string;
    showBarcode: boolean;
    showReturnAddress: boolean;
    paperSize: string;
    declarationText: string;
  };
  notificationPrefs: {
    notifyOnPacked: boolean;
    notifyOnDispatched: boolean;
    notifyOnOutForDelivery: boolean;
    notifyOnDelivered: boolean;
    notifyOnFailed: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
  };
  autoStatusAdvance: boolean;
}

//
// Dashboard
//
export const fetchDeliveryDashboard = async (): Promise<{ kpis: DeliveryDashboardKPIs; charts: DeliveryDashboardCharts }> => {
  const res = await fetch(`${API_BASE}/admin/delivery/dashboard`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch delivery dashboard");
  return data.data;
};

//
// Shipments
//
export const fetchShipments = async (params: {
  search?: string;
  status?: string;
  courier?: string;
  paymentType?: string;
  sort?: string;
}): Promise<{ shipments: ShipmentItem[]; analytics: any; charts: any }> => {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "All") query.set("status", params.status);
  if (params.courier && params.courier !== "All") query.set("courier", params.courier);
  if (params.paymentType && params.paymentType !== "All") query.set("paymentType", params.paymentType);
  if (params.sort) query.set("sort", params.sort);

  const res = await fetch(`${API_BASE}/admin/shipments?${query.toString()}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch shipments");
  return data;
};

export const fetchOrdersReadyForShipment = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/admin/shipments/orders`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch orders ready for shipping");
  return data.orders || [];
};

export const createShipment = async (payload: any): Promise<ShipmentItem> => {
  const res = await fetch(`${API_BASE}/admin/shipments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create shipment");
  return data.shipment;
};

export const updateShipment = async (id: string, payload: any): Promise<ShipmentItem> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update shipment");
  return data.shipment;
};

export const updateShipmentStatus = async (
  id: string,
  payload: { status: string; remark?: string; location?: string; internalNote?: string }
): Promise<ShipmentItem> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update shipment status");
  return data.shipment;
};

export const deleteShipment = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete shipment");
  return true;
};

export const assignShipmentPersonnel = async (shipmentId: string, personnelId: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${shipmentId}/assign`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ personnelId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to assign delivery agent");
  return data.shipment;
};

export const reattemptShipmentDelivery = async (
  shipmentId: string,
  payload: { nextAttemptDate?: string; remarks?: string; reason?: string }
): Promise<any> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${shipmentId}/reattempt`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to reattempt delivery");
  return data.shipment;
};

export const processShipmentRto = async (
  shipmentId: string,
  payload: { reason: string; remarks?: string; restoreStock?: boolean }
): Promise<any> => {
  const res = await fetch(`${API_BASE}/admin/shipments/${shipmentId}/rto`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to process Return to Origin");
  return data.shipment;
};

//
// Shipping Partners / Couriers
//
export const fetchCouriers = async (): Promise<CourierPartnerItem[]> => {
  const res = await fetch(`${API_BASE}/admin/couriers`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch courier partners");
  return data.couriers || [];
};

export const createCourierPartner = async (payload: any): Promise<CourierPartnerItem> => {
  const res = await fetch(`${API_BASE}/admin/couriers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create courier partner");
  return data.courier;
};

export const updateCourierPartner = async (id: string, payload: any): Promise<CourierPartnerItem> => {
  const res = await fetch(`${API_BASE}/admin/couriers/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update courier partner");
  return data.courier;
};

export const toggleCourierPartner = async (id: string): Promise<CourierPartnerItem> => {
  const res = await fetch(`${API_BASE}/admin/couriers/${id}/toggle`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to toggle partner status");
  return data.courier;
};

export const deleteCourierPartner = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/admin/couriers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete courier partner");
  return true;
};

//
// Delivery Zones
//
export const fetchDeliveryZones = async (): Promise<DeliveryZoneItem[]> => {
  const res = await fetch(`${API_BASE}/admin/delivery/zones`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch delivery zones");
  return data.zones || [];
};

export const createDeliveryZone = async (payload: any): Promise<DeliveryZoneItem> => {
  const res = await fetch(`${API_BASE}/admin/delivery/zones`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create delivery zone");
  return data.zone;
};

export const updateDeliveryZone = async (id: string, payload: any): Promise<DeliveryZoneItem> => {
  const res = await fetch(`${API_BASE}/admin/delivery/zones/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update delivery zone");
  return data.zone;
};

export const deleteDeliveryZone = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/admin/delivery/zones/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete delivery zone");
  return true;
};

//
// Pincodes
//
export const fetchPincodes = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  serviceable?: string;
}): Promise<{ pincodes: DeliveryPincodeItem[]; total: number; page: number; pages: number }> => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.serviceable !== undefined && params.serviceable !== "All") query.set("serviceable", params.serviceable);

  const res = await fetch(`${API_BASE}/admin/delivery/pincodes?${query.toString()}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch pincodes");
  return data;
};

export const createPincode = async (payload: any): Promise<DeliveryPincodeItem> => {
  const res = await fetch(`${API_BASE}/admin/delivery/pincodes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create pincode");
  return data.pincode;
};

export const deletePincode = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/admin/delivery/pincodes/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete pincode");
  return true;
};

export const bulkImportPincodes = async (pincodes: any[]): Promise<{ count: number }> => {
  const res = await fetch(`${API_BASE}/admin/delivery/pincodes/bulk-import`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ pincodes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to import pincodes");
  return data;
};

//
// Delivery Personnel
//
export const fetchDeliveryPersonnel = async (): Promise<DeliveryPersonnelItem[]> => {
  const res = await fetch(`${API_BASE}/admin/delivery/personnel`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch delivery personnel");
  return data.personnel || [];
};

export const createDeliveryPersonnel = async (payload: any): Promise<DeliveryPersonnelItem> => {
  const res = await fetch(`${API_BASE}/admin/delivery/personnel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create delivery rider");
  return data.personnel;
};

export const updateDeliveryPersonnel = async (id: string, payload: any): Promise<DeliveryPersonnelItem> => {
  const res = await fetch(`${API_BASE}/admin/delivery/personnel/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update delivery rider");
  return data.personnel;
};

export const deleteDeliveryPersonnel = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/admin/delivery/personnel/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete delivery rider");
  return true;
};

//
// Failed Deliveries & Returns (RTO)
//
export const fetchFailedDeliveries = async (): Promise<ShipmentItem[]> => {
  const res = await fetch(`${API_BASE}/admin/delivery/failed-returns`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch failed deliveries");
  return data.shipments || [];
};

//
// Settings
//
export const fetchDeliverySettings = async (): Promise<DeliverySettingsData> => {
  const res = await fetch(`${API_BASE}/admin/delivery/settings`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch delivery settings");
  return data.settings;
};

export const updateDeliverySettings = async (payload: Partial<DeliverySettingsData>): Promise<DeliverySettingsData> => {
  const res = await fetch(`${API_BASE}/admin/delivery/settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update delivery settings");
  return data.settings;
};

//
// Public Order Tracking
//
export const fetchPublicOrderTracking = async (identifier: string, phone?: string): Promise<any> => {
  const query = phone ? `?phone=${encodeURIComponent(phone)}` : "";
  const res = await fetch(`${API_BASE}/shipments/track/${encodeURIComponent(identifier)}${query}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Shipment tracking record not found");
  return data.tracking;
};

export const checkPincode = async (pincode: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/shipments/check-pincode/${encodeURIComponent(pincode)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Pincode service check failed");
  return data;
};

export const exportDeliveryReportUrl = (reportType = "shipments", format = "xlsx"): string => {
  return `${API_BASE}/admin/delivery/reports?reportType=${reportType}&format=${format}`;
};
