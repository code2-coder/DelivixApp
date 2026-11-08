import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  cancelMyOrder,
  createRazorpayPayment,
  createStripePayment,
  fetchMyOrdersPage,
  fetchOrderDetails,
  fetchOrderInvoice,
  submitOrderReturn,
  verifyRazorpayPayment,
  verifyStripePayment,
  type OrderPagination,
  type OrderRecord,
} from "../../services/api";
import {
  getOrderItemCount,
  getOrderNumber,
  itemVariantLabel,
  OrderStatusBadge,
  OrderTimeline,
  orderDate,
  orderDateTime,
  orderMoney,
  PaymentStatusBadge,
  printInvoice,
} from "./OrderBits";
import {
  Package,
  ShoppingBag,
  Search,
  ArrowLeft,
  ArrowRight,
  Printer,
  RotateCcw,
  CreditCard,
  Truck,
  MapPin,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";

type CustomerOrdersProps = {
  onOrdersChanged?: () => void;
  onReorder?: (
    items: { productId: string; quantity: number; size?: string; variantName?: string }[]
  ) => void;
  onShop?: () => void;
};

type OrderFilter = "All" | "Active" | "Delivered" | "Returns" | "Cancelled";

const FILTERS: { id: OrderFilter; label: string; statuses?: string }[] = [
  { id: "All", label: "All orders" },
  {
    id: "Active",
    label: "In progress",
    statuses: "Pending,Confirmed,Processing,Packed,Shipped,Out for Delivery",
  },
  { id: "Delivered", label: "Delivered", statuses: "Delivered" },
  {
    id: "Returns",
    label: "Returns & refunds",
    statuses:
      "Return Requested,Return Approved,Return Rejected,Returned,Refund Pending,Refunded",
  },
  { id: "Cancelled", label: "Cancelled", statuses: "Cancelled" },
];

const RETURN_REASONS = [
  "Defective/Damaged",
  "Wrong Item Received",
  "Size Issue",
  "Quality Not as Expected",
  "Other",
];

const isCancellable = (order: OrderRecord | null) =>
  Boolean(order && ["Pending", "Confirmed", "Processing"].includes(String(order.orderStatus)));

const isReturnable = (order: OrderRecord | null) =>
  Boolean(order && order.orderStatus === "Delivered");

const canRetryPayment = (order: OrderRecord | null) => {
  if (!order) return false;
  if (!["Razorpay", "Stripe"].includes(String(order.paymentMethod))) return false;
  if (!["Pending", "Failed"].includes(String(order.paymentStatus))) return false;
  return !["Cancelled", "Refunded", "Delivered", "Returned", "Return Requested"].includes(
    String(order.orderStatus)
  );
};

const productIdOf = (item: OrderRecord["orderItems"][number]): string | null => {
  if (typeof item.product === "string") return item.product;
  if (item.product && typeof item.product === "object" && item.product._id) {
    return String(item.product._id);
  }
  return null;
};

const loadRazorpayScript = (): Promise<boolean> => {
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean((window as any).Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean((window as any).Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const addressText = (address: any): string[] => {
  if (!address) return [];
  return [
    address.addressLine1 || address.address || address.street,
    address.addressLine2,
    address.landmark,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.pincode || address.zipCode || address.pinCode, address.country]
      .filter(Boolean)
      .join(" · "),
    address.phone ? `Phone: ${address.phone}` : address.phoneNo ? `Phone: ${address.phoneNo}` : "",
  ].filter(Boolean);
};

export default function CustomerOrders({ onOrdersChanged, onReorder, onShop }: CustomerOrdersProps) {
  const [filter, setFilter] = useState<OrderFilter>("All");
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [pagination, setPagination] = useState<OrderPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOrder, setDetailOrder] = useState<OrderRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnDescription, setReturnDescription] = useState("");
  const [returning, setReturning] = useState(false);

  const [paying, setPaying] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const focusHandled = useRef(false);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
    onOrdersChanged?.();
  }, [onOrdersChanged]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(search.trim());
      setPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMyOrdersPage({
          page,
          limit: 10,
          status: FILTERS.find((entry) => entry.id === filter)?.statuses,
          search: searchTerm || undefined,
        });
        if (cancelled) return;
        setOrders(result.orders);
        setPagination(result.pagination);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "We could not load your orders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, page, searchTerm, reloadKey]);

  const openOrder = useCallback(async (orderId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await fetchOrderDetails(orderId);
      setDetailOrder(result.order);
    } catch (err: any) {
      setDetailError(err.message || "We could not load this order.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focusHandled.current || loading) return;
    let focusId: string | null = null;
    try {
      focusId = sessionStorage.getItem("delivix_focus_order");
    } catch {}
    if (!focusId) return;
    focusHandled.current = true;
    try {
      sessionStorage.removeItem("delivix_focus_order");
    } catch {}
    openOrder(focusId);
  }, [loading, openOrder]);

  // Stripe redirects back to /account with the session id. Verify the payment
  // server-side before showing any success state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const sessionId = params.get("stripe_session_id");
    if (!orderId || !sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const updated = await verifyStripePayment({ orderId, sessionId });
        if (cancelled) return;
        toast.success("Payment verified. Your order is confirmed.");
        setDetailOrder(updated);
        reload();
        await openOrder(orderId);
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || "We could not verify the Stripe payment.");
      } finally {
        if (!cancelled) {
          params.delete("order_id");
          params.delete("stripe_session_id");
          params.delete("tab");
          const query = params.toString();
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}`
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openOrder, reload]);

  const refreshDetail = async (orderId: string) => {
    const result = await fetchOrderDetails(orderId);
    setDetailOrder(result.order);
    reload();
    return result.order;
  };

  const handleCancel = async () => {
    if (!detailOrder) return;
    if (cancelReason.trim().length < 3) {
      toast.error("Please tell us why you are cancelling.");
      return;
    }
    setCancelling(true);
    try {
      await cancelMyOrder(detailOrder._id, cancelReason.trim());
      toast.success("Your order has been cancelled.");
      setCancelOpen(false);
      setCancelReason("");
      await refreshDetail(detailOrder._id);
    } catch (err: any) {
      toast.error(err.message || "We could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  };

  const openReturn = () => {
    if (!detailOrder) return;
    const quantities: Record<string, number> = {};
    detailOrder.orderItems.forEach((item) => {
      quantities[item._id] = 0;
    });
    setReturnQuantities(quantities);
    setReturnReason(RETURN_REASONS[0]);
    setReturnDescription("");
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!detailOrder) return;
    const items = Object.entries(returnQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
        reason: returnReason,
        description: returnDescription.trim(),
        returnType: "Refund",
      }));

    if (!items.length) {
      toast.error("Select at least one item to return.");
      return;
    }
    if (returnDescription.trim().length < 5) {
      toast.error("Please describe the issue in at least 5 characters.");
      return;
    }

    setReturning(true);
    try {
      await submitOrderReturn(detailOrder._id, { items });
      toast.success("Your return request has been submitted.");
      setReturnOpen(false);
      await refreshDetail(detailOrder._id);
    } catch (err: any) {
      toast.error(err.message || "We could not submit the return request.");
    } finally {
      setReturning(false);
    }
  };

  const handleReorder = () => {
    if (!detailOrder || !onReorder) return;
    const items = detailOrder.orderItems
      .map((item) => {
        const productId = productIdOf(item);
        return productId
          ? {
              productId,
              quantity: Number(item.quantity) || 1,
              size: item.size || undefined,
              variantName: item.variantName || undefined,
            }
          : null;
      })
      .filter(Boolean) as {
        productId: string;
        quantity: number;
        size?: string;
        variantName?: string;
      }[];
    if (!items.length) {
      toast.error("These items are no longer available to reorder.");
      return;
    }
    onReorder(items);
  };

  const handleInvoice = async () => {
    if (!detailOrder) return;
    setInvoiceBusy(true);
    try {
      const invoice = await fetchOrderInvoice(detailOrder._id);
      if (!printInvoice(invoice)) {
        toast.error("Please allow pop-ups to print the invoice.");
      }
    } catch (err: any) {
      toast.error(err.message || "We could not load the invoice.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handlePayNow = async (orderToPay?: OrderRecord) => {
    const target = orderToPay || detailOrder;
    if (!target || paying) return;
    setPaying(true);
    try {
      if (target.paymentMethod === "Razorpay") {
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error("Unable to load the Razorpay checkout. Please try again.");
        const payment = await createRazorpayPayment(target._id);
        await new Promise<void>((resolve, reject) => {
          const RazorpayCheckout = (window as any).Razorpay;
          if (!RazorpayCheckout) {
            reject(new Error("Razorpay checkout is unavailable."));
            return;
          }
          const checkout = new RazorpayCheckout({
            key: payment.keyId || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || "rzp_live_Ttk82MqcwEuYWt",
            amount: payment.amount,
            currency: payment.currency,
            name: "DELIVIX",
            description: `Order ${getOrderNumber(target)}`,
            order_id: payment.order?.id,
            prefill: {
              name: target.shippingAddress?.fullName || target.shippingInfo?.fullName || "",
              email: target.customerInfo?.email || "",
              contact: target.shippingAddress?.phone || target.shippingInfo?.phoneNo || "",
            },
            notes: { orderId: target._id },
            theme: { color: "#111111" },
            handler: async (response: any) => {
              try {
                await verifyRazorpayPayment({
                  orderId: target._id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                toast.success("Payment verified! Your order is confirmed.");
                if (detailOrder && detailOrder._id === target._id) {
                  await refreshDetail(target._id);
                } else {
                  reload();
                }
                resolve();
              } catch (err: any) {
                reject(new Error(err.message || "Payment verification failed."));
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment was cancelled. You can retry anytime.")),
            },
          });
          checkout.on("payment.failed", (response: any) => {
            reject(new Error(response?.error?.description || "Payment failed. Please try again."));
          });
          checkout.open();
        });
      } else {
        const session = await createStripePayment(target._id);
        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        window.location.assign(session.url);
      }
    } catch (err: any) {
      toast.error(err.message || "We could not start the payment.");
    } finally {
      setPaying(false);
    }
  };

  const itemCount = useMemo(
    () => orders.reduce((total, order) => total + getOrderItemCount(order), 0),
    [orders]
  );

  if (detailOrder || detailLoading) {
    const order = detailOrder;
    return (
      <div className="cust-orders">
        <button
          className="cust-orders__back"
          type="button"
          onClick={() => {
            setDetailOrder(null);
            setDetailError(null);
          }}
        >
          <ArrowLeft size={15} /> Back to my orders
        </button>

        {detailLoading && !order ? (
          <div className="order-skeleton">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {detailError ? (
          <div className="order-alert order-alert--error">
            {detailError}
            <button type="button" onClick={() => openOrder(detailOrder?._id || "")}>
              Try again
            </button>
          </div>
        ) : null}

        {order ? (
          <>
            <header className="cust-order-detail__head">
              <div>
                <p className="eyebrow">Order {getOrderNumber(order)}</p>
                <h1>{getOrderItemCount(order)} item(s) · {orderMoney(order.totalAmount, order.currency)}</h1>
                <p className="cust-order-detail__meta">
                  Placed {orderDateTime(order.createdAt)} · {order.paymentMethod} ·{" "}
                  {order.shippingMethod || "standard"} delivery
                </p>
              </div>
              <div className="cust-order-detail__badges">
                <OrderStatusBadge status={order.orderStatus} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </header>

            <div className="cust-order-actions">
              <button type="button" onClick={handleInvoice} disabled={invoiceBusy}>
                <Printer size={15} /> {invoiceBusy ? "Preparing…" : "Print invoice"}
              </button>
              {onReorder ? (
                <button type="button" onClick={handleReorder}>
                  <RotateCcw size={15} /> Reorder
                </button>
              ) : null}
              {canRetryPayment(order) ? (
                <button type="button" className="is-primary" onClick={() => handlePayNow(order)} disabled={paying}>
                  <CreditCard size={15} /> {paying ? "Starting payment…" : `Pay ${orderMoney(order.totalAmount, order.currency)} (Razorpay)`}
                </button>
              ) : null}
              {isCancellable(order) ? (
                <button type="button" className="is-danger" onClick={() => setCancelOpen(true)}>
                  <X size={15} /> Cancel order
                </button>
              ) : null}
              {isReturnable(order) ? (
                <button type="button" onClick={openReturn}>
                  <RotateCcw size={15} /> Request return
                </button>
              ) : null}
            </div>

            {cancelOpen ? (
              <div className="order-modal" role="dialog" aria-modal="true" aria-label="Cancel order">
                <div className="order-modal__card">
                  <h3>Cancel this order?</h3>
                  <p>
                    This cannot be undone. Any reserved stock will be released and a refund, if
                    applicable, will be processed to your original payment method.
                  </p>
                  <label>
                    Reason for cancellation
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Tell us why you need to cancel"
                    />
                  </label>
                  <div className="order-modal__actions">
                    <button type="button" onClick={() => setCancelOpen(false)} disabled={cancelling}>
                      Keep order
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={handleCancel}
                      disabled={cancelling}
                    >
                      {cancelling ? "Cancelling…" : "Cancel order"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {returnOpen ? (
              <div className="order-modal" role="dialog" aria-modal="true" aria-label="Return items">
                <div className="order-modal__card order-modal__card--wide">
                  <h3>Request a return</h3>
                  <p>Select the items and quantities you want to return.</p>
                  <div className="order-return-list">
                    {order.orderItems.map((item) => {
                      const max = Number(item.quantity) || 1;
                      const quantity = returnQuantities[item._id] || 0;
                      return (
                        <div className="order-return-row" key={item._id}>
                          {item.image ? <img src={item.image} alt="" /> : <div />}
                          <span>
                            <strong>{item.name}</strong>
                            <small>{itemVariantLabel(item) || "Standard"}</small>
                          </span>
                          <label>
                            Qty
                            <input
                              type="number"
                              min={0}
                              max={max}
                              value={quantity}
                              onChange={(event) =>
                                setReturnQuantities((current) => ({
                                  ...current,
                                  [item._id]: Math.max(
                                    0,
                                    Math.min(max, Number(event.target.value) || 0)
                                  ),
                                }))
                              }
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <label>
                    Reason
                    <select
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                    >
                      {RETURN_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Describe the issue
                    <textarea
                      value={returnDescription}
                      onChange={(event) => setReturnDescription(event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Tell us what went wrong"
                    />
                  </label>
                  <div className="order-modal__actions">
                    <button type="button" onClick={() => setReturnOpen(false)} disabled={returning}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="is-primary"
                      onClick={submitReturn}
                      disabled={returning}
                    >
                      {returning ? "Submitting…" : "Submit return request"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="cust-order-detail__grid">
              <div className="cust-order-detail__main">
                <section className="order-panel">
                  <div className="order-panel__head">
                    <div>
                      <p className="eyebrow">Items</p>
                      <h3>{order.orderItems.length} product line(s)</h3>
                    </div>
                    <span>{getOrderItemCount(order)} unit(s)</span>
                  </div>
                  <div className="cust-order-items">
                    {order.orderItems.map((item) => (
                      <div className="cust-order-item" key={item._id}>
                        {item.image ? <img src={item.image} alt="" /> : <div />}
                        <span>
                          <strong>{item.name}</strong>
                          <small>{itemVariantLabel(item) || "Standard"}</small>
                          <em>Qty {item.quantity}</em>
                        </span>
                        <b>{orderMoney(item.price * item.quantity, order.currency)}</b>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="order-panel">
                  <div className="order-panel__head">
                    <div>
                      <p className="eyebrow">Tracking</p>
                      <h3>Order journey</h3>
                    </div>
                  </div>
                  <OrderTimeline order={order} />
                </section>
              </div>

              <aside className="cust-order-detail__side">
                <section className="order-panel">
                  <p className="eyebrow">Delivery address</p>
                  <h3>{order.shippingAddress?.fullName || order.shippingInfo?.fullName}</h3>
                  <div className="order-address">
                    {addressText(order.shippingAddress || order.shippingInfo).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </section>

                <section className="order-panel">
                  <p className="eyebrow">Payment summary</p>
                  <h3>{order.paymentMethod} · {order.paymentStatus}</h3>
                  <div className="order-summary-lines">
                    <div>
                      <span>Items</span>
                      <strong>{orderMoney(order.itemsPrice, order.currency)}</strong>
                    </div>
                    {Number(order.discountAmount) ? (
                      <div>
                        <span>Discount</span>
                        <strong>− {orderMoney(order.discountAmount, order.currency)}</strong>
                      </div>
                    ) : null}
                    <div>
                      <span>Tax</span>
                      <strong>{orderMoney(order.taxAmount, order.currency)}</strong>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <strong>
                        {Number(order.shippingAmount) > 0
                          ? orderMoney(order.shippingAmount, order.currency)
                          : "Free"}
                      </strong>
                    </div>
                    {Number(order.packagingAmount) ? (
                      <div>
                        <span>Packaging</span>
                        <strong>{orderMoney(order.packagingAmount, order.currency)}</strong>
                      </div>
                    ) : null}
                    <div className="is-total">
                      <span>Total</span>
                      <strong>{orderMoney(order.totalAmount, order.currency)}</strong>
                    </div>
                  </div>
                </section>

                {order.courierName || order.trackingId || order.awbNumber || order.trackingUrl ? (
                  <section className="order-panel">
                    <p className="eyebrow">Shipment</p>
                    <h3>{order.courierName || "Courier assigned"}</h3>
                    <div className="order-address">
                      {order.trackingId || order.awbNumber ? (
                        <p>Tracking / AWB: <strong>{order.trackingId || order.awbNumber}</strong></p>
                      ) : null}
                      {order.shipmentDate ? <p>Shipped {orderDate(order.shipmentDate)}</p> : null}
                      {order.estimatedDeliveryDate ? (
                        <p>Estimated delivery {orderDate(order.estimatedDeliveryDate)}</p>
                      ) : null}
                      {order.trackingUrl ? (
                        <a href={order.trackingUrl} target="_blank" rel="noreferrer">
                          Track shipment ↗
                        </a>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {order.cancellation?.cancelledAt ? (
                  <section className="order-panel">
                    <p className="eyebrow">Cancellation</p>
                    <h3>{order.cancellation.reason || "Order cancelled"}</h3>
                    <div className="order-address">
                      <p>Cancelled {orderDateTime(order.cancellation.cancelledAt)}</p>
                      {order.cancellation.refundStatus ? (
                        <p>Refund status: {order.cancellation.refundStatus}</p>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {order.returnInfo?.status ? (
                  <section className="order-panel">
                    <p className="eyebrow">Return</p>
                    <h3>{order.returnInfo.status}</h3>
                    <div className="order-address">
                      {order.returnInfo.reason ? <p>{order.returnInfo.reason}</p> : null}
                      {order.returnInfo.requestedAt ? (
                        <p>Requested {orderDateTime(order.returnInfo.requestedAt)}</p>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {order.refunds?.length ? (
                  <section className="order-panel">
                    <p className="eyebrow">Refunds</p>
                    <h3>{orderMoney(
                      order.refunds
                        .filter((refund) => refund.status === "Completed")
                        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0),
                      order.currency
                    )} refunded</h3>
                    <div className="order-address">
                      {order.refunds.map((refund, index) => (
                        <p key={refund._id || index}>
                          {refund.status} · {orderMoney(refund.amount, order.currency)}
                          {refund.processedAt ? ` · ${orderDate(refund.processedAt)}` : ""}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cust-orders">
      <div className="cust-orders__head">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>My orders.</h1>
          <p className="account-intro">
            Track deliveries, download invoices, reorder favourites, and start a return.
          </p>
        </div>
        {pagination ? (
          <span className="cust-orders__count">
            {pagination.total} order(s) · {itemCount} item(s) on this page
          </span>
        ) : null}
      </div>

      <div className="cust-orders__toolbar">
        <div className="cust-orders__filters" role="tablist" aria-label="Filter orders">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              className={filter === entry.id ? "is-active" : ""}
              onClick={() => {
                setFilter(entry.id);
                setPage(1);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="cust-orders__search">
          <Search size={15} className="cust-orders__search-icon" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number or product"
            aria-label="Search orders"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={12} />
            </button>
          ) : null}
        </label>
      </div>

      {loading ? (
        <div className="cust-orders__list">
          {[0, 1, 2].map((key) => (
            <div className="cust-order-card cust-order-card--skeleton" key={key}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="order-alert order-alert--error">
          {error}
          <button type="button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="cust-orders__empty">
          <div className="cust-orders__empty-icon">
            <Package size={30} strokeWidth={1.75} />
          </div>
          <h3>{searchTerm ? "No matching orders" : "No orders yet"}</h3>
          <p>
            {searchTerm
              ? `We couldn't find any orders matching "${searchTerm}". Try a different order number or product name.`
              : "When you place an order, it will appear here with live tracking and invoices."}
          </p>
          {onShop && !searchTerm ? (
            <button type="button" className="is-primary" onClick={onShop}>
              <ShoppingBag size={15} /> Start shopping
            </button>
          ) : null}
        </div>
      ) : (
        <div className="cust-orders__list">
          {orders.map((order) => {
            const firstItem = order.orderItems[0];
            return (
              <article className="cust-order-card" key={order._id}>
                <button
                  type="button"
                  className="cust-order-card__main"
                  onClick={() => openOrder(order._id)}
                  aria-label={`View order ${getOrderNumber(order)}`}
                >
                  <span className="cust-order-card__media">
                    {firstItem?.image ? (
                      <img src={firstItem.image} alt="" />
                    ) : (
                      <span className="cust-order-card__placeholder" aria-hidden="true" />
                    )}
                    {order.orderItems.length > 1 ? (
                      <em>+{order.orderItems.length - 1}</em>
                    ) : null}
                  </span>
                  <span className="cust-order-card__info">
                    <small>{getOrderNumber(order)}</small>
                    <strong>
                      {firstItem?.name || "Order"}
                      {order.orderItems.length > 1
                        ? ` +${order.orderItems.length - 1} more`
                        : ""}
                    </strong>
                    <em>
                      Placed {orderDate(order.createdAt)} · {getOrderItemCount(order)} item(s) ·{" "}
                      {orderMoney(order.totalAmount, order.currency)}
                    </em>
                    <span className="cust-order-card__badges">
                      <OrderStatusBadge status={order.orderStatus} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </span>
                  </span>
                  <span className="cust-order-card__arrow" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </button>
                <div className="cust-order-card__actions">
                  {canRetryPayment(order) && (
                    <button
                      type="button"
                      className="is-pay-now"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePayNow(order);
                      }}
                      disabled={paying}
                    >
                      <CreditCard size={13} /> {paying ? "Processing…" : "Pay now"}
                    </button>
                  )}
                  <button type="button" onClick={() => openOrder(order._id)}>
                    View details
                  </button>
                  {onReorder ? (
                    <button
                      type="button"
                      onClick={() => {
                        const items = order.orderItems
                          .map((item) => {
                            const productId = productIdOf(item);
                            return productId
                              ? {
                                  productId,
                                  quantity: Number(item.quantity) || 1,
                                  size: item.size || undefined,
                                  variantName: item.variantName || undefined,
                                }
                              : null;
                          })
                          .filter(Boolean) as {
                            productId: string;
                            quantity: number;
                            size?: string;
                            variantName?: string;
                          }[];
                        if (!items.length) {
                          toast.error("These items are no longer available to reorder.");
                          return;
                        }
                        onReorder(items);
                      }}
                    >
                      <RotateCcw size={13} /> Reorder
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pagination && pagination.pages > 1 ? (
        <div className="cust-orders__pagination">
          <button
            type="button"
            disabled={!pagination.hasPrev || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNext || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
