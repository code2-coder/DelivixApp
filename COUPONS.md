# Coupons & Discounts

This document describes the coupon system in the Delivix application, its
operational configuration, and the promotion types that are intentionally not
supported.

## What is implemented

- Percentage, fixed-amount and free-shipping coupons.
- Code entry at checkout with server-side validation and instant quote updates.
- Eligibility rules: start/expiry dates (server time), minimum order value,
  minimum quantity, global usage limit, per-customer limit, first-order-only,
  included/excluded products and categories, customer allow-lists,
  and shipping-method restrictions.
- Product/category targeting uses the live catalog. Prices and totals are always
  recalculated from database prices; client-supplied discounts are ignored.
- Discounts are clamped so item + shipping discounts can never make the payable
  total negative.
- Coupon currency is stored in INR and converted server-side into the checkout
  currency.
- Redemption lifecycle: `pending` reservation -> `success` after verified
  payment (COD confirms immediately) -> `reversed` on cancellation or `refunded`
  on a full refund. Partial refunds keep the coupon consumed.
- Reservations abandoned before payment expire after
  `COUPON_RESERVATION_TTL_MINUTES` (default 30) and are swept periodically.
  Coupon usage is atomic across concurrent checkouts via pending/usage counters
  and a partial unique index on live redemptions.
- Immutable order coupon snapshot (`order.coupon`) retained independently of
  later coupon edits/deletions.
- Admin analytics: successful redemptions, unique customers, discount granted,
  gross/eligible/net revenue, AOV, usage over time, most-used coupons, coupons
  nearing their limits, expired unused coupons, and CSV export. Cancelled,
  failed and refunded orders are excluded.
- Admin audit trail (`CouponAuditLog`) for create/update/activate/disable/
  archive/delete/duplicate operations.
- Rate-limited, authenticated customer validation; admin endpoints require an
  admin or staff role.

## API surface

Admin/staff (all under `/api/v1`):

- `GET /admin/coupons` — search/filter/sort/paginated list
- `GET /admin/coupons/stats` — summary cards
- `GET /admin/coupons/analytics`
- `GET /admin/coupons/analytics/export` — CSV
- `POST /admin/coupons`
- `GET /admin/coupons/:id`
- `PUT /admin/coupons/:id`
- `PATCH /admin/coupons/:id/active`
- `PATCH /admin/coupons/:id/archive`
- `DELETE /admin/coupons/:id`
- `POST /admin/coupons/:id/duplicate`
- `POST /admin/coupons/reverse-redemption/:orderId`

Customer:

- `POST /coupons/validate`

Checkout integrates with `POST /orders/quote` and `POST /orders/new` via the
`couponCode` field. Payment confirmation/refund handling uses the existing
payment service and webhook flow.

## Pricing order

1. Trusted database prices and line-item totals.
2. Eligible item/category subtotal.
3. Item/category discount (for future automatic promotions).
4. Coupon discount (item discount and shipping discount tracked separately).
5. Shipping discount and payable shipping.
6. Taxes (`TAX_RATE`, default 0).
7. Final payable total used by the payment gateway and order record.

## Configuration

Required backend environment variables:

- `MONGODB_URI`
- `JWT_SECRET`

Optional coupon / payment configuration:

- `COUPON_RESERVATION_TTL_MINUTES` — reservation lifetime in minutes (default 30)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — enable Razorpay online payments
- `RAZORPAY_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY` — enable Stripe online payments
- `STRIPE_WEBHOOK_SECRET`
- `TAX_RATE` — tax rate used by checkout (unset/0 in the current environment)

Run the stack from the repository root with `npm run dev`. Backend defaults to
port `8085`, frontend to `5173`.

## Tests

From `backend/`:

```bash
npm test                                      # unit + database lifecycle suites
node scripts/couponSmoke.js                   # live API smoke suite (backend must be running)
```

The smoke suite covers admin guards, CRUD, enable/disable, validation, quotes,
COD redemption, immutable snapshots, idempotent retries, cancellation release,
analytics exclusion, reuse, product scope, expiry/scheduling, free shipping,
currency conversion, concurrent usage limits, duplicate/archive/delete
protections and audit logging.

The automated lifecycle suite covers online checkout reservation, payment
amount verification, idempotent payment confirmation, partial refund retention,
full refund release and abandoned-checkout cancellation release. Live gateway
calls cannot be exercised without provider credentials; the same service methods
used by the gateway webhooks are tested directly.

## Not supported

The current system supports **one coupon per order**. The `combinable` flag is
stored for future use but stacking multiple coupons is not implemented.

There is no automatic promotion engine. The following are **not supported** and
are not simulated with mock/hardcoded data:

- Buy-one-get-one (BXGY) promotions
- Automatic category-wide or site-wide sales
- Seasonal campaigns or scheduled automatic discounts
- Tiered/loyalty pricing
- Multiple stacked coupons or coupon + automatic-promotion stacking
