import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Boxes,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Search,
  Plus,
  ArrowUpDown,
  Download,
  Filter,
  Eye,
  SlidersHorizontal,
  Warehouse as WarehouseIcon,
  Truck,
  Building2,
  Barcode,
  History,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Layers,
  ArrowRightLeft,
  X,
  Trash2,
  Edit,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ScanLine,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  fetchInventoryOverview,
  fetchInventoryProducts,
  updateProductInventory,
  bulkUpdateStock,
  adjustStock,
  fetchAdjustments,
  createStockInward,
  fetchStockInwards,
  fetchMovements,
  fetchAlerts,
  fetchInventoryReports,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  fetchTransfers,
  createTransfer,
  updateTransferStatus,
  autoGenerateSku,
  autoGenerateBarcode,
  searchInventoryByBarcodeOrSku,
  exportInventoryReportUrl,
  type InventoryOverview,
  type InventoryProductItem,
  type InventoryAdjustmentItem,
  type StockInwardItem,
  type SupplierItem,
  type WarehouseItem,
  type StockTransferItem,
  type InventoryMovementItem,
} from "../../services/inventoryApi";
import { formatPrice } from "../../utils/currency";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

type TabType =
  | "overview"
  | "products"
  | "adjustments"
  | "inwards"
  | "suppliers"
  | "warehouses"
  | "alerts"
  | "barcode"
  | "ledger"
  | "reports";

