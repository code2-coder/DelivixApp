import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  addAdminCustomerNote,
  deleteAdminCustomerNote,
  exportAdminCustomers,
  fetchAdminCustomerDetails,
  fetchAdminCustomers,
  fetchAdminCustomerStats,
  updateAdminCustomer,
  updateAdminCustomerStatus,
  type AddressItem,
  type CustomerAccountStatus,
  type CustomerAdminNote,
  type CustomerDetailResponse,
  type CustomerPagination,
  type CustomerRecord,
  type CustomerStats,
  type OrderRecord,
} from "../../services/api";
import { formatPrice } from "../../utils/currency";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Ban,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  UserX,
  X,
  XCircle,
} from "lucide-react";

type AdminCustomersProps = {
  onCustomersChanged?: () => void;
  onNavigateToOrder?: (orderId: string) => void;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "All", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
];

const SEGMENT_OPTIONS: { id: string; label: string; icon: any; hint: string }[] = [
  { id: "all", label: "All Customers", icon: Users, hint: "Complete directory" },
  { id: "new", label: "New (30 Days)", icon: Sparkles, hint: "Recently joined" },
  { id: "repeat", label: "Repeat Buyers", icon: TrendingUp, hint: "2+ orders placed" },
  { id: "high_value", label: "High-Value", icon: ShoppingBag, hint: "High lifetime spend" },
  { id: "no_orders", label: "No Orders Yet", icon: UserCheck, hint: "Registered, 0 orders" },
  { id: "inactive", label: "Inactive / Churned", icon: Clock, hint: "90+ days without order" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest registered" },
  { value: "oldest", label: "Oldest registered" },
  { value: "spending_desc", label: "Total spent: High to Low" },
  { value: "spending_asc", label: "Total spent: Low to High" },
  { value: "orders_desc", label: "Total orders: High to Low" },
  { value: "orders_asc", label: "Total orders: Low to High" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

const ORDER_COUNT_OPTIONS = [
  { value: "All", label: "Any Order Count" },
  { value: "0", label: "0 Orders" },
  { value: "1-5", label: "1 - 5 Orders" },
  { value: "6-20", label: "6 - 20 Orders" },
  { value: "20+", label: "20+ Orders" },
];

const formatDate = (dateStr?: string | Date | null) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateStr?: string | Date | null) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitials = (name?: string) => {
  if (!name) return "CU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name?: string) => {
  const colors = [
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#6366f1",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function AdminCustomers({
  onCustomersChanged,
  onNavigateToOrder,
}: AdminCustomersProps) {
  // Statistics State
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // List State
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [pagination, setPagination] = useState<CustomerPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderCount, setOrderCount] = useState("All");
  const [minSpent, setMinSpent] = useState("");
  const [maxSpent, setMaxSpent] = useState("");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);

  // Selection & Export
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  // Modals & Drawers
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CustomerDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"orders" | "addresses" | "notes" | "history">("orders");

  // Edit Profile Modal
  const [editCustomer, setEditCustomer] = useState<CustomerRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAltPhone, setEditAltPhone] = useState("");
  const [editVerified, setEditVerified] = useState(false);
  const [editStatus, setEditStatus] = useState<CustomerAccountStatus>("active");
  const [editSaving, setEditSaving] = useState(false);

  // Status Change Dialog
  const [statusModalCustomer, setStatusModalCustomer] = useState<CustomerRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<CustomerAccountStatus>("active");
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  // Add Note State
  const [newNoteText, setNewNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Copying helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load summary stats
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await fetchAdminCustomerStats();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load customer statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load customer list
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminCustomers({
        page,
        limit,
        search: debouncedSearch,
        status,
        segment,
        sort,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        orderCount,
        minSpent: minSpent || undefined,
        maxSpent: maxSpent || undefined,
      });
      setCustomers(res.customers);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to load customers");
      toast.error(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, status, segment, sort, dateFrom, dateTo, orderCount, minSpent, maxSpent]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Open customer details
  const openCustomerDetails = async (customerId: string) => {
    setDetailCustomerId(customerId);
    setDetailTab("orders");
    try {
      setDetailLoading(true);
      const data = await fetchAdminCustomerDetails(customerId);
      setDetailData(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load customer profile");
      setDetailCustomerId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Close details modal
  const closeDetails = () => {
    setDetailCustomerId(null);
    setDetailData(null);
  };

  // Copy ID to clipboard
  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Customer ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Edit Modal
  const openEditModal = (cust: CustomerRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditCustomer(cust);
    setEditName(cust.name || "");
    setEditPhone(cust.phoneNumber || "");
    setEditAltPhone(cust.altPhoneNumber || "");
    setEditVerified(Boolean(cust.isVerified));
    setEditStatus(cust.status || "active");
  };

  // Save Edit Profile
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer) return;
    try {
      setEditSaving(true);
      await updateAdminCustomer(editCustomer._id, {
        name: editName.trim(),
        phoneNumber: editPhone.trim() || null,
        altPhoneNumber: editAltPhone.trim() || null,
        isVerified: editVerified,
        status: editStatus,
        reason: "Profile fields updated via Admin Customer Management",
      });
      toast.success("Customer profile updated successfully");
      setEditCustomer(null);
      loadCustomers();
      loadStats();
      if (detailCustomerId === editCustomer._id) {
        openCustomerDetails(editCustomer._id);
      }
      onCustomersChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
    } finally {
      setEditSaving(false);
    }
  };

  // Open Status Confirmation
  const openStatusConfirm = (cust: CustomerRecord, newStatus: CustomerAccountStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStatusModalCustomer(cust);
    setTargetStatus(newStatus);
    setStatusReason("");
  };

  // Execute Status Change
  const handleSaveStatus = async () => {
    if (!statusModalCustomer) return;
    try {
      setStatusSaving(true);
      await updateAdminCustomerStatus(
        statusModalCustomer._id,
        targetStatus,
        statusReason.trim() || `Administrative status change to ${targetStatus}`
      );
      toast.success(`Customer status changed to ${targetStatus}`);
      setStatusModalCustomer(null);
      loadCustomers();
      loadStats();
      if (detailCustomerId === statusModalCustomer._id) {
        openCustomerDetails(statusModalCustomer._id);
      }
      onCustomersChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update account status");
    } finally {
      setStatusSaving(false);
    }
  };

  // Add Admin Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCustomerId || !newNoteText.trim()) return;
    try {
      setNoteSaving(true);
      const createdNote = await addAdminCustomerNote(detailCustomerId, newNoteText.trim());
      setNewNoteText("");
      toast.success("Note added successfully");
      if (detailData) {
        setDetailData({
          ...detailData,
          adminNotes: [createdNote, ...(detailData.adminNotes || [])],
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  // Delete Admin Note
  const handleDeleteNote = async (noteId: string) => {
    if (!detailCustomerId) return;
    if (!confirm("Are you sure you want to remove this internal note?")) return;
    try {
      await deleteAdminCustomerNote(detailCustomerId, noteId);
      toast.success("Note removed");
      if (detailData) {
        setDetailData({
          ...detailData,
          adminNotes: detailData.adminNotes.filter((n) => n._id !== noteId),
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const blob = await exportAdminCustomers({
        search: debouncedSearch,
        status,
        segment,
        sort,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        orderCount,
        minSpent: minSpent || undefined,
        maxSpent: maxSpent || undefined,
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `delivix_customers_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast.success("Customer export downloaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to export customers");
    } finally {
      setExporting(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("All");
    setSegment("all");
    setSort("newest");
    setDateFrom("");
    setDateTo("");
    setOrderCount("All");
    setMinSpent("");
    setMaxSpent("");
    setPage(1);
  };

  // Selection toggles
  const allSelected = useMemo(
    () => customers.length > 0 && selectedIds.length === customers.length,
    [customers, selectedIds]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c._id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const hasActiveFilters =
    Boolean(search) ||
    status !== "All" ||
    segment !== "all" ||
    sort !== "newest" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    orderCount !== "All" ||
    Boolean(minSpent) ||
    Boolean(maxSpent);

  return (
    <div className="admin-tab-view admin-customers-page">
      {/* ── SUMMARY STAT CARDS ────────────────────────────────────────── */}
      <section className="admin-order-stats-grid customer-stats-grid" aria-label="Customer statistics">
        <article
          className={`admin-order-stat admin-order-stat--total ${segment === "all" ? "is-active-card" : ""}`}
          onClick={() => {
            setSegment("all");
            setStatus("All");
          }}
          title="Click to view all customers"
          role="button"
          tabIndex={0}
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">Total Registered</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.totalRegistered ?? 0}</strong>
          <small>
            <span>Active: {stats?.activeCustomers ?? 0}</span>
            <b>100% DB</b>
          </small>
        </article>

        <article
          className={`admin-order-stat admin-order-stat--delivered ${status === "active" ? "is-active-card" : ""}`}
          onClick={() => {
            setStatus("active");
            setSegment("all");
          }}
          title="Filter active customers"
          role="button"
          tabIndex={0}
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">Active Customers</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.activeCustomers ?? 0}</strong>
          <small>Verified accounts in good standing</small>
        </article>

        <article
          className={`admin-order-stat admin-order-stat--processing ${segment === "new" ? "is-active-card" : ""}`}
          onClick={() => {
            setSegment("new");
            setStatus("All");
          }}
          title="Filter new customers this month"
          role="button"
          tabIndex={0}
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">New This Month</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.newCustomersThisMonth ?? 0}</strong>
          <small>Joined since 1st of month</small>
        </article>

        <article
          className="admin-order-stat admin-order-stat--refunded"
          title="Customers with delivered orders"
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">With Completed Orders</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.customersWithCompletedOrders ?? 0}</strong>
          <small>Placed delivered orders</small>
        </article>

        <article
          className="admin-order-stat admin-order-stat--pending"
          title="Customers with in-flight/pending orders"
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">With Pending Orders</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.customersWithPendingOrders ?? 0}</strong>
          <small>In-transit or processing orders</small>
        </article>

        <article
          className={`admin-order-stat admin-order-stat--cancelled ${status === "blocked" ? "is-active-card" : ""}`}
          onClick={() => {
            setStatus("blocked");
            setSegment("all");
          }}
          title="Filter blocked or suspended customers"
          role="button"
          tabIndex={0}
        >
          <div className="admin-order-stat__head">
            <span className="admin-order-stat__dot" />
            <span className="admin-order-stat__label">Blocked / Suspended</span>
          </div>
          <strong>{statsLoading ? "…" : stats?.blockedCustomers ?? 0}</strong>
          <small>Restricted or under review</small>
        </article>
      </section>

      {/* ── CUSTOMER SEGMENTS SELECTOR ─────────────────────────────────── */}
      <div className="customer-segment-bar">
        <span className="customer-segment-label">
          <Sparkles size={14} /> Segments:
        </span>
        <div className="customer-segment-tabs">
          {SEGMENT_OPTIONS.map((seg) => {
            const SegIcon = seg.icon;
            const isActive = segment === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                className={`customer-segment-pill ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  setSegment(seg.id);
                  setPage(1);
                }}
                title={seg.hint}
              >
                <SegIcon size={13} />
                <span>{seg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEARCH & FILTER TOOLBAR ────────────────────────────────────── */}
      <section className="admin-panel admin-order-filters">
        <div className="admin-order-filters__head">
          <div className="admin-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by customer name, email, phone number, or customer ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search customers"
            />
            {search && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setSearch("")}
                aria-label="Clear search input"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="admin-order-filter-actions">
            <button
              type="button"
              className="admin-subtle-btn"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              title="Export filtered customer records to CSV"
            >
              <Download size={14} />
              <span>{exporting ? "Exporting…" : "Export CSV"}</span>
            </button>

            <button
              type="button"
              className="admin-subtle-btn"
              onClick={() => {
                loadStats();
                loadCustomers();
              }}
              disabled={loading}
              title="Refresh customer database"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                className="admin-subtle-btn"
                onClick={handleResetFilters}
                title="Reset all search and filter fields"
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="admin-order-filter-grid customer-filter-grid">
          <label>
            <span>Account Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Order Count</span>
            <select
              value={orderCount}
              onChange={(e) => {
                setOrderCount(e.target.value);
                setPage(1);
              }}
            >
              {ORDER_COUNT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Sort By</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Registered From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            <span>Registered To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            <span>Min Spend (₹)</span>
            <input
              type="number"
              placeholder="0"
              value={minSpent}
              onChange={(e) => {
                setMinSpent(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            <span>Page Size</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </label>
        </div>
      </section>

      {/* ── CUSTOMER LIST TABLE ────────────────────────────────────────── */}
      <div className="admin-panel admin-order-table-panel customer-table-panel">
        <div className="admin-order-table-head">
          <div>
            <p className="eyebrow">Customer Directory</p>
            <h3>
              {pagination ? `${pagination.total} Customer(s)` : "All Customers"}
              {loading ? " · Loading…" : ""}
            </h3>
          </div>
          <span>
            Page {pagination?.page || 1} of {pagination?.pages || 1}
          </span>
        </div>

        {error && (
          <div className="order-alert order-alert--error" style={{ margin: "16px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
            <button type="button" onClick={loadCustomers} style={{ marginLeft: "auto" }}>
              Try again
            </button>
          </div>
        )}

        <div className="admin-order-table-wrap">
          <table className="admin-order-table customer-table">
            <thead>
              <tr>
                <th className="is-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all customers"
                  />
                </th>
                <th>Customer ID</th>
                <th>Customer Profile</th>
                <th>Contact</th>
                <th>Registered</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Last Order</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && customers.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="table-skeleton-row">
                    <td colSpan={10} style={{ padding: "16px 20px" }}>
                      <div className="skeleton-line" style={{ height: "20px", borderRadius: "6px" }} />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="admin-order-empty">
                    <div className="empty-customers-view">
                      <Users size={36} />
                      <h4>No customers found</h4>
                      <p>
                        {hasActiveFilters
                          ? "No customer matches your active search or filters."
                          : "No customers registered in the database yet."}
                      </p>
                      {hasActiveFilters && (
                        <button type="button" className="is-primary" onClick={handleResetFilters}>
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const isSelected = selectedIds.includes(cust._id);
                  const isHighVal = cust.totalSpent >= 5000;
                  return (
                    <tr
                      key={cust._id}
                      className={`${isSelected ? "is-selected" : ""} customer-row`}
                      onClick={() => openCustomerDetails(cust._id)}
                    >
                      <td className="is-check" onClick={(e) => toggleSelect(cust._id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          aria-label={`Select customer ${cust.name}`}
                        />
                      </td>

                      {/* Customer ID */}
                      <td>
                        <div className="customer-id-chip">
                          <code title={cust._id}>{cust._id.slice(-6).toUpperCase()}</code>
                          <button
                            type="button"
                            className="id-copy-btn"
                            onClick={(e) => handleCopyId(cust._id, e)}
                            title="Copy full Customer ID"
                          >
                            {copiedId === cust._id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Customer Profile */}
                      <td>
                        <div className="customer-profile-cell">
                          {cust.avatar?.url ? (
                            <img
                              src={cust.avatar.url}
                              alt={cust.name}
                              className="customer-avatar-img"
                              onError={(e) => {
                                // fallback to initials
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className="customer-avatar-initials"
                              style={{ backgroundColor: getAvatarColor(cust.name) }}
                            >
                              {getInitials(cust.name)}
                            </div>
                          )}

                          <div className="customer-name-block">
                            <strong className="customer-fullname">
                              {cust.name}
                              {cust.isVerified && (
                                <span title="Email verified" className="verified-badge-icon">
                                  <CheckCircle2 size={13} color="#10b981" />
                                </span>
                              )}
                              {isHighVal && (
                                <span className="vip-tag-chip" title="High-Value VIP Customer">
                                  VIP
                                </span>
                              )}
                            </strong>
                            <small className="customer-email-muted">{cust.email}</small>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div className="customer-contact-cell">
                          <span>{cust.phoneNumber || "No phone registered"}</span>
                          {cust.altPhoneNumber && (
                            <small className="text-muted">Alt: {cust.altPhoneNumber}</small>
                          )}
                        </div>
                      </td>

                      {/* Registered */}
                      <td>
                        <div className="date-cell">
                          <span>{formatDate(cust.createdAt)}</span>
                        </div>
                      </td>

                      {/* Orders */}
                      <td>
                        <div className="order-count-cell">
                          <strong>{cust.totalOrders} order(s)</strong>
                          {cust.completedOrders > 0 && (
                            <small className="completed-count">
                              {cust.completedOrders} delivered
                            </small>
                          )}
                        </div>
                      </td>

                      {/* Total Spent */}
                      <td>
                        <div className="spent-cell">
                          <strong>{formatPrice(cust.totalSpent)}</strong>
                        </div>
                      </td>

                      {/* Last Order */}
                      <td>
                        <div className="date-cell">
                          <span>{cust.lastOrderDate ? formatDate(cust.lastOrderDate) : "Never"}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill status-pill--${cust.status || "active"}`}>
                          <span className="status-pill-dot" />
                          <span className="capitalize">{cust.status || "active"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions-group">
                          <button
                            type="button"
                            className="table-action-icon-btn"
                            title="View customer profile"
                            onClick={() => openCustomerDetails(cust._id)}
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            className="table-action-icon-btn"
                            title="Edit customer details"
                            onClick={(e) => openEditModal(cust, e)}
                          >
                            <Edit3 size={15} />
                          </button>

                          {cust.status === "blocked" ? (
                            <button
                              type="button"
                              className="table-action-icon-btn unblock-btn"
                              title="Unblock customer"
                              onClick={(e) => openStatusConfirm(cust, "active", e)}
                            >
                              <UserCheck size={15} color="#10b981" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="table-action-icon-btn block-btn"
                              title="Block customer"
                              onClick={(e) => openStatusConfirm(cust, "blocked", e)}
                            >
                              <Ban size={15} color="#ef4444" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.pages > 1 && (
          <div className="admin-order-table-foot">
            <span className="page-summary">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} customers
            </span>

            <div className="admin-order-pagination">
              <button
                type="button"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              <span className="current-page-pill">
                {pagination.page} / {pagination.pages}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CUSTOMER DETAILS DRAWER / MODAL ────────────────────────────── */}
      {detailCustomerId && (
        <div className="admin-modal-overlay" onClick={closeDetails}>
          <div
            className="admin-modal admin-customer-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {detailLoading || !detailData ? (
              <div className="customer-modal-loading">
                <RefreshCw size={28} className="animate-spin" />
                <p>Loading customer profile...</p>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="customer-modal-header">
                  <div className="customer-modal-profile">
                    {detailData.customer.avatar?.url ? (
                      <img
                        src={detailData.customer.avatar.url}
                        alt={detailData.customer.name}
                        className="customer-modal-avatar-img"
                      />
                    ) : (
                      <div
                        className="customer-modal-avatar-initials"
                        style={{ backgroundColor: getAvatarColor(detailData.customer.name) }}
                      >
                        {getInitials(detailData.customer.name)}
                      </div>
                    )}

                    <div className="customer-modal-identity">
                      <div className="customer-modal-title-row">
                        <h2>{detailData.customer.name}</h2>
                        <span className={`status-pill status-pill--${detailData.customer.status || "active"}`}>
                          <span className="status-pill-dot" />
                          <span className="capitalize">{detailData.customer.status || "active"}</span>
                        </span>
                        {detailData.customer.isVerified ? (
                          <span className="verified-tag">
                            <CheckCircle2 size={12} color="#10b981" /> Email Verified
                          </span>
                        ) : (
                          <span className="unverified-tag">
                            <AlertCircle size={12} color="#f59e0b" /> Unverified Email
                          </span>
                        )}
                      </div>

                      <div className="customer-modal-meta-row">
                        <span title="Email">
                          <Mail size={13} /> {detailData.customer.email}
                        </span>
                        {detailData.customer.phoneNumber && (
                          <span title="Phone">
                            <Phone size={13} /> {detailData.customer.phoneNumber}
                          </span>
                        )}
                        <span title="Customer ID">
                          <code className="text-xs">ID: {detailData.customer._id}</code>
                          <button
                            type="button"
                            className="id-copy-btn inline"
                            onClick={(e) => handleCopyId(detailData.customer._id, e)}
                          >
                            {copiedId === detailData.customer._id ? (
                              <Check size={12} color="#10b981" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </span>
                        <span>
                          <Calendar size={13} /> Joined {formatDate(detailData.customer.createdAt)}
                        </span>
                        {detailData.customer.lastLogin && (
                          <span>
                            <Clock size={13} /> Last active: {formatDateTime(detailData.customer.lastLogin)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="customer-modal-top-actions">
                    <button
                      type="button"
                      className="admin-subtle-btn"
                      onClick={() => openEditModal(detailData.customer)}
                    >
                      <Edit3 size={14} /> Edit Profile
                    </button>

                    {detailData.customer.status === "active" ? (
                      <button
                        type="button"
                        className="admin-subtle-btn danger-tone"
                        onClick={() => openStatusConfirm(detailData.customer, "blocked")}
                      >
                        <Ban size={14} /> Block Account
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-subtle-btn success-tone"
                        onClick={() => openStatusConfirm(detailData.customer, "active")}
                      >
                        <UserCheck size={14} /> Activate Account
                      </button>
                    )}

                    <button
                      type="button"
                      className="icon-button close-modal-btn"
                      onClick={closeDetails}
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Purchase Metrics Summary Bar */}
                <div className="customer-kpi-bar">
                  <div className="kpi-item">
                    <span className="kpi-label">Lifetime Spend</span>
                    <strong className="kpi-value highlight">
                      {formatPrice(detailData.metrics.totalSpent)}
                    </strong>
                    <small className="kpi-hint">Eligible paid orders</small>
                  </div>

                  <div className="kpi-item">
                    <span className="kpi-label">Total Orders</span>
                    <strong className="kpi-value">{detailData.metrics.totalOrders}</strong>
                    <small className="kpi-hint">{detailData.metrics.completedOrders} completed</small>
                  </div>

                  <div className="kpi-item">
                    <span className="kpi-label">Average Order Value</span>
                    <strong className="kpi-value">
                      {formatPrice(detailData.metrics.averageOrderValue)}
                    </strong>
                    <small className="kpi-hint">Per completed purchase</small>
                  </div>

                  <div className="kpi-item">
                    <span className="kpi-label">Pending Orders</span>
                    <strong className="kpi-value">{detailData.metrics.pendingOrders}</strong>
                    <small className="kpi-hint">In transit or packing</small>
                  </div>

                  <div className="kpi-item">
                    <span className="kpi-label">Cancelled / Returns</span>
                    <strong className="kpi-value">{detailData.metrics.cancelledOrders}</strong>
                    <small className="kpi-hint">Refunded or cancelled</small>
                  </div>

                  <div className="kpi-item">
                    <span className="kpi-label">Last Purchase</span>
                    <strong className="kpi-value text-sm">
                      {formatDate(detailData.metrics.lastOrderDate)}
                    </strong>
                    <small className="kpi-hint">
                      {detailData.metrics.lastOrderDate ? "Recorded in database" : "No orders yet"}
                    </small>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="customer-modal-tabs">
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === "orders" ? "is-active" : ""}`}
                    onClick={() => setDetailTab("orders")}
                  >
                    <ShoppingBag size={14} /> Order History ({detailData.orders.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === "addresses" ? "is-active" : ""}`}
                    onClick={() => setDetailTab("addresses")}
                  >
                    <MapPin size={14} /> Saved Addresses ({detailData.addresses.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === "notes" ? "is-active" : ""}`}
                    onClick={() => setDetailTab("notes")}
                  >
                    <FileText size={14} /> Admin Notes ({detailData.adminNotes.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === "history" ? "is-active" : ""}`}
                    onClick={() => setDetailTab("history")}
                  >
                    <Clock size={14} /> Status Audit ({detailData.statusHistory.length})
                  </button>
                </div>

                {/* Modal Tab Body */}
                <div className="customer-modal-body">
                  {/* TAB 1: ORDER HISTORY */}
                  {detailTab === "orders" && (
                    <div className="customer-orders-tab">
                      {detailData.orders.length === 0 ? (
                        <div className="customer-empty-tab">
                          <ShoppingBag size={32} />
                          <p>This customer has not placed any orders yet.</p>
                        </div>
                      ) : (
                        <div className="customer-orders-list">
                          <table className="customer-subtable">
                            <thead>
                              <tr>
                                <th>Order ID</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th style={{ textAlign: "right" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.orders.map((ord) => (
                                <tr key={ord._id}>
                                  <td>
                                    <strong>{ord.orderNumber || ord._id.slice(-8).toUpperCase()}</strong>
                                  </td>
                                  <td>{formatDate(ord.createdAt)}</td>
                                  <td>
                                    <span title={(ord.orderItems || []).map((it) => it.name).join(", ")}>
                                      {ord.orderItems?.[0]?.name || "Item"}
                                      {ord.orderItems && ord.orderItems.length > 1
                                        ? ` +${ord.orderItems.length - 1} more`
                                        : ""}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`payment-pill payment-pill--${ord.paymentStatus || "pending"}`}>
                                      {ord.paymentStatus} ({ord.paymentMethod})
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-pill status-pill--${ord.orderStatus?.toLowerCase().replace(/\s+/g, "-")}`}>
                                      <span className="status-pill-dot" />
                                      {ord.orderStatus}
                                    </span>
                                  </td>
                                  <td>
                                    <strong>{formatPrice(ord.totalAmount)}</strong>
                                  </td>
                                  <td style={{ textAlign: "right" }}>
                                    {onNavigateToOrder ? (
                                      <button
                                        type="button"
                                        className="admin-link-btn"
                                        onClick={() => {
                                          closeDetails();
                                          onNavigateToOrder(ord._id);
                                        }}
                                        title="View order in Order Management"
                                      >
                                        View Order <ExternalLink size={12} />
                                      </button>
                                    ) : (
                                      <span className="text-muted text-xs">#{ord.orderNumber}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: SAVED ADDRESSES */}
                  {detailTab === "addresses" && (
                    <div className="customer-addresses-tab">
                      {detailData.addresses.length === 0 ? (
                        <div className="customer-empty-tab">
                          <MapPin size={32} />
                          <p>No addresses have been saved by this customer yet.</p>
                        </div>
                      ) : (
                        <div className="address-card-grid">
                          {detailData.addresses.map((addr, idx) => (
                            <div key={idx} className="customer-address-card">
                              <div className="address-card-head">
                                <span className="address-type-tag">
                                  <Building size={12} /> {addr.title || "Address"}
                                </span>
                                {addr.isDefault && <span className="default-pill">Default</span>}
                              </div>
                              <strong>{addr.fullName}</strong>
                              <p className="address-phone">Phone: {addr.phoneNo}</p>
                              {addr.altPhoneNo && (
                                <p className="address-phone alt">Alt: {addr.altPhoneNo}</p>
                              )}
                              <p className="address-street">
                                {[addr.street, addr.landmark, addr.village].filter(Boolean).join(", ")}
                              </p>
                              <p className="address-locality">
                                {[addr.city, addr.state, addr.zipCode, addr.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: ADMIN NOTES */}
                  {detailTab === "notes" && (
                    <div className="customer-notes-tab">
                      <form onSubmit={handleAddNote} className="add-note-box">
                        <textarea
                          placeholder="Type an internal admin note about this customer (visible to store staff only)..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          rows={3}
                          required
                        />
                        <div className="add-note-actions">
                          <button
                            type="submit"
                            className="is-primary"
                            disabled={noteSaving || !newNoteText.trim()}
                          >
                            <Plus size={14} /> {noteSaving ? "Adding…" : "Add Admin Note"}
                          </button>
                        </div>
                      </form>

                      {detailData.adminNotes.length === 0 ? (
                        <div className="customer-empty-tab">
                          <FileText size={32} />
                          <p>No internal notes have been recorded for this customer yet.</p>
                        </div>
                      ) : (
                        <div className="customer-notes-list">
                          {detailData.adminNotes.map((note) => (
                            <div key={note._id} className="customer-note-item">
                              <div className="note-item-meta">
                                <div>
                                  <strong>{note.addedByName || "Administrator"}</strong>
                                  <span className="note-timestamp">{formatDateTime(note.createdAt)}</span>
                                </div>
                                <button
                                  type="button"
                                  className="delete-note-btn"
                                  onClick={() => handleDeleteNote(note._id)}
                                  title="Delete note"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <p className="note-item-text">{note.note}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: STATUS AUDIT */}
                  {detailTab === "history" && (
                    <div className="customer-history-tab">
                      {detailData.statusHistory.length === 0 ? (
                        <div className="customer-empty-tab">
                          <Clock size={32} />
                          <p>No status changes recorded. Account initialized as active.</p>
                        </div>
                      ) : (
                        <div className="customer-timeline">
                          {detailData.statusHistory.map((hist, i) => (
                            <div key={i} className="timeline-node">
                              <div className="timeline-node__marker">
                                <span className={`timeline-dot timeline-dot--${hist.status}`} />
                              </div>
                              <div className="timeline-node__content">
                                <div className="timeline-head">
                                  <strong>Status set to {hist.status.toUpperCase()}</strong>
                                  <span className="timeline-time">{formatDateTime(hist.changedAt)}</span>
                                </div>
                                <p className="timeline-reason">
                                  Reason: {hist.reason || "Administrative update"}
                                </p>
                                <small className="timeline-by">
                                  By: {hist.changedByName || "System Admin"}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ────────────────────────────────────────── */}
      {editCustomer && (
        <div className="admin-modal-overlay" onClick={() => setEditCustomer(null)}>
          <div
            className="admin-modal admin-customer-edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3>Edit Customer Profile</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditCustomer(null)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="admin-customer-form">
              <div className="admin-form-group">
                <label>Customer Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Full Name"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Primary Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="admin-form-group">
                <label>Alternate Phone Number</label>
                <input
                  type="text"
                  value={editAltPhone}
                  onChange={(e) => setEditAltPhone(e.target.value)}
                  placeholder="Alternate Contact Number"
                />
              </div>

              <div className="admin-form-group">
                <label>Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CustomerAccountStatus)}
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="inactive">Inactive (Deactivated)</option>
                  <option value="suspended">Suspended (Temporary restriction)</option>
                  <option value="blocked">Blocked (Fraud / policy violation)</option>
                </select>
              </div>

              <div className="admin-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editVerified}
                    onChange={(e) => setEditVerified(e.target.checked)}
                  />
                  <span>Mark Email as Verified</span>
                </label>
              </div>

              <div className="security-notice-box">
                <Shield size={16} />
                <div>
                  <strong>Security & Compliance Notice</strong>
                  <p>
                    Customer passwords cannot be directly viewed or altered by administrators.
                    Password recovery requires the customer to use the secure OTP workflow.
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="admin-subtle-btn"
                  onClick={() => setEditCustomer(null)}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="is-primary" disabled={editSaving}>
                  {editSaving ? "Saving Changes…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STATUS CHANGE / BLOCK CONFIRMATION DIALOG ──────────────────── */}
      {statusModalCustomer && (
        <div className="admin-modal-overlay" onClick={() => setStatusModalCustomer(null)}>
          <div
            className="admin-modal admin-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="confirm-icon-head">
              {targetStatus === "blocked" ? (
                <ShieldAlert size={32} color="#ef4444" />
              ) : targetStatus === "suspended" ? (
                <AlertTriangle size={32} color="#f59e0b" />
              ) : (
                <UserCheck size={32} color="#10b981" />
              )}
            </div>

            <h3>
              {targetStatus === "blocked"
                ? "Block Customer Account?"
                : targetStatus === "suspended"
                ? "Suspend Customer Account?"
                : targetStatus === "inactive"
                ? "Deactivate Customer Account?"
                : "Reactivate Customer Account?"}
            </h3>

            <p className="confirm-lead-text">
              {targetStatus === "blocked"
                ? `Blocking will immediately prevent "${statusModalCustomer.name}" (${statusModalCustomer.email}) from placing new orders or logging into the storefront.`
                : targetStatus === "suspended"
                ? `Suspending "${statusModalCustomer.name}" places a temporary hold on account capabilities while under administrative review.`
                : `Set "${statusModalCustomer.name}" status to "${targetStatus}".`}
            </p>

            <div className="admin-form-group" style={{ margin: "14px 0" }}>
              <label>Reason for this status change (recorded in audit log):</label>
              <textarea
                placeholder="e.g., Chargeback dispute, customer request, address verification needed..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={2}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="admin-subtle-btn"
                onClick={() => setStatusModalCustomer(null)}
                disabled={statusSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={targetStatus === "blocked" ? "is-destructive" : "is-primary"}
                onClick={handleSaveStatus}
                disabled={statusSaving}
              >
                {statusSaving
                  ? "Updating…"
                  : targetStatus === "blocked"
                  ? "Confirm Block"
                  : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
