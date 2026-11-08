import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  bulkUpdateAdminOrderStatus,
  deleteAdminOrder,
  exportAdminOrders,
  fetchAdminOrderDetails,
  fetchAdminOrders,
  fetchAdminOrderStats,
  fetchOrderInvoice,
  getStoredAdminUser,
  refundAdminOrder,
  retryAdminOrderNotification,
  updateAdminOrderShipment,
  updateAdminOrderStatus,
  type AdminOrderDetailResponse,
  type AdminOrderStats,
  type OrderPagination,
  type OrderRecord,
  type OrderStatus,
} from "../../services/api";
import {
  getOrderItemCount,
  getOrderNumber,
  itemVariantLabel,
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
  OrderTimeline,
  orderDate,
  orderDateTime,
  orderMoney,
  PaymentStatusBadge,
  printInvoice,
  printPackingSlip,
  printShippingLabel,
} from "./OrderBits";

type AdminOrdersProps = {
  onOrdersChanged?: () => void;
};

const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Failed",
  "Refund Pending",
  "Partially Refunded",
  "Refunded",
  "Cancelled",
];

const PAYMENT_METHODS = ["COD", "Razorpay", "Stripe", "Card"];
const PAID_PAYMENT_STATUSES = ["Paid", "Partially Refunded", "Refund Pending", "Refunded"];
const SHIPPING_METHODS = ["standard", "express", "surface", "air", "other"];
const SHIPMENT_STATUSES = [
  "Packed",
  "Ready for Pickup",
  "Picked Up",
  "Dispatched",
  "In Transit",
  "Arrived at Hub",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount_desc", label: "Total: high to low" },
  { value: "amount_asc", label: "Total: low to high" },
  { value: "status", label: "Status" },
];

const STAT_CARDS: { key: keyof AdminOrderStats["grouped"]; label: string; tone: string }[] = [
  { key: "pending", label: "Pending", tone: "pending" },
  { key: "processing", label: "Processing", tone: "processing" },
  { key: "shipped", label: "Shipped", tone: "shipped" },
  { key: "delivered", label: "Delivered", tone: "delivered" },
  { key: "cancelled", label: "Cancelled", tone: "cancelled" },
  { key: "returned", label: "Returns", tone: "return" },
  { key: "refunded", label: "Refunded", tone: "refunded" },
  { key: "refundPending", label: "Refund pending", tone: "refund-pending" },
];

const STAT_STATUS_MAP: Record<string, string> = {
  pending: "Pending",
  processing: "Confirmed,Processing,Packed",
  shipped: "Shipped,Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Return Requested,Return Approved,Returned",
  refunded: "Refunded",
  refundPending: "Refund Pending",
};

