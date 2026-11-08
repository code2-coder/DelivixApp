import type { OrderRecord, OrderStatus, PaymentStatus } from "../../services/api";

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "Pending",
  "Confirmed",
  "Processing",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Return Approved",
  "Return Rejected",
  "Returned",
  "Refund Pending",
  "Refunded",
];

export const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  "Pending",
  "Paid",
  "Failed",
  "Refund Pending",
  "Partially Refunded",
  "Refunded",
  "Cancelled",
];

const STATUS_TONES: Record<string, string> = {
  Pending: "pending",
  Confirmed: "confirmed",
  Processing: "processing",
  Packed: "packed",
  Shipped: "shipped",
  "Out for Delivery": "out-for-delivery",
  Delivered: "delivered",
  Cancelled: "cancelled",
  "Return Requested": "return",
  "Return Approved": "return",
  "Return Rejected": "rejected",
  Returned: "returned",
  "Refund Pending": "refund-pending",
  Refunded: "refunded",
  Paid: "paid",
  Failed: "failed",
  "Partially Refunded": "refund-pending",
};

export function orderStatusTone(status?: string): string {
  return STATUS_TONES[status || "Pending"] || "pending";
}

export function OrderStatusBadge({ status }: { status?: string }) {
  return (
    <span className={`order-badge order-badge--${orderStatusTone(status)}`}>
      <i aria-hidden="true" />
      {status || "Pending"}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status?: string }) {
  return (
    <span className={`order-badge order-badge--${orderStatusTone(status)}`}>
      <i aria-hidden="true" />
      {status || "Pending"}
    </span>
  );
}

export function getOrderNumber(order?: OrderRecord | null): string {
  if (!order) return "—";
  return order.orderNumber || String(order._id || "").toUpperCase();
}

export function getOrderItemCount(order?: OrderRecord | null): number {
  return (order?.orderItems || []).reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0
  );
}

export function orderMoney(
  value: number | string | null | undefined,
  currency = "INR"
): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currency || "INR").toUpperCase();
  try {
    return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-AU", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${code} ${safeAmount.toFixed(2)}`;
  }
}

