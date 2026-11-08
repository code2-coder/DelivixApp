const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format an amount as Indian rupees using Indian digit grouping.
 * e.g. 129900 -> "₹1,29,900"
 */
export function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value);
  return inrFormatter.format(Number.isFinite(amount) ? amount : 0);
}
