import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatPrice } from "../../utils/currency";
import {
  fetchAdminCoupons,
  createCoupon,
  updateCoupon,
  setCouponActive,
  archiveCoupon,
  deleteCoupon,
  duplicateCoupon,
  fetchCouponStats,
  fetchCouponAnalytics,
  exportCouponAnalytics,
  type CouponRecord,
  type CouponPagination,
  type CouponDiscountType,
  type CouponStatus,
  type CouponStats,
  type CouponAnalyticsResponse,
  type CouponCreatePayload,
} from "../../services/api";
import {
  TicketPercent,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  Search,
  X,
  Plus,
  Pencil,
  Trash2,
  Archive,
  Copy,
  BarChart3,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Power,
  Truck,
  Percent,
  Loader2,
} from "lucide-react";

const EMPTY_PAGINATION: CouponPagination = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
  hasNext: false,
  hasPrev: false,
};

type CouponsAdminProps = {
  categories: { id: string; name: string }[];
  products: { id: string | number; name: string }[];
  onRefresh?: () => void;
};

type CouponFormState = {
  code: string;
  name: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;
  minQuantity: string;
  startDate: string;
  expiryDate: string;
  usageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  shippingMethods: ("standard" | "express")[];
  combinable: boolean;
  eligibleCategories: string[];
  eligibleProducts: string[];
  excludedCategories: string[];
  excludedProducts: string[];
  eligibleCustomers: string;
  isActive: boolean;
};

const emptyForm = (): CouponFormState => ({
  code: "",
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: "10",
  maxDiscount: "",
  minOrderValue: "",
  minQuantity: "1",
  startDate: "",
  expiryDate: "",
  usageLimit: "",
  perCustomerLimit: "1",
  firstOrderOnly: false,
  shippingMethods: [],
  combinable: true,
  eligibleCategories: [],
  eligibleProducts: [],
  excludedCategories: [],
  excludedProducts: [],
  eligibleCustomers: "",
  isActive: true,
});

const toLocalInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const statusLabel = (status: CouponStatus) =>
  ({
    active: "Active",
    disabled: "Disabled",
    scheduled: "Scheduled",
    expired: "Expired",
    exhausted: "Exhausted",
    archived: "Archived",
  })[status] || status;

const computedStatus = (coupon: CouponRecord): CouponStatus => {
  if (coupon.status) return coupon.status;
  if (coupon.isArchived) return "archived";
  if (!coupon.isActive) return "disabled";
  const now = Date.now();
  if (coupon.startDate && now < new Date(coupon.startDate).getTime()) return "scheduled";
  if (coupon.expiryDate && now > new Date(coupon.expiryDate).getTime()) return "expired";
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return "exhausted";
  return "active";
};

