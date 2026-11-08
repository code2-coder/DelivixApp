import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import {
  createAddress,
  createOrder,
  createRazorpayPayment,
  createStripePayment,
  fetchMyAddresses,
  fetchMyProfile,
  fetchOrderInvoice,
  fetchPaymentConfig,
  getStoredAdminToken,
  quoteOrder,
  validateCouponCode,
  verifyRazorpayPayment,
  type AddressItem,
  type OrderQuote,
  type OrderRecord,
  type PaymentConfig,
  type ProductItem,
} from "../../services/api";
import {
  getOrderNumber,
  orderMoney,
  printInvoice,
} from "./OrderBits";
import { cartLineLabel, findProductOption, getCartLines, type CartMap } from "../../utils/cart";

type CheckoutTarget = "home" | "account" | "cart" | "shop";
type PaymentMethod = "COD" | "Razorpay" | "Stripe";

interface CheckoutPageProps {
  products: ProductItem[];
  cart: CartMap;
  setPage: (page: CheckoutTarget) => void;
  onOrderComplete: () => void;
  loggedInUser: { name: string; email: string; role?: string } | null;
}

interface CheckoutForm {
  fullName: string;
  email: string;
  phoneNo: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const COUNTRIES = ["India", "Australia", "United States", "United Kingdom", "United Arab Emirates"];

const emptyForm: CheckoutForm = {
  fullName: "",
  email: "",
  phoneNo: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
};

const createIdempotencyKey = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Fall through to the timestamp-based key.
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const formFromAddress = (address: AddressItem, email: string): CheckoutForm => ({
  fullName: address.fullName || "",
  email,
  phoneNo: address.phoneNo || address.phone || "",
  addressLine1: address.street || address.address || "",
  addressLine2: "",
  landmark: address.landmark || "",
  city: address.city || "",
  state: address.state || "",
  zipCode: address.zipCode || address.pinCode || "",
  country: address.country || "India",
});

const formFromProfile = (profile: any, fallbackEmail: string): CheckoutForm => ({
  fullName: profile?.name || "",
  email: profile?.email || fallbackEmail || "",
  phoneNo: profile?.phoneNumber || "",
  addressLine1: profile?.address?.street || "",
  addressLine2: "",
  landmark: profile?.address?.landmark || "",
  city: profile?.address?.city || "",
  state: profile?.address?.state || "",
  zipCode: profile?.address?.pinCode || "",
  country: "India",
});

const validateForm = (form: CheckoutForm): string | null => {
  if (form.fullName.trim().length < 2) return "Please enter the recipient's full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Please enter a valid email address for order updates.";
  }
  if (form.phoneNo.replace(/\D/g, "").length < 6) return "Please enter a valid phone number.";
  if (form.addressLine1.trim().length < 3) return "Please enter the delivery address.";
  if (form.city.trim().length < 2) return "Please enter the city.";
  if (!form.zipCode.trim()) return "Please enter the postal / PIN code.";
  if (!form.country.trim()) return "Please select the delivery country.";
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

export default function CheckoutPage({
  products,
  cart,
  setPage,
  onOrderComplete,
  loggedInUser,
}: CheckoutPageProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [profile, setProfile] = useState<any | null>(null);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<OrderRecord | null>(null);
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const idempotencyKey = useRef(createIdempotencyKey());

  // ── Coupon state ────────────────────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    name: string;
    discountAmount: number;
    shippingDiscount: number;
    eligibleSubtotal: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [quoteRefresh, setQuoteRefresh] = useState(0);

  const hasToken = Boolean(getStoredAdminToken());
  const cartItems = useMemo(() => {
    const productById = new Map<string, ProductItem>();
    products.forEach((product) => productById.set(String(product.id), product));

    return getCartLines(cart)
      .map((line) => {
        const product = productById.get(line.productId);
        if (!product) return null;
        const option = findProductOption(product, line);
        return {
          key: line.key,
          productId: line.productId,
          name: product.name,
          image: option.variant?.images?.[0]?.url || product.image,
          price: option.price,
          stock: option.stock,
          quantity: line.quantity,
          size: line.size,
          variantName: line.variantName,
          label: cartLineLabel(line),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [products, cart]);

  const currency = form.country.trim().toLowerCase() === "australia" ? "AUD" : "INR";
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    if (!hasToken) {
      setLoadingAccount(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingAccount(true);
      setAuthError(null);
      const [profileResult, addressResult, configResult] = await Promise.allSettled([
        fetchMyProfile(),
        fetchMyAddresses(),
        fetchPaymentConfig(),
      ]);
      if (cancelled) return;

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      } else {
        setAuthError(profileResult.reason?.message || "Please sign in to continue.");
      }

      if (addressResult.status === "fulfilled") {
        const list = Array.isArray(addressResult.value) ? addressResult.value : [];
        setAddresses(list);
        if (list.length > 0) {
          const preferred = list.find((address) => address.isDefault) || list[0];
          const preferredId = String(preferred._id || "");
          setSelectedAddressId(preferredId);
          setShowNewAddress(false);
          setForm(
            formFromAddress(
              preferred,
              profileResult.status === "fulfilled" ? profileResult.value?.email || "" : loggedInUser?.email || ""
            )
          );
        } else {
          setSelectedAddressId("new");
          setShowNewAddress(true);
          setForm(
            formFromProfile(
              profileResult.status === "fulfilled" ? profileResult.value : null,
              loggedInUser?.email || ""
            )
          );
        }
      } else {
        setAuthError(addressResult.reason?.message || "Please sign in to continue.");
      }

      if (configResult.status === "fulfilled") {
        setPaymentConfig(configResult.value);
      } else {
        setPaymentConfig({
          cod: true,
          razorpay: false,
          razorpayKeyId: null,
          stripe: false,
          stripeWebhook: false,
          razorpayWebhook: false,
        });
      }
      setLoadingAccount(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken, loggedInUser?.email]);

  const paymentOptions = useMemo(() => {
    const options: {
      id: PaymentMethod;
      title: string;
      description: string;
      enabled: boolean;
      note?: string;
    }[] = [
      {
        id: "COD",
        title: "Cash on delivery",
        description: "Pay in cash when your order is delivered.",
        enabled: true,
      },
    ];

    if (currency === "AUD") {
      options.push({
        id: "Stripe",
        title: "Card payment (Stripe)",
        description: "Visa, Mastercard and American Express via Stripe.",
        enabled: Boolean(paymentConfig?.stripe),
        note: paymentConfig?.stripe
          ? undefined
          : "Stripe is not configured on this server yet.",
      });
    } else {
      options.push({
        id: "Razorpay",
        title: "UPI / Card / Netbanking (Razorpay)",
        description: "Secure payment through Razorpay.",
        enabled: Boolean(paymentConfig?.razorpay),
        note: paymentConfig?.razorpay
          ? undefined
          : "Razorpay is not configured on this server yet.",
      });
    }

    return options;
  }, [currency, paymentConfig]);

  useEffect(() => {
    const selected = paymentOptions.find((option) => option.id === paymentMethod);
    if (!selected?.enabled) {
      setPaymentMethod("COD");
    }
  }, [paymentOptions, paymentMethod]);

  useEffect(() => {
    if (step !== 2 || !cartItems.length) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const result = await quoteOrder({
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            size: item.size,
            variantName: item.variantName,
          })),
          shippingInfo: form,
          shippingMethod,
          packagingOption: "standard",
          currency,
          couponCode: appliedCoupon?.code || undefined,
        });
        if (!cancelled) {
          setQuote(result);
          // Keep the applied-coupon panel in sync with the authoritative
          // server quote (useful when the cart changes after applying).
          if (result.coupon) {
            setAppliedCoupon((current) =>
              current
                ? {
                    ...current,
                    code: result.coupon?.code || current.code,
                    name: result.coupon?.name || current.name,
                    discountAmount: Number(result.coupon?.discountAmount || 0),
                    shippingDiscount: Number(result.coupon?.shippingDiscount || 0),
                    eligibleSubtotal: Number(result.coupon?.eligibleSubtotal || 0),
                  }
                : current
            );
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(error.message || "We could not calculate the order total.");
          // Surface coupon validation errors distinctly. Do not silently drop
          // the coupon: the customer must remove it or fix their bag.
          if (appliedCoupon) setCouponError(error.message || "Coupon is no longer valid.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, cartItems, form, shippingMethod, currency, appliedCoupon?.code, quoteRefresh]);

  const updateForm = (field: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectAddress = (address: AddressItem) => {
    setSelectedAddressId(String(address._id || "new"));
    setShowNewAddress(false);
    setForm(formFromAddress(address, profile?.email || loggedInUser?.email || ""));
    setQuote(null);
  };

  const startNewAddress = () => {
    setSelectedAddressId("new");
    setShowNewAddress(true);
    setForm(formFromProfile(profile, loggedInUser?.email || ""));
    setQuote(null);
  };

  const continueToPayment = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setPlaceError(validationError);
      return;
    }
    setPlaceError(null);
    setStep(2);
  };

  const saveNewAddress = async () => {
    if (!saveAddress || selectedAddressId !== "new") return;
    try {
      await createAddress({
        fullName: form.fullName,
        phoneNo: form.phoneNo,
        street: form.addressLine1,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        country: form.country,
        isDefault: addresses.length === 0,
      });
    } catch {
      // A saved-address failure should not block an order that was created.
    }
  };

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }
    if (!cartItems.length) {
      setCouponError("Your bag is empty. Add items before applying a coupon.");
      return;
    }
    setCouponApplying(true);
    setCouponError(null);
    try {
      const result = await validateCouponCode({
        code,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          variantName: item.variantName,
        })),
        shippingInfo: form,
        shippingMethod,
        currency,
        shippingAmount: quote?.amounts?.shippingAmount ?? 0,
      });
      setAppliedCoupon({
        code: result.coupon?.code || code,
        name: result.coupon?.name || "",
        discountAmount: Number(result.discountAmount || 0),
        shippingDiscount: Number(result.shippingDiscount || 0),
        eligibleSubtotal: Number(result.eligibleSubtotal || 0),
      });
      setCouponCode(result.coupon?.code || code);
      setQuote(null); // force re-quote with the coupon applied to totals
      setQuoteRefresh((value) => value + 1);
    } catch (error: any) {
      setCouponError(error.message || "Coupon could not be applied.");
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError(null);
    setQuote(null); // force re-quote without coupon
    setQuoteRefresh((value) => value + 1);
  };

  const finishOrder = (order: OrderRecord, warning?: string) => {
    setPlacedOrder(order);
    setPaymentWarning(warning || null);
    setStep(3);
    onOrderComplete();
  };

  const payWithRazorpay = async (order: OrderRecord) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error("Unable to load the Razorpay checkout. Please try again.");

    const payment = await createRazorpayPayment(order._id);
    await new Promise<void>((resolve, reject) => {
      const RazorpayCheckout = (window as any).Razorpay;
      if (!RazorpayCheckout) {
        reject(new Error("Razorpay checkout is unavailable."));
        return;
      }
      const checkout = new RazorpayCheckout({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "DELIVIX",
        description: `Order ${getOrderNumber(order)}`,
        order_id: payment.order?.id,
        prefill: {
          name: form.fullName,
          email: form.email,
          contact: form.phoneNo,
        },
        notes: { orderId: order._id },
        theme: { color: "#111111" },
        handler: async (response: any) => {
          try {
            const updated = await verifyRazorpayPayment({
              orderId: order._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            finishOrder(updated);
            resolve();
          } catch (error: any) {
            reject(new Error(error.message || "Payment verification failed."));
          }
        },
        modal: {
          ondismiss: () =>
            reject(
              new Error(
                "Payment was cancelled. Your order is saved and can be paid from My Orders."
              )
            ),
        },
      });
      checkout.on("payment.failed", (response: any) => {
        reject(
          new Error(
            response?.error?.description ||
              "The payment failed. Your order is saved and can be retried from My Orders."
          )
        );
      });
      checkout.open();
    });
  };

  const placeOrder = async () => {
    if (placing || !cartItems.length) return;
    if (quoteLoading) {
      setPlaceError("Please wait while we confirm the order total.");
      return;
    }
    if (quoteError) {
      setPlaceError(quoteError);
      return;
    }

    setPlacing(true);
    setPlaceError(null);
    let createdOrder: OrderRecord | null = null;

    try {
      const result = await createOrder(
        {
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            size: item.size,
            variantName: item.variantName,
          })),
          shippingInfo: {
            ...form,
            address: form.addressLine1,
          },
          shippingMethod,
          packagingOption: "standard",
          currency,
          couponCode: appliedCoupon?.code || undefined,
          paymentMethod,
        },
        idempotencyKey.current
      );
      createdOrder = result.order;
      await saveNewAddress();
      onOrderComplete();

      if (paymentMethod === "COD") {
        finishOrder(createdOrder);
        toast.success("Order placed successfully.");
        return;
      }

      if (paymentMethod === "Razorpay") {
        await payWithRazorpay(createdOrder);
        toast.success("Payment verified. Your order is confirmed.");
        return;
      }

      const session = await createStripePayment(createdOrder._id);
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(session.url);
    } catch (error: any) {
      const message = error.message || "We could not complete your order.";
      if (createdOrder) {
        setPlacedOrder(createdOrder);
        setPaymentWarning(message);
        setStep(3);
      } else {
        setPlaceError(message);
      }
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!placedOrder) return;
    try {
      const invoice = await fetchOrderInvoice(placedOrder._id);
      if (!printInvoice(invoice)) {
        toast.error("Please allow pop-ups to print the invoice.");
      }
    } catch (error: any) {
      toast.error(error.message || "Could not load the invoice.");
    }
  };

