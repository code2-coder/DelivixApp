import { useEffect, useState, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import { formatPrice } from "../../utils/currency";
import {
  fetchAnalyticsOverview,
  fetchAnalyticsRevenue,
  fetchAnalyticsSales,
  fetchAnalyticsProducts,
  fetchAnalyticsCustomers,
  fetchAnalyticsCategories,
  fetchAnalyticsPayments,
  fetchAnalyticsInventory,
  fetchAnalyticsCoupons,
  fetchAnalyticsReturns,
  downloadAnalyticsExport,
  type AnalyticsOverviewResponse,
  type AnalyticsRevenueResponse,
  type AnalyticsSalesResponse,
  type AnalyticsProductsResponse,
  type AnalyticsCustomersResponse,
  type AnalyticsCategoriesResponse,
  type AnalyticsPaymentsResponse,
  type AnalyticsInventoryResponse,
  type AnalyticsCouponsResponse,
  type AnalyticsReturnsResponse,
  type SalesReportItem,
} from "../../services/api";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Percent,
  RefreshCw,
  Download,
  Printer,
  Calendar,
  Filter,
  Search,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Building,
  RotateCcw,
  Sparkles,
  BarChart2,
  Layers,
  Tag,
  Boxes,
  HelpCircle,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";

type TabKey =
  | "overview"
  | "revenue"
  | "sales"
  | "products"
  | "customers"
  | "categories"
  | "payments"
  | "inventory"
  | "coupons"
  | "returns";

type DateRangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
];

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