export default function CouponsAdmin({ categories, products, onRefresh }: CouponsAdminProps) {
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [pagination, setPagination] = useState<CouponPagination>(EMPTY_PAGINATION);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | CouponStatus>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | CouponDiscountType>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("-createdAt");

  // Modal / form
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CouponRecord | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "archive"; coupon: CouponRecord } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<CouponAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFrom, setAnalyticsFrom] = useState("");
  const [analyticsTo, setAnalyticsTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const reload = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchAdminCoupons({
          page,
          limit,
          search: search.trim() || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          discountType: typeFilter === "All" ? undefined : typeFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sort,
        });
        if (cancelled) return;
        setCoupons(result.coupons);
        setPagination(result.pagination);
        if (result.pagination.page !== page) setPage(result.pagination.page);
      } catch (error: any) {
        if (!cancelled) {
          setCoupons([]);
          setPagination(EMPTY_PAGINATION);
          toast.error(error.message || "Failed to load coupons");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, limit, search, statusFilter, typeFilter, dateFrom, dateTo, sort, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    fetchCouponStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const updateForm = <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setTypeFilter("All");
    setDateFrom("");
    setDateTo("");
    setSort("-createdAt");
    setPage(1);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (coupon: CouponRecord) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue ?? 0),
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : "",
      minOrderValue: coupon.minOrderValue ? String(coupon.minOrderValue) : "",
      minQuantity: String(coupon.minQuantity || 1),
      startDate: toLocalInput(coupon.startDate),
      expiryDate: toLocalInput(coupon.expiryDate),
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
      perCustomerLimit: String(coupon.perCustomerLimit || 1),
      firstOrderOnly: Boolean(coupon.firstOrderOnly),
      shippingMethods: Array.isArray(coupon.shippingMethods) ? coupon.shippingMethods : [],
      combinable: coupon.combinable !== false,
      eligibleCategories: (coupon.eligibleCategories || []).map(String),
      eligibleProducts: (coupon.eligibleProducts || []).map(String),
      excludedCategories: (coupon.excludedCategories || []).map(String),
      excludedProducts: (coupon.excludedProducts || []).map(String),
      eligibleCustomers: (coupon.eligibleCustomers || []).map(String).join(", "),
      isActive: coupon.isActive,
    });
    setShowModal(true);
  };

  const generateCode = () => {
    const code = `DLX${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    updateForm("code", code);
  };

  const toggleShippingMethod = (method: "standard" | "express") => {
    setForm((current) => ({
      ...current,
      shippingMethods: current.shippingMethods.includes(method)
        ? current.shippingMethods.filter((item) => item !== method)
        : [...current.shippingMethods, method],
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Coupon name is required");
      return;
    }
    if (form.discountType === "percentage") {
      const value = Number(form.discountValue);
      if (!(value > 0) || value > 100) {
        toast.error("Percentage discount must be between 0 and 100");
        return;
      }
    }
    if (form.discountType === "fixed" && !(Number(form.discountValue) > 0)) {
      toast.error("Fixed discount must be greater than zero");
      return;
    }
    const start = new Date(form.startDate);
    const expiry = new Date(form.expiryDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(expiry.getTime())) {
      toast.error("Please choose valid start and expiry dates");
      return;
    }
    if (expiry.getTime() <= start.getTime()) {
      toast.error("Expiry date must be after the start date");
      return;
    }

    const customerIds = form.eligibleCustomers
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const payload: CouponCreatePayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: form.discountType === "free_shipping" ? 0 : Number(form.discountValue) || 0,
      maxDiscount:
        form.discountType === "percentage" && form.maxDiscount
          ? Number(form.maxDiscount)
          : 0,
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
      minQuantity: Number(form.minQuantity) || 1,
      startDate: start.toISOString(),
      expiryDate: expiry.toISOString(),
      usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
      perCustomerLimit: Number(form.perCustomerLimit) || 1,
      firstOrderOnly: form.firstOrderOnly,
      shippingMethods: form.shippingMethods,
      combinable: form.combinable,
      eligibleCategories: form.eligibleCategories,
      eligibleProducts: form.eligibleProducts,
      excludedCategories: form.excludedCategories,
      excludedProducts: form.excludedProducts,
      eligibleCustomers: customerIds,
      isActive: form.isActive,
    };
    if (form.code.trim()) {
      payload.code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCoupon(editing.id || editing._id, payload);
        toast.success(`Updated coupon ${updated.code}`);
      } else {
        const created = await createCoupon(payload);
        toast.success(`Created coupon ${created.code}`);
      }
      setShowModal(false);
      reload();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (coupon: CouponRecord, action: "toggle" | "duplicate") => {
    setActionId(coupon.id || coupon._id);
    try {
      if (action === "toggle") {
        const updated = await setCouponActive(coupon.id || coupon._id, !coupon.isActive);
        toast.success(`${updated.code} is now ${updated.isActive ? "active" : "disabled"}`);
      } else {
        const created = await duplicateCoupon(coupon.id || coupon._id);
        toast.success(`Duplicated as ${created.code}`);
      }
      reload();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Coupon action failed");
    } finally {
      setActionId(null);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const coupon = confirm.coupon;
    setActionId(coupon.id || coupon._id);
    try {
      if (confirm.kind === "delete") {
        await deleteCoupon(coupon.id || coupon._id);
        toast.success(`Deleted coupon ${coupon.code}`);
      } else {
        const result = await archiveCoupon(coupon.id || coupon._id);
        toast.success(
          result.action === "archived"
            ? `Archived coupon ${coupon.code}`
            : `Deactivated ${coupon.code}: ${result.reason || "coupon has redemption history"}`
        );
      }
      setConfirm(null);
      reload();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Coupon action failed");
    } finally {
      setActionId(null);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const result = await fetchCouponAnalytics({
        dateFrom: analyticsFrom || undefined,
        dateTo: analyticsTo || undefined,
        limit: 50,
      });
      setAnalytics(result);
    } catch (error: any) {
      toast.error(error.message || "Failed to load coupon analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const toggleAnalytics = () => {
    const next = !showAnalytics;
    setShowAnalytics(next);
    if (next && !analytics) loadAnalytics();
  };

  const downloadCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportCouponAnalytics({
        dateFrom: analyticsFrom || undefined,
        dateTo: analyticsTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `delivix-coupons-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Coupon report downloaded");
    } catch (error: any) {
      toast.error(error.message || "Failed to export coupon report");
    } finally {
      setExporting(false);
    }
  };

  const typeLabel = (coupon: CouponRecord) => {
    if (coupon.discountType === "percentage") return `${Number(coupon.discountValue)}%`;
    if (coupon.discountType === "fixed") return formatPrice(coupon.discountValue);
    return "Free shipping";
  };

  const typeIcon = (coupon: CouponRecord) => {
    if (coupon.discountType === "free_shipping") return <Truck size={13} />;
    if (coupon.discountType === "percentage") return <Percent size={13} />;
    return <TicketPercent size={13} />;
  };

  const summary = stats || {
    totalCoupons: pagination.total,
    activeCoupons: coupons.filter((coupon) => computedStatus(coupon) === "active").length,
    scheduledCoupons: coupons.filter((coupon) => computedStatus(coupon) === "scheduled").length,
    expiredCoupons: coupons.filter((coupon) => computedStatus(coupon) === "expired").length,
    exhaustedCoupons: 0,
    successfulRedemptions: coupons.reduce((sum, coupon) => sum + (coupon.usageCount || 0), 0),
    totalDiscountGranted: 0,
    pendingReservations: 0,
    totalOrdersWithCoupons: 0,
    grossOrderValue: 0,
    netRevenue: 0,
    averageOrderValue: 0,
  };

  return (
    <div className="admin-tab-view coupons-admin">
      <div className="admin-filters-bar">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>
            Promotions &amp; discounts
          </p>
          <h3 style={{ font: '500 20px "Manrope"', margin: "4px 0 0" }}>
            Coupons &amp; Discounts
          </h3>
        </div>
        <div className="coupon-toolbar">
          <button type="button" className="coupon-btn coupon-btn--ghost" onClick={toggleAnalytics}>
            <BarChart3 size={15} />
            {showAnalytics ? "Hide analytics" : "Analytics"}
          </button>
          <button type="button" className="coupon-btn coupon-btn--primary" onClick={openAdd}>
            <Plus size={15} /> Create coupon
          </button>
        </div>
      </div>

      <div className="stat-grid coupon-stat-grid">
        <StatCard icon={<TicketPercent size={15} />} label="Total coupons" value={summary.totalCoupons} hint="All non-archived coupons" />
        <StatCard icon={<CheckCircle2 size={15} />} label="Active" value={summary.activeCoupons} hint="Currently redeemable" tone="good" />
        <StatCard icon={<Clock size={15} />} label="Scheduled" value={summary.scheduledCoupons} hint="Starts in the future" />
        <StatCard icon={<AlertTriangle size={15} />} label="Expired" value={summary.expiredCoupons} hint="Past expiry" tone="warn" />
        <StatCard icon={<ShoppingCart size={15} />} label="Redemptions" value={summary.successfulRedemptions} hint="Successful uses" />
        <StatCard icon={<Percent size={15} />} label="Discount granted" value={formatPrice(summary.totalDiscountGranted)} hint="All successful redemptions" />
      </div>

      {showAnalytics && (
        <section className="coupon-analytics">
          <div className="coupon-analytics__head">
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Redemption analytics</p>
              <h4>Coupon performance</h4>
            </div>
            <div className="coupon-analytics__controls">
              <input
                className="admin-input"
                type="date"
                value={analyticsFrom}
                onChange={(event) => setAnalyticsFrom(event.target.value)}
                aria-label="Analytics from date"
              />
              <input
                className="admin-input"
                type="date"
                value={analyticsTo}
                onChange={(event) => setAnalyticsTo(event.target.value)}
                aria-label="Analytics to date"
              />
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={loadAnalytics} disabled={analyticsLoading}>
                {analyticsLoading ? <Loader2 size={14} className="coupon-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={downloadCsv} disabled={exporting}>
                {exporting ? <Loader2 size={14} className="coupon-spin" /> : <Download size={14} />}
                CSV
              </button>
            </div>
          </div>

          {analyticsLoading && !analytics ? (
            <div className="coupon-analytics__empty">
              <Loader2 size={22} className="coupon-spin" /> Loading analytics…
            </div>
          ) : analytics ? (
            <>
              <div className="coupon-analytics__metrics">
                <Metric label="Successful redemptions" value={analytics.summary.totalRedemptions} />
                <Metric label="Unique customers" value={analytics.summary.uniqueCustomers} />
                <Metric label="Discount granted" value={formatPrice(analytics.summary.totalDiscountGranted)} />
                <Metric label="Gross order value" value={formatPrice(analytics.summary.grossOrderValue)} />
                <Metric label="Net revenue" value={formatPrice(analytics.summary.netRevenue)} />
                <Metric label="Average order value" value={formatPrice(analytics.summary.averageOrderValue)} />
              </div>

              <div className="coupon-analytics__grid">
                <div className="coupon-analytics__panel">
                  <h5>Most used coupons</h5>
                  {analytics.mostUsed.length === 0 ? (
                    <p className="coupon-muted">No successful redemptions in this period.</p>
                  ) : (
                    <div className="coupon-analytics__list">
                      {analytics.mostUsed.slice(0, 8).map((row) => (
                        <div key={row.couponId || row.code} className="coupon-analytics__row">
                          <span>
                            <strong>{row.code}</strong>
                            <small>{row.name || "Coupon"}</small>
                          </span>
                          <span className="coupon-analytics__numbers">
                            <b>{row.totalRedemptions}</b>
                            <small>{formatPrice(row.totalDiscount)}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="coupon-analytics__panel">
                  <h5>Nearing usage limits</h5>
                  {analytics.nearingLimits.length === 0 ? (
                    <p className="coupon-muted">No coupons are close to their limit.</p>
                  ) : (
                    <div className="coupon-analytics__list">
                      {analytics.nearingLimits.slice(0, 8).map((row) => (
                        <div key={row.couponId || row.code} className="coupon-analytics__row">
                          <span>
                            <strong>{row.code}</strong>
                            <small>{row.name || "Coupon"}</small>
                          </span>
                          <span className="coupon-analytics__numbers">
                            <b>{row.remaining ?? 0} left</b>
                            <small>{row.usageCount ?? 0} used</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="coupon-analytics__panel">
                  <h5>Usage over time</h5>
                  {analytics.usageOverTime.length === 0 ? (
                    <p className="coupon-muted">No redemption activity in this period.</p>
                  ) : (
                    <div className="coupon-analytics__bars">
                      {analytics.usageOverTime.slice(-14).map((row) => {
                        const max = Math.max(...analytics.usageOverTime.map((item) => item.redemptions), 1);
                        return (
                          <div key={row.date} className="coupon-analytics__bar" title={`${row.date}: ${row.redemptions} redemption(s)`}>
                            <span style={{ height: `${Math.max(6, (row.redemptions / max) * 100)}%` }} />
                            <small>{row.date.slice(5)}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="coupon-analytics__panel">
                  <h5>Expired &amp; never used</h5>
                  {analytics.expiredUnused.length === 0 ? (
                    <p className="coupon-muted">No expired unused coupons.</p>
                  ) : (
                    <div className="coupon-analytics__list">
                      {analytics.expiredUnused.slice(0, 8).map((row: any) => (
                        <div key={row._id || row.code} className="coupon-analytics__row">
                          <span>
                            <strong>{row.code}</strong>
                            <small>{row.name || "Coupon"}</small>
                          </span>
                          <span className="coupon-analytics__numbers">
                            <b>Unused</b>
                            <small>{row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : ""}</small>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="coupon-analytics__empty">
              <BarChart3 size={22} />
              <p>Choose a period and refresh to view analytics.</p>
            </div>
          )}
        </section>
      )}

      <div className="coupon-filters">
        <div className="admin-search-box coupon-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search code, name or description…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            aria-label="Search coupons"
          />
          {search && (
            <button type="button" className="icon-button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="coupon-select"
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value as any); setPage(1); }}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
          <option value="exhausted">Exhausted</option>
          <option value="archived">Archived</option>
        </select>

        <select
          className="coupon-select"
          value={typeFilter}
          onChange={(event) => { setTypeFilter(event.target.value as any); setPage(1); }}
          aria-label="Filter by type"
        >
          <option value="All">All types</option>
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed amount</option>
          <option value="free_shipping">Free shipping</option>
        </select>

        <select
          className="coupon-select"
          value={sort}
          onChange={(event) => { setSort(event.target.value); setPage(1); }}
          aria-label="Sort coupons"
        >
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="code">Code A–Z</option>
          <option value="-usageCount">Most used</option>
          <option value="expiryDate">Expiring soon</option>
          <option value="-discountValue">Highest value</option>
        </select>

        <input
          className="admin-input coupon-date"
          type="date"
          value={dateFrom}
          onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
          aria-label="Expiry from"
          title="Expiry date from"
        />
        <input
          className="admin-input coupon-date"
          type="date"
          value={dateTo}
          onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
          aria-label="Expiry to"
          title="Expiry date to"
        />
        <button type="button" className="coupon-btn coupon-btn--ghost" onClick={reload} disabled={loading}>
          <RefreshCw size={14} className={loading ? "coupon-spin" : ""} /> Refresh
        </button>
      </div>

      <article className="orders-table coupon-table">
        <div className="table-head coupon-table__head">
          <span>Coupon</span>
          <span>Type</span>
          <span>Discount</span>
          <span>Minimums</span>
          <span>Validity</span>
          <span>Usage</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="coupon-table__state">
            <Loader2 size={22} className="coupon-spin" />
            <p>Loading coupons…</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="coupon-table__state">
            <TicketPercent size={28} />
            <h4>{search || statusFilter !== "All" || typeFilter !== "All" ? "No matching coupons" : "No coupons yet"}</h4>
            <p>
              {search || statusFilter !== "All" || typeFilter !== "All"
                ? "Try clearing the filters or searching for a different code."
                : "Create your first coupon to offer discounts at checkout."}
            </p>
            {search || statusFilter !== "All" || typeFilter !== "All" ? (
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={resetFilters}>
                Reset filters
              </button>
            ) : (
              <button type="button" className="coupon-btn coupon-btn--primary" onClick={openAdd}>
                <Plus size={14} /> Create coupon
              </button>
            )}
          </div>
        ) : (
          coupons.map((coupon) => {
            const status = computedStatus(coupon);
            const busy = actionId === (coupon.id || coupon._id);
            return (
              <div className="table-row coupon-table__row" key={coupon.id || coupon._id}>
                <div className="coupon-cell coupon-cell--code" data-label="Coupon">
                  <strong>{coupon.code}</strong>
                  <small>{coupon.name}</small>
                  {coupon.description ? <em>{coupon.description}</em> : null}
                </div>
                <div className="coupon-cell" data-label="Type">
                  <span className="coupon-type">
                    {typeIcon(coupon)}
                    {coupon.discountType === "free_shipping" ? "Free shipping" : coupon.discountType === "percentage" ? "Percentage" : "Fixed amount"}
                  </span>
                </div>
                <div className="coupon-cell" data-label="Discount">
                  <strong>{typeLabel(coupon)}</strong>
                  {coupon.discountType === "percentage" && coupon.maxDiscount > 0 ? (
                    <small>Cap {formatPrice(coupon.maxDiscount)}</small>
                  ) : null}
                </div>
                <div className="coupon-cell" data-label="Minimums">
                  <span>{coupon.minOrderValue > 0 ? `Min ${formatPrice(coupon.minOrderValue)}` : "No minimum"}</span>
                  {coupon.minQuantity > 1 ? <small>{coupon.minQuantity}+ items</small> : null}
                </div>
                <div className="coupon-cell" data-label="Validity">
                  <span>{new Date(coupon.startDate).toLocaleDateString()}</span>
                  <small>to {new Date(coupon.expiryDate).toLocaleDateString()}</small>
                </div>
                <div className="coupon-cell" data-label="Usage">
                  <strong>
                    {coupon.usageCount || 0}
                    {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ""}
                  </strong>
                  <small>
                    {coupon.usageLimit != null && coupon.availableUses != null
                      ? `${coupon.availableUses} available`
                      : "Unlimited"}
                    {coupon.pendingCount ? ` · ${coupon.pendingCount} pending` : ""}
                  </small>
                </div>
                <div className="coupon-cell" data-label="Status">
                  <span className={`status-badge status-badge--${status}`}>{statusLabel(status)}</span>
                </div>
                <div className="coupon-cell coupon-actions" data-label="Actions">
                  <button type="button" className="admin-action-btn admin-action-btn--edit" onClick={() => openEdit(coupon)} disabled={busy} title="Edit coupon">
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="admin-action-btn" onClick={() => runAction(coupon, "toggle")} disabled={busy} title={coupon.isActive ? "Disable coupon" : "Activate coupon"}>
                    <Power size={13} /> {coupon.isActive ? "Disable" : "Activate"}
                  </button>
                  <button type="button" className="admin-action-btn" onClick={() => runAction(coupon, "duplicate")} disabled={busy} title="Duplicate coupon">
                    <Copy size={13} /> Duplicate
                  </button>
                  <button type="button" className="admin-action-btn" onClick={() => setConfirm({ kind: "archive", coupon })} disabled={busy} title="Archive coupon">
                    <Archive size={13} /> Archive
                  </button>
                  <button type="button" className="admin-action-btn admin-action-btn--delete" onClick={() => setConfirm({ kind: "delete", coupon })} disabled={busy} title="Delete coupon">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </article>

      {pagination.total > 0 && (
        <div className="coupon-pagination">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="coupon-pagination__controls">
            <select
              className="coupon-select"
              value={limit}
              onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.page <= 1 || loading}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="coupon-pagination__page">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))} disabled={pagination.page >= pagination.pages || loading}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="admin-modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="admin-modal admin-modal--small" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ color: confirm.kind === "delete" ? "#dc2626" : undefined, margin: 0 }}>
                  {confirm.kind === "delete" ? "Confirm removal" : "Confirm archive"}
                </p>
                <h2>{confirm.kind === "delete" ? "Delete coupon?" : "Archive coupon?"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setConfirm(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--black)" }}>{confirm.coupon.code}</strong>
              {confirm.kind === "delete"
                ? " will be permanently deleted. Coupons with redemption history cannot be deleted; archive or disable them instead."
                : " will be removed from the active list. Coupons with redemption history are deactivated so historical orders stay intact."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setConfirm(null)} disabled={Boolean(actionId)}>
                Cancel
              </button>
              <button type="button" className={confirm.kind === "delete" ? "admin-btn-delete coupon-btn" : "coupon-btn coupon-btn--primary"} onClick={confirmAction} disabled={Boolean(actionId)}>
                {actionId ? <Loader2 size={14} className="coupon-spin" /> : confirm.kind === "delete" ? <Trash2 size={14} /> : <Archive size={14} />}
                {confirm.kind === "delete" ? "Delete coupon" : "Archive coupon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="admin-modal coupon-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Promotions &amp; discounts</p>
                <h2>{editing ? `Edit coupon: ${editing.code}` : "Create new coupon"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="coupon-form">
              <div className="admin-modal__grid">
                <div className="admin-form-group">
                  <label>Coupon code</label>
                  <div className="coupon-code-row">
                    <input
                      className="admin-input"
                      type="text"
                      placeholder="Auto-generated if blank"
                      value={form.code}
                      onChange={(event) => updateForm("code", event.target.value.toUpperCase().replace(/\s+/g, ""))}
                      maxLength={30}
                    />
                    <button type="button" className="coupon-btn coupon-btn--ghost" onClick={generateCode} disabled={saving}>
                      <RefreshCw size={13} /> Generate
                    </button>
                  </div>
                  <small>Uppercase letters, numbers, hyphens and underscores only.</small>
                </div>

                <div className="admin-form-group">
                  <label>Coupon name *</label>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="e.g. Summer Sale 10% Off"
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                <div className="admin-form-group coupon-form__wide">
                  <label>Customer-facing description</label>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="Shown to customers at checkout"
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    maxLength={500}
                  />
                </div>

                <div className="admin-form-group">
                  <label>Discount type *</label>
                  <select
                    className="admin-input"
                    value={form.discountType}
                    onChange={(event) => {
                      const type = event.target.value as CouponDiscountType;
                      setForm((current) => ({
                        ...current,
                        discountType: type,
                        discountValue: type === "free_shipping" ? "0" : current.discountValue === "0" ? "10" : current.discountValue,
                        maxDiscount: type === "percentage" ? current.maxDiscount : "",
                      }));
                    }}
                  >
                    <option value="percentage">Percentage discount</option>
                    <option value="fixed">Fixed amount discount</option>
                    <option value="free_shipping">Free shipping</option>
                  </select>
                </div>

                {form.discountType !== "free_shipping" && (
                  <div className="admin-form-group">
                    <label>Discount value *</label>
                    <div className="coupon-inline">
                      <input
                        className="admin-input"
                        type="number"
                        min="0"
                        step="any"
                        value={form.discountValue}
                        onChange={(event) => updateForm("discountValue", event.target.value)}
                        required
                      />
                      <span>{form.discountType === "percentage" ? "%" : "₹"}</span>
                    </div>
                    {form.discountType === "percentage" ? (
                      <small>Enter a percentage between 0 and 100.</small>
                    ) : (
                      <small>Fixed amount in INR, deducted from eligible items.</small>
                    )}
                  </div>
                )}

                {form.discountType === "percentage" && (
                  <div className="admin-form-group">
                    <label>Maximum discount cap</label>
                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="No cap"
                      value={form.maxDiscount}
                      onChange={(event) => updateForm("maxDiscount", event.target.value)}
                    />
                    <small>Caps the amount a percentage coupon can grant.</small>
                  </div>
                )}

                <div className="admin-form-group">
                  <label>Minimum order value</label>
                  <div className="coupon-inline">
                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={form.minOrderValue}
                      onChange={(event) => updateForm("minOrderValue", event.target.value)}
                    />
                    <span>₹</span>
                  </div>
                  <small>Measured against eligible items only.</small>
                </div>

                <div className="admin-form-group">
                  <label>Minimum quantity</label>
                  <input
                    className="admin-input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.minQuantity}
                    onChange={(event) => updateForm("minQuantity", event.target.value)}
                  />
                  <small>Minimum number of eligible items in the bag.</small>
                </div>

                <div className="admin-form-group">
                  <label>Starts at *</label>
                  <input
                    className="admin-input"
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(event) => updateForm("startDate", event.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label>Expires at *</label>
                  <input
                    className="admin-input"
                    type="datetime-local"
                    value={form.expiryDate}
                    onChange={(event) => updateForm("expiryDate", event.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label>Total usage limit</label>
                  <input
                    className="admin-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Unlimited"
                    value={form.usageLimit}
                    onChange={(event) => updateForm("usageLimit", event.target.value)}
                  />
                  <small>Leave blank for unlimited redemptions.</small>
                </div>

                <div className="admin-form-group">
                  <label>Per-customer limit</label>
                  <input
                    className="admin-input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.perCustomerLimit}
                    onChange={(event) => updateForm("perCustomerLimit", event.target.value)}
                  />
                  <small>Maximum uses per customer account.</small>
                </div>

                <div className="admin-form-group coupon-form__wide">
                  <label>Shipping method restriction</label>
                  <div className="coupon-checkboxes">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.shippingMethods.includes("standard")}
                        onChange={() => toggleShippingMethod("standard")}
                      />
                      Standard delivery
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.shippingMethods.includes("express")}
                        onChange={() => toggleShippingMethod("express")}
                      />
                      Express delivery
                    </label>
                  </div>
                  <small>Leave both unchecked to allow every shipping method.</small>
                </div>

                <div className="admin-form-group">
                  <label>Eligible categories</label>
                  <select
                    className="admin-input"
                    multiple
                    size={4}
                    value={form.eligibleCategories}
                    onChange={(event) => updateForm("eligibleCategories", Array.from(event.target.selectedOptions).map((option) => option.value))}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <small>Empty = all categories eligible. Ctrl/Cmd-click to select multiple.</small>
                </div>

                <div className="admin-form-group">
                  <label>Eligible products</label>
                  <select
                    className="admin-input"
                    multiple
                    size={4}
                    value={form.eligibleProducts}
                    onChange={(event) => updateForm("eligibleProducts", Array.from(event.target.selectedOptions).map((option) => option.value))}
                  >
                    {products.map((product) => (
                      <option key={String(product.id)} value={String(product.id)}>{product.name}</option>
                    ))}
                  </select>
                  <small>Empty = all products eligible.</small>
                </div>

                <div className="admin-form-group">
                  <label>Excluded categories</label>
                  <select
                    className="admin-input"
                    multiple
                    size={4}
                    value={form.excludedCategories}
                    onChange={(event) => updateForm("excludedCategories", Array.from(event.target.selectedOptions).map((option) => option.value))}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label>Excluded products</label>
                  <select
                    className="admin-input"
                    multiple
                    size={4}
                    value={form.excludedProducts}
                    onChange={(event) => updateForm("excludedProducts", Array.from(event.target.selectedOptions).map((option) => option.value))}
                  >
                    {products.map((product) => (
                      <option key={String(product.id)} value={String(product.id)}>{product.name}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group coupon-form__wide">
                  <label>Eligible customer IDs</label>
                  <textarea
                    className="admin-input"
                    rows={2}
                    placeholder="Optional — comma-separated customer account IDs"
                    value={form.eligibleCustomers}
                    onChange={(event) => updateForm("eligibleCustomers", event.target.value)}
                  />
                  <small>Leave blank to allow every signed-in customer.</small>
                </div>

                <div className="admin-form-group coupon-form__wide">
                  <div className="coupon-checkboxes">
                    <label>
                      <input type="checkbox" checked={form.firstOrderOnly} onChange={(event) => updateForm("firstOrderOnly", event.target.checked)} />
                      First-order customers only
                    </label>
                    <label>
                      <input type="checkbox" checked={form.combinable} onChange={(event) => updateForm("combinable", event.target.checked)} />
                      Combinable with other promotions
                    </label>
                    <label>
                      <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} />
                      Active and redeemable
                    </label>
                  </div>
                </div>
              </div>

              <div className="coupon-form__actions">
                <button type="button" className="coupon-btn coupon-btn--ghost" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="coupon-btn coupon-btn--primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="coupon-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "warn" | "good";
}) {
  return (
    <article className={`stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <div className="stat-card__head">
        <p>{label}</p>
        <span className="stat-card__icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="coupon-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