const toDateInput = (value?: string | Date | null): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const addressLines = (address: any = {}): string[] =>
  [
    address.fullName,
    address.addressLine1 || address.address || address.street,
    address.addressLine2,
    address.landmark,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.pincode || address.zipCode || address.pinCode, address.country]
      .filter(Boolean)
      .join(" · "),
    address.phone ? `Phone: ${address.phone}` : address.phoneNo ? `Phone: ${address.phoneNo}` : "",
  ].filter(Boolean);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export default function AdminOrders({ onOrdersChanged }: AdminOrdersProps) {
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [pagination, setPagination] = useState<OrderPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [shippingMethod, setShippingMethod] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("Confirmed");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkCodCollected, setBulkCodCollected] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [detail, setDetail] = useState<AdminOrderDetailResponse | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<OrderStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const [codCollected, setCodCollected] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const [shipmentForm, setShipmentForm] = useState({
    courierName: "",
    trackingNumber: "",
    awbNumber: "",
    trackingUrl: "",
    shippingMethod: "standard",
    shipmentDate: "",
    estimatedDeliveryDate: "",
    status: "",
    remarks: "",
  });
  const [shipmentBusy, setShipmentBusy] = useState(false);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundConfirmManual, setRefundConfirmManual] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);

  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isAdmin = getStoredAdminUser()?.role === "admin";

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const result = await fetchAdminOrderStats();
      setStats(result);
    } catch (err: any) {
      setStatsError(err.message || "Failed to load order statistics.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(search.trim());
      setPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminOrders({
        page,
        limit: 20,
        status: status === "All" ? undefined : status,
        paymentStatus: paymentStatus === "All" ? undefined : paymentStatus,
        paymentMethod: paymentMethod === "All" ? undefined : paymentMethod,
        shippingMethod: shippingMethod === "All" ? undefined : shippingMethod,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchTerm || undefined,
        sort,
      });
      setOrders(result.orders);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    status,
    paymentStatus,
    paymentMethod,
    shippingMethod,
    dateFrom,
    dateTo,
    searchTerm,
    sort,
  ]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOrders(), loadStats()]);
    onOrdersChanged?.();
  }, [loadOrders, loadStats, onOrdersChanged]);

  const resetFilters = () => {
    setSearch("");
    setStatus("All");
    setPaymentStatus("All");
    setPaymentMethod("All");
    setShippingMethod("All");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
    setPage(1);
  };

  const loadDetail = useCallback(
    async (orderId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const result = await fetchAdminOrderDetails(orderId);
        setDetail(result);
        setStatusTarget("");
        setStatusNote("");
        setCodCollected(false);
        setRefundAmount(String(result.refundableAmount || ""));
        setRefundReason("");
        setRefundReference("");
        setRefundConfirmManual(false);
        const order = result.order;
        setShipmentForm({
          courierName: order.courierName || order.shipment?.courierName || "",
          trackingNumber:
            order.trackingId || order.shipment?.trackingNumber || "",
          awbNumber: order.awbNumber || order.shipment?.awbNumber || "",
          trackingUrl: order.trackingUrl || "",
          shippingMethod: order.shipment?.shippingMethod || order.shippingMethod || "standard",
          shipmentDate: toDateInput(order.shipmentDate || order.shipment?.dispatchDate),
          estimatedDeliveryDate: toDateInput(
            order.estimatedDeliveryDate || order.shipment?.estimatedDeliveryDate
          ),
          status: "",
          remarks: order.shipment?.remarks || "",
        });
      } catch (err: any) {
        setDetailError(err.message || "Failed to load order details.");
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const openDetail = (orderId: string) => {
    setDetailOpen(true);
    setDetail(null);
    loadDetail(orderId);
  };

  useEffect(() => {
    if (!detailOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [detailOpen]);

  const toggleSelected = (orderId: string) => {
    setSelectedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === orders.length ? [] : orders.map((order) => order._id)
    );
  };

  const applyBulkStatus = async () => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      const result = await bulkUpdateAdminOrderStatus({
        orderIds: selectedIds,
        status: bulkStatus,
        note: bulkNote.trim() || undefined,
        codCollected: bulkStatus === "Delivered" ? bulkCodCollected : undefined,
      });
      if (result.failed.length) {
        toast.error(
          `${result.updated.length} updated, ${result.failed.length} skipped: ${result.failed
            .slice(0, 2)
            .map((entry: any) => entry.message)
            .join(" · ")}`
        );
      } else {
        toast.success(`${result.updated.length} order(s) updated.`);
      }
      setBulkOpen(false);
      setSelectedIds([]);
      setBulkNote("");
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportAdminOrders({
        status: status === "All" ? undefined : status,
        paymentStatus: paymentStatus === "All" ? undefined : paymentStatus,
        paymentMethod: paymentMethod === "All" ? undefined : paymentMethod,
        shippingMethod: shippingMethod === "All" ? undefined : shippingMethod,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchTerm || undefined,
        sort,
      });
      downloadBlob(blob, `delivix-orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Orders exported.");
    } catch (err: any) {
      toast.error(err.message || "Failed to export orders.");
    } finally {
      setExporting(false);
    }
  };

  const updateStatus = async () => {
    if (!detail || !statusTarget) {
      toast.error("Choose a status first.");
      return;
    }
    setStatusBusy(true);
    try {
      await updateAdminOrderStatus(detail.order._id, {
        status: statusTarget as OrderStatus,
        note: statusNote.trim() || undefined,
        codCollected: statusTarget === "Delivered" ? codCollected : undefined,
      });
      toast.success(`Order moved to ${statusTarget}.`);
      await loadDetail(detail.order._id);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update the order status.");
    } finally {
      setStatusBusy(false);
    }
  };

  const saveShipment = async () => {
    if (!detail) return;
    if (!shipmentForm.courierName.trim()) {
      toast.error("Courier name is required.");
      return;
    }
    if (!shipmentForm.trackingNumber.trim() && !shipmentForm.awbNumber.trim()) {
      toast.error("Enter a tracking number or AWB number.");
      return;
    }
    setShipmentBusy(true);
    try {
      await updateAdminOrderShipment(detail.order._id, {
        courierName: shipmentForm.courierName.trim(),
        trackingNumber: shipmentForm.trackingNumber.trim() || undefined,
        awbNumber: shipmentForm.awbNumber.trim() || undefined,
        trackingUrl: shipmentForm.trackingUrl.trim() || undefined,
        shippingMethod: SHIPPING_METHODS.includes(shipmentForm.shippingMethod)
          ? (shipmentForm.shippingMethod as any)
          : undefined,
        shipmentDate: shipmentForm.shipmentDate || undefined,
        estimatedDeliveryDate: shipmentForm.estimatedDeliveryDate || undefined,
        status: shipmentForm.status || undefined,
        remarks: shipmentForm.remarks.trim() || undefined,
        note: shipmentForm.status ? `Shipment marked ${shipmentForm.status}` : undefined,
      });
      toast.success("Shipment details saved.");
      await loadDetail(detail.order._id);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to save shipment details.");
    } finally {
      setShipmentBusy(false);
    }
  };

  const submitRefund = async () => {
    if (!detail) return;
    const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      toast.error("Enter a valid refund amount.");
      return;
    }
    if (detail.order.paymentMethod === "COD" && !refundConfirmManual) {
      toast.error("Confirm that the COD refund has been sent before recording it.");
      return;
    }
    if (detail.order.paymentMethod === "COD" && !refundReference.trim()) {
      toast.error("A manual refund reference (UTR / bank reference) is required.");
      return;
    }
    setRefundBusy(true);
    try {
      await refundAdminOrder(detail.order._id, {
        amount,
        reason: refundReason.trim() || undefined,
        reference: refundReference.trim() || undefined,
        confirmManual: refundConfirmManual || undefined,
      });
      toast.success("Refund confirmed and recorded.");
      await loadDetail(detail.order._id);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to process the refund.");
    } finally {
      setRefundBusy(false);
    }
  };

  const retryNotification = async (event: string) => {
    if (!detail) return;
    try {
      await retryAdminOrderNotification(detail.order._id, event);
      toast.success("Notification retry attempted.");
      await loadDetail(detail.order._id);
    } catch (err: any) {
      toast.error(err.message || "Failed to retry the notification.");
    }
  };

  const printAdminInvoice = async () => {
    if (!detail) return;
    setInvoiceBusy(true);
    try {
      const invoice = await fetchOrderInvoice(detail.order._id);
      if (!printInvoice(invoice)) toast.error("Please allow pop-ups to print the invoice.");
    } catch (err: any) {
      toast.error(err.message || "Failed to load the invoice.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const removeOrder = async () => {
    if (!detail || !isAdmin) return;
    if (
      !window.confirm(
        `Delete order ${getOrderNumber(detail.order)}? This permanently removes the order record. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteAdminOrder(detail.order._id);
      toast.success("Order deleted.");
      setDetailOpen(false);
      setDetail(null);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete the order.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const totalRevenue = stats ? orderMoney(stats.totalRevenue) : "—";
  const selectedCount = selectedIds.length;
  const allSelected = orders.length > 0 && selectedCount === orders.length;

  return (
    <div className="admin-tab-view admin-orders">
      <div className="admin-order-stats">
        <article className="admin-order-stat admin-order-stat--total">
          <span className="admin-order-stat__label">
            <i className="admin-order-stat__dot" aria-hidden="true" />
            Total orders
          </span>
          <strong>{statsLoading ? "…" : stats?.totalOrders ?? 0}</strong>
          <small>
            <span>Confirmed revenue</span>
            <b>{totalRevenue}</b>
          </small>
        </article>
        {STAT_CARDS.map((card) => {
          const cardStatus = STAT_STATUS_MAP[card.key] || "All";
          const active = status === cardStatus;
          return (
            <button
              type="button"
              key={card.key}
              className={`admin-order-stat admin-order-stat--${card.tone}${
                active ? " is-active" : ""
              }`}
              aria-pressed={active}
              onClick={() => {
                setStatus(cardStatus);
                setPage(1);
              }}
            >
              <span className="admin-order-stat__label">
                <i className="admin-order-stat__dot" aria-hidden="true" />
                {card.label}
              </span>
              <strong>{statsLoading ? "…" : stats?.grouped?.[card.key] ?? 0}</strong>
              <small>
                View orders <span aria-hidden="true">→</span>
              </small>
            </button>
          );
        })}
      </div>

      {statsError ? (
        <div className="order-alert order-alert--error">
          {statsError}
          <button type="button" onClick={loadStats}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="admin-filters-bar admin-order-filters">
        <div className="admin-order-filters__head">
          <div className="admin-search-box">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              placeholder="Search order ID, name, email, phone, product…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search orders"
            />
            {search ? (
              <button className="icon-button" onClick={() => setSearch("")} aria-label="Clear search">
                ×
              </button>
            ) : null}
          </div>

          <div className="admin-order-filter-actions">
            <button type="button" className="admin-subtle-btn" onClick={resetFilters}>
              Reset
            </button>
            <button type="button" className="admin-subtle-btn" onClick={refreshAll}>
              Refresh
            </button>
            <button type="button" className="is-primary" onClick={exportCsv} disabled={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="admin-order-filter-grid">
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="All">All statuses</option>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="All">All payments</option>
              {PAYMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Method</span>
            <select
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value);
                setPage(1);
              }}
            >
              <option value="All">All methods</option>
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Delivery</span>
            <select
              value={shippingMethod}
              onChange={(event) => {
                setShippingMethod(event.target.value);
                setPage(1);
              }}
            >
              <option value="All">All delivery</option>
              {SHIPPING_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="admin-order-bulkbar">
          <span>
            <strong>{selectedCount}</strong> selected
          </span>
          <label>
            Move to
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="is-primary" onClick={() => setBulkOpen(true)}>
            Apply to selected
          </button>
          <button type="button" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="admin-panel admin-order-table-panel">
        <div className="admin-order-table-head">
          <div>
            <p className="eyebrow">Orders</p>
            <h3>
              {pagination ? `${pagination.total} order(s)` : "All orders"}
              {loading ? " · loading…" : ""}
            </h3>
          </div>
          <span>
            Page {pagination?.page || 1} of {pagination?.pages || 1}
          </span>
        </div>

        {error ? (
          <div className="order-alert order-alert--error">
            {error}
            <button type="button" onClick={loadOrders}>
              Try again
            </button>
          </div>
        ) : null}

        <div className="admin-order-table-wrap">
          <table className="admin-order-table">
            <thead>
              <tr>
                <th className="is-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all orders"
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-order-empty">
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-order-empty">
                    No orders match these filters.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className={selectedIds.includes(order._id) ? "is-selected" : ""}>
                    <td className="is-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order._id)}
                        onChange={() => toggleSelected(order._id)}
                        aria-label={`Select ${getOrderNumber(order)}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-order-link"
                        title={getOrderNumber(order)}
                        onClick={() => openDetail(order._id)}
                      >
                        <strong>{getOrderNumber(order)}</strong>
                        <small>{orderDate(order.createdAt)}</small>
                      </button>
                    </td>
                    <td>
                      <strong className="admin-order-customer">
                        {order.shippingInfo?.fullName || order.customerInfo?.name || "Guest"}
                      </strong>
                      <small title={order.customerInfo?.email || order.shippingInfo?.email || ""}>
                        {order.customerInfo?.email || order.shippingInfo?.email || "—"}
                      </small>
                      <small title={order.customerInfo?.phone || order.shippingInfo?.phoneNo || ""}>
                        {order.customerInfo?.phone || order.shippingInfo?.phoneNo || ""}
                      </small>
                    </td>
                    <td>
                      <strong>{getOrderItemCount(order)}</strong>
                      <small
                        title={(order.orderItems || []).map((item) => item.name).join(", ")}
                      >
                        {order.orderItems?.[0]?.name || "—"}
                        {order.orderItems?.length > 1 ? ` +${order.orderItems.length - 1}` : ""}
                      </small>
                    </td>
                    <td>
                      <strong>{order.paymentMethod}</strong>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                    <td>
                      <strong>{orderMoney(order.totalAmount, order.currency)}</strong>
                      <small>{order.currency || "INR"}</small>
                    </td>
                    <td>
                      <OrderStatusBadge status={order.orderStatus} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-order-view-btn"
                        aria-label={`Manage ${getOrderNumber(order)}`}
                        onClick={() => openDetail(order._id)}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 ? (
          <div className="admin-order-pagination">
            <button
              type="button"
              disabled={!pagination.hasPrev || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasNext || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>

      {bulkOpen ? (
        <div className="order-modal" role="dialog" aria-modal="true" aria-label="Bulk update orders">
          <div className="order-modal__card">
            <h3>Update {selectedCount} order(s)</h3>
            <p>
              Each order is validated against the status workflow. Orders that cannot move to{" "}
              <strong>{bulkStatus}</strong> will be skipped.
            </p>
            <label>
              Internal note (optional)
              <textarea
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Visible in the order timeline"
              />
            </label>
            {bulkStatus === "Delivered" ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={bulkCodCollected}
                  onChange={(event) => setBulkCodCollected(event.target.checked)}
                />
                COD cash collected for eligible orders
              </label>
            ) : null}
            <div className="order-modal__actions">
              <button type="button" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>
                Cancel
              </button>
              <button type="button" className="is-primary" onClick={applyBulkStatus} disabled={bulkBusy}>
                {bulkBusy ? "Updating…" : `Move to ${bulkStatus}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="admin-order-drawer" role="dialog" aria-modal="true" aria-label="Order details">
          <div className="admin-order-drawer__backdrop" onClick={() => setDetailOpen(false)} />
          <div className="admin-order-drawer__panel">
            <header className="admin-order-drawer__head">
              <div>
                <p className="eyebrow">Order management</p>
                <h2>{detail ? getOrderNumber(detail.order) : "Loading order…"}</h2>
                {detail ? (
                  <p>
                    Placed {orderDateTime(detail.order.createdAt)} ·{" "}
                    {getOrderItemCount(detail.order)} item(s) ·{" "}
                    {orderMoney(detail.order.totalAmount, detail.order.currency)}
                  </p>
                ) : null}
              </div>
              <div className="admin-order-drawer__head-actions">
                {detail ? (
                  <>
                    <OrderStatusBadge status={detail.order.orderStatus} />
                    <PaymentStatusBadge status={detail.order.paymentStatus} />
                    <button type="button" className="admin-subtle-btn" onClick={printAdminInvoice} disabled={invoiceBusy}>
                      {invoiceBusy ? "Preparing…" : "Invoice"}
                    </button>
                    <button
                      type="button"
                      className="admin-subtle-btn"
                      onClick={() => printPackingSlip(detail.order)}
                    >
                      Packing slip
                    </button>
                    <button
                      type="button"
                      className="admin-subtle-btn"
                      onClick={() => printShippingLabel(detail.order)}
                    >
                      Shipping label
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="admin-order-danger-btn"
                        onClick={removeOrder}
                        disabled={deleteBusy}
                      >
                        {deleteBusy ? "Deleting…" : "Delete"}
                      </button>
                    ) : null}
                  </>
                ) : null}
                <button
                  type="button"
                  className="admin-order-drawer__close"
                  onClick={() => setDetailOpen(false)}
                  aria-label="Close order details"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="admin-order-drawer__body">
              {detailLoading && !detail ? (
                <div className="order-skeleton">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              {detailError ? (
                <div className="order-alert order-alert--error">
                  {detailError}
                  <button
                    type="button"
                    onClick={() => {
                      const id = detail?.order._id;
                      if (id) loadDetail(id);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {detail ? (
                <>
                  <div className="admin-order-detail-grid">
                    <div className="admin-order-detail-main">
                      <section className="admin-panel admin-order-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Workflow</p>
                            <h3>Update status</h3>
                          </div>
                          <span>{detail.allowedNextStatuses.length} next step(s) available</span>
                        </div>
                        <div className="admin-order-status-actions">
                          {detail.allowedNextStatuses.length ? (
                            detail.allowedNextStatuses.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                className={statusTarget === nextStatus ? "is-selected" : ""}
                                onClick={() => setStatusTarget(nextStatus)}
                              >
                                {nextStatus}
                              </button>
                            ))
                          ) : (
                            <p className="order-muted">
                              This order is in a terminal state. No further workflow transitions are
                              available.
                            </p>
                          )}
                        </div>
                        {statusTarget ? (
                          <div className="admin-order-status-form">
                            <label>
                              Note (optional)
                              <textarea
                                rows={2}
                                maxLength={1000}
                                value={statusNote}
                                onChange={(event) => setStatusNote(event.target.value)}
                                placeholder="Reason or internal note"
                              />
                            </label>
                            {statusTarget === "Delivered" &&
                            detail.order.paymentMethod === "COD" &&
                            detail.order.paymentStatus !== "Paid" ? (
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={codCollected}
                                  onChange={(event) => setCodCollected(event.target.checked)}
                                />
                                COD cash collected — mark this order paid
                              </label>
                            ) : null}
                            <button
                              type="button"
                              className="is-primary"
                              onClick={updateStatus}
                              disabled={statusBusy}
                            >
                              {statusBusy ? "Updating…" : `Move to ${statusTarget}`}
                            </button>
                          </div>
                        ) : null}

                        <div className="admin-order-history">
                          <p className="eyebrow">Status history</p>
                          <OrderTimeline order={detail.order} />
                        </div>
                      </section>

                      <section className="admin-panel admin-order-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Items</p>
                            <h3>
                              {detail.order.orderItems.length} product line(s) ·{" "}
                              {getOrderItemCount(detail.order)} unit(s)
                            </h3>
                          </div>
                        </div>
                        <div className="admin-order-items">
                          {detail.order.orderItems.map((item) => (
                            <div className="admin-order-item" key={item._id}>
                              {item.image ? <img src={item.image} alt="" /> : <div />}
                              <span>
                                <strong>{item.name}</strong>
                                <small>{itemVariantLabel(item) || "Standard"}</small>
                                <em>
                                  Qty {item.quantity} × {orderMoney(item.price, detail.order.currency)}
                                </em>
                              </span>
                              <b>{orderMoney(item.price * item.quantity, detail.order.currency)}</b>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="admin-panel admin-order-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Shipping</p>
                            <h3>Courier & tracking</h3>
                          </div>
                          <span>Manual management</span>
                        </div>
                        <div className="admin-order-form-grid">
                          <label>
                            Courier name
                            <input
                              value={shipmentForm.courierName}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  courierName: event.target.value,
                                }))
                              }
                              placeholder="e.g. Delhivery"
                            />
                          </label>
                          <label>
                            Tracking number
                            <input
                              value={shipmentForm.trackingNumber}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  trackingNumber: event.target.value,
                                }))
                              }
                              placeholder="Courier tracking number"
                            />
                          </label>
                          <label>
                            AWB number
                            <input
                              value={shipmentForm.awbNumber}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  awbNumber: event.target.value,
                                }))
                              }
                              placeholder="Optional AWB"
                            />
                          </label>
                          <label>
                            Tracking URL
                            <input
                              value={shipmentForm.trackingUrl}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  trackingUrl: event.target.value,
                                }))
                              }
                              placeholder="https://courier.example/track/..."
                            />
                          </label>
                          <label>
                            Delivery method
                            <select
                              value={shipmentForm.shippingMethod}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  shippingMethod: event.target.value,
                                }))
                              }
                            >
                              {SHIPPING_METHODS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Shipment status
                            <select
                              value={shipmentForm.status}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  status: event.target.value,
                                }))
                              }
                            >
                              <option value="">Keep current status</option>
                              {SHIPMENT_STATUSES.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Shipment date
                            <input
                              type="date"
                              value={shipmentForm.shipmentDate}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  shipmentDate: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Estimated delivery
                            <input
                              type="date"
                              value={shipmentForm.estimatedDeliveryDate}
                              onChange={(event) =>
                                setShipmentForm((current) => ({
                                  ...current,
                                  estimatedDeliveryDate: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Shipment remarks
                          <textarea
                            rows={2}
                            value={shipmentForm.remarks}
                            onChange={(event) =>
                              setShipmentForm((current) => ({
                                ...current,
                                remarks: event.target.value,
                              }))
                            }
                            placeholder="Optional internal remarks"
                          />
                        </label>
                        <button
                          type="button"
                          className="is-primary"
                          onClick={saveShipment}
                          disabled={shipmentBusy}
                        >
                          {shipmentBusy ? "Saving…" : "Save shipment details"}
                        </button>
                        <p className="order-muted">
                          Tracking updates are only recorded when entered here or confirmed by a
                          courier integration. The system never fabricates tracking events.
                        </p>
                      </section>

                      <section className="admin-panel admin-order-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Inventory</p>
                            <h3>Stock ledger</h3>
                          </div>
                          <span>{detail.inventoryTransactions.length} movement(s)</span>
                        </div>
                        {detail.inventoryTransactions.length ? (
                          <div className="admin-order-table-wrap">
                            <table className="admin-order-mini-table">
                              <thead>
                                <tr>
                                  <th>Action</th>
                                  <th>Qty</th>
                                  <th>Variant</th>
                                  <th>Reason</th>
                                  <th>When</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.inventoryTransactions.map((tx: any, index: number) => (
                                  <tr key={tx._id || index}>
                                    <td>{tx.action}</td>
                                    <td>{tx.quantity}</td>
                                    <td>{[tx.variantName, tx.size, tx.sku].filter(Boolean).join(" · ") || "—"}</td>
                                    <td>{tx.reason || "—"}</td>
                                    <td>{orderDateTime(tx.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="order-muted">No inventory movements recorded yet.</p>
                        )}
                      </section>

                      <section className="admin-panel admin-order-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Notifications</p>
                            <h3>Email delivery log</h3>
                          </div>
                          <span>{detail.notifications.length} event(s)</span>
                        </div>
                        {detail.notifications.length ? (
                          <div className="admin-order-notifications">
                            {detail.notifications.map((notification: any) => (
                              <div className="admin-order-notification" key={notification._id}>
                                <span
                                  className={`admin-order-notification__status is-${String(
                                    notification.status || ""
                                  ).toLowerCase()}`}
                                >
                                  {notification.status}
                                </span>
                                <div>
                                  <strong>{notification.event}</strong>
                                  <small>
                                    {notification.channel} · {notification.recipient}
                                    {notification.attempts ? ` · ${notification.attempts} attempt(s)` : ""}
                                  </small>
                                  {notification.error ? <em>{notification.error}</em> : null}
                                </div>
                                {notification.status !== "Sent" ? (
                                  <button
                                    type="button"
                                    className="admin-subtle-btn"
                                    onClick={() => retryNotification(notification.event)}
                                  >
                                    Retry
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="order-muted">No notification events recorded yet.</p>
                        )}
                      </section>
                    </div>

                    <aside className="admin-order-detail-side">
                      <section className="admin-panel admin-order-section">
                        <p className="eyebrow">Customer</p>
                        <h3>{detail.order.shippingInfo?.fullName || detail.order.customerInfo?.name}</h3>
                        <div className="admin-order-kv">
                          <span>Email</span>
                          <strong>{detail.order.customerInfo?.email || detail.order.shippingInfo?.email || "—"}</strong>
                          <span>Phone</span>
                          <strong>{detail.order.customerInfo?.phone || detail.order.shippingInfo?.phoneNo || "—"}</strong>
                          <span>Account</span>
                          <strong>{(detail.order as any).user?.email || "Registered customer"}</strong>
                        </div>
                      </section>

                      <section className="admin-panel admin-order-section">
                        <p className="eyebrow">Delivery address</p>
                        <div className="admin-order-address">
                          {addressLines(detail.order.shippingAddress || detail.order.shippingInfo).map(
                            (line) => (
                              <p key={line}>{line}</p>
                            )
                          )}
                        </div>
                        {detail.order.billingAddress ? (
                          <>
                            <p className="eyebrow" style={{ marginTop: 16 }}>
                              Billing address
                            </p>
                            <div className="admin-order-address">
                              {addressLines(detail.order.billingAddress).map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </section>

                      <section className="admin-panel admin-order-section">
                        <p className="eyebrow">Payment summary</p>
                        <div className="order-summary-lines">
                          <div>
                            <span>Items</span>
                            <strong>{orderMoney(detail.order.itemsPrice, detail.order.currency)}</strong>
                          </div>
                          {Number(detail.order.discountAmount) ? (
                            <div>
                              <span>Discount</span>
                              <strong>− {orderMoney(detail.order.discountAmount, detail.order.currency)}</strong>
                            </div>
                          ) : null}
                          <div>
                            <span>Tax</span>
                            <strong>{orderMoney(detail.order.taxAmount, detail.order.currency)}</strong>
                          </div>
                          <div>
                            <span>Shipping</span>
                            <strong>{orderMoney(detail.order.shippingAmount, detail.order.currency)}</strong>
                          </div>
                          {Number(detail.order.packagingAmount) ? (
                            <div>
                              <span>Packaging</span>
                              <strong>
                                {orderMoney(detail.order.packagingAmount, detail.order.currency)}
                              </strong>
                            </div>
                          ) : null}
                          <div className="is-total">
                            <span>Total</span>
                            <strong>{orderMoney(detail.order.totalAmount, detail.order.currency)}</strong>
                          </div>
                        </div>
                        <div className="admin-order-kv" style={{ marginTop: 14 }}>
                          <span>Method</span>
                          <strong>{detail.order.paymentMethod}</strong>
                          <span>Status</span>
                          <strong>{detail.order.paymentStatus}</strong>
                          <span>Refundable</span>
                          <strong>{orderMoney(detail.refundableAmount, detail.order.currency)}</strong>
                        </div>

                        {detail.order.paymentTransactions?.length ? (
                          <div className="admin-order-transactions">
                            <p className="eyebrow">Transactions</p>
                            {detail.order.paymentTransactions.map((tx, index) => (
                              <div key={tx._id || index}>
                                <strong>{tx.provider} · {tx.status}</strong>
                                <small>
                                  {orderMoney(tx.amount, tx.currency)} · {tx.method || "—"} ·{" "}
                                  {tx.transactionId || tx.providerSessionId || "—"}
                                </small>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {detail.order.refunds?.length ? (
                          <div className="admin-order-transactions">
                            <p className="eyebrow">Refunds</p>
                            {detail.order.refunds.map((refund, index) => (
                              <div key={refund._id || index}>
                                <strong>{refund.status} · {orderMoney(refund.amount, detail.order.currency)}</strong>
                                <small>
                                  {refund.provider || "—"} · {refund.reference || refund.refundId || "—"} ·{" "}
                                  {orderDateTime(refund.processedAt || refund.createdAt)}
                                </small>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {detail.refundableAmount > 0 &&
                        PAID_PAYMENT_STATUSES.includes(detail.order.paymentStatus) ? (
                          <div className="admin-order-refund-form">
                            <p className="eyebrow">Record a refund</p>
                            <label>
                              Amount
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={refundAmount}
                                onChange={(event) => setRefundAmount(event.target.value)}
                              />
                            </label>
                            <label>
                              Reason
                              <input
                                value={refundReason}
                                onChange={(event) => setRefundReason(event.target.value)}
                                placeholder="Customer request, damaged item…"
                              />
                            </label>
                            {detail.order.paymentMethod === "COD" ? (
                              <>
                                <label className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={refundConfirmManual}
                                    onChange={(event) => setRefundConfirmManual(event.target.checked)}
                                  />
                                  I confirm the money has been returned to the customer
                                </label>
                                <label>
                                  Refund reference (UTR / bank reference)
                                  <input
                                    value={refundReference}
                                    onChange={(event) => setRefundReference(event.target.value)}
                                    placeholder="Required for COD refunds"
                                  />
                                </label>
                              </>
                            ) : (
                              <p className="order-muted">
                                Online refunds are only recorded after the payment provider confirms
                                them. Provider credentials must be configured on the server.
                              </p>
                            )}
                            <button
                              type="button"
                              className="is-primary"
                              onClick={submitRefund}
                              disabled={refundBusy}
                            >
                              {refundBusy ? "Confirming…" : "Confirm refund"}
                            </button>
                          </div>
                        ) : null}
                      </section>
                    </aside>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