  const viewOrder = () => {
    if (placedOrder) {
      try {
        sessionStorage.setItem("delivix_account_tab", "My orders");
        sessionStorage.setItem("delivix_focus_order", placedOrder._id);
      } catch {}
    }
    setPage("account");
  };

  if (!hasToken) {
    return (
      <main className="checkout checkout-v2">
        <div className="checkout__top">
          <button className="wordmark" onClick={() => setPage("home")}>
            DELIVIX<span>.</span>
          </button>
          <span>SECURE CHECKOUT</span>
        </div>
        <section className="checkout-gate">
          <p className="eyebrow">Sign in required</p>
          <h1>Your bag is ready.</h1>
          <p>
            Sign in to your DELIVIX account so we can attach this order to your order
            history and send you tracking updates.
          </p>
          <div className="button-row">
            <button className="button button--primary" onClick={() => setPage("account")}>
              Sign in to continue
            </button>
            <button className="button button--secondary" onClick={() => setPage("cart")}>
              Back to bag
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (step === 3 && placedOrder) {
    const paid = ["Paid", "Partially Refunded", "Refunded"].includes(
      String(placedOrder.paymentStatus)
    );
    return (
      <main className="checkout-success checkout-success-v2">
        <div className="success-mark">
          <span aria-hidden="true">✓</span>
        </div>
        <p className="eyebrow">{paid ? "Order confirmed" : "Order saved"}</p>
        <h1>{paid ? "Thank you." : "We saved your order."}</h1>
        <p>
          Your order <strong>{getOrderNumber(placedOrder)}</strong>{" "}
          {paid
            ? "is confirmed. We will send tracking details as soon as it is on the move."
            : "has been created. Complete payment from My Orders when you are ready."}
        </p>
        <div className="success-card">
          <span>Order number</span>
          <strong>{getOrderNumber(placedOrder)}</strong>
          <small>
            {placedOrder.paymentMethod} · {placedOrder.paymentStatus} ·{" "}
            {orderMoney(placedOrder.totalAmount, placedOrder.currency)}
          </small>
        </div>
        {paymentWarning ? <p className="checkout-warning">{paymentWarning}</p> : null}
        <div className="button-row">
          <button className="button button--primary" onClick={viewOrder}>
            View my order
          </button>
          <button className="button button--secondary" onClick={handlePrintInvoice}>
            Print invoice
          </button>
          <button className="button button--secondary" onClick={() => setPage("home")}>
            Continue shopping
          </button>
        </div>
      </main>
    );
  }

  if (!cartItems.length) {
    return (
      <main className="checkout checkout-v2">
        <div className="checkout__top">
          <button className="wordmark" onClick={() => setPage("home")}>
            DELIVIX<span>.</span>
          </button>
          <span>SECURE CHECKOUT</span>
        </div>
        <section className="checkout-gate">
          <p className="eyebrow">Your bag</p>
          <h1>Your bag is empty.</h1>
          <p>Add something you love before checking out.</p>
          <div className="button-row">
            <button className="button button--primary" onClick={() => setPage("shop")}>
              Explore the collection
            </button>
          </div>
        </section>
      </main>
    );
  }

  const totals = quote?.amounts;
  const displayCurrency = totals?.currency || currency;
  const fallbackSubtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  return (
    <main className="checkout checkout-v2">
      <div className="checkout__top">
        <button className="wordmark" onClick={() => setPage("home")}>
          DELIVIX<span>.</span>
        </button>
        <button className="checkout-back-link" onClick={() => setPage("cart")}>
          Back to bag
        </button>
      </div>

      <div className="checkout-progress">
        {["Delivery", "Payment", "Confirmation"].map((label, index) => (
          <div className={step >= index + 1 ? "active" : ""} key={label}>
            <span>{step > index + 1 ? "✓" : index + 1}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>

      <div className="checkout-grid">
        <section>
          <p className="eyebrow">Step {step} of 3</p>
          <h1>{step === 1 ? "Where should we send it?" : "How would you like to pay?"}</h1>

          {authError ? (
            <div className="checkout-alert checkout-alert--error">
              {authError}{" "}
              <button onClick={() => setPage("account")}>Sign in again</button>
            </div>
          ) : null}

          {step === 1 ? (
            <form className="checkout-form" onSubmit={continueToPayment}>
              {loadingAccount ? (
                <div className="checkout-loading">Loading your saved addresses…</div>
              ) : null}

              {addresses.length > 0 && !showNewAddress ? (
                <div className="checkout-address-list">
                  <div className="checkout-section-label">
                    <span>Saved addresses</span>
                    <button type="button" onClick={startNewAddress}>
                      Use a new address
                    </button>
                  </div>
                  {addresses.map((address) => {
                    const id = String(address._id || "");
                    const selected = selectedAddressId === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`checkout-address-option${selected ? " is-selected" : ""}`}
                        onClick={() => selectAddress(address)}
                      >
                        <span className="checkout-address-radio" aria-hidden="true" />
                        <span>
                          <strong>{address.fullName}</strong>
                          <small>
                            {[address.street || address.address, address.landmark, address.city]
                              .filter(Boolean)
                              .join(", ")}
                          </small>
                          <small>
                            {[address.state, address.zipCode || address.pinCode, address.country]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                          <small>{address.phoneNo || address.phone}</small>
                        </span>
                      </button>
                    );
                  })}
                  {selectedAddressId !== "new" ? (
                    <div className="checkout-address-actions">
                      <button type="button" className="text-link" onClick={startNewAddress}>
                        Deliver to a different address
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="checkout-section-label">
                    <span>Delivery details</span>
                    {addresses.length > 0 ? (
                      <button type="button" onClick={() => setShowNewAddress(false)}>
                        Use a saved address
                      </button>
                    ) : null}
                  </div>
                  <div className="field-row">
                    <label>
                      Full name
                      <input
                        required
                        value={form.fullName}
                        onChange={(event) => updateForm("fullName", event.target.value)}
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        required
                        value={form.phoneNo}
                        onChange={(event) => updateForm("phoneNo", event.target.value)}
                        autoComplete="tel"
                      />
                    </label>
                  </div>
                  <label>
                    Email address
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Street address
                    <input
                      required
                      value={form.addressLine1}
                      onChange={(event) => updateForm("addressLine1", event.target.value)}
                      placeholder="House / flat number and street"
                      autoComplete="address-line1"
                    />
                  </label>
                  <div className="field-row">
                    <label>
                      Apartment / landmark
                      <input
                        value={form.landmark}
                        onChange={(event) => updateForm("landmark", event.target.value)}
                        placeholder="Optional"
                        autoComplete="address-line2"
                      />
                    </label>
                    <label>
                      City
                      <input
                        required
                        value={form.city}
                        onChange={(event) => updateForm("city", event.target.value)}
                        autoComplete="address-level2"
                      />
                    </label>
                  </div>
                  <div className="field-row">
                    <label>
                      State / region
                      <input
                        value={form.state}
                        onChange={(event) => updateForm("state", event.target.value)}
                        autoComplete="address-level1"
                      />
                    </label>
                    <label>
                      Postal / PIN code
                      <input
                        required
                        value={form.zipCode}
                        onChange={(event) => updateForm("zipCode", event.target.value)}
                        autoComplete="postal-code"
                      />
                    </label>
                  </div>
                  <label>
                    Country
                    <select
                      value={form.country}
                      onChange={(event) => updateForm("country", event.target.value)}
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                  {addresses.length === 0 ? (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(event) => setSaveAddress(event.target.checked)}
                      />
                      Save this address to my account
                    </label>
                  ) : null}
                </>
              )}

              <div className="checkout-delivery-options">
                <span className="checkout-section-label">Delivery method</span>
                <button
                  type="button"
                  className={`checkout-delivery-option${shippingMethod === "standard" ? " is-selected" : ""}`}
                  onClick={() => {
                    setShippingMethod("standard");
                    setQuote(null);
                  }}
                >
                  <span>
                    <strong>Standard delivery</strong>
                    <small>5–7 business days · free in India</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`checkout-delivery-option${shippingMethod === "express" ? " is-selected" : ""}`}
                  onClick={() => {
                    setShippingMethod("express");
                    setQuote(null);
                  }}
                >
                  <span>
                    <strong>Express delivery</strong>
                    <small>2–3 business days · calculated at payment</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              </div>

              {placeError ? (
                <div className="checkout-alert checkout-alert--error">{placeError}</div>
              ) : null}

              <button className="button button--primary full" type="submit">
                Continue to payment
              </button>
            </form>
          ) : (
            <div className="payment-options checkout-payment-options">
              {paymentOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  disabled={!option.enabled}
                  className={`${paymentMethod === option.id ? "selected" : ""}${option.enabled ? "" : " is-disabled"}`}
                  onClick={() => option.enabled && setPaymentMethod(option.id)}
                >
                  <span>
                    <b>{option.title}</b>
                    <small>{option.note || option.description}</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              ))}

              {/* ── Coupon section ───────────────────────────────────── */}
              <div className="checkout-coupon">
                <p className="checkout-section-label">Have a coupon code?</p>
                {appliedCoupon ? (
                  <div className="checkout-coupon--applied">
                    <span>Applied: <b>{appliedCoupon.code}</b> ({appliedCoupon.name})</span>
                    <small>
                      − {orderMoney(appliedCoupon.discountAmount, displayCurrency)}{appliedCoupon.shippingDiscount > 0 ? ` + free shipping (−${orderMoney(appliedCoupon.shippingDiscount, displayCurrency)})` : ""}
                    </small>
                    <button type="button" className="checkout-remove-coupon" onClick={removeCoupon}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input
                      className="checkout-input"
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                      disabled={couponApplying}
                      maxLength={30}
                    />
                    <button
                      className="button button--primary"
                      onClick={applyCoupon}
                      disabled={couponApplying || !couponCode.trim()}
                    >
                      {couponApplying ? "Applying…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && (
                  <div className="checkout-alert checkout-alert--error">{couponError}</div>
                )}
              </div>

              {quoteLoading ? (
                <div className="checkout-loading">Confirming prices and stock…</div>
              ) : null}
              {quoteError ? (
                <div className="checkout-alert checkout-alert--error">
                  {quoteError}
                  <button type="button" onClick={() => setQuote(null)}>
                    Try again
                  </button>
                </div>
              ) : null}
              {placeError ? (
                <div className="checkout-alert checkout-alert--error">{placeError}</div>
              ) : null}

              <button
                className="button button--primary full"
                type="button"
                onClick={placeOrder}
                disabled={placing || quoteLoading || Boolean(quoteError)}
              >
                {placing
                  ? "Processing…"
                  : paymentMethod === "COD"
                    ? `Place order · ${orderMoney(totals?.totalAmount ?? fallbackSubtotal, displayCurrency)}`
                    : `Pay ${orderMoney(totals?.totalAmount ?? fallbackSubtotal, displayCurrency)}`}
              </button>
              <button
                className="checkout-back-button"
                type="button"
                onClick={() => setStep(1)}
                disabled={placing}
              >
                ← Back to delivery
              </button>
              <small className="checkout-secure-note">
                🔒 Secure, encrypted checkout. Payments are verified on our server.
              </small>
            </div>
          )}
        </section>

        <aside className="checkout-summary">
          <p className="eyebrow">Your order · {itemCount} item(s)</p>
          {cartItems.map((item) => (
            <div className="mini-item" key={item.key}>
              <img src={item.image} alt="" />
              <span>
                <strong>{item.name}</strong>
                <small>{item.label} · Qty {item.quantity}</small>
              </span>
              <b>{orderMoney(item.price * item.quantity, "INR")}</b>
            </div>
          ))}
          <div className="summary-lines">
            <div>
              <span>Subtotal</span>
              <strong>{orderMoney(totals?.itemsPrice ?? fallbackSubtotal, displayCurrency)}</strong>
            </div>
            {Number(totals?.discountAmount) ? (
              <div>
                <span>Discount</span>
                <strong>− {orderMoney(totals?.discountAmount, displayCurrency)}</strong>
              </div>
            ) : null}
            <div>
              <span>Tax</span>
              <strong>
                {totals ? orderMoney(totals.taxAmount, displayCurrency) : "Calculated at checkout"}
              </strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>
                {totals
                  ? (totals.payableShipping ??
                      Math.max(
                        0,
                        totals.shippingAmount - (totals.shippingDiscount || 0)
                      )) > 0
                    ? orderMoney(
                        totals.payableShipping ??
                          Math.max(
                            0,
                            totals.shippingAmount - (totals.shippingDiscount || 0)
                          ),
                        displayCurrency
                      )
                    : "Free"
                  : shippingMethod === "express"
                    ? "Calculated at checkout"
                    : "Free"}
              </strong>
            </div>
            {Number(totals?.packagingAmount) ? (
              <div>
                <span>Packaging</span>
                <strong>{orderMoney(totals?.packagingAmount, displayCurrency)}</strong>
              </div>
            ) : null}
            <div>
              <span>Total</span>
              <strong>{orderMoney(totals?.totalAmount ?? fallbackSubtotal, displayCurrency)}</strong>
            </div>
          </div>
          <small className="checkout-summary-note">
            {quote?.shipping?.details || "Taxes and delivery are confirmed before payment."}
          </small>
        </aside>
      </div>
    </main>
  );
}