export default function InventoryAdmin({
  adminUser,
  onRefresh,
}: {
  adminUser?: any;
  onRefresh?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(false);

  // Overview Data
  const [overview, setOverview] = useState<InventoryOverview | null>(null);

  // Products Table
  const [products, setProducts] = useState<InventoryProductItem[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All");
  const [stockStatusFilter, setStockStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("stock_desc");

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    image: true,
    name: true,
    sku: true,
    category: true,
    available: true,
    reserved: true,
    minMax: true,
    sellingPrice: true,
    purchasePrice: true,
    valuation: true,
    status: true,
    warehouse: true,
    actions: true,
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<InventoryProductItem | null>(null);
  const [adjustType, setAdjustType] = useState<"Add" | "Remove" | "Set Exact" | "Scrap">("Add");
  const [adjustQty, setAdjustQty] = useState("5");
  const [adjustReason, setAdjustReason] = useState("Physical Audit Mismatch");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Bulk Update Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<{ id: string; name: string; sku: string; currentStock: number; newStock: number }[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Stock Inward / Purchase Order Modal
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardSupplier, setInwardSupplier] = useState("");
  const [inwardInvoiceNo, setInwardInvoiceNo] = useState("");
  const [inwardPoRef, setInwardPoRef] = useState("");
  const [inwardItems, setInwardItems] = useState<
    { product: string; productTitle: string; sku: string; orderedQty: number; receivedQty: number; purchasePrice: number }[]
  >([]);
  const [inwardSubmitting, setInwardSubmitting] = useState(false);

  // Suppliers State
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [supName, setSupName] = useState("");
  const [supCompany, setSupCompany] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supGst, setSupGst] = useState("");
  const [supTerms, setSupTerms] = useState("Net 30");

  // Warehouses State
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whContact, setWhContact] = useState("");
  const [whPhone, setWhPhone] = useState("");
  const [whCity, setWhCity] = useState("");
  const [whState, setWhState] = useState("");
  const [whCapacity, setWhCapacity] = useState("10000");

  // Transfers State
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [trSource, setTrSource] = useState("");
  const [trDest, setTrDest] = useState("");
  const [trProduct, setTrProduct] = useState("");
  const [trQty, setTrQty] = useState("1");
  const [trNotes, setTrNotes] = useState("");

  // Ledger Movements
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [movementActionFilter, setMovementActionFilter] = useState("All");

  // Inwards List & Adjustments List
  const [inwardsList, setInwardsList] = useState<StockInwardItem[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<InventoryAdjustmentItem[]>([]);

  // Barcode / SKU Tools
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedResults, setScannedResults] = useState<any[]>([]);
  const [generatedSku, setGeneratedSku] = useState("");
  const [generatedBarcode, setGeneratedBarcode] = useState("");
  const [skuCategory, setSkuCategory] = useState("Laptops");
  const [skuBrand, setSkuBrand] = useState("Apple");
  const [skuName, setSkuName] = useState("MacBook Pro");

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchInventoryOverview();
      setOverview(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory overview");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Products Catalog
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchInventoryProducts({
        page,
        limit,
        search,
        category: categoryFilter,
        brand: brandFilter,
        stockStatus: stockStatusFilter,
        sort: sortBy,
      });
      setProducts(data.items);
      setProductTotal(data.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load products inventory");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, categoryFilter, brandFilter, stockStatusFilter, sortBy]);

  // Load Tab Specific Data
  useEffect(() => {
    if (activeTab === "overview") {
      loadOverview();
    } else if (activeTab === "products") {
      loadProducts();
    } else if (activeTab === "adjustments") {
      fetchAdjustments(1, 50).then((res) => setAdjustmentsList(res.adjustments)).catch(console.error);
    } else if (activeTab === "inwards") {
      fetchStockInwards(1, 50).then((res) => setInwardsList(res.inwards)).catch(console.error);
      fetchSuppliers().then(setSuppliers).catch(console.error);
    } else if (activeTab === "suppliers") {
      fetchSuppliers().then(setSuppliers).catch(console.error);
    } else if (activeTab === "warehouses") {
      fetchWarehouses().then(setWarehouses).catch(console.error);
      fetchTransfers().then(setTransfers).catch(console.error);
    } else if (activeTab === "ledger") {
      fetchMovements({ action: movementActionFilter }).then((res) => setMovements(res.movements)).catch(console.error);
    }
  }, [activeTab, loadOverview, loadProducts, movementActionFilter]);

  // Handle Adjustment Submit
  const handlePerformAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setAdjustSubmitting(true);
    try {
      await adjustStock({
        productId: selectedProductForAdjust.productId,
        variantId: selectedProductForAdjust.variantId || undefined,
        adjustmentQuantity: qty,
        adjustmentType: adjustType,
        reason: adjustReason,
        notes: adjustNotes,
      });
      toast.success("Stock adjusted successfully!");
      setShowAdjustModal(false);
      setSelectedProductForAdjust(null);
      setAdjustNotes("");
      loadProducts();
      loadOverview();
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust stock");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Open Adjust Modal for a product
  const openAdjust = (item: InventoryProductItem) => {
    setSelectedProductForAdjust(item);
    setAdjustType("Add");
    setAdjustQty("5");
    setAdjustReason("Physical Audit Mismatch");
    setAdjustNotes("");
    setShowAdjustModal(true);
  };

  // Handle Bulk Modal Open
  const openBulkModal = () => {
    const rows = products.slice(0, 10).map((p) => ({
      id: p.id,
      name: p.productName,
      sku: p.sku,
      currentStock: p.availableQuantity,
      newStock: p.availableQuantity,
    }));
    setBulkRows(rows);
    setShowBulkModal(true);
  };

  const handleSaveBulk = async () => {
    setBulkSubmitting(true);
    try {
      const updates = bulkRows.map((r) => {
        const [productId, variantId] = r.id.split("_");
        return {
          productId,
          variantId: variantId || undefined,
          stock: Number(r.newStock) || 0,
        };
      });
      await bulkUpdateStock(updates);
      toast.success("Bulk stock updated successfully!");
      setShowBulkModal(false);
      loadProducts();
      loadOverview();
    } catch (err: any) {
      toast.error(err.message || "Bulk update failed");
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Handle Supplier Save
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      const payload = {
        supplierName: supName.trim(),
        companyName: supCompany.trim(),
        contactPerson: supContact.trim(),
        phone: supPhone.trim(),
        email: supEmail.trim(),
        gstNumber: supGst.trim(),
        paymentTerms: supTerms,
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier._id, payload);
        toast.success("Supplier updated successfully!");
      } else {
        await createSupplier(payload);
        toast.success("Supplier created successfully!");
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      fetchSuppliers().then(setSuppliers);
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier");
    }
  };

  // Handle Warehouse Save
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) {
      toast.error("Warehouse name and code are required");
      return;
    }
    try {
      await createWarehouse({
        name: whName.trim(),
        code: whCode.trim().toUpperCase(),
        contactPerson: whContact.trim(),
        phone: whPhone.trim(),
        address: { city: whCity.trim(), state: whState.trim(), country: "India" },
        capacity: Number(whCapacity) || 10000,
      });
      toast.success("Warehouse created!");
      setShowWarehouseModal(false);
      setWhName("");
      setWhCode("");
      fetchWarehouses().then(setWarehouses);
    } catch (err: any) {
      toast.error(err.message || "Failed to create warehouse");
    }
  };

  // Handle Transfer Create
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trDest) {
      toast.error("Select destination warehouse");
      return;
    }
    const selProd = products.find((p) => p.productId === trProduct || p.id === trProduct);
    if (!selProd) {
      toast.error("Select a product to transfer");
      return;
    }
    try {
      await createTransfer({
        sourceLocation: trSource || "Main Central Fulfillment Hub",
        destinationLocation: trDest,
        items: [
          {
            product: selProd.productId,
            productTitle: selProd.productName,
            sku: selProd.sku,
            quantity: Number(trQty) || 1,
          },
        ],
        notes: trNotes,
      });
      toast.success("Transfer initiated!");
      setShowTransferModal(false);
      fetchTransfers().then(setTransfers);
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate transfer");
    }
  };

  // Handle Barcode Scanner Search
  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const res = await searchInventoryByBarcodeOrSku(barcodeInput.trim());
      setScannedResults(res);
      if (res.length === 0) toast.error("No product found matching this SKU/Barcode");
    } catch (err: any) {
      toast.error(err.message || "Scan lookup failed");
    }
  };

  const handleGenSku = async () => {
    try {
      const sku = await autoGenerateSku({ category: skuCategory, brand: skuBrand, name: skuName });
      setGeneratedSku(sku);
      toast.success(`Generated SKU: ${sku}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate SKU");
    }
  };

  const handleGenBarcode = async () => {
    try {
      const bc = await autoGenerateBarcode();
      setGeneratedBarcode(bc);
      toast.success(`Generated Barcode: ${bc}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate barcode");
    }
  };

  // Calculate adjusted stock preview
  const previewStock = useMemo(() => {
    if (!selectedProductForAdjust) return 0;
    const current = selectedProductForAdjust.availableQuantity;
    const delta = parseInt(adjustQty, 10) || 0;
    if (adjustType === "Add") return current + delta;
    if (adjustType === "Remove" || adjustType === "Scrap") return Math.max(0, current - delta);
    if (adjustType === "Set Exact") return delta;
    return current;
  }, [selectedProductForAdjust, adjustType, adjustQty]);

  return (
    <div className="admin-tab-view inventory-admin">
      {/* Top Header & Sub-nav toolbar */}
      <div className="admin-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Catalog &amp; Warehousing</p>
          <h2 style={{ font: '600 22px "Manrope", sans-serif', margin: "4px 0 0", color: "#111" }}>
            Inventory Management System
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="coupon-btn coupon-btn--ghost"
            onClick={() => {
              loadOverview();
              loadProducts();
              toast.success("Inventory re-synchronized with live stock");
            }}
            title="Refresh inventory counts"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>

          <a
            href={exportInventoryReportUrl("current_stock", "xlsx")}
            className="coupon-btn coupon-btn--ghost"
            download
            style={{ textDecoration: "none" }}
          >
            <FileSpreadsheet size={14} /> Export Excel
          </a>

          <button
            type="button"
            className="coupon-btn coupon-btn--primary"
            onClick={() => {
              if (activeTab === "suppliers") setShowSupplierModal(true);
              else if (activeTab === "warehouses") setShowWarehouseModal(true);
              else {
                setActiveTab("products");
                openBulkModal();
              }
            }}
          >
            <Plus size={15} />
            {activeTab === "suppliers" ? "Add Supplier" : activeTab === "warehouses" ? "New Warehouse" : "Bulk Stock Update"}
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="inventory-nav-tabs" style={{ display: "flex", gap: 6, borderBottom: "1px solid #e5e7eb", margin: "16px 0 20px", overflowX: "auto" }}>
        {[
          { key: "overview", label: "Dashboard", icon: Boxes },
          { key: "products", label: "Product Inventory", icon: Package },
          { key: "adjustments", label: "Stock Adjustments", icon: SlidersHorizontal },
          { key: "inwards", label: "Purchase Orders (Inwards)", icon: Truck },
          { key: "suppliers", label: "Suppliers", icon: Building2 },
          { key: "warehouses", label: "Warehouses & Transfers", icon: WarehouseIcon },
          { key: "alerts", label: "Stock Alerts", icon: AlertTriangle, count: overview?.lowStockAlerts?.length },
          { key: "barcode", label: "SKU & Barcodes", icon: Barcode },
          { key: "ledger", label: "Transactions Ledger", icon: History },
          { key: "reports", label: "Valuation & Reports", icon: FileText },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabType)}
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
          TAB 1: OVERVIEW DASHBOARD
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="inventory-overview-tab">
          {/* KPI Summary Cards */}
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <div className="stat-card" style={{ background: "#fff", padding: "16px 18px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Total Products</span>
                <Package size={18} color="#3b82f6" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8 }}>
                {overview?.totalProducts ?? 0}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>
                Across {overview?.totalVariants ?? 0} active SKU variants
              </small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px 18px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Available Stock</span>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#10b981" }}>
                {overview?.totalAvailableStock ?? 0} units
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Ready for immediate fulfillment</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px 18px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Reserved in Orders</span>
                <Boxes size={18} color="#f59e0b" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#f59e0b" }}>
                {overview?.calculatedReservedStock ?? 0} units
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Allocated to pending dispatches</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px 18px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Low / Out of Stock</span>
                <AlertTriangle size={18} color="#ef4444" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#ef4444" }}>
                {overview?.lowStockCount ?? 0} / {overview?.outOfStockCount ?? 0}
              </strong>
              <small style={{ color: "#b91c1c", fontSize: 11.5, fontWeight: 500 }}>Requires restock attention</small>
            </div>

            <div className="stat-card" style={{ background: "#fff", padding: "16px 18px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Total Valuation</span>
                <DollarSign size={18} color="#6366f1" />
              </div>
              <strong style={{ fontSize: 24, font: '700 24px "Manrope"', display: "block", marginTop: 8, color: "#111" }}>
                {formatPrice(overview?.totalInventoryValue ?? 0)}
              </strong>
              <small style={{ color: "#6b7280", fontSize: 11.5 }}>Total retail valuation</small>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginTop: 20 }}>
            {/* Category Stock Distribution Chart */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 14px", font: '600 15px "Manrope"' }}>Stock by Category</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview?.categoryDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [name === "stock" ? `${val} units` : formatPrice(val), name === "stock" ? "Stock" : "Value"]}
                    />
                    <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units in Stock" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Valuation by Category Pie Chart */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 14px", font: '600 15px "Manrope"' }}>Inventory Valuation Breakdown</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={overview?.categoryDistribution || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {(overview?.categoryDistribution || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatPrice(val), "Valuation"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Critical Low Stock Quick Warnings */}
          <div style={{ marginTop: 24, background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, font: '600 15px "Manrope"', display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={17} color="#ef4444" /> Priority Low Stock Alerts
                </h4>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                  Items with zero stock or below configured minimum reorder threshold
                </p>
              </div>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => setActiveTab("alerts")}
                style={{ fontSize: 12 }}
              >
                View all alerts &rarr;
              </button>
            </div>

            {overview?.lowStockAlerts && overview.lowStockAlerts.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "8px 12px" }}>Product Name</th>
                      <th style={{ padding: "8px 12px" }}>SKU</th>
                      <th style={{ padding: "8px 12px" }}>Current Stock</th>
                      <th style={{ padding: "8px 12px" }}>Min Threshold</th>
                      <th style={{ padding: "8px 12px" }}>Urgency</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.lowStockAlerts.slice(0, 5).map((alert) => (
                      <tr key={alert.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{alert.name}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#4b5563" }}>{alert.sku}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: alert.stock === 0 ? "#ef4444" : "#f59e0b" }}>
                          {alert.stock} units
                        </td>
                        <td style={{ padding: "10px 12px" }}>{alert.minLevel} units</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: alert.urgency === "Critical" ? "#fee2e2" : "#fef3c7",
                              color: alert.urgency === "Critical" ? "#b91c1c" : "#b45309",
                            }}
                          >
                            {alert.urgency}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--ghost"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => {
                              setActiveTab("products");
                              setSearch(alert.sku);
                            }}
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "30px", textAlign: "center", color: "#10b981" }}>
                <CheckCircle2 size={32} style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontWeight: 500 }}>All products currently meet healthy stock thresholds!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: PRODUCT INVENTORY TABLE
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "products" && (
        <div className="inventory-products-tab">
          {/* Search, Filter, Sort and Column Visibility Toolbar */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Search by product name, SKU, or barcode..."
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
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="All">All Categories</option>
              {overview?.categoryDistribution.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="All">All Stock Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Overstocked">Overstocked</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="stock_desc">Highest Stock</option>
              <option value="stock_asc">Lowest Stock</option>
              <option value="name_asc">Name A-Z</option>
              <option value="value_desc">Highest Valuation</option>
            </select>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => setShowColPicker(!showColPicker)}
                title="Customize table columns"
              >
                <Eye size={14} /> Columns
              </button>
              {showColPicker && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 6,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    zIndex: 50,
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    width: 180,
                  }}
                >
                  <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Toggle Columns</strong>
                  {Object.keys(visibleColumns).map((col) => (
                    <label key={col} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={() => setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }))}
                      />
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Products Table */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    {visibleColumns.image && <th style={{ padding: "10px 12px", width: 50 }}>Image</th>}
                    {visibleColumns.name && <th style={{ padding: "10px 12px" }}>Product Name / Variant</th>}
                    {visibleColumns.sku && <th style={{ padding: "10px 12px" }}>SKU &amp; Barcode</th>}
                    {visibleColumns.category && <th style={{ padding: "10px 12px" }}>Category</th>}
                    {visibleColumns.available && <th style={{ padding: "10px 12px" }}>Available Stock</th>}
                    {visibleColumns.reserved && <th style={{ padding: "10px 12px" }}>Reserved</th>}
                    {visibleColumns.minMax && <th style={{ padding: "10px 12px" }}>Min / Max</th>}
                    {visibleColumns.sellingPrice && <th style={{ padding: "10px 12px" }}>Selling Price</th>}
                    {visibleColumns.purchasePrice && <th style={{ padding: "10px 12px" }}>Purchase Cost</th>}
                    {visibleColumns.valuation && <th style={{ padding: "10px 12px" }}>Stock Value</th>}
                    {visibleColumns.status && <th style={{ padding: "10px 12px" }}>Status</th>}
                    {visibleColumns.warehouse && <th style={{ padding: "10px 12px" }}>Location</th>}
                    {visibleColumns.actions && <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        No inventory items found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    products.map((item) => {
                      const isLow = item.stockStatus === "Low Stock";
                      const isOut = item.stockStatus === "Out of Stock";
                      const isOver = item.stockStatus === "Overstocked";

                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          {visibleColumns.image && (
                            <td style={{ padding: "10px 12px" }}>
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", border: "1px solid #e5e7eb" }}
                                />
                              ) : (
                                <div style={{ width: 38, height: 38, borderRadius: 6, background: "#f3f4f6", display: "grid", placeItems: "center" }}>
                                  <Package size={16} color="#9ca3af" />
                                </div>
                              )}
                            </td>
                          )}

                          {visibleColumns.name && (
                            <td style={{ padding: "10px 12px" }}>
                              <strong style={{ display: "block", color: "#111" }}>{item.productName}</strong>
                              {item.variantTitle && (
                                <span style={{ fontSize: 11.5, color: "#4f46e5", fontWeight: 500 }}>
                                  Variant: {item.variantTitle}
                                </span>
                              )}
                            </td>
                          )}

                          {visibleColumns.sku && (
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
                              <div style={{ fontWeight: 600, color: "#1f2937" }}>{item.sku || "—"}</div>
                              {item.barcode && <div style={{ fontSize: 11, color: "#6b7280" }}>{item.barcode}</div>}
                            </td>
                          )}

                          {visibleColumns.category && (
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                                {item.category}
                              </span>
                            </td>
                          )}

                          {visibleColumns.available && (
                            <td style={{ padding: "10px 12px" }}>
                              <strong
                                style={{
                                  fontSize: 14,
                                  color: isOut ? "#ef4444" : isLow ? "#f59e0b" : "#10b981",
                                }}
                              >
                                {item.availableQuantity}
                              </strong>{" "}
                              <small style={{ color: "#6b7280" }}>units</small>
                            </td>
                          )}

                          {visibleColumns.reserved && (
                            <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.reservedQuantity} units</td>
                          )}

                          {visibleColumns.minMax && (
                            <td style={{ padding: "10px 12px", fontSize: 12, color: "#4b5563" }}>
                              {item.minimumStockLevel} / {item.maximumStockLevel}
                            </td>
                          )}

                          {visibleColumns.sellingPrice && (
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatPrice(item.sellingPrice)}</td>
                          )}

                          {visibleColumns.purchasePrice && (
                            <td style={{ padding: "10px 12px", color: "#6b7280" }}>{formatPrice(item.purchasePrice)}</td>
                          )}

                          {visibleColumns.valuation && (
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111" }}>
                              {formatPrice(item.totalStockValue)}
                            </td>
                          )}

                          {visibleColumns.status && (
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  background: isOut ? "#fee2e2" : isLow ? "#fef3c7" : isOver ? "#ede9fe" : "#d1fae5",
                                  color: isOut ? "#b91c1c" : isLow ? "#b45309" : isOver ? "#6d28d9" : "#047857",
                                }}
                              >
                                {item.stockStatus}
                              </span>
                            </td>
                          )}

                          {visibleColumns.warehouse && (
                            <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
                              {item.warehouseLocation || "Main Hub"}
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="coupon-btn coupon-btn--ghost"
                                  style={{ padding: "4px 8px", fontSize: 12 }}
                                  onClick={() => openAdjust(item)}
                                  title="Adjust Stock Level"
                                >
                                  Adjust
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 18px",
                borderTop: "1px solid #e5e7eb",
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              <span>
                Showing {(page - 1) * limit + 1} - {Math.min(page * limit, productTotal)} of {productTotal} items
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="coupon-btn coupon-btn--ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ padding: "4px 10px" }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  type="button"
                  className="coupon-btn coupon-btn--ghost"
                  disabled={page * limit >= productTotal}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ padding: "4px 10px" }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: STOCK ADJUSTMENTS LEDGER
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "adjustments" && (
        <div className="inventory-adjustments-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Stock Adjustments Audit Trail</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Every manual stock balance change, damage write-off, or physical inventory count reconciliation
              </p>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Adjustment #</th>
                  <th style={{ padding: "10px 12px" }}>Product Name</th>
                  <th style={{ padding: "10px 12px" }}>SKU</th>
                  <th style={{ padding: "10px 12px" }}>Previous Qty</th>
                  <th style={{ padding: "10px 12px" }}>Change</th>
                  <th style={{ padding: "10px 12px" }}>New Qty</th>
                  <th style={{ padding: "10px 12px" }}>Reason &amp; Notes</th>
                  <th style={{ padding: "10px 12px" }}>Adjusted By</th>
                  <th style={{ padding: "10px 12px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentsList.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                      No manual stock adjustments recorded yet.
                    </td>
                  </tr>
                ) : (
                  adjustmentsList.map((adj) => (
                    <tr key={adj._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600 }}>{adj.adjustmentNumber}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {adj.productTitle} {adj.variantTitle && `(${adj.variantTitle})`}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#6b7280" }}>{adj.sku || "N/A"}</td>
                      <td style={{ padding: "10px 12px" }}>{adj.previousQuantity}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: adj.adjustmentType === "Add" ? "#10b981" : "#ef4444",
                          }}
                        >
                          {adj.adjustmentType === "Add" ? `+${adj.adjustmentQuantity}` : `-${adj.adjustmentQuantity}`}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{adj.newQuantity}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{adj.reason}</strong>
                        {adj.notes && <div style={{ fontSize: 11.5, color: "#6b7280" }}>{adj.notes}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#4b5563" }}>{adj.adjustedBy?.name || "Admin"}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {new Date(adj.adjustmentDate).toLocaleDateString()}
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
          TAB 4: STOCK INWARDS / PURCHASE ORDERS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "inwards" && (
        <div className="inventory-inwards-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Purchase Inward Receipts</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Receive product shipments from suppliers and increase available inventory atomically
              </p>
            </div>
            <button
              type="button"
              className="coupon-btn coupon-btn--primary"
              onClick={() => {
                if (products.length > 0) {
                  const p = products[0];
                  setInwardItems([
                    {
                      product: p.productId,
                      productTitle: p.productName,
                      sku: p.sku,
                      orderedQty: 20,
                      receivedQty: 20,
                      purchasePrice: p.purchasePrice || Math.round(p.sellingPrice * 0.7),
                    },
                  ]);
                }
                setShowInwardModal(true);
              }}
            >
              <Plus size={14} /> New Stock Inward
            </button>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Inward #</th>
                  <th style={{ padding: "10px 12px" }}>Supplier</th>
                  <th style={{ padding: "10px 12px" }}>Supplier Invoice</th>
                  <th style={{ padding: "10px 12px" }}>Items Count</th>
                  <th style={{ padding: "10px 12px" }}>Received Units</th>
                  <th style={{ padding: "10px 12px" }}>Total Cost</th>
                  <th style={{ padding: "10px 12px" }}>Payment Status</th>
                  <th style={{ padding: "10px 12px" }}>Inward Status</th>
                  <th style={{ padding: "10px 12px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {inwardsList.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                      No purchase inward receipts recorded yet. Click "New Stock Inward" to record received inventory.
                    </td>
                  </tr>
                ) : (
                  inwardsList.map((inw) => (
                    <tr key={inw._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700 }}>{inw.inwardNumber}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{inw.supplierName || "Direct Supplier"}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{inw.supplierInvoiceNumber || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{inw.items?.length || 0} product(s)</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#10b981" }}>+{inw.totalQuantity} units</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatPrice(inw.totalAmount)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: inw.paymentStatus === "Paid" ? "#d1fae5" : "#fef3c7",
                            color: inw.paymentStatus === "Paid" ? "#047857" : "#b45309",
                          }}
                        >
                          {inw.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>{inw.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {new Date(inw.receivedDate).toLocaleDateString()}
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
          TAB 5: SUPPLIERS MANAGEMENT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="inventory-suppliers-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Registered Vendors &amp; Suppliers</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Manage procurement partners, contact details, GST numbers, payment terms and purchase balances
              </p>
            </div>
            <button
              type="button"
              className="coupon-btn coupon-btn--primary"
              onClick={() => {
                setEditingSupplier(null);
                setSupName("");
                setSupCompany("");
                setSupContact("");
                setSupPhone("");
                setSupEmail("");
                setSupGst("");
                setShowSupplierModal(true);
              }}
            >
              <Plus size={14} /> Add Supplier
            </button>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Supplier Name</th>
                  <th style={{ padding: "10px 12px" }}>Company / Business</th>
                  <th style={{ padding: "10px 12px" }}>Contact Person</th>
                  <th style={{ padding: "10px 12px" }}>Phone &amp; Email</th>
                  <th style={{ padding: "10px 12px" }}>GST / Tax ID</th>
                  <th style={{ padding: "10px 12px" }}>Payment Terms</th>
                  <th style={{ padding: "10px 12px" }}>Total Purchases</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                      No suppliers registered yet. Click "Add Supplier" to add your first vendor.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((sup) => (
                    <tr key={sup._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{sup.supplierName}</td>
                      <td style={{ padding: "10px 12px" }}>{sup.companyName || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{sup.contactPerson || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        <div>{sup.phone || "—"}</div>
                        <div style={{ color: "#6b7280" }}>{sup.email || "—"}</div>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{sup.gstNumber || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{sup.paymentTerms || "Net 30"}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatPrice(sup.totalPurchaseAmount || 0)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: sup.status === "Active" ? "#d1fae5" : "#fee2e2",
                            color: sup.status === "Active" ? "#047857" : "#b91c1c",
                          }}
                        >
                          {sup.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--ghost"
                            style={{ padding: "4px 8px" }}
                            onClick={() => {
                              setEditingSupplier(sup);
                              setSupName(sup.supplierName);
                              setSupCompany(sup.companyName || "");
                              setSupContact(sup.contactPerson || "");
                              setSupPhone(sup.phone || "");
                              setSupEmail(sup.email || "");
                              setSupGst(sup.gstNumber || "");
                              setSupTerms(sup.paymentTerms || "Net 30");
                              setShowSupplierModal(true);
                            }}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--ghost"
                            style={{ padding: "4px 8px", color: "#ef4444" }}
                            onClick={async () => {
                              if (confirm(`Delete supplier ${sup.supplierName}?`)) {
                                await deleteSupplier(sup._id);
                                toast.success("Supplier deleted");
                                fetchSuppliers().then(setSuppliers);
                              }
                            }}
                          >
                            <Trash2 size={13} />
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
          TAB 6: WAREHOUSES & TRANSFERS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "warehouses" && (
        <div className="inventory-warehouses-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Warehouse Management &amp; Stock Transfers</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Multi-location storage facilities, live capacity tracking and inter-warehouse stock transfer orders
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="coupon-btn coupon-btn--ghost"
                onClick={() => {
                  if (warehouses.length > 0) setTrSource(warehouses[0].name);
                  if (warehouses.length > 1) setTrDest(warehouses[1].name);
                  if (products.length > 0) setTrProduct(products[0].productId);
                  setShowTransferModal(true);
                }}
              >
                <ArrowRightLeft size={14} /> Transfer Stock
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--primary"
                onClick={() => setShowWarehouseModal(true)}
              >
                <Plus size={14} /> New Warehouse
              </button>
            </div>
          </div>

          {/* Warehouses Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
            {warehouses.map((wh) => (
              <div
                key={wh._id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: wh.isDefault ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                  padding: 18,
                  position: "relative",
                }}
              >
                {wh.isDefault && (
                  <span
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontSize: 10,
                      fontWeight: 700,
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    DEFAULT HUB
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: "#eff6ff", display: "grid", placeItems: "center" }}>
                    <WarehouseIcon size={20} color="#3b82f6" />
                  </div>
                  <div>
                    <h5 style={{ margin: 0, font: '600 15px "Manrope"' }}>{wh.name}</h5>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>{wh.code}</span>
                  </div>
                </div>

                <div style={{ margin: "14px 0", fontSize: 12.5, color: "#4b5563" }}>
                  <div>
                    <strong>Location:</strong> {wh.address?.city || "Mumbai"}, {wh.address?.state || "Maharashtra"}
                  </div>
                  <div>
                    <strong>Contact:</strong> {wh.contactPerson || "Manager"} ({wh.phone || "—"})
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>Live Stock Count:</span>
                    <strong style={{ color: "#10b981", fontSize: 13 }}>{wh.currentStockCount} units</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>Capacity:</span>
                    <span>{wh.capacity} units</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round(((wh.currentStockCount || 0) / (wh.capacity || 10000)) * 100))}%`,
                      height: "100%",
                      background: "#3b82f6",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Transfers History Table */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 18 }}>
            <h5 style={{ margin: "0 0 12px", font: '600 15px "Manrope"' }}>Inter-Warehouse Transfer Log</h5>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 12px" }}>Transfer #</th>
                  <th style={{ padding: "8px 12px" }}>Source Location</th>
                  <th style={{ padding: "8px 12px" }}>Destination Hub</th>
                  <th style={{ padding: "8px 12px" }}>Product &amp; SKU</th>
                  <th style={{ padding: "8px 12px" }}>Quantity</th>
                  <th style={{ padding: "8px 12px" }}>Status</th>
                  <th style={{ padding: "8px 12px" }}>Initiated Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
                      No stock transfers initiated yet.
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700 }}>{tr.transferNumber}</td>
                      <td style={{ padding: "10px 12px" }}>{tr.sourceLocation}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{tr.destinationLocation}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {tr.items?.[0]?.productTitle || "Product"} ({tr.items?.[0]?.sku || "N/A"})
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{tr.items?.[0]?.quantity || 1} units</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: tr.status === "Received" ? "#d1fae5" : tr.status === "Pending" ? "#fef3c7" : "#ede9fe",
                            color: tr.status === "Received" ? "#047857" : tr.status === "Pending" ? "#b45309" : "#6d28d9",
                          }}
                        >
                          {tr.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {new Date(tr.transferDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {tr.status !== "Received" && (
                          <button
                            type="button"
                            className="coupon-btn coupon-btn--ghost"
                            style={{ padding: "3px 8px", fontSize: 11.5 }}
                            onClick={async () => {
                              await updateTransferStatus(tr._id, "Received");
                              toast.success("Transfer marked as Received!");
                              fetchTransfers().then(setTransfers);
                            }}
                          >
                            Mark Received
                          </button>
                        )}
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
          TAB 7: STOCK ALERTS & THRESHOLDS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <div className="inventory-alerts-tab">
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Automated Stock Alerts &amp; Restock Reminders</h4>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Active notifications for items that have dropped below safety thresholds or depleted completely
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Product / Variant</th>
                  <th style={{ padding: "10px 12px" }}>SKU</th>
                  <th style={{ padding: "10px 12px" }}>Available Stock</th>
                  <th style={{ padding: "10px 12px" }}>Min Threshold</th>
                  <th style={{ padding: "10px 12px" }}>Alert Level</th>
                  <th style={{ padding: "10px 12px" }}>Suggested Action</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {!overview?.lowStockAlerts || overview.lowStockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#10b981" }}>
                      <CheckCircle2 size={30} style={{ margin: "0 auto 8px" }} />
                      No low-stock alerts. All product inventory is well-stocked!
                    </td>
                  </tr>
                ) : (
                  overview.lowStockAlerts.map((alert) => (
                    <tr key={alert.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{alert.name}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{alert.sku}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: alert.stock === 0 ? "#ef4444" : "#f59e0b" }}>
                        {alert.stock} units
                      </td>
                      <td style={{ padding: "10px 12px" }}>{alert.minLevel} units</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: alert.urgency === "Critical" ? "#fee2e2" : "#fef3c7",
                            color: alert.urgency === "Critical" ? "#b91c1c" : "#b45309",
                          }}
                        >
                          {alert.urgency === "Critical" ? "OUT OF STOCK" : "LOW STOCK"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
                        Reorder minimum {alert.minLevel * 2} units from primary supplier
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="coupon-btn coupon-btn--primary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => {
                            setActiveTab("products");
                            setSearch(alert.sku);
                          }}
                        >
                          Restock
                        </button>
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
          TAB 8: SKU & BARCODE TOOLS & SCANNER
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "barcode" && (
        <div className="inventory-barcode-tab">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
            {/* Live Barcode Scanner / SKU Lookup */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ScanLine size={20} color="#3b82f6" />
                <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Barcode &amp; SKU Scanner Search</h4>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#6b7280" }}>
                Scan with a handheld USB/Bluetooth hardware scanner or enter SKU / Barcode directly
              </p>

              <form onSubmit={handleBarcodeSearch} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Scan or paste barcode/SKU here..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  style={{ flex: 1, padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
                  autoFocus
                />
                <button type="submit" className="coupon-btn coupon-btn--primary">
                  Search
                </button>
              </form>

              {/* Scanned Search Results */}
              <div style={{ marginTop: 18 }}>
                {scannedResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <strong style={{ fontSize: 13 }}>Matches Found ({scannedResults.length}):</strong>
                    {scannedResults.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          background: "#f9fafb",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <div>
                          <strong style={{ display: "block", fontSize: 13.5 }}>{r.title}</strong>
                          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>
                            SKU: {r.sku} &middot; Barcode: {r.barcode}
                          </div>
                          <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                            Stock: {r.stock} units &middot; Price: {formatPrice(r.price)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="coupon-btn coupon-btn--ghost"
                          onClick={() => {
                            setActiveTab("products");
                            setSearch(r.sku);
                          }}
                        >
                          View in Catalog
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unique SKU & Barcode Generator */}
            <div style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Barcode size={20} color="#10b981" />
                <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Automatic SKU &amp; Barcode Generator</h4>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#6b7280" }}>
                Generate collision-free standardized product SKUs and standard EAN-13 barcodes
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#4b5563" }}>Category</label>
                  <input
                    type="text"
                    value={skuCategory}
                    onChange={(e) => setSkuCategory(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#4b5563" }}>Brand / Maker</label>
                  <input
                    type="text"
                    value={skuBrand}
                    onChange={(e) => setSkuBrand(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#4b5563" }}>Product / Variant Name</label>
                <input
                  type="text"
                  value={skuName}
                  onChange={(e) => setSkuName(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="coupon-btn coupon-btn--primary" onClick={handleGenSku}>
                  Generate Unique SKU
                </button>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={handleGenBarcode}>
                  Generate Barcode
                </button>
              </div>

              {/* Visual Previews */}
              {(generatedSku || generatedBarcode) && (
                <div style={{ marginTop: 16, padding: 14, background: "#f3f4f6", borderRadius: 8 }}>
                  {generatedSku && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Generated SKU:</span>
                      <strong style={{ display: "block", fontSize: 15, fontFamily: "monospace", color: "#1e40af" }}>
                        {generatedSku}
                      </strong>
                    </div>
                  )}

                  {generatedBarcode && (
                    <div>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>EAN-13 Barcode:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                        <strong style={{ fontSize: 16, fontFamily: "monospace", letterSpacing: 2 }}>{generatedBarcode}</strong>
                      </div>
                      {/* Visual Barcode Graphic representation */}
                      <div
                        style={{
                          height: 40,
                          background:
                            "repeating-linear-gradient(90deg, #111 0px, #111 2px, #fff 2px, #fff 4px, #111 4px, #111 7px, #fff 7px, #fff 9px)",
                          width: 220,
                          marginTop: 6,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 9: TRANSACTIONS LEDGER
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="inventory-ledger-tab">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Immutable Inventory Transaction Ledger</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
                Complete ledger of every stock in, stock out, order deduction, order cancellation restoration and manual adjustment
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={movementActionFilter}
                onChange={(e) => setMovementActionFilter(e.target.value)}
                style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #d1d5db" }}
              >
                <option value="All">All Action Types</option>
                <option value="deduct">Order Deduct</option>
                <option value="restore">Order Return / Cancellation Restore</option>
                <option value="stock_in">Stock Inward</option>
                <option value="stock_out">Stock Outward</option>
                <option value="adjustment_add">Manual Adjustment (+)</option>
                <option value="adjustment_remove">Manual Adjustment (-)</option>
              </select>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 12px" }}>Date &amp; Time</th>
                  <th style={{ padding: "10px 12px" }}>Product &amp; Variant</th>
                  <th style={{ padding: "10px 12px" }}>SKU</th>
                  <th style={{ padding: "10px 12px" }}>Action</th>
                  <th style={{ padding: "10px 12px" }}>Qty Delta</th>
                  <th style={{ padding: "10px 12px" }}>Previous Stock</th>
                  <th style={{ padding: "10px 12px" }}>Current Stock</th>
                  <th style={{ padding: "10px 12px" }}>Reason / Order Ref</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                      No ledger transactions found matching filter.
                    </td>
                  </tr>
                ) : (
                  movements.map((tx) => (
                    <tr key={tx._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {tx.productTitle} {tx.variantName && `(${tx.variantName})`}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{tx.sku || "N/A"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background:
                              tx.action === "stock_in" || tx.action === "restore" || tx.action === "adjustment_add"
                                ? "#d1fae5"
                                : "#fee2e2",
                            color:
                              tx.action === "stock_in" || tx.action === "restore" || tx.action === "adjustment_add"
                                ? "#047857"
                                : "#b91c1c",
                          }}
                        >
                          {tx.action.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{tx.previousStock}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{tx.currentStock}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        {tx.reason || tx.referenceId || "Standard movement"}
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
          TAB 10: VALUATION & REPORTS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "reports" && (
        <div className="inventory-reports-tab">
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, font: '600 16px "Manrope"' }}>Inventory Valuation &amp; Analytics Reports</h4>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Real-time stock valuation reports, dead stock detection, and exportable ledger manifests
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {[
              {
                title: "Current Stock Manifest",
                desc: "Complete stock list with SKU, selling price, cost price, and stock valuation",
                type: "current_stock",
              },
              {
                title: "Low & Out of Stock Report",
                desc: "List of items that have dropped below minimum threshold or depleted",
                type: "low_stock",
              },
              {
                title: "Stock Inward Receipts",
                desc: "History of all purchased and received supplier consignments",
                type: "inward",
              },
              {
                title: "Audit & Adjustments Report",
                desc: "Manual stock count adjustments, shrinkage write-offs and corrections",
                type: "adjustments",
              },
              {
                title: "Complete Movement Ledger",
                desc: "Immutable ledger of all inventory transactions with timestamps and actors",
                type: "movements",
              },
            ].map((rep) => (
              <div key={rep.type} style={{ background: "#fff", padding: 18, borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <h5 style={{ margin: "0 0 6px", font: '600 15px "Manrope"' }}>{rep.title}</h5>
                <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#6b7280" }}>{rep.desc}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={exportInventoryReportUrl(rep.type, "xlsx")}
                    className="coupon-btn coupon-btn--ghost"
                    download
                    style={{ textDecoration: "none", fontSize: 12 }}
                  >
                    <FileSpreadsheet size={13} /> Excel (.xlsx)
                  </a>
                  <a
                    href={exportInventoryReportUrl(rep.type, "csv")}
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
          MODAL: MANUAL STOCK ADJUSTMENT
         ───────────────────────────────────────────────────────────── */}
      {showAdjustModal && selectedProductForAdjust && (
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
              maxWidth: 500,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Adjust Stock Balance</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#4b5563" }}>
              Item: <strong>{selectedProductForAdjust.productName}</strong>{" "}
              {selectedProductForAdjust.variantTitle && `(${selectedProductForAdjust.variantTitle})`}
              <br />
              SKU: <code style={{ color: "#3b82f6" }}>{selectedProductForAdjust.sku}</code>
            </p>

            <form onSubmit={handlePerformAdjustment}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Adjustment Action</label>
                <select
                  value={adjustType}
                  onChange={(e: any) => setAdjustType(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  <option value="Add">Add Stock (+)</option>
                  <option value="Remove">Reduce Stock (-)</option>
                  <option value="Set Exact">Set Exact Quantity (=)</option>
                  <option value="Scrap">Damage / Scrap Write-off</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  required
                />
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  background: "#f3f4f6",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: "#6b7280" }}>Current:</span>{" "}
                  <strong>{selectedProductForAdjust.availableQuantity} units</strong>
                </div>
                <div>&rarr;</div>
                <div>
                  <span style={{ color: "#6b7280" }}>New Balance:</span>{" "}
                  <strong style={{ color: previewStock === 0 ? "#ef4444" : "#10b981", fontSize: 14 }}>
                    {previewStock} units
                  </strong>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Reason</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  <option value="Physical Audit Mismatch">Physical Audit Mismatch</option>
                  <option value="Damaged Goods / Quality Reject">Damaged Goods / Quality Reject</option>
                  <option value="Theft or Inventory Shrinkage">Theft or Inventory Shrinkage</option>
                  <option value="Found Unaccounted Inventory">Found Unaccounted Inventory</option>
                  <option value="Customer Return Stock Added">Customer Return Stock Added</option>
                  <option value="Returned to Vendor">Returned to Vendor</option>
                  <option value="Other Manual Correction">Other Manual Correction</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Internal Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Reference audit voucher, reason or approver..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="coupon-btn coupon-btn--ghost"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="coupon-btn coupon-btn--primary"
                  disabled={adjustSubmitting}
                >
                  {adjustSubmitting ? "Adjusting..." : "Confirm Stock Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: BULK STOCK UPDATE
         ───────────────────────────────────────────────────────────── */}
      {showBulkModal && (
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
              maxWidth: 700,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Bulk Stock Update</h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#6b7280" }}>
              Quickly edit current available stock balances across multiple catalog products at once.
            </p>

            <table className="admin-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 16 }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>Product Name</th>
                  <th style={{ padding: "8px 10px" }}>SKU</th>
                  <th style={{ padding: "8px 10px" }}>Current</th>
                  <th style={{ padding: "8px 10px" }}>New Stock</th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12 }}>{r.sku}</td>
                    <td style={{ padding: "8px 10px", color: "#6b7280" }}>{r.currentStock}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        min="0"
                        value={r.newStock}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setBulkRows((rows) => {
                            const next = [...rows];
                            next[i].newStock = val;
                            return next;
                          });
                        }}
                        style={{ width: 90, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowBulkModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--primary"
                onClick={handleSaveBulk}
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? "Saving Updates..." : "Save All Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: NEW STOCK INWARD / PO RECEIPT
         ───────────────────────────────────────────────────────────── */}
      {showInwardModal && (
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
              maxWidth: 650,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Receive Stock Inward (PO)</h3>
              <button
                type="button"
                onClick={() => setShowInwardModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Supplier</label>
                <select
                  value={inwardSupplier}
                  onChange={(e) => setInwardSupplier(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.supplierName} ({s.companyName || "Vendor"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Supplier Invoice #</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-904"
                  value={inwardInvoiceNo}
                  onChange={(e) => setInwardInvoiceNo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600 }}>Items to Inward</label>
              {inwardItems.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr",
                    gap: 8,
                    padding: 10,
                    background: "#f9fafb",
                    borderRadius: 8,
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13, display: "block" }}>{it.productTitle}</strong>
                    <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "#6b7280" }}>{it.sku}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280" }}>Received Units</label>
                    <input
                      type="number"
                      min="1"
                      value={it.receivedQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setInwardItems((prev) => {
                          const next = [...prev];
                          next[idx].receivedQty = val;
                          return next;
                        });
                      }}
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280" }}>Cost Price</label>
                    <input
                      type="number"
                      min="0"
                      value={it.purchasePrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setInwardItems((prev) => {
                          const next = [...prev];
                          next[idx].purchasePrice = val;
                          return next;
                        });
                      }}
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowInwardModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="coupon-btn coupon-btn--primary"
                disabled={inwardSubmitting}
                onClick={async () => {
                  setInwardSubmitting(true);
                  try {
                    const selSup = suppliers.find((s) => s._id === inwardSupplier);
                    await createStockInward({
                      supplier: inwardSupplier || undefined,
                      supplierName: selSup?.supplierName || "Direct Supplier",
                      supplierInvoiceNumber: inwardInvoiceNo,
                      items: inwardItems.map((i) => ({
                        ...i,
                        orderedQuantity: i.receivedQty,
                        receivedQuantity: i.receivedQty,
                      })),
                    });
                    toast.success("Stock inward recorded and inventory updated!");
                    setShowInwardModal(false);
                    loadOverview();
                    loadProducts();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to record inward");
                  } finally {
                    setInwardSubmitting(false);
                  }
                }}
              >
                {inwardSubmitting ? "Receiving..." : "Receive Stock Inward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT SUPPLIER
         ───────────────────────────────────────────────────────────── */}
      {showSupplierModal && (
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
              maxWidth: 500,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Company Name</label>
                  <input
                    type="text"
                    value={supCompany}
                    onChange={(e) => setSupCompany(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Contact Person</label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>GST / Tax Number</label>
                  <input
                    type="text"
                    value={supGst}
                    onChange={(e) => setSupGst(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Terms</label>
                  <select
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowSupplierModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="coupon-btn coupon-btn--primary">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD WAREHOUSE
         ───────────────────────────────────────────────────────────── */}
      {showWarehouseModal && (
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
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Add New Storage Warehouse</h3>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Warehouse Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South India Hub"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Warehouse Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WH-SOUTH-03"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Unit Capacity</label>
                  <input
                    type="number"
                    value={whCapacity}
                    onChange={(e) => setWhCapacity(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>State</label>
                  <input
                    type="text"
                    placeholder="e.g. Karnataka"
                    value={whState}
                    onChange={(e) => setWhState(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowWarehouseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="coupon-btn coupon-btn--primary">
                  Create Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: INTER-WAREHOUSE STOCK TRANSFER
         ───────────────────────────────────────────────────────────── */}
      {showTransferModal && (
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
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, font: '600 18px "Manrope"' }}>Initiate Stock Transfer</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Source Warehouse</label>
                <select
                  value={trSource}
                  onChange={(e) => setTrSource(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  {warehouses.map((w) => (
                    <option key={w._id} value={w.name}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Destination Warehouse *</label>
                <select
                  value={trDest}
                  onChange={(e) => setTrDest(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  required
                >
                  <option value="">Select destination...</option>
                  {warehouses
                    .filter((w) => w.name !== trSource)
                    .map((w) => (
                      <option key={w._id} value={w.name}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Product to Transfer *</label>
                <select
                  value={trProduct}
                  onChange={(e) => setTrProduct(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.productId}>
                      {p.productName} ({p.sku}) &middot; In Stock: {p.availableQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Transfer Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={trQty}
                  onChange={(e) => setTrQty(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Notes / Dispatch Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Cross-docking for holiday demand"
                  value={trNotes}
                  onChange={(e) => setTrNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="coupon-btn coupon-btn--primary">
                  Initiate Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
