import { getStoredAdminToken, API_BASE } from "./api";

const authHeaders = () => {
  const token = getStoredAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface InventoryOverview {
  totalProducts: number;
  totalVariants: number;
  totalAvailableStock: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  totalDamagedStock: number;
  calculatedReservedStock: number;
  calculatedIncomingStock: number;
  categoryDistribution: { name: string; count: number; stock: number; value: number }[];
  lowStockAlerts: {
    id: string;
    productId: string;
    name: string;
    sku: string;
    stock: number;
    minLevel: number;
    status: string;
    urgency: "Critical" | "Warning" | "Normal";
  }[];
  recentAdjustments: any[];
  txCount: number;
}

export interface InventoryProductItem {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantTitle?: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  availableQuantity: number;
  reservedQuantity: number;
  minimumStockLevel: number;
  maximumStockLevel: number;
  sellingPrice: number;
  purchasePrice: number;
  totalStockValue: number;
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock" | "Overstocked";
  warehouseLocation: string;
  shelfBin: string;
  image: string;
  updatedAt: string;
  attributes?: Record<string, any>;
  hasVariants?: boolean;
}

export interface InventoryAdjustmentItem {
  _id: string;
  adjustmentNumber: string;
  product: any;
  productTitle: string;
  variantTitle?: string;
  sku: string;
  previousQuantity: number;
  adjustmentQuantity: number;
  newQuantity: number;
  adjustmentType: "Add" | "Remove" | "Set Exact" | "Scrap";
  reason: string;
  notes?: string;
  adjustedBy?: any;
  adjustmentDate: string;
}

export interface StockInwardItem {
  _id: string;
  inwardNumber: string;
  purchaseReference?: string;
  supplier?: any;
  supplierName: string;
  supplierInvoiceNumber?: string;
  items: {
    product: string;
    productTitle: string;
    variantId?: string;
    variantTitle?: string;
    sku: string;
    barcode?: string;
    orderedQuantity: number;
    receivedQuantity: number;
    purchasePrice: number;
    totalAmount: number;
    batchNumber?: string;
    expiryDate?: string;
  }[];
  totalAmount: number;
  totalQuantity: number;
  receivedDate: string;
  paymentStatus: "Paid" | "Pending" | "Partial";
  status: "Received" | "Partially Received" | "Pending" | "Cancelled";
  notes?: string;
}

export interface SupplierItem {
  _id: string;
  supplierName: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  gstNumber?: string;
  status: "Active" | "Inactive";
  totalPurchaseAmount: number;
  outstandingAmount: number;
  paymentTerms?: string;
  notes?: string;
}

export interface WarehouseItem {
  _id: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    country?: string;
  };
  capacity: number;
  currentStockCount: number;
  isDefault: boolean;
  status: "Active" | "Inactive";
  notes?: string;
}

export interface StockTransferItem {
  _id: string;
  transferNumber: string;
  sourceLocation: string;
  destinationLocation: string;
  items: {
    product: string;
    productTitle: string;
    variantId?: string;
    variantTitle?: string;
    sku: string;
    quantity: number;
  }[];
  status: "Pending" | "Dispatched" | "Received" | "Cancelled";
  notes?: string;
  transferDate: string;
}

export interface InventoryMovementItem {
  _id: string;
  key: string;
  product: string;
  productTitle: string;
  variantName?: string;
  sku: string;
  action: string;
  transactionType: string;
  quantity: number;
  previousStock: number;
  currentStock: number;
  referenceId?: string;
  reason?: string;
  timestamp: string;
}

export const fetchInventoryOverview = async (): Promise<InventoryOverview> => {
  const res = await fetch(`${API_BASE}/inventory/overview`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch inventory overview");
  return data.data;
};

export const fetchInventoryProducts = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  brand?: string;
  stockStatus?: string;
  sort?: string;
}): Promise<{ items: InventoryProductItem[]; total: number; page: number; pages: number }> => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.brand && params.brand !== "All") query.set("brand", params.brand);
  if (params.stockStatus && params.stockStatus !== "All") query.set("stockStatus", params.stockStatus);
  if (params.sort) query.set("sort", params.sort);

  const res = await fetch(`${API_BASE}/inventory/products?${query.toString()}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch products");
  return data.data;
};

export const updateProductInventory = async (productId: string, updates: any): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/products/${productId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update product inventory");
  return data.data;
};

export const bulkUpdateStock = async (updates: { productId: string; variantId?: string; stock: number }[]): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/products/bulk-update`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ updates }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update bulk stock");
  return data.data;
};