export function orderDate(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function orderDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function itemVariantLabel(item: {
  size?: string;
  variantName?: string;
  sku?: string;
  variantSku?: string;
}): string {
  return [item.variantName, item.size, item.sku || item.variantSku]
    .filter(Boolean)
    .join(" · ");
}

export interface TimelineEntry {
  key: string;
  status: string;
  note?: string;
  at?: string;
  source?: string;
  actor?: string;
}

export function getOrderTimeline(order?: OrderRecord | null): TimelineEntry[] {
  if (!order) return [];
  const entries: TimelineEntry[] = [];

  (order.statusHistory || []).forEach((entry, index) => {
    entries.push({
      key: `status-${entry._id || index}-${entry.status}`,
      status: entry.status,
      note: entry.note,
      at: entry.at,
      source: entry.source,
      actor: entry.changedByName,
    });
  });

  const shipmentHistory = Array.isArray(order.shipment?.statusHistory)
    ? order.shipment.statusHistory
    : [];
  const orderStatuses = new Set(entries.map((entry) => entry.status));
  shipmentHistory.forEach((entry: any, index: number) => {
    // The order workflow already records statuses such as Packed, Out for
    // Delivery, Delivered and Cancelled. Showing the matching shipment event
    // again would duplicate the same milestone with a slightly different time.
    if (orderStatuses.has(entry.status)) return;
    const at = entry.date
      ? new Date(entry.date).toISOString()
      : entry.createdAt || undefined;
    const key = `shipment-${entry._id || index}-${entry.status}`;
    if (entries.some((existing) => existing.status === entry.status && existing.at === at)) {
      return;
    }
    entries.push({
      key,
      status: entry.status,
      note: entry.remark,
      at,
      source: "shipment",
      actor: entry.adminName,
    });
  });

  return entries.sort((left, right) => {
    const leftTime = left.at ? new Date(left.at).getTime() : 0;
    const rightTime = right.at ? new Date(right.at).getTime() : 0;
    return leftTime - rightTime;
  });
}

export function OrderTimeline({ order }: { order: OrderRecord }) {
  const entries = getOrderTimeline(order);
  if (!entries.length) {
    return <p className="order-muted">Tracking updates will appear here.</p>;
  }

  return (
    <ol className="order-timeline">
      {entries.map((entry, index) => (
        <li
          key={entry.key}
          className={index === entries.length - 1 ? "is-current" : ""}
        >
          <span className="order-timeline__dot" aria-hidden="true" />
          <div>
            <strong>{entry.status}</strong>
            {entry.at ? <small>{orderDateTime(entry.at)}</small> : null}
            {entry.note ? <p>{entry.note}</p> : null}
            {entry.actor ? <em>Updated by {entry.actor}</em> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
  .print-head { display: flex; justify-content: space-between; gap: 32px; border-bottom: 2px solid #111; padding-bottom: 18px; margin-bottom: 24px; }
  .print-head h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.04em; }
  .print-head p { margin: 2px 0; color: #555; }
  .print-meta { text-align: right; }
  .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .print-block h2 { margin: 0 0 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; }
  .print-block p { margin: 3px 0; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
  th { text-align: left; background: #f5f5f3; padding: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  td { padding: 10px; border-bottom: 1px solid #e3e3e0; vertical-align: top; }
  td.right, th.right { text-align: right; }
  .totals { margin-left: auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals div.total { border-top: 2px solid #111; margin-top: 8px; padding-top: 10px; font-size: 15px; font-weight: bold; }
  .print-note { margin-top: 26px; color: #666; font-size: 11px; line-height: 1.6; }
  .label { border: 2px solid #111; padding: 24px; max-width: 620px; }
  .label h1 { margin: 0 0 18px; font-size: 26px; letter-spacing: 0.08em; }
  .label .to { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
  .label .tracking { margin-top: 24px; border-top: 1px dashed #111; padding-top: 16px; font-size: 15px; }
  @media print { body { padding: 0; } }
`;

function openPrintWindow(title: string, body: string): boolean {
  const printWindow = window.open("", "_blank", "width=960,height=760");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      title
    )}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 350);
  return true;
}

const addressLines = (address: any = {}): string =>
  [
    address.fullName,
    address.addressLine1 || address.address,
    address.addressLine2,
    address.landmark,
    [address.city, address.state].filter(Boolean).join(", "),
    address.pincode || address.zipCode,
    address.country,
    address.phone ? `Phone: ${address.phone}` : address.phoneNo ? `Phone: ${address.phoneNo}` : "",
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");

export function printInvoice(invoice: any): boolean {
  if (!invoice) return false;
  const items = (invoice.items || [])
    .map(
      (item: any) => `<tr>
        <td>${escapeHtml(item.name)}${item.size ? ` <small>(${escapeHtml(item.size)})</small>` : ""}</td>
        <td class="right">${escapeHtml(item.quantity)}</td>
        <td class="right">${escapeHtml(orderMoney(item.price, invoice.amounts?.currency))}</td>
        <td class="right">${escapeHtml(orderMoney(item.subtotal, invoice.amounts?.currency))}</td>
      </tr>`
    )
    .join("");

  const body = `
    <div class="print-head">
      <div>
        <h1>${escapeHtml(invoice.seller?.name || "DELIVIX")}</h1>
        <p>${escapeHtml(invoice.seller?.address || "")}</p>
        <p>${escapeHtml(invoice.seller?.email || "")} ${invoice.seller?.phone ? `· ${escapeHtml(invoice.seller.phone)}` : ""}</p>
        ${invoice.seller?.gstin ? `<p>GSTIN: ${escapeHtml(invoice.seller.gstin)}</p>` : ""}
      </div>
      <div class="print-meta">
        <h1>INVOICE</h1>
        <p><strong>${escapeHtml(invoice.invoiceNumber)}</strong></p>
        <p>Order: ${escapeHtml(invoice.orderNumber)}</p>
        <p>Date: ${escapeHtml(orderDate(invoice.invoiceDate))}</p>
        <p>Status: ${escapeHtml(invoice.payment?.status || invoice.status)}</p>
      </div>
    </div>
    <div class="print-grid">
      <div class="print-block">
        <h2>Billed to</h2>
        <p>${addressLines(invoice.customer?.billingAddress || invoice.customer?.address)}</p>
        <p>${escapeHtml(invoice.customer?.email || "")}</p>
      </div>
      <div class="print-block">
        <h2>Ship to</h2>
        <p>${addressLines(invoice.customer?.address)}</p>
        <p>Payment: ${escapeHtml(invoice.payment?.method || "")} / ${escapeHtml(invoice.payment?.status || "")}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Subtotal</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div class="totals">
      <div><span>Items</span><strong>${escapeHtml(orderMoney(invoice.amounts?.itemsPrice, invoice.amounts?.currency))}</strong></div>
      ${Number(invoice.amounts?.discountAmount) ? `<div><span>Discount</span><strong>- ${escapeHtml(orderMoney(invoice.amounts.discountAmount, invoice.amounts?.currency))}</strong></div>` : ""}
      <div><span>Tax</span><strong>${escapeHtml(orderMoney(invoice.amounts?.taxAmount, invoice.amounts?.currency))}</strong></div>
      <div><span>Shipping</span><strong>${escapeHtml(orderMoney(invoice.amounts?.shippingAmount, invoice.amounts?.currency))}</strong></div>
      ${Number(invoice.amounts?.packagingAmount) ? `<div><span>Packaging</span><strong>${escapeHtml(orderMoney(invoice.amounts.packagingAmount, invoice.amounts?.currency))}</strong></div>` : ""}
      <div class="total"><span>Total</span><strong>${escapeHtml(orderMoney(invoice.amounts?.totalAmount, invoice.amounts?.currency))}</strong></div>
      ${Number(invoice.amounts?.refundedAmount) ? `<div><span>Refunded</span><strong>- ${escapeHtml(orderMoney(invoice.amounts.refundedAmount, invoice.amounts?.currency))}</strong></div>` : ""}
    </div>
    <p class="print-note">${escapeHtml(invoice.notes || "Thank you for shopping with DELIVIX.")}</p>
  `;

  return openPrintWindow(`Invoice ${invoice.invoiceNumber || ""}`, body);
}

export function printPackingSlip(order: OrderRecord): boolean {
  const items = (order.orderItems || [])
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}${item.size ? ` <small>(${escapeHtml(item.size)})</small>` : ""}</td>
        <td>${escapeHtml(item.sku || item.variantSku || "—")}</td>
        <td class="right">${escapeHtml(item.quantity)}</td>
      </tr>`
    )
    .join("");

  const body = `
    <div class="print-head">
      <div><h1>DELIVIX</h1><p>Packing slip</p></div>
      <div class="print-meta">
        <p><strong>${escapeHtml(getOrderNumber(order))}</strong></p>
        <p>${escapeHtml(orderDate(order.createdAt))}</p>
        <p>${escapeHtml(order.shippingMethod || "standard")} delivery</p>
      </div>
    </div>
    <div class="print-grid">
      <div class="print-block">
        <h2>Ship to</h2>
        <p>${addressLines(order.shippingAddress || order.shippingInfo)}</p>
      </div>
      <div class="print-block">
        <h2>Order details</h2>
        <p>Items: ${escapeHtml(getOrderItemCount(order))}</p>
        <p>Payment: ${escapeHtml(order.paymentMethod)} / ${escapeHtml(order.paymentStatus)}</p>
        <p>Status: ${escapeHtml(order.orderStatus)}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <p class="print-note">Please verify the contents before dispatch. Pack with care.</p>
  `;

  return openPrintWindow(`Packing slip ${getOrderNumber(order)}`, body);
}

export function printShippingLabel(order: OrderRecord): boolean {
  const body = `
    <div class="label">
      <h1>DELIVIX · SHIPPING LABEL</h1>
      <div class="to">${escapeHtml(order.shippingAddress?.fullName || order.shippingInfo?.fullName || "Customer")}</div>
      <p>${addressLines(order.shippingAddress || order.shippingInfo)}</p>
      <div class="tracking">
        <p><strong>Order:</strong> ${escapeHtml(getOrderNumber(order))}</p>
        <p><strong>Courier:</strong> ${escapeHtml(order.courierName || "Not assigned")}</p>
        <p><strong>Tracking / AWB:</strong> ${escapeHtml(order.trackingId || order.awbNumber || "Not assigned")}</p>
        <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)} / ${escapeHtml(order.paymentStatus)}</p>
      </div>
    </div>
    <p class="print-note">From: ${escapeHtml(
      import.meta.env.VITE_COMPANY_NAME || "DELIVIX fulfilment centre"
    )}</p>
  `;

  return openPrintWindow(`Shipping label ${getOrderNumber(order)}`, body);
}