export default function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Tab Data states
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [revenue, setRevenue] = useState<AnalyticsRevenueResponse | null>(null);
  const [revenueInterval, setRevenueInterval] = useState<"day" | "week" | "month" | "year">("day");
  const [sales, setSales] = useState<AnalyticsSalesResponse | null>(null);
  const [products, setProducts] = useState<AnalyticsProductsResponse | null>(null);
  const [customers, setCustomers] = useState<AnalyticsCustomersResponse | null>(null);
  const [categories, setCategories] = useState<AnalyticsCategoriesResponse | null>(null);
  const [payments, setPayments] = useState<AnalyticsPaymentsResponse | null>(null);
  const [inventory, setInventory] = useState<AnalyticsInventoryResponse | null>(null);
  const [coupons, setCoupons] = useState<AnalyticsCouponsResponse | null>(null);
  const [returns, setReturns] = useState<AnalyticsReturnsResponse | null>(null);

  // Sales Table filters & pagination
  const [salesPage, setSalesPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesOrderStatus, setSalesOrderStatus] = useState("All");
  const [salesPaymentStatus, setSalesPaymentStatus] = useState("All");
  const [salesPaymentMethod, setSalesPaymentMethod] = useState("All");
  const [salesSortBy, setSalesSortBy] = useState("createdAt");
  const [salesSortOrder, setSalesSortOrder] = useState<"asc" | "desc">("desc");

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Date query params helper
  const dateParams = useMemo(() => {
    const p: Record<string, string> = { range: dateRange };
    if (dateRange === "custom") {
      if (customStart) p.startDate = customStart;
      if (customEnd) p.endDate = customEnd;
    }
    return p;
  }, [dateRange, customStart, customEnd]);

  // Load Tab-specific data
  const loadActiveTabData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "overview") {
        const res = await fetchAnalyticsOverview(dateParams);
        setOverview(res);
      } else if (activeTab === "revenue") {
        const res = await fetchAnalyticsRevenue({ ...dateParams, interval: revenueInterval });
        setRevenue(res);
      } else if (activeTab === "sales") {
        const res = await fetchAnalyticsSales({
          ...dateParams,
          page: salesPage,
          limit: 10,
          search: salesSearch || undefined,
          orderStatus: salesOrderStatus !== "All" ? salesOrderStatus : undefined,
          paymentStatus: salesPaymentStatus !== "All" ? salesPaymentStatus : undefined,
          paymentMethod: salesPaymentMethod !== "All" ? salesPaymentMethod : undefined,
          sortBy: salesSortBy,
          sortOrder: salesSortOrder,
        });
        setSales(res);
      } else if (activeTab === "products") {
        const res = await fetchAnalyticsProducts(dateParams);
        setProducts(res);
      } else if (activeTab === "customers") {
        const res = await fetchAnalyticsCustomers(dateParams);
        setCustomers(res);
      } else if (activeTab === "categories") {
        const res = await fetchAnalyticsCategories(dateParams);
        setCategories(res);
      } else if (activeTab === "payments") {
        const res = await fetchAnalyticsPayments(dateParams);
        setPayments(res);
      } else if (activeTab === "inventory") {
        const res = await fetchAnalyticsInventory();
        setInventory(res);
      } else if (activeTab === "coupons") {
        const res = await fetchAnalyticsCoupons(dateParams);
        setCoupons(res);
      } else if (activeTab === "returns") {
        const res = await fetchAnalyticsReturns(dateParams);
        setReturns(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    dateParams,
    revenueInterval,
    salesPage,
    salesSearch,
    salesOrderStatus,
    salesPaymentStatus,
    salesPaymentMethod,
    salesSortBy,
    salesSortOrder,
  ]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData, refreshKey]);

  // Handle Export Action
  const handleExport = async (type: string, format: "xlsx" | "csv") => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const blob = await downloadAnalyticsExport(type, format, dateParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_report_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported ${type} report as .${format}`);
    } catch (err: any) {
      toast.error(err.message || "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Helper for trend badge
  const renderTrendBadge = (growth?: number) => {
    if (growth === undefined || growth === null) return null;
    const isPositive = growth > 0;
    const isNeutral = growth === 0;

    return (
      <span
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
          isNeutral
            ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
            : isPositive
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
            : "bg-rose-50 text-rose-700 border border-rose-200/70"
        }`}
      >
        {isPositive ? (
          <ArrowUpRight size={12} className="stroke-[2.5]" />
        ) : isNeutral ? null : (
          <ArrowDownRight size={12} className="stroke-[2.5]" />
        )}
        {growth > 0 ? `+${growth}%` : `${growth}%`}
      </span>
    );
  };

  return (
    <div className="reports-analytics space-y-5">
      {/* ── Top Analytics Control Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Database Connected
          </div>
          <span className="text-zinc-300">|</span>
          <p className="text-xs text-zinc-500 hidden md:inline">
            Real-time business insights &amp; downloadable performance reports
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl transition shadow-2xs hover:border-zinc-300 cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-zinc-900" : "text-zinc-500"} />
            <span>Refresh</span>
          </button>

          {/* Print / PDF Button */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl transition shadow-2xs hover:border-zinc-300 cursor-pointer"
            title="Print report or save as PDF"
          >
            <Printer size={13} className="text-zinc-500" />
            <span>Print / PDF</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-xl transition shadow-2xs hover:border-zinc-300 cursor-pointer"
            >
              <Download size={13} className={exporting ? "animate-bounce text-blue-600" : "text-zinc-600"} />
              <span>{exporting ? "Exporting..." : "Export"}</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-zinc-200/90 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Download Current View ({activeTab})
                </div>
                <button
                  onClick={() => handleExport(activeTab, "xlsx")}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-zinc-800 hover:bg-zinc-50 transition font-medium cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <span>Excel Spreadsheet (.xlsx)</span>
                </button>
                <button
                  onClick={() => handleExport(activeTab, "csv")}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-zinc-800 hover:bg-zinc-50 transition font-medium cursor-pointer"
                >
                  <FileText size={15} className="text-blue-600" />
                  <span>CSV Spreadsheet (.csv)</span>
                </button>

                <div className="border-t border-zinc-100 my-1" />

                <div className="px-3.5 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Complete Data Package
                </div>
                <button
                  onClick={() => handleExport("all", "xlsx")}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-zinc-800 hover:bg-zinc-50 transition font-medium cursor-pointer"
                >
                  <Layers size={15} className="text-purple-600" />
                  <span>Full Analytics Workbook (.xlsx)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Date Range Filter Pill Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-100/90 p-1.5 rounded-2xl border border-zinc-200/80 print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          <div className="flex items-center gap-1.5 text-zinc-400 pl-2 pr-2 shrink-0">
            <Calendar size={13} className="text-zinc-500" />
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider hidden md:inline">Period:</span>
          </div>
          {DATE_RANGE_OPTIONS.map((opt) => {
            const isSelected = dateRange === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  setDateRange(opt.key);
                  if (opt.key === "custom") setShowCustomModal(true);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? "bg-white text-zinc-950 font-bold shadow-xs border border-zinc-200/80"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60"
                }`}
              >
                {opt.label}
                {opt.key === "custom" && customStart && customEnd && (
                  <span className="ml-1 text-[10px] text-blue-600 font-normal">
                    ({customStart} to {customEnd})
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="hidden lg:flex items-center text-xs text-zinc-500 pr-3 font-medium">
          Comparison: <span className="ml-1 font-semibold text-zinc-700">Previous Period</span>
        </div>
      </div>

      {/* ── Main Navigation Tabs ── */}
      <div className="bg-zinc-100/90 p-1.5 rounded-2xl border border-zinc-200/80 overflow-x-auto no-scrollbar print:hidden">
        <nav className="flex items-center gap-1 min-w-max">
          {[
            { id: "overview", label: "Dashboard Overview", icon: BarChart2 },
            { id: "revenue", label: "Interactive Revenue", icon: TrendingUp },
            { id: "sales", label: "Sales Reports", icon: ShoppingCart },
            { id: "products", label: "Product Performance", icon: Package },
            { id: "customers", label: "Customer Analytics", icon: Users },
            { id: "categories", label: "Categories & Brands", icon: Layers },
            { id: "payments", label: "Order & Payments", icon: CreditCard },
            { id: "inventory", label: "Inventory Reports", icon: Boxes },
            { id: "coupons", label: "Discounts & Coupons", icon: Tag },
            { id: "returns", label: "Returns & Refunds", icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`flex items-center gap-2 py-2 px-3.5 text-xs rounded-xl transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-zinc-950 font-bold shadow-xs border border-zinc-200/90"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60 font-medium"
                }`}
              >
                <Icon size={14} className={isActive ? "text-blue-600" : "text-zinc-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Loading Skeleton / Content ── */}
      {loading && (
        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-pulse space-y-4">
          <div className="flex justify-center">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
          </div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Fetching real analytics from database...
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          1. DASHBOARD OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "overview" && overview && (
        <div className="space-y-6">
          {/* 10 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Total Revenue */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Revenue</span>
                <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <DollarSign size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {formatPrice(overview.kpis.totalRevenue.value)}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Prev Period</span>
                {renderTrendBadge(overview.kpis.totalRevenue.growth)}
              </div>
            </div>

            {/* Card 2: Total Orders */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Orders</span>
                <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <ShoppingCart size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.totalOrders.value.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Prev Period</span>
                {renderTrendBadge(overview.kpis.totalOrders.growth)}
              </div>
            </div>

            {/* Card 3: Total Products Sold */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Products Sold</span>
                <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <Package size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.totalProductsSold.value.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Prev Period</span>
                {renderTrendBadge(overview.kpis.totalProductsSold.growth)}
              </div>
            </div>

            {/* Card 4: Total Customers */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Customers</span>
                <span className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                  <Users size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.totalCustomers.value.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Prev Period</span>
                {renderTrendBadge(overview.kpis.totalCustomers.growth)}
              </div>
            </div>

            {/* Card 5: Average Order Value (AOV) */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Avg Order Value</span>
                <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {formatPrice(overview.kpis.averageOrderValue.value)}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Prev Period</span>
                {renderTrendBadge(overview.kpis.averageOrderValue.growth)}
              </div>
            </div>

            {/* Card 6: Total Profit */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Profit</span>
                <span className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                  <Sparkles size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {formatPrice(overview.kpis.totalProfit.value)}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">Est. 28% Margin</span>
                {renderTrendBadge(overview.kpis.totalProfit.growth)}
              </div>
            </div>

            {/* Card 7: Total Refunds */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Refunds</span>
                <span className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <RotateCcw size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {formatPrice(overview.kpis.totalRefunds.value)}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">Processed</span>
                {renderTrendBadge(overview.kpis.totalRefunds.growth)}
              </div>
            </div>

            {/* Card 8: Conversion Rate */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Conversion Rate</span>
                <span className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
                  <Percent size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.conversionRate.value}%
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">vs Benchmark</span>
                {renderTrendBadge(overview.kpis.conversionRate.growth)}
              </div>
            </div>

            {/* Card 9: Revenue Growth Percentage */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Revenue Growth</span>
                <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.revenueGrowthPercentage.value > 0
                  ? `+${overview.kpis.revenueGrowthPercentage.value}%`
                  : `${overview.kpis.revenueGrowthPercentage.value}%`}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">Period Trend</span>
                <span className="text-xs font-semibold text-emerald-600">Active</span>
              </div>
            </div>

            {/* Card 10: Pending Payments */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pending Payments</span>
                <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Clock size={16} />
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {overview.kpis.pendingPayments.count} Orders
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-400">Volume</span>
                <span className="text-xs font-bold text-amber-600">
                  {formatPrice(overview.kpis.pendingPayments.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Velocity Chart & Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Revenue Velocity Trend</h3>
                  <p className="text-xs text-zinc-400">Daily valid completed order volume in current date range</p>
                </div>
                <button
                  onClick={() => setActiveTab("revenue")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Deep Dive <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="h-64 w-full">
                {overview.recentTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overview.recentTrend}>
                      <defs>
                        <linearGradient id="overviewRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                      />
                      <Tooltip
                        formatter={(val: any) => [formatPrice(val), "Revenue"]}
                        labelFormatter={(lbl) => `Date: ${lbl}`}
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          color: "#fafafa",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#overviewRevGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                    No order data recorded for the selected date range.
                  </div>
                )}
              </div>
            </div>

            {/* All-Time Business Milestone Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Store Lifespan Totals</h3>
                <p className="text-xs text-zinc-400 mb-4">Complete cumulative milestones across the database</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Lifetime Orders</span>
                    <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {overview.allTime.totalOrders.toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Catalog Products</span>
                    <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {overview.allTime.totalProducts.toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Registered Accounts</span>
                    <strong className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {overview.allTime.totalCustomers.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => handleExport("all", "xlsx")}
                  className="w-full py-2 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <Download size={13} />
                  <span>Download Executive Snapshot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          2. INTERACTIVE REVENUE ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "revenue" && revenue && (
        <div className="space-y-6">
          {/* Revenue Top Summary & Interval Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
            <div>
              <span className="text-xs text-zinc-400 font-medium">Net Revenue in Period</span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {formatPrice(revenue.totals.revenue)}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                <span>Profit: <b className="text-emerald-600">{formatPrice(revenue.totals.profit)}</b></span>
                <span>•</span>
                <span>Expenses: <b>{formatPrice(revenue.totals.expenses)}</b></span>
                <span>•</span>
                <span>Discounts Given: <b>{formatPrice(revenue.totals.discounts)}</b></span>
              </div>
            </div>

            {/* Interval buttons: Daily, Weekly, Monthly, Yearly */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl self-start sm:self-auto">
              {(["day", "week", "month", "year"] as const).map((intv) => (
                <button
                  key={intv}
                  onClick={() => setRevenueInterval(intv)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    revenueInterval === intv
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {intv === "day" ? "Daily" : intv === "week" ? "Weekly" : intv === "month" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </div>

          {/* Chart 1: Current vs Previous Period Revenue Line/Area Chart */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Revenue Comparison Chart</h3>
                <p className="text-xs text-zinc-400">Current Period vs. Previous Period comparison with exact hover tooltips</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-3 h-3 rounded-full bg-blue-600" /> Current Period
                </span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-3 h-3 rounded-full bg-zinc-400" /> Previous Period
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              {revenue.series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue.series}>
                    <defs>
                      <linearGradient id="currRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: string | undefined) => [
                        formatPrice(val),
                        name === "revenue" ? "Current Revenue" : "Previous Revenue",
                      ]}
                      labelFormatter={(lbl) => `Timeline: ${lbl}`}
                      contentStyle={{
                        backgroundColor: "#09090b",
                        borderColor: "#27272a",
                        color: "#fafafa",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="previousRevenue"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#currRevGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  No revenue series found for selected period.
                </div>
              )}
            </div>
          </div>

          {/* Chart 2 & 3: Profit vs Expenses and Orders vs Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit vs Expenses Bar Chart */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Profit vs Expenses Breakdown</h3>
              <p className="text-xs text-zinc-400 mb-4">Estimated net earnings after cost of goods and operational expenses</p>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: string | undefined) => [
                        formatPrice(val),
                        name === "profit" ? "Net Profit" : "Estimated Expenses",
                      ]}
                      contentStyle={{
                        backgroundColor: "#09090b",
                        borderColor: "#27272a",
                        color: "#fafafa",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend />
                    <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" />
                    <Bar dataKey="expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Orders vs Revenue Composite Chart */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Orders vs. Revenue Correlation</h3>
              <p className="text-xs text-zinc-400 mb-4">Track order volume correlation against gross rupee earnings</p>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        borderColor: "#27272a",
                        color: "#fafafa",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="right" dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Orders Count" />
                    <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          3. SALES REPORTS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "sales" && sales && (
        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Sales Value</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {formatPrice(sales.summary.totalSales)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Orders Filtered</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {sales.pagination.totalCount.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Discounts Conceded</span>
              <div className="text-lg font-bold text-amber-600 mt-1">
                {formatPrice(sales.summary.totalDiscounts)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Taxes Collected</span>
              <div className="text-lg font-bold text-blue-600 mt-1">
                {formatPrice(sales.summary.totalTax)}
              </div>
            </div>
          </div>

          {/* Filters Bar: Search, Order Status, Payment Status, Payment Method */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by order ID, customer name, email, or product..."
                value={salesSearch}
                onChange={(e) => {
                  setSalesSearch(e.target.value);
                  setSalesPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Order Status Filter */}
              <select
                value={salesOrderStatus}
                onChange={(e) => {
                  setSalesOrderStatus(e.target.value);
                  setSalesPage(1);
                }}
                className="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200"
              >
                <option value="All">All Order Statuses</option>
                <option value="Delivered">Delivered</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>

              {/* Payment Status Filter */}
              <select
                value={salesPaymentStatus}
                onChange={(e) => {
                  setSalesPaymentStatus(e.target.value);
                  setSalesPage(1);
                }}
                className="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200"
              >
                <option value="All">All Payment Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Refunded">Refunded</option>
              </select>

              {/* Payment Method Filter */}
              <select
                value={salesPaymentMethod}
                onChange={(e) => {
                  setSalesPaymentMethod(e.target.value);
                  setSalesPage(1);
                }}
                className="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200"
              >
                <option value="All">All Payment Methods</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Razorpay">Razorpay</option>
                <option value="Card">Card</option>
                <option value="Stripe">Stripe</option>
              </select>
            </div>
          </div>

          {/* Sales Report Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Product(s)</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Shipping</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Payment</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {sales.sales.length > 0 ? (
                    sales.sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                        <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                          {sale.orderNumber}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-zinc-500">
                          {new Date(sale.orderDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{sale.customerName}</div>
                          <div className="text-[10px] text-zinc-400">{sale.customerEmail}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[220px] truncate" title={sale.productName}>
                          {sale.productName}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{sale.quantity}</td>
                        <td className="py-3 px-4 text-right">{formatPrice(sale.subtotal)}</td>
                        <td className="py-3 px-4 text-right text-rose-600">
                          {sale.discount > 0 ? `-${formatPrice(sale.discount)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">{formatPrice(sale.tax)}</td>
                        <td className="py-3 px-4 text-right">{formatPrice(sale.shippingCharges)}</td>
                        <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-zinc-50">
                          {formatPrice(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {sale.paymentMethod}
                          </span>
                          <span
                            className={`ml-1 text-[10px] font-bold ${
                              sale.paymentStatus === "Paid"
                                ? "text-emerald-600"
                                : sale.paymentStatus === "Failed"
                                ? "text-rose-600"
                                : "text-amber-600"
                            }`}
                          >
                            • {sale.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                              sale.orderStatus === "Delivered"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : sale.orderStatus === "Cancelled" || sale.orderStatus === "Refunded"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                            }`}
                          >
                            {sale.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-zinc-400">
                        No orders match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Page {sales.pagination.page} of {sales.pagination.totalPages} ({sales.pagination.totalCount} orders)
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={sales.pagination.page <= 1}
                  onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={sales.pagination.page >= sales.pagination.totalPages}
                  onClick={() => setSalesPage((p) => p + 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          4. PRODUCT PERFORMANCE REPORTS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "products" && products && (
        <div className="space-y-6">
          {/* Top Sellers vs Lowest Sellers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best Sellers */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-600" /> Best-Selling Products
                </h3>
                <span className="text-xs text-zinc-400">By Sales Quantity</span>
              </div>

              <div className="space-y-3">
                {products.bestSelling.slice(0, 5).map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800"
                  >
                    <span className="w-5 text-center font-bold text-zinc-400 text-xs">#{idx + 1}</span>
                    <img
                      src={p.image || "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?w=100&q=80"}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</div>
                      <div className="text-[10px] text-zinc-400">{p.category} • {p.brand}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{p.unitsSold} units</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">{formatPrice(p.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Profitable Products */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" /> Most Profitable Products
                </h3>
                <span className="text-xs text-zinc-400">By Margin & Profit</span>
              </div>

              <div className="space-y-3">
                {products.mostProfitable.slice(0, 5).map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800"
                  >
                    <span className="w-5 text-center font-bold text-zinc-400 text-xs">#{idx + 1}</span>
                    <img
                      src={p.image || "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?w=100&q=80"}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</div>
                      <div className="text-[10px] text-zinc-400">Price: {formatPrice(p.price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-teal-600">{formatPrice(p.profit)}</div>
                      <div className="text-[10px] text-zinc-400 font-medium">Est. Net Profit</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Product Performance Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Complete Product Performance Audit</h3>
                <p className="text-xs text-zinc-400">Real-time stock valuation, unit sales, and revenue velocity</p>
              </div>
              <button
                onClick={() => handleExport("products", "xlsx")}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition flex items-center gap-1.5"
              >
                <Download size={13} /> Export Products
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {products.allPerformance.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img
                          src={p.image || "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?w=100&q=80"}
                          alt={p.name}
                          className="w-8 h-8 rounded-md object-cover bg-zinc-200"
                        />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">
                          {p.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{p.category}</td>
                      <td className="py-3 px-4 text-zinc-500">{p.brand}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatPrice(p.price)}</td>
                      <td className="py-3 px-4 text-center font-bold">{p.stock}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            p.stock === 0
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : p.stock <= 5
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          }`}
                        >
                          {p.stockStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{p.unitsSold}</td>
                      <td className="py-3 px-4 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(p.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatPrice(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          5. CUSTOMER ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "customers" && customers && (
        <div className="space-y-6">
          {/* Customer KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Registered</span>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {customers.summary.totalRegistered.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Active in Period</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {customers.summary.activeCustomers.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Returning Customers</span>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {customers.summary.returningCustomers.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Customer Lifetime Value (CLV)</span>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {formatPrice(customers.summary.customerLifetimeValue)}
              </div>
            </div>
          </div>

          {/* Top Spenders Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Top Spending Customers (CLV Leaderboard)</h3>
                <p className="text-xs text-zinc-400">Recognize high-value buyers and purchase frequency</p>
              </div>
              <button
                onClick={() => handleExport("customers", "xlsx")}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition flex items-center gap-1.5"
              >
                <Download size={13} /> Export Customers
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4 text-center">Total Orders</th>
                    <th className="py-3 px-4 text-right">Avg Order Value</th>
                    <th className="py-3 px-4 text-right">Lifetime Spend</th>
                    <th className="py-3 px-4 text-right">Last Purchase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {customers.topSpending.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 text-center font-bold text-zinc-400">#{c.rank}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">{c.email}</td>
                      <td className="py-3 px-4 text-center font-semibold">{c.orderCount}</td>
                      <td className="py-3 px-4 text-right">{formatPrice(c.averageOrderValue)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatPrice(c.totalSpend)}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-500">
                        {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          6. CATEGORIES & BRAND ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "categories" && categories && (
        <div className="space-y-6">
          {/* Charts Row: Category Distribution Bar & Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Revenue Bar Chart */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Category-Wise Revenue</h3>
              <p className="text-xs text-zinc-400 mb-4">Direct gross volume generated by each product category</p>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories.categories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(val: any) => [formatPrice(val), "Revenue"]}
                      contentStyle={{
                        backgroundColor: "#09090b",
                        borderColor: "#27272a",
                        color: "#fafafa",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Share Pie Chart */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Product Demand Share</h3>
              <p className="text-xs text-zinc-400 mb-4">Percentage contribution of each category to store sales</p>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories.categories.filter((c) => c.revenue > 0)}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categories.categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatPrice(val), "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Brand Performance Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Brand-Wise Performance Audit</h3>
              <p className="text-xs text-zinc-400">Order share and revenue performance across vendor brands</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Brand Name</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Revenue Generated</th>
                    <th className="py-3 px-4 text-right">Market Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {categories.brands.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{b.name}</td>
                      <td className="py-3 px-4 text-center">{b.orders}</td>
                      <td className="py-3 px-4 text-center font-bold">{b.unitsSold}</td>
                      <td className="py-3 px-4 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatPrice(b.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-blue-600">{b.sharePercentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          7. ORDER & PAYMENT ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "payments" && payments && (
        <div className="space-y-6">
          {/* Payment Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Payment Success Rate</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {payments.summary.paymentSuccessRate}%
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Online Payments</span>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {formatPrice(payments.summary.onlinePayments.amount)}
              </div>
              <span className="text-[10px] text-zinc-400">{payments.summary.onlinePayments.count} Transactions</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">COD Orders</span>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {formatPrice(payments.summary.codOrders.amount)}
              </div>
              <span className="text-[10px] text-zinc-400">{payments.summary.codOrders.count} Orders</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Failed Payments</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {payments.summary.failedPayments}
              </div>
            </div>
          </div>

          {/* Transactions Log Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Recent Payment Transactions Audit</h3>
              <p className="text-xs text-zinc-400">Verification log of payments across gateway providers</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Order Number</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Payment Status</th>
                    <th className="py-3 px-4 text-center">Order Status</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {payments.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">{tx.orderNumber}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{tx.customerName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800">
                          {tx.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-zinc-50">{formatPrice(tx.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.paymentStatus === "Paid"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : tx.paymentStatus === "Failed"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {tx.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-zinc-500">{tx.orderStatus}</td>
                      <td className="py-3 px-4 text-right text-zinc-400 whitespace-nowrap">
                        {new Date(tx.date).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          8. INVENTORY REPORTS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "inventory" && inventory && (
        <div className="space-y-6">
          {/* Inventory Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Stock Valuation</span>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {formatPrice(inventory.summary.totalInventoryValue)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Available Units</span>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {inventory.summary.availableStockUnits.toLocaleString()} units
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Low-Stock Alerts</span>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {inventory.summary.lowStockCount} items
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Out of Stock</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {inventory.summary.outOfStockCount} items
              </div>
            </div>
          </div>

          {/* Fast Moving vs Slow Moving Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" /> Fast-Moving Inventory
              </h3>
              <p className="text-xs text-zinc-400 mb-4">High turnover products requiring restock monitoring</p>

              <div className="space-y-3">
                {inventory.fastMoving.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</div>
                      <div className="text-[10px] text-zinc-400">Stock left: {p.stock} units</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600">{p.salesCount} sold</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
                <Clock size={16} className="text-amber-500" /> Slow-Moving Inventory
              </h3>
              <p className="text-xs text-zinc-400 mb-4">Capital retention items with low demand velocity</p>

              <div className="space-y-3">
                {inventory.slowMoving.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</div>
                      <div className="text-[10px] text-zinc-400">Stock holding: {p.stock} units</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-zinc-500">{p.salesCount || 0} sold</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          9. COUPONS & DISCOUNTS ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "coupons" && coupons && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Discounts Given</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatPrice(coupons.summary.totalDiscountsProvided)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Coupon Redemptions</span>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {coupons.summary.couponUsageCount.toLocaleString()} times
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Promotional Orders</span>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {coupons.summary.discountedOrders} orders
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Discount Impact on Sales</span>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {coupons.summary.discountImpactOnSales}%
              </div>
            </div>
          </div>

          {/* Coupons Performance Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Coupon Performance Leaderboard</h3>
              <p className="text-xs text-zinc-400">Revenue driven and discounts applied per promo campaign</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Discount Type</th>
                    <th className="py-3 px-4 text-center">Times Redeemed</th>
                    <th className="py-3 px-4 text-right">Total Discount Conceded</th>
                    <th className="py-3 px-4 text-right">Revenue Generated</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {coupons.couponList.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{c.code}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</td>
                      <td className="py-3 px-4 capitalize text-zinc-500">{c.discountType} ({c.discountValue})</td>
                      <td className="py-3 px-4 text-center font-bold">{c.timesUsed}</td>
                      <td className="py-3 px-4 text-right text-rose-600 font-semibold">{formatPrice(c.totalDiscountGiven)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatPrice(c.revenueGenerated)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {c.isActive ? "Active" : "Expired"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          10. RETURNS & REFUNDS ANALYTICS TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === "returns" && returns && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Return Requests</span>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {returns.summary.totalReturnRequests}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Approved Returns</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {returns.summary.approvedReturns}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Total Refunded Amount</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatPrice(returns.summary.totalRefundedAmount)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-xs text-zinc-400">Return Rate</span>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {returns.summary.returnPercentage}%
              </div>
            </div>
          </div>

          {/* Return Reasons Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Return Reasons Analysis</h3>
              <p className="text-xs text-zinc-400 mb-4">Distribution of customer-reported reasons for returns</p>

              <div className="space-y-3">
                {returns.returnReasons.map((r) => (
                  <div key={r.reason}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>{r.reason}</span>
                      <span>{r.count} cases ({r.percentage}%)</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.max(5, r.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-1">Most Returned Items</h3>
              <p className="text-xs text-zinc-400 mb-4">Products with the highest return frequency</p>

              <div className="space-y-3">
                {returns.mostReturnedProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-600">{p.count} returns</div>
                      <div className="text-[10px] text-zinc-400">{formatPrice(p.refundAmount)} refunded</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Date Range Modal ── */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Select Custom Date Range</h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!customStart || !customEnd) {
                    toast.error("Please select both start and end dates");
                    return;
                  }
                  setDateRange("custom");
                  setShowCustomModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