export const adjustStock = async (payload: {
  productId: string;
  variantId?: string;
  adjustmentQuantity: number;
  adjustmentType: "Add" | "Remove" | "Set Exact" | "Scrap";
  reason: string;
  notes?: string;
}): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/adjust`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to adjust stock");
  return data.data;
};

export const fetchAdjustments = async (page = 1, limit = 20): Promise<{ adjustments: InventoryAdjustmentItem[]; total: number }> => {
  const res = await fetch(`${API_BASE}/inventory/adjustments?page=${page}&limit=${limit}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch stock adjustments");
  return data.data;
};

export const createStockInward = async (payload: any): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/stock-in`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to record stock inward");
  return data.data;
};

export const fetchStockInwards = async (page = 1, limit = 20): Promise<{ inwards: StockInwardItem[]; total: number }> => {
  const res = await fetch(`${API_BASE}/inventory/stock-in?page=${page}&limit=${limit}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch stock inwards");
  return data.data;
};

export const fetchMovements = async (params: { page?: number; limit?: number; action?: string; search?: string }): Promise<{ movements: InventoryMovementItem[]; total: number }> => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.action && params.action !== "All") query.set("action", params.action);
  if (params.search) query.set("search", params.search);

  const res = await fetch(`${API_BASE}/inventory/movements?${query.toString()}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch movements ledger");
  return data.data;
};

export const fetchAlerts = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/inventory/alerts`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch alerts");
  return data.data;
};

export const fetchInventoryReports = async (): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/reports`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch reports");
  return data.data;
};

// Suppliers
export const fetchSuppliers = async (): Promise<SupplierItem[]> => {
  const res = await fetch(`${API_BASE}/inventory/suppliers`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch suppliers");
  return data.data;
};

export const createSupplier = async (payload: any): Promise<SupplierItem> => {
  const res = await fetch(`${API_BASE}/inventory/suppliers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create supplier");
  return data.data;
};

export const updateSupplier = async (id: string, payload: any): Promise<SupplierItem> => {
  const res = await fetch(`${API_BASE}/inventory/suppliers/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update supplier");
  return data.data;
};

export const deleteSupplier = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/inventory/suppliers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete supplier");
  return true;
};

// Warehouses
export const fetchWarehouses = async (): Promise<WarehouseItem[]> => {
  const res = await fetch(`${API_BASE}/inventory/warehouses`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch warehouses");
  return data.data;
};

export const createWarehouse = async (payload: any): Promise<WarehouseItem> => {
  const res = await fetch(`${API_BASE}/inventory/warehouses`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create warehouse");
  return data.data;
};

export const updateWarehouse = async (id: string, payload: any): Promise<WarehouseItem> => {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update warehouse");
  return data.data;
};

export const deleteWarehouse = async (id: string): Promise<boolean> => {
  const res = await fetch(`${API_BASE}/inventory/warehouses/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to delete warehouse");
  return true;
};

// Transfers
export const fetchTransfers = async (): Promise<StockTransferItem[]> => {
  const res = await fetch(`${API_BASE}/inventory/transfers`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch transfers");
  return data.data;
};

export const createTransfer = async (payload: any): Promise<StockTransferItem> => {
  const res = await fetch(`${API_BASE}/inventory/transfers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to create stock transfer");
  return data.data;
};

export const updateTransferStatus = async (id: string, status: string): Promise<any> => {
  const res = await fetch(`${API_BASE}/inventory/transfers/${id}/status`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to update transfer status");
  return data.data;
};

// SKU & Barcode Automation
export const autoGenerateSku = async (params: { category?: string; brand?: string; name?: string; variantName?: string }): Promise<string> => {
  const res = await fetch(`${API_BASE}/inventory/sku/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to generate SKU");
  return data.sku;
};

export const autoGenerateBarcode = async (): Promise<string> => {
  const res = await fetch(`${API_BASE}/inventory/barcode/generate`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to generate barcode");
  return data.barcode;
};

export const searchInventoryByBarcodeOrSku = async (query: string): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/inventory/barcode/search?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to search product by barcode");
  return data.data;
};

export const exportInventoryReportUrl = (type = "current_stock", format = "xlsx"): string => {
  return `${API_BASE}/inventory/export?type=${type}&format=${format}`;
};
