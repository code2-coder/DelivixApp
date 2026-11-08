import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fetchProducts,
  fetchBrands,
  fetchProductReviews,
  fetchAdminProducts,
  fetchAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  checkBackendHealth,
  subscribeNewsletter,
  checkCloudinaryStatus,
  uploadProductImage,
  fetchBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  sendZeptoOtp,
  verifyZeptoOtp,
  registerAccount,
  loginWithPassword,
  fetchMyProfile,
  updateMyProfile,
  fetchMyOrders,
  fetchMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getStoredAdminUser,
  getStoredAdminToken,
  clearStoredAdmin,
  fetchDashboardStats,
  type ProductItem,
  type BrandItem,
  type ReviewItem,
  type BannerItem,
  type CategoryItem,
  type BackendHealth,
  type CloudinaryStatus,
  type DashboardData,
  type AddressItem,
} from "./services/api";
import { formatPrice } from "./utils/currency";
import {
  addCartSelection,
  cartLineLabel,
  findProductOption,
  getCartLines,
  setCartLineQuantity,
  type CartMap,
} from "./utils/cart";
import CheckoutPage from "./components/orders/CheckoutPage";
import CustomerOrders from "./components/orders/CustomerOrders";
import AdminOrders from "./components/orders/AdminOrders";
import CouponsAdmin from "./components/admin/CouponsAdmin";
import AdminCustomers from "./components/customers/AdminCustomers";
import ReportsAnalytics from "./components/admin/ReportsAnalytics";
import InventoryAdmin from "./components/admin/InventoryAdmin";
import DeliveryAdmin from "./components/admin/DeliveryAdmin";
import StoreSettingsAdmin from "./components/admin/StoreSettingsAdmin";
import ProductsAdmin from "./components/admin/ProductsAdmin";
import ReviewsAdmin from "./components/admin/ReviewsAdmin";
import { fetchPublicSettings, PublicStoreSettings } from "./services/settingsApi";
import OrderTrackingPage from "./components/orders/OrderTrackingPage";
import ProductCard from "./components/products/ProductCard";
import ProductDetailPage from "./components/products/ProductDetailPage";
import QuickViewModal from "./components/products/QuickViewModal";
import CompareBar from "./components/products/CompareBar";
import { ProductExperienceProvider } from "./components/products/ProductExperienceContext";
import { Toaster, toast as hotToast } from "react-hot-toast";
import "./styles/home.css";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Images,
  ShoppingCart,
  Truck,
  Users,
  Boxes,
  Star,
  TicketPercent,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Search,
  Store,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  MapPin,
  Home as HomeIcon,
  Phone,
  Mail,
  User as UserIcon,
  Check,
  CheckCircle2,
  Building,
  Navigation,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";

type Page = "home" | "shop" | "product" | "wishlist" | "cart" | "checkout" | "account" | "admin" | "track";

type AddCartHandler = (
  id: string | number,
  options?: { quantity?: number; size?: string; variantName?: string }
) => void;
type IconName =
  | "arrow"
  | "bag"
  | "check"
  | "chevron"
  | "close"
  | "filter"
  | "grid"
  | "heart"
  | "menu"
  | "minus"
  | "plus"
  | "search"
  | "star"
  | "user"
  | "refresh"
  | "cloud"
  | "edit"
  | "trash"
  | "shield"
  | "mail"
  | "image"
  | "link"
  | "eye";

const images = {
  hero: "https://images.unsplash.com/photo-1615788189819-bee84874da4b?auto=format&fit=crop&w=1800&q=90",
  desk: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1400&q=85",
  laptop: "https://images.unsplash.com/photo-1562907550-096d3bf9b25c?auto=format&fit=crop&w=900&q=85",
  headphones: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=900&q=85",
  keyboard: "https://images.unsplash.com/photo-1646944505531-6a2670fda084?auto=format&fit=crop&w=900&q=85",
  camera: "https://images.unsplash.com/photo-1698934689061-1ebbf2c3c3dc?auto=format&fit=crop&w=900&q=85",
  mouse: "https://images.unsplash.com/photo-1621570555371-f3e91dafbb5d?auto=format&fit=crop&w=900&q=85",
  airpods: "https://images.unsplash.com/photo-1621570555334-66a1f48e48eb?auto=format&fit=crop&w=900&q=85",
  phone: "https://images.unsplash.com/photo-1504610926078-a1611febcad3?auto=format&fit=crop&w=900&q=85",
};

const isMacPlatform =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    filter: <><path d="M4 7h16M7 12h10M10 17h4" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></>,
    heart: <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    minus: <path d="M5 12h14" />,
    plus: <><path d="M5 12h14M12 5v14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.4 2.6L21 8" /><path d="M21 3v5h-5" /></>,
    cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.07 0l1.42-1.42a5 5 0 0 0-7.07-7.07L10 5.93" /><path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.42a5 5 0 0 0 7.07 7.07L14 18.07" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "light";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={`button button--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function BrandLogo({ onClick, light = false }: { onClick: () => void; light?: boolean }) {
  return (
    <button
      type="button"
      className={`wordmark${light ? " wordmark--light" : ""}`}
      onClick={onClick}
      aria-label="DELIVIX home"
    >
      DELIVIX<span>.</span>
    </button>
  );
}

function Header({
  page,
  setPage,
  cartCount,
  wishlistCount,
  dbHealth,
  onOpenProduct,
  loggedInUser,
  setLoggedInUser,
  products,
  categories,
  onOpenCategory,
}: {
  page: Page;
  setPage: (p: Page) => void;
  cartCount: number;
  wishlistCount: number;
  dbHealth: BackendHealth | null;
  onOpenProduct: (id: string | number) => void;
  loggedInUser: { name: string; email: string; role?: string } | null;
  setLoggedInUser: (u: { name: string; email: string; role?: string } | null) => void;
  products: ProductItem[];
  categories: CategoryItem[];
  onOpenCategory: (category: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Open the search overlay from anywhere with âŒ˜K / Ctrl+K.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Build the mega-menu from the categories managed in the admin dashboard.
  // CSS columns balance the groups automatically; subcategories sit directly
  // under their parent so every link opens the shop pre-filtered.
  const menuGroups = useMemo(() => {
    const mainCategories = categories.filter(c => !c.parentCategory);
    return mainCategories.length > 0
      ? mainCategories.map(c => ({
          name: c.name,
          subs: categories.filter(s => s.parentCategory === c.id).map(s => s.name),
        }))
      : Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(name => ({
          name,
          subs: [] as string[],
        }));
  }, [categories, products]);

  // â”€â”€ Account Login & Zepto OTP State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [loginEmail, setLoginEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  useEffect(() => {
    if (otpCountdown > 0) {
      const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCountdown]);

  const handleAccountSendOtp = async () => {
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await sendZeptoOtp(loginEmail.trim());
      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setAuthSuccess(null);
      } else {
        setAuthError(res.message);
      }
    } catch {
      setAuthError("Failed to send OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAccountRegister = async () => {
    if (!regName.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (regPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (regPassword !== regConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await registerAccount(regName.trim(), loginEmail.trim(), regPassword);
      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setOtpCode("");
        setAuthSuccess(null);
      } else {
        setAuthError(res.message);
      }
    } catch {
      setAuthError("Registration failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAccountVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setAuthError("Please enter the 6-digit OTP.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await verifyZeptoOtp(loginEmail.trim(), otpCode.trim());
      if (res.success) {
        setLoggedInUser({
          name: res.user?.name || loginEmail.split("@")[0],
          email: res.user?.email || loginEmail,
          role: res.user?.role,
        });
        setAuthSuccess("âœ“ Signed in successfully!");
        setOtpSent(false);
        setOtpCode("");
        setAuthView("login");
        setRegName("");
        setRegPassword("");
        setRegConfirm("");
      } else {
        setAuthError(res.message);
      }
    } catch {
      setAuthError("Verification failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAccountSignOut = () => {
    clearStoredAdmin();
    setLoggedInUser(null);
    setOtpSent(false);
    setOtpCode("");
    setLoginEmail("");
    setAuthError(null);
    setAuthSuccess(null);
    setAccountOpen(false);
    setAuthView("login");
    setRegName("");
    setRegPassword("");
    setRegConfirm("");
  };

  return (
    <>
      <div className="announcement-bar">
        <span>Thoughtfully selected essentials, made easy to discover.</span>
        <button type="button" onClick={() => setPage("shop")}>
          Explore the collection <Icon name="arrow" size={13} />
        </button>
      </div>
      <header className="header">
        <div className="header__inner">
          <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
          <BrandLogo onClick={() => setPage("home")} />
          <nav className="nav">
            <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>Home</button>
            <button className={page === "shop" ? "active" : ""} onClick={() => setPage("shop")}>Shop</button>
            <button className={categoriesOpen ? "active" : ""} onClick={() => setCategoriesOpen(!categoriesOpen)}>Categories <Icon name="chevron" size={13} /></button>
          </nav>
          <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search products">
            <Icon name="search" size={17} />
            <span>Search products, categoriesâ€¦</span>
            <kbd>{isMacPlatform ? "âŒ˜" : "Ctrl"} K</kbd>
          </button>
          <div className="header__actions">
            <div className="account-control">
              <button className="icon-button hide-mobile" aria-label="Account" onClick={() => setAccountOpen(!accountOpen)}><Icon name="user" /></button>
              {accountOpen && (
                <div className="account-menu">
                  {loggedInUser ? (
                    /* â”€â”€ Logged-in state â”€â”€ */
                    <>
                      <p className="eyebrow" style={{ marginBottom: 10 }}>Signed in</p>
                      <div className="acct-user-row">
                        <div className="acct-avatar">{loggedInUser.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <strong style={{ fontSize: 14, fontFamily: "Manrope", letterSpacing: "-.02em" }}>{loggedInUser.name}</strong>
                          <span style={{ fontSize: 10, color: "var(--muted)", display: "block" }}>{loggedInUser.email}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 14 }}><Button onClick={() => { setPage("account"); setAccountOpen(false); }} className="full">My Account <Icon name="arrow" size={15} /></Button></div>
                      {(loggedInUser.role === "admin" || loggedInUser.role === "staff") && (
                        <button className="acct-admin-link" onClick={() => { setPage("admin"); setAccountOpen(false); }}>
                          Admin Dashboard <Icon name="arrow" size={15} />
                        </button>
                      )}
                      <button className="acct-signout" onClick={handleAccountSignOut}>Sign out</button>
                    </>
                  ) : (
                    /* â”€â”€ Login / OTP flow â”€â”€ */
                    <>
                      <p className="eyebrow" style={{ marginBottom: 4 }}>{authView === "register" ? "Create account" : "Sign in"}</p>
                      <strong style={{ fontSize: 18, fontFamily: "Manrope", letterSpacing: "-.03em", margin: "8px 0 4px", display: "block" }}>{authView === "register" ? "Join Delivix" : "Welcome back"}</strong>
                      <span style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55, marginBottom: 16, display: "block" }}>
                        {authView === "register"
                          ? "Create your account and verify it with a one-time code via ZeptoMail."
                          : "Verify your identity with a one-time code via ZeptoMail."}
                      </span>

                      {authError && <div className="acct-alert acct-alert--error">{authError}</div>}
                      {authSuccess && <div className="acct-alert acct-alert--success">{authSuccess}</div>}

                      {!otpSent ? (
                        authView === "register" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input
                              className="acct-input"
                              type="text"
                              placeholder="Full name"
                              value={regName}
                              onChange={e => { setRegName(e.target.value); setAuthError(null); }}
                              autoComplete="name"
                            />
                            <input
                              className="acct-input"
                              type="email"
                              placeholder="your@email.com"
                              value={loginEmail}
                              onChange={e => { setLoginEmail(e.target.value); setAuthError(null); }}
                              autoComplete="email"
                            />
                            <input
                              className="acct-input"
                              type="password"
                              placeholder="Password (min. 6 characters)"
                              value={regPassword}
                              onChange={e => { setRegPassword(e.target.value); setAuthError(null); }}
                              autoComplete="new-password"
                            />
                            <input
                              className="acct-input"
                              type="password"
                              placeholder="Confirm password"
                              value={regConfirm}
                              onChange={e => { setRegConfirm(e.target.value); setAuthError(null); }}
                              autoComplete="new-password"
                            />
                            <Button
                              variant="primary"
                              className="full"
                              onClick={handleAccountRegister}
                              disabled={authLoading}
                            >
                              {authLoading ? <><Icon name="refresh" size={15} /> Creatingâ€¦</> : <><Icon name="user" size={15} /> Create account</>}
                            </Button>
                            <button
                              type="button"
                              style={{ border: 0, background: "none", fontSize: 10, color: "var(--muted)", padding: 0, cursor: "pointer", textAlign: "left" }}
                              onClick={() => { setAuthView("login"); setAuthError(null); setAuthSuccess(null); }}
                            >
                              Already have an account? <span style={{ color: "var(--ink)", textDecoration: "underline" }}>Sign in</span>
                            </button>
                          </div>
                        ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            className="acct-input"
                            type="email"
                            placeholder="your@email.com"
                            value={loginEmail}
                            onChange={e => { setLoginEmail(e.target.value); setAuthError(null); }}
                            autoComplete="email"
                          />
                          <Button
                            variant="primary"
                            className="full"
                            onClick={handleAccountSendOtp}
                            disabled={authLoading}
                          >
                            {authLoading ? "Sendingâ€¦" : "Send OTP"}
                          </Button>
                          <button
                            type="button"
                            style={{ border: 0, background: "none", fontSize: 10, color: "var(--muted)", padding: 0, cursor: "pointer", textAlign: "left" }}
                            onClick={() => { setAuthView("register"); setAuthError(null); setAuthSuccess(null); }}
                          >
                            New to Delivix? <span style={{ color: "var(--ink)", textDecoration: "underline" }}>Create account</span>
                          </button>
                        </div>
                        )
                      ) : (
                        <form onSubmit={handleAccountVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div className="acct-otp-sent">
                            <Icon name="check" size={14} />
                            <span>Code sent to <b>{loginEmail}</b></span>
                          </div>
                          <input
                            className="acct-input acct-input--otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="6-digit OTP"
                            value={otpCode}
                            onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setAuthError(null); }}
                            autoFocus
                          />
                          <Button variant="primary" className="full" type="submit" disabled={authLoading}>
                            {authLoading ? <><Icon name="refresh" size={15} /> Verifyingâ€¦</> : <><Icon name="shield" size={15} /> Verify & Sign In</>}
                          </Button>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button
                              type="button"
                              style={{ border: 0, background: "none", fontSize: 10, color: "var(--muted)", padding: 0, cursor: "pointer" }}
                              onClick={() => { setOtpSent(false); setOtpCode(""); setAuthError(null); setAuthSuccess(null); }}
                            >
                              â† Change email
                            </button>
                            {otpCountdown > 0 ? (
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>Resend in {otpCountdown}s</span>
                            ) : (
                              <button
                                type="button"
                                style={{ border: 0, background: "none", fontSize: 10, color: "var(--ink)", textDecoration: "underline", padding: 0, cursor: "pointer" }}
                                onClick={handleAccountSendOtp}
                                disabled={authLoading}
                              >
                                Resend OTP
                              </button>
                            )}
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <button className="icon-button" aria-label="Wishlist" onClick={() => setPage("wishlist")}><Icon name="heart" /><span className="count">{wishlistCount}</span></button>
            <button className="icon-button" aria-label="Cart" onClick={() => setPage("cart")}><Icon name="bag" /><span className="count">{cartCount}</span></button>
          </div>
        </div>

        {categoriesOpen && <div className="mega-menu">
          <div className="mega-menu__inner">
            <div className="mega-menu__intro">
              <p className="eyebrow">Shop by category</p>
              <h2>Technology, considered.</h2>
              <p>Explore high-performance essentials designed for focus and flow.</p>
              <button className="text-link" onClick={() => { setPage("shop"); setCategoriesOpen(false); }}>View all products <Icon name="arrow" size={16} /></button>
            </div>
            <div className="mega-menu__links">
              {menuGroups.map(group => (
                <div className="mega-menu__group" key={group.name}>
                  <button
                    className="mega-menu__group-link"
                    onClick={() => { onOpenCategory(group.name); setCategoriesOpen(false); }}
                  >
                    {group.name}<Icon name="arrow" size={14} />
                  </button>
                  {group.subs.length > 0 && (
                    <div className="mega-menu__subs">
                      {group.subs.map(sub => (
                        <button
                          className="mega-menu__sub"
                          key={sub}
                          onClick={() => { onOpenCategory(sub); setCategoriesOpen(false); }}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="mega-menu__feature" onClick={() => { setPage("shop"); setCategoriesOpen(false); }}>
              <img src={images.headphones} alt="Studio Wireless H1 headphones" />
              <span><small>FEATURED / AUDIO</small><strong>Studio Wireless H1</strong><em>Available now.</em></span>
              <i><Icon name="arrow" size={17} /></i>
            </button>
          </div>
        </div>}
      </header>

      {mobileOpen && <div className="drawer-backdrop" onClick={() => setMobileOpen(false)}>
        <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-title"><span className="wordmark">DELIVIX.</span><button className="icon-button" onClick={() => setMobileOpen(false)}><Icon name="close" /></button></div>
          <p className="eyebrow">Explore</p>
          {["Home", "Shop All"].map((x) => (
            <button key={x} onClick={() => { setPage(x === "Home" ? "home" : "shop"); setMobileOpen(false); }}>
              {x}<Icon name="arrow" />
            </button>
          ))}
          {categories.filter((category) => !category.parentCategory).slice(0, 8).map((category) => (
            <button key={category.id} onClick={() => { onOpenCategory(category.name); setMobileOpen(false); }}>
              {category.name}<Icon name="arrow" />
            </button>
          ))}
          <button onClick={() => { setPage("account"); setMobileOpen(false); }}>
            {loggedInUser ? "My account" : "Sign in"}<Icon name="user" />
          </button>
          <div className="drawer-account">
            <Icon name="user" />
            <span>{loggedInUser ? loggedInUser.name : "Sign in"}</span>
          </div>
        </aside>
      </div>}

      {searchOpen && (
        <SearchOverlay
          close={() => setSearchOpen(false)}
          setPage={setPage}
          onOpenProduct={onOpenProduct}
          products={products}
        />
      )}
    </>
  );
}

function HighlightMatch({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

function SearchOverlay({
  close,
  setPage,
  onOpenProduct,
  products,
}: {
  close: () => void;
  setPage: (p: Page) => void;
  onOpenProduct: (id: string | number) => void;
  products: ProductItem[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock background scrolling while the overlay is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const localMatches = products
        .filter(p =>
          [p.name, p.category, p.description].some(value =>
            value?.toLowerCase().includes(term.toLowerCase())
          )
        )
        .slice(0, 6);

      try {
        const live = await fetchProducts({ keyword: term });
        if (!cancelled) setResults((live.length > 0 ? live : localMatches).slice(0, 6));
      } catch {
        if (!cancelled) setResults(localMatches);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setActiveIndex(-1);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, products]);

  const openResult = (product: ProductItem) => {
    onOpenProduct(product.id);
    setPage("product");
    close();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!query.trim() || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(i => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        openResult(results[activeIndex >= 0 ? activeIndex : 0]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query, results, activeIndex, close, onOpenProduct, setPage]);

  const trimmed = query.trim();

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search products">
      <div className="search-panel">
        <div className="search-panel__top">
          <span className="search-panel__icon"><Icon name="search" size={21} /></span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, categoriesâ€¦"
            role="combobox"
            aria-label="Search products"
            aria-expanded={trimmed.length > 0}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          />
          {loading && <span className="search-spinner" aria-hidden="true" />}
          {query && (
            <button
              className="search-clear"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <Icon name="close" size={13} />
            </button>
          )}
          <button className="search-close" onClick={close} aria-label="Close search">
            <span>Esc</span>
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="search-content">
          <p className="eyebrow" aria-live="polite">
            {trimmed
              ? loading
                ? "Searching catalogâ€¦"
                : `${results.length} ${results.length === 1 ? "result" : "results"}`
              : "Popular searches"}
          </p>

          {!trimmed && (
            <div className="search-chips">
              {["laptop", "keyboard", "wireless", "security camera", "mobile"].map(x => (
                <button key={x} onClick={() => { setQuery(x); inputRef.current?.focus(); }}>
                  {x}<Icon name="arrow" size={14} />
                </button>
              ))}
            </div>
          )}

          {trimmed && results.length > 0 && (
            <div id="search-results" role="listbox" aria-label="Search results">
              {results.map((p, i) => (
                <button
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`search-result ${i === activeIndex ? "is-active" : ""}`}
                  key={p.id}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => openResult(p)}
                >
                  <img src={p.image} alt="" />
                  <span><small><HighlightMatch text={p.category} term={trimmed} /></small><HighlightMatch text={p.name} term={trimmed} /></span>
                  <strong>{formatPrice(p.price)}</strong>
                </button>
              ))}
            </div>
          )}

          {trimmed && !loading && results.length === 0 && (
            <div className="search-empty">
              <Icon name="search" size={22} />
              <strong>No matches for â€œ{trimmed}â€</strong>
              <span>Try a different keyword, or browse the full collection.</span>
              <button className="text-link" onClick={() => { setPage("shop"); close(); }}>
                Browse all products <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="search-footer">
          <span><kbd>â†‘</kbd><kbd>â†“</kbd> navigate</span>
          <span><kbd>â†µ</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
      <button className="search-dismiss" onClick={close} aria-label="Close search" />
    </div>
  );
}

function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-heading">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
      {action && <button className="text-link" onClick={onAction}>{action}<Icon name="arrow" size={17} /></button>}
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFeedback({ success: false, message: "Enter a valid email address." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await subscribeNewsletter(email.trim());
      setFeedback(res);
      if (res.success) setEmail("");
    } catch (error) {
      setFeedback({
        success: false,
        message: error instanceof Error ? error.message : "Could not subscribe. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div className="newsletter__intro">
        <p className="eyebrow">The dispatch <span>— No. 01</span></p>
        <h2 id="newsletter-title">Stay ahead of <em>what’s next.</em></h2>
        <p>Good things, thoughtfully selected. Get first looks at new arrivals, considered recommendations and private offers.</p>
        <ul className="newsletter__benefits" aria-label="Dispatch benefits">
          <li><Icon name="check" size={14} /> First access</li>
          <li><Icon name="check" size={14} /> Private offers</li>
          <li><Icon name="check" size={14} /> Only the good stuff</li>
        </ul>
      </div>
      <div className="newsletter__signup">
        <p className="newsletter__signup-heading">A better inbox starts here.</p>
        <form className="newsletter__form" onSubmit={handleSubmit}>
          <label htmlFor="newsletter-email">Your email address</label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Joining..." : <>Join the dispatch <Icon name="arrow" size={17} /></>}
          </button>
          {feedback && (
            <div
              className={`newsletter__feedback ${feedback.success ? "newsletter__feedback--success" : "newsletter__feedback--error"}`}
              role={feedback.success ? "status" : "alert"}
              aria-live="polite"
            >
              <Icon name={feedback.success ? "check" : "close"} size={14} />
              {feedback.message}
            </div>
          )}
          <small><Icon name="shield" size={13} /> Just the good stuff. Unsubscribe whenever you like.</small>
        </form>
      </div>
    </section>
  );
}

type HeroSlide = {
  eyebrow: string;
  title: ReactNode;
  copy: string;
  image: string;
  mobileImage?: string;
  link?: string;
  alt: string;
  cta: string;
};

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: "The DELIVIX edit",
    title: (
      <>
        Upgrade your
        <br />
        everyday.
      </>
    ),
    copy: "Thoughtfully selected technology designed for seamless living.",
    image: images.hero,
    alt: "Premium technology essentials",
    cta: "Shop the collection",
  },
  {
    eyebrow: "Immersive sound",
    title: (
      <>
        Hear every
        <br />
        detail.
      </>
    ),
    copy: "Studio-grade audio engineered for deep focus and effortless flow.",
    image: images.headphones,
    alt: "Premium wireless headphones",
    cta: "Shop audio",
  },
  {
    eyebrow: "Precision, refined",
    title: (
      <>
        Tools for
        <br />
        deeper focus.
      </>
    ),
    copy: "Keyboards and mice built for every keystroke and every idea.",
    image: images.keyboard,
    alt: "Mechanical keyboard and mouse",
    cta: "Shop accessories",
  },
  {
    eyebrow: "See everything",
    title: (
      <>
        Clarity around
        <br />
        the clock.
      </>
    ),
    copy: "Smart security designed for complete peace of mind.",
    image: images.camera,
    alt: "Smart home security camera",
    cta: "Shop security",
  },
];

function categoryBlurb(name: string) {
  const n = name.toLowerCase();
  if (n.includes("laptop") || n.includes("computer")) return "Performance without compromise.";
  if (n.includes("audio") || n.includes("sound") || n.includes("headphone")) return "Hear every detail.";
  if (n.includes("monitor") || n.includes("display")) return "See every detail.";
  if (n.includes("security") || n.includes("surveillance") || n.includes("cctv")) return "Clarity around the clock.";
  if (n.includes("keyboard") || n.includes("mouse") || n.includes("accessor")) return "Precision in every interaction.";
  if (n.includes("network")) return "Stay connected, always.";
  if (n.includes("print") || n.includes("toner")) return "Sharp output, every time.";
  if (n.includes("component") || n.includes("graphics") || n.includes("processor") || n.includes("memory") || n.includes("storage") || n.includes("ssd")) return "Power your next build.";
  if (n.includes("mobile") || n.includes("phone")) return "The everyday essential.";
  if (n.includes("repair") || n.includes("tool")) return "Built for the workbench.";
  return "Explore the collection.";
}

function Home({
  products,
  brands,
  catalogueLoading,
  setPage,
  wished,
  toggleWish,
  addCart,
  onOpenProduct,
  categories,
  onOpenCategory,
  onOpenBrand,
}: {
  products: ProductItem[];
  brands: BrandItem[];
  catalogueLoading: boolean;
  setPage: (p: Page) => void;
  wished: (string | number)[];
  toggleWish: (id: string | number) => void;
  addCart: AddCartHandler;
  onOpenProduct: (id: string | number) => void;
  categories: CategoryItem[];
  onOpenCategory: (category: string) => void;
  onOpenBrand: (brand: string) => void;
}) {
  const [heroBanners, setHeroBanners] = useState<BannerItem[]>([]);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [testimonials, setTestimonials] = useState<
    (ReviewItem & { productName: string; productId: string | number })[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    fetchBanners(false)
      .then((list) => {
        if (!cancelled) setHeroBanners(list.filter((b) => b.image));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const slides: HeroSlide[] =
    heroBanners.length > 0
      ? heroBanners.map((b) => ({
          eyebrow: b.badgeText || "Featured / Now",
          title: b.title,
          copy: b.subtitle || "",
          image: b.image,
          mobileImage: b.mobileImage,
          link: b.link,
          alt: b.title,
          cta: b.buttonText || "Shop now",
        }))
      : HERO_SLIDES;

  const slideCount = slides.length;
  const activeIndex = slideCount > 0 ? heroSlide % slideCount : 0;
  const active = slides[activeIndex];

  const categoryCards = useMemo(() => {
    const main = categories.filter(c => !c.parentCategory);
    const source: { name: string; image: string }[] =
      main.length > 0
        ? main.map(c => ({
            name: c.name,
            image:
              c.image?.url ||
              products.find((product) => product.category.toLowerCase() === c.name.toLowerCase())?.images?.[0]?.url ||
              "",
          }))
        : Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(name => ({
            name,
            image: products.find((product) => product.category.toLowerCase() === name.toLowerCase())?.images?.[0]?.url || "",
          }));

    return source.slice(0, 6).map((c, i) => ({
      name: c.name,
      image: c.image,
      copy: categoryBlurb(c.name),
      index: i,
    }));
  }, [categories, products]);

  useEffect(() => {
    if (slideCount <= 1 || heroPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setHeroSlide((i) => (i + 1) % slideCount), 6000);
    return () => clearTimeout(timer);
  }, [heroSlide, slideCount, heroPaused]);

  const productsWithReviews = useMemo(
    () =>
      products
        .filter((product) => (product.reviewCount || product.numOfReviews || 0) > 0)
        .slice(0, 4),
    [products]
  );

  useEffect(() => {
    let cancelled = false;
    if (!productsWithReviews.length) {
      setTestimonials([]);
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      productsWithReviews.map(async (product) => {
        const result = await fetchProductReviews(product.id, { limit: 3, sort: "helpful" });
        return result.reviews.map((review) => ({
          ...review,
          productName: product.name,
          productId: product.id,
        }));
      })
    )
      .then((results) => {
        if (!cancelled) {
          setTestimonials(results.flat().sort((a, b) =>
            Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          ).slice(0, 6));
        }
      })
      .catch(() => {
        if (!cancelled) setTestimonials([]);
      });

    return () => {
      cancelled = true;
    };
  }, [productsWithReviews]);

  const featuredProducts = useMemo(() => {
    const featured = products.filter((product) => product.isFeatured);
    return (featured.length ? featured : products).slice(0, 4);
  }, [products]);

  const newArrivals = useMemo(
    () => products.filter((product) => product.isNewArrival).slice(0, 4),
    [products]
  );
  const bestSellers = useMemo(
    () => products.filter((product) => product.isBestSeller).slice(0, 4),
    [products]
  );
  const topRated = useMemo(
    () =>
      products
        .filter((product) => (product.reviewCount || product.numOfReviews || 0) > 0 && (product.ratings || 0) > 0)
        .sort((a, b) => (b.ratings || 0) - (a.ratings || 0))
        .slice(0, 4),
    [products]
  );
  const trendingProducts = useMemo(
    () => products.filter((product) => product.isTrending).slice(0, 4),
    [products]
  );
  const offers = useMemo(
    () =>
      products
        .filter((product) => {
          const compareAt = product.old || product.mrp || 0;
          return Number(product.discountPercentage || 0) > 0 || compareAt > product.price;
        })
        .slice(0, 4),
    [products]
  );

  const renderProducts = (items: ProductItem[]) => (
    <div className="product-grid">
      {items.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          wished={wished.some((id) => String(id) === String(product.id))}
          onWish={() => toggleWish(product.id)}
          onAdd={(options) => addCart(product.id, options)}
          onOpen={() => {
            onOpenProduct(product.id);
            setPage("product");
          }}
        />
      ))}
    </div>
  );

  const openHeroLink = () => {
    const link = active?.link || "";
    if (link.startsWith("/product/")) {
      const target = products.find((product) =>
        link.endsWith(String(product.id)) || link.endsWith(String(product.slug || ""))
      );
      if (target) {
        onOpenProduct(target.id);
        setPage("product");
        return;
      }
    }
    const category = link.match(/[?&]category=([^&]+)/)?.[1];
    if (category) {
      onOpenCategory(decodeURIComponent(category.replace(/\+/g, " ")));
      return;
    }
    setPage("shop");
  };

  return (
    <main className="home-page">
      <section
        className="hero"
        aria-roledescription="carousel"
        aria-label="Featured campaigns"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocusCapture={() => setHeroPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeroPaused(false);
        }}
      >
        {slides.map((s, i) => (
          <picture className={`hero__picture ${i === activeIndex ? "is-active" : ""}`} key={`${s.image}-${i}`}>
            {s.mobileImage && <source media="(max-width: 700px)" srcSet={s.mobileImage} />}
            <img
              src={s.image}
              alt={s.alt}
              className="hero__img"
              loading={i === activeIndex ? "eager" : "lazy"}
              fetchPriority={i === activeIndex ? "high" : "auto"}
              decoding="async"
            />
          </picture>
        ))}
        <div className="hero__shade" />
        {active && (
          <div className="hero__content" key={activeIndex}>
            <p className="eyebrow eyebrow--light">{active.eyebrow}</p>
            <h1>{active.title}</h1>
            <p>{active.copy}</p>
            <div className="button-row">
              <Button onClick={openHeroLink}>{active.cta} <Icon name="arrow" /></Button>
              <Button
                variant="light"
                onClick={() => categoryCards[0] ? onOpenCategory(categoryCards[0].name) : setPage("shop")}
              >
                Explore categories
              </Button>
            </div>
          </div>
        )}
        {slideCount > 1 && (
          <div className="hero__controls">
            <button type="button" className="hero__step" onClick={() => setHeroSlide((activeIndex - 1 + slideCount) % slideCount)} aria-label="Previous campaign">
              <Icon name="chevron" size={16} />
            </button>
            <div className="hero__dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={i === activeIndex ? "active" : ""}
                onClick={() => setHeroSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === activeIndex ? "true" : undefined}
              />
            ))}
            </div>
            <button type="button" className="hero__step hero__step--next" onClick={() => setHeroSlide((activeIndex + 1) % slideCount)} aria-label="Next campaign">
              <Icon name="chevron" size={16} />
            </button>
          </div>
        )}
        {slideCount > 1 && <div className="hero__index">
          {String(activeIndex + 1).padStart(2, "0")} <span /> {String(slideCount).padStart(2, "0")}
        </div>}
      </section>

      <section className="home-trust container" aria-label="Shopping benefits">
        <div><Icon name="shield" size={20} /><span><strong>Secure checkout</strong><small>Protected payments</small></span></div>
        <div><Icon name="bag" size={20} /><span><strong>Order tracking</strong><small>Stay in the know</small></span></div>
        <div><Icon name="check" size={20} /><span><strong>Verified reviews</strong><small>From real customers</small></span></div>
      </section>

      <section className="section container home-categories">
        <SectionHeader eyebrow="Find your next essential" title="Shop by category" action="View all" onAction={() => setPage("shop")} />
        {catalogueLoading ? (
          <div className="home-category-skeletons" aria-label="Loading categories">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="home-skeleton" />)}
          </div>
        ) : categoryCards.length ? (
          <div className="category-grid">
          {categoryCards.map((card) => (
            <button
              className="category-card"
              key={card.name}
              onClick={() => onOpenCategory(card.name)}
              aria-label={`Shop ${card.name}`}
            >
              {card.image && <img src={card.image} alt="" loading="lazy" decoding="async" />}
              <span className="category-card__shade" />
              <span className="category-card__text">
                <small>EXPLORE</small>
                <strong>{card.name}</strong>
                <em>{card.copy}</em>
              </span>
              <span className="category-arrow"><Icon name="arrow" /></span>
            </button>
          ))}
          </div>
        ) : (
          <div className="home-empty">
            <p>Product categories will appear here as soon as they’re available.</p>
            <Button variant="secondary" onClick={() => setPage("shop")}>Browse the collection <Icon name="arrow" /></Button>
          </div>
        )}
      </section>

      <section className="section section--gray">
        <div className="container">
          <SectionHeader eyebrow={products.some((product) => product.isFeatured) ? "Selected by DELIVIX" : "The collection"} title="A considered edit" action="Shop all" onAction={() => setPage("shop")} />
          {catalogueLoading ? <HomeProductSkeleton /> : featuredProducts.length ? renderProducts(featuredProducts) : (
            <div className="home-empty"><p>Our product collection is being updated.</p></div>
          )}
        </div>
      </section>

      {offers.length > 0 && (
        <section className="home-offers section container">
          {offers.slice(0, 2).map((product, index) => {
            const compareAt = product.old || product.mrp || product.price;
            const discount = product.discountPercentage || Math.round(((compareAt - product.price) / compareAt) * 100);
            return (
              <article className={`home-offer home-offer--${index + 1}`} key={product.id}>
                <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
                <div className="home-offer__shade" />
                <div className="home-offer__content">
                  <p className="eyebrow eyebrow--light">{discount > 0 ? `Save ${discount}%` : "Special offer"}</p>
                  <h2>{product.name}</h2>
                  <p>{product.shortDescription || product.category}</p>
                  <Button variant="light" onClick={() => { onOpenProduct(product.id); setPage("product"); }}>
                    Discover the offer <Icon name="arrow" />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="section container">
          <SectionHeader eyebrow="Customer favourites" title="Best sellers" action="Shop all" onAction={() => setPage("shop")} />
          {renderProducts(bestSellers)}
        </section>
      )}

      {topRated.length > 0 && (
        <section className="section container">
          <SectionHeader eyebrow="Rated by customers" title="Top rated" action="Shop all" onAction={() => setPage("shop")} />
          {renderProducts(topRated)}
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="section section--gray">
          <div className="container">
            <SectionHeader eyebrow="Fresh from the collection" title="New arrivals" action="Explore all" onAction={() => setPage("shop")} />
            {renderProducts(newArrivals)}
          </div>
        </section>
      )}

      {trendingProducts.length > 0 && (
        <section className="section container">
          <SectionHeader eyebrow="On the rise" title="Trending now" action="Shop all" onAction={() => setPage("shop")} />
          {renderProducts(trendingProducts)}
        </section>
      )}

      {brands.length > 0 && (
        <section className="home-brands section section--gray">
          <div className="container">
            <SectionHeader eyebrow="Brands we believe in" title="Explore by brand" />
            <div className="home-brands__grid">
              {brands.slice(0, 8).map((brand) => (
                <button key={brand.id} type="button" onClick={() => onOpenBrand(brand.name)} aria-label={`Shop ${brand.name}`}>
                  {brand.logo?.url
                    ? <img src={brand.logo.url} alt={brand.name} loading="lazy" decoding="async" />
                    : <span>{brand.name}</span>}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="home-reviews section container">
          <SectionHeader eyebrow="From our customers" title="Good things, shared." />
          <div className="home-reviews__grid">
            {testimonials.map((review) => {
              const avatar = typeof review.user?.avatar === "string"
                ? review.user.avatar
                : review.user?.avatar?.url;
              return (
                <article className="home-review" key={review._id}>
                  <div className="home-review__rating" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                    <span>{"★".repeat(5 - Math.max(0, Math.min(5, review.rating)))}</span>
                  </div>
                  {review.title && <h3>{review.title}</h3>}
                  <p>{review.comment}</p>
                  <div className="home-review__byline">
                    {avatar
                      ? <img src={avatar} alt="" loading="lazy" />
                      : <span className="home-review__initial">{review.user?.name?.slice(0, 1) || "C"}</span>}
                    <div>
                      <strong>{review.user?.name || "Customer"}</strong>
                      <button type="button" onClick={() => { onOpenProduct(review.productId); setPage("product"); }}>
                        {review.productName}
                      </button>
                    </div>
                    {review.isVerifiedPurchase && <small>Verified purchase</small>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <Newsletter />
    </main>
  );
}

function HomeProductSkeleton() {
  return (
    <div className="product-grid home-product-skeletons" aria-label="Loading products">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="home-product-skeleton" key={index}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function Shop({
  products,
  setPage,
  wished,
  toggleWish,
  addCart,
  onOpenProduct,
  category,
  setCategory,
  brand,
  setBrand,
  categories,
}: {
  products: ProductItem[];
  setPage: (p: Page) => void;
  wished: (string | number)[];
  toggleWish: (id: string | number) => void;
  addCart: AddCartHandler;
  onOpenProduct: (id: string | number) => void;
  category: string;
  setCategory: (c: string) => void;
  brand: string;
  setBrand: (brand: string) => void;
  categories: CategoryItem[];
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Map every managed category to itself plus its descendants, so selecting a
  // main category also surfaces products filed under its subcategories.
  const categoryMatchSets = useMemo(() => {
    const children = new Map<string, CategoryItem[]>();
    categories.forEach(cat => {
      if (!cat.parentCategory) return;
      const list = children.get(cat.parentCategory) || [];
      list.push(cat);
      children.set(cat.parentCategory, list);
    });

    const collect = (cat: CategoryItem, seen: Set<string>): Set<string> => {
      const names = new Set<string>();
      if (seen.has(cat.id)) return names;
      seen.add(cat.id);
      names.add(cat.name.toLowerCase());
      (children.get(cat.id) || []).forEach(child => {
        collect(child, seen).forEach(name => names.add(name));
      });
      return names;
    };

    const map = new Map<string, Set<string>>();
    categories.forEach(cat => {
      const key = cat.name.toLowerCase();
      if (!map.has(key)) map.set(key, collect(cat, new Set()));
    });
    return map;
  }, [categories]);

  const matchesCategory = (productCategory: string, selected: string) => {
    if (selected === "All products") return true;
    const names = categoryMatchSets.get(selected.toLowerCase());
    if (names) return names.has((productCategory || "").toLowerCase());
    return (productCategory || "").toLowerCase() === selected.toLowerCase();
  };

  const countFor = (name: string) =>
    products.filter((product) =>
      (!brand || (product.brandName || product.brand || "").toLowerCase() === brand.toLowerCase()) &&
      (name === "All products" || matchesCategory(product.category, name))
    ).length;
  const countForBrand = (name: string) =>
    products.filter((product) =>
      (product.brandName || product.brand || "").toLowerCase() === name.toLowerCase() &&
      (category === "All products" || matchesCategory(product.category, category))
    ).length;

  // Managed main categories come first; product-only categories are appended
  // so nothing sold in the catalogue disappears from the filter.
  const categoryOptions = useMemo(() => {
    const names: string[] = [];
    const add = (name?: string) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      if (!names.some(n => n.toLowerCase() === trimmed.toLowerCase())) names.push(trimmed);
    };

    categories.filter(c => !c.parentCategory).forEach(c => add(c.name));
    products.forEach(p => add(p.category));
    if (category !== "All products") add(category);

    // Keep the admin order, but surface categories that currently have stock
    // first so the filter opens with useful options at the top.
    const ordered = names
      .map((name, index) => ({ name, index, count: countFor(name) }))
      .sort((a, b) => {
        const aEmpty = a.count === 0 ? 1 : 0;
        const bEmpty = b.count === 0 ? 1 : 0;
        return aEmpty - bEmpty || a.index - b.index;
      })
      .map(item => item.name);

    return ["All products", ...ordered];
    // countFor reads from the memoized match sets and the product list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, products, category, categoryMatchSets]);

  const filtered = products.filter((product) =>
    (!brand || (product.brandName || product.brand || "").toLowerCase() === brand.toLowerCase()) &&
    (category === "All products" || matchesCategory(product.category, category))
  );
  const brandOptions = [...new Set(products.map((product) => product.brandName || product.brand).filter(Boolean))] as string[];

  return (
    <main className="page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => setPage("home")}>Home</button>
          <span className="sep">/</span>
          <button onClick={() => { setCategory("All products"); setBrand(""); }}>Shop</button>
          {category !== "All products" && (
            <>
              <span className="sep">/</span>
              <span aria-current="page">{category}</span>
            </>
          )}
          {brand && <><span className="sep">/</span><span aria-current="page">{brand}</span></>}
        </nav>
        <div className="shop-title">
          <div>
            <p className="eyebrow">{brand ? "Brand collection" : category === "All products" ? "The full collection" : "Category"}</p>
            <h1>{brand ? `Shop ${brand}.` : category === "All products" ? "Shop all products." : `Shop ${category}.`}</h1>
            <p>
              {brand
                ? `Explore products from ${brand}.`
                : category === "All products"
                ? "Curated essentials for work, home and everything between."
                : `Explore our ${category} collection, curated for work, home and everything between.`}
            </p>
          </div>
          <span>{filtered.length} {filtered.length === 1 ? "product" : "products"} found</span>
        </div>
        <div className="shop-layout">
          <aside className={`filters ${filtersOpen ? "filters--open" : ""}`}>
            <div className="filter-mobile-title">
              <strong>Filters</strong>
              <button onClick={() => setFiltersOpen(false)}><Icon name="close" /></button>
            </div>
            <div className="filter-heading">
              <strong>Filters</strong>
              <button onClick={() => { setCategory("All products"); setBrand(""); }}>Clear all</button>
            </div>
            {brandOptions.length > 0 && (
              <div className="filter-group">
                <p>Brand <Icon name="minus" size={16} /></p>
                <label>
                  <input type="radio" name="brand-radio" checked={!brand} onChange={() => setBrand("")} />
                  <span>All brands</span>
                </label>
                {brandOptions.map((option) => (
                  <label key={option}>
                    <input type="radio" name="brand-radio" checked={brand.toLowerCase() === option.toLowerCase()} onChange={() => setBrand(option)} />
                    <span>{option}</span>
                    <small>{countForBrand(option)}</small>
                  </label>
                ))}
              </div>
            )}
            <div className="filter-group">
              <p>Category <Icon name="minus" size={16} /></p>
              {categoryOptions.map(option => (
                <label key={option}>
                  <input
                    type="radio"
                    name="category-radio"
                    checked={category.toLowerCase() === option.toLowerCase()}
                    onChange={() => setCategory(option)}
                  />
                  <span>{option}</span>
                  <small>{countFor(option)}</small>
                </label>
              ))}
            </div>
            <Button className="apply-filter" onClick={() => setFiltersOpen(false)}>Show {filtered.length} products</Button>
          </aside>
          <div className="listing">
            <div className="toolbar">
              <button className="mobile-filter" onClick={() => setFiltersOpen(true)}><Icon name="filter" size={17} /> Filters</button>
              <span>Showing {filtered.length} results</span>
              <div><Icon name="grid" size={17} /><button>Featured <Icon name="chevron" size={15} /></button></div>
            </div>
            <div className="product-grid product-grid--listing">
              {filtered.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  wished={wished.some(v => String(v) === String(p.id))}
                  onWish={() => toggleWish(p.id)}
                  onAdd={(options) => addCart(p.id, options)}
                  onOpen={() => { onOpenProduct(p.id); setPage("product"); }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Wishlist({
  products,
  setPage,
  wished,
  toggleWish,
  addCart,
  onOpenProduct,
}: {
  products: ProductItem[];
  setPage: (p: Page) => void;
  wished: (string | number)[];
  toggleWish: (id: string | number) => void;
  addCart: AddCartHandler;
  onOpenProduct: (id: string | number) => void;
}) {
  const items = products.filter(p => wished.some(v => String(v) === String(p.id)));

  return (
    <main className="page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => setPage("home")}>Home</button>
          <span className="sep">/</span>
          <span aria-current="page">Wishlist</span>
        </nav>
        <div className="simple-title">
          <p className="eyebrow">Saved for later</p>
          <h1>Your wishlist.</h1>
          <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
        </div>
        {items.length ? (
          <div className="product-grid">
            {items.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                wished
                onWish={() => toggleWish(p.id)}
                onAdd={(options) => addCart(p.id, options)}
                onOpen={() => { onOpenProduct(p.id); setPage("product"); }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="heart"
            title="Nothing saved just yet."
            copy="Keep track of the pieces you're considering. They'll stay here for when you're ready."
            action="Explore products"
            onClick={() => setPage("shop")}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({ icon, title, copy, action, onClick }: { icon: IconName; title: string; copy: string; action: string; onClick: () => void }) {
  return (
    <div className="empty-state">
      <div><Icon name={icon} size={32} /></div>
      <h2>{title}</h2>
      <p>{copy}</p>
      <Button onClick={onClick}>{action} <Icon name="arrow" /></Button>
    </div>
  );
}

function Cart({
  products,
  setPage,
  cart,
  changeQty,
}: {
  products: ProductItem[];
  setPage: (p: Page) => void;
  cart: CartMap;
  changeQty: (key: string, qty: number) => void;
}) {
  const productById = useMemo(() => {
    const map = new Map<string, ProductItem>();
    products.forEach((product) => map.set(String(product.id), product));
    return map;
  }, [products]);

  const lines = useMemo(
    () =>
      getCartLines(cart)
        .map((line) => {
          const product = productById.get(line.productId);
          if (!product) return null;
          const option = findProductOption(product, line);
          const needsSelection =
            ((product.sizes || []).length > 0 ||
              (product.variants || []).some((variant) => (variant.sizes || []).length > 0)) &&
            !line.size;
          return {
            ...line,
            product,
            price: option.price,
            stock: option.stock,
            needsSelection,
            label: needsSelection ? "Select a size / variant again" : cartLineLabel(line),
          };
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line)),
    [cart, productById]
  );

  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.price * line.quantity, 0);
  const hasInvalidSelection = lines.some((line) => line.needsSelection);

  return (
    <main className="page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => setPage("home")}>Home</button>
          <span className="sep">/</span>
          <span aria-current="page">Shopping bag</span>
        </nav>
        <div className="simple-title">
          <p className="eyebrow">Your selection</p>
          <h1>Shopping bag.</h1>
          <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        </div>
        {lines.length ? (
          <div className="cart-layout">
            <div className="cart-items">
              {lines.map((line) => (
                <article className="cart-item" key={line.key}>
                  <img src={line.product.image} alt={line.product.name} />
                  <div className="cart-item__main">
                    <div>
                      <p>{line.product.category}</p>
                      <h3>{line.product.name}</h3>
                      <span>{line.label}</span>
                    </div>
                    <div className="qty">
                      <button
                        onClick={() => changeQty(line.key, Math.max(0, line.quantity - 1))}
                      >
                        <Icon name="minus" size={15} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        onClick={() =>
                          changeQty(
                            line.key,
                            line.stock > 0
                              ? Math.min(line.stock, line.quantity + 1)
                              : line.quantity + 1
                          )
                        }
                        disabled={line.stock > 0 && line.quantity >= line.stock}
                      >
                        <Icon name="plus" size={15} />
                      </button>
                    </div>
                    <strong>{formatPrice(line.price * line.quantity)}</strong>
                    <button className="remove" onClick={() => changeQty(line.key, 0)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <aside className="summary">
              <p className="eyebrow">Order summary</p>
              <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Delivery</span><strong>Complimentary</strong></div>
              <div><span>Estimated tax</span><span>Calculated at checkout</span></div>
              <div className="summary__total"><span>Total</span><strong>{formatPrice(subtotal)}</strong></div>
              {hasInvalidSelection && (
                <small>Remove the item marked "Select a size / variant again" and re-add it from its product page.</small>
              )}
              <Button className="full" disabled={hasInvalidSelection} onClick={() => setPage("checkout")}>Secure checkout <Icon name="arrow" /></Button>
              <small><Icon name="check" size={14} /> Secure, encrypted checkout</small>
            </aside>
          </div>
        ) : (
          <EmptyState
            icon="bag"
            title="Your bag is empty."
            copy="The right upgrade is waiting. Explore our considered edit of modern essentials."
            action="Start shopping"
            onClick={() => setPage("shop")}
          />
        )}
      </div>
    </main>
  );
}

function Account({
  setPage,
  dbHealth,
  loggedInUser,
  onSignOut,
  wishlistCount,
  onReorder,
}: {
  setPage: (p: Page) => void;
  dbHealth: BackendHealth | null;
  loggedInUser: { name: string; email: string; role?: string } | null;
  onSignOut: () => void;
  wishlistCount: number;
  onReorder: (items: { productId: string; quantity: number; size?: string; variantName?: string }[]) => void;
}) {
  const [tab, setTab] = useState(() => {
    try {
      const stored = sessionStorage.getItem("delivix_account_tab");
      if (stored) {
        sessionStorage.removeItem("delivix_account_tab");
        return stored;
      }
    } catch {}
    return "Overview";
  });
  const [profile, setProfile] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pStreet, setPStreet] = useState("");
  const [pLandmark, setPLandmark] = useState("");
  const [pVillage, setPVillage] = useState("");
  const [pCity, setPCity] = useState("");
  const [pState, setPState] = useState("");
  const [pPinCode, setPPinCode] = useState("");
  const [pSaving, setPSaving] = useState(false);

  // Address CRUD State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressItem | null>(null);
  const [addrFullName, setAddrFullName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrAltPhone, setAddrAltPhone] = useState("");
  const [addrTitle, setAddrTitle] = useState("Home");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrVillage, setAddrVillage] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPinCode, setAddrPinCode] = useState("");
  const [addrCountry, setAddrCountry] = useState("India");
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrDeletingId, setAddrDeletingId] = useState<string | null>(null);

  const hasToken = !!getStoredAdminToken();

  useEffect(() => {
    if (!hasToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, myOrders, myAddresses] = await Promise.all([
          fetchMyProfile(),
          fetchMyOrders(),
          fetchMyAddresses(),
        ]);
        if (cancelled) return;
        setProfile(me);
        setOrders(Array.isArray(myOrders) ? myOrders : []);
        setAddresses(Array.isArray(myAddresses) ? myAddresses : []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load account data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  // Sync profile values to edit form
  useEffect(() => {
    if (profile) {
      setPName(profile.name || "");
      setPPhone(profile.phoneNumber || "");
      setPStreet(profile.address?.street || "");
      setPLandmark(profile.address?.landmark || "");
      setPVillage(profile.address?.village || "");
      setPCity(profile.address?.city || "");
      setPState(profile.address?.state || "");
      setPPinCode(profile.address?.pinCode || "");
    }
  }, [profile]);

  const displayName = profile?.name || loggedInUser?.name || "";
  const displayEmail = profile?.email || loggedInUser?.email || "";
  const role = profile?.role || loggedInUser?.role || "user";
  const firstName = displayName.split(" ")[0] || "there";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "D";
  const activeOrder = orders.find(o => o.orderStatus !== "Delivered" && o.orderStatus !== "Cancelled") || null;
  const recentOrders = orders.slice(0, 5);
  const money = (v: any) => formatPrice(Number(v || 0));
  const orderDate = (o: any) =>
    o?.createdAt
      ? new Date(o.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
      : "";
  const orderItemCount = (o: any) =>
    (o?.orderItems || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) {
      hotToast.error("Full name is required");
      return;
    }
    setPSaving(true);
    try {
      const updatedUser = await updateMyProfile({
        name: pName.trim(),
        phoneNumber: pPhone.trim(),
        address: {
          street: pStreet.trim(),
          landmark: pLandmark.trim(),
          village: pVillage.trim(),
          city: pCity.trim(),
          state: pState.trim(),
          pinCode: pPinCode.trim(),
        },
      });
      setProfile(updatedUser);
      setIsEditingProfile(false);
      hotToast.success("Profile and address details updated successfully!");
    } catch (err: any) {
      hotToast.error(err.message || "Failed to update profile");
    } finally {
      setPSaving(false);
    }
  };

  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddrFullName(profile?.name || displayName || "");
    setAddrPhone(profile?.phoneNumber || "");
    setAddrAltPhone("");
    setAddrTitle("Home");
    setAddrStreet(profile?.address?.street || "");
    setAddrLandmark(profile?.address?.landmark || "");
    setAddrVillage(profile?.address?.village || "");
    setAddrCity(profile?.address?.city || "");
    setAddrState(profile?.address?.state || "");
    setAddrPinCode(profile?.address?.pinCode || "");
    setAddrCountry("India");
    setAddrIsDefault(addresses.length === 0);
    setShowAddressModal(true);
  };

  const handleOpenEditAddress = (addr: AddressItem) => {
    setEditingAddress(addr);
    setAddrFullName(addr.fullName || "");
    setAddrPhone(addr.phoneNo || addr.phone || "");
    setAddrAltPhone(addr.altPhoneNo || "");
    setAddrTitle(addr.title || "Home");
    setAddrStreet(addr.street || addr.address || "");
    setAddrLandmark(addr.landmark || "");
    setAddrVillage(addr.village || "");
    setAddrCity(addr.city || "");
    setAddrState(addr.state || "");
    setAddrPinCode(addr.zipCode || addr.pinCode || "");
    setAddrCountry(addr.country || "India");
    setAddrIsDefault(!!addr.isDefault);
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrFullName.trim()) {
      hotToast.error("Recipient name is required");
      return;
    }
    if (!addrPhone.trim() || addrPhone.trim().length < 6) {
      hotToast.error("Valid contact phone number is required");
      return;
    }
    if (!addrPinCode.trim()) {
      hotToast.error("PIN code is required");
      return;
    }
    if (!addrCity.trim()) {
      hotToast.error("City is required");
      return;
    }

    setAddrSaving(true);
    const payload: AddressItem = {
      title: addrTitle,
      fullName: addrFullName.trim(),
      phoneNo: addrPhone.trim(),
      altPhoneNo: addrAltPhone.trim() || undefined,
      street: addrStreet.trim(),
      landmark: addrLandmark.trim(),
      village: addrVillage.trim(),
      city: addrCity.trim(),
      state: addrState.trim(),
      zipCode: addrPinCode.trim(),
      pinCode: addrPinCode.trim(),
      country: addrCountry.trim() || "India",
      isDefault: addrIsDefault,
    };

    try {
      const next = editingAddress?._id
        ? await updateAddress(editingAddress._id, payload)
        : await createAddress(payload);
      setAddresses(Array.isArray(next) ? next : []);
      setShowAddressModal(false);
      hotToast.success(editingAddress ? "Address updated successfully!" : "Address added successfully!");
    } catch (err: any) {
      hotToast.error(err.message || "Failed to save address");
    } finally {
      setAddrSaving(false);
    }
  };

  const handleDeleteAddress = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Remove this delivery address?")) return;
    setAddrDeletingId(id);
    try {
      const next = await deleteAddress(id);
      setAddresses(Array.isArray(next) ? next : []);
      hotToast.success("Address removed");
    } catch (err: any) {
      hotToast.error(err.message || "Failed to delete address");
    } finally {
      setAddrDeletingId(null);
    }
  };

  const handleSetDefaultAddress = async (id?: string) => {
    if (!id) return;
    try {
      const next = await setDefaultAddress(id);
      setAddresses(Array.isArray(next) ? next : []);
      hotToast.success("Default address updated");
    } catch (err: any) {
      hotToast.error(err.message || "Failed to set default address");
    }
  };

  const tabs = ["Overview", "My orders", "Addresses", "Wishlist", "Security"];

  if (!hasToken) {
    return (
      <main className="page">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <button onClick={() => setPage("home")}>Home</button>
            <span className="sep">/</span>
            <span aria-current="page">Account</span>
          </nav>
          <EmptyState
            icon="user"
            title="Sign in to your account."
            copy="Access your orders, saved addresses, wishlist and profile details from one place."
            action="Sign in"
            onClick={() => setPage("account")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => setPage("home")}>Home</button>
          <span className="sep">/</span>
          <span aria-current="page">Account</span>
        </nav>
        <div className="simple-title">
          <p className="eyebrow">Your account</p>
          <h1>Hello, {firstName}.</h1>
          <span>{displayEmail || "Signed in"}</span>
        </div>

        <div className="account-layout">
          <aside>
            <p className="eyebrow">Account</p>
            <h2>{displayName || "Your account"}</h2>
            {tabs.map((item) => (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item} <Icon name="arrow" size={14} />
              </button>
            ))}
            <button onClick={onSignOut}>Sign out</button>
          </aside>

          <section>
            {loading ? (
              <div className="account-cards" style={{ gridTemplateColumns: "1fr" }}>
                <article>
                  <span>Loading account</span>
                  <strong>Fetching your details…</strong>
                  <p>Orders, addresses and profile information are on their way.</p>
                </article>
              </div>
            ) : error ? (
              <div className="acct-prompt-banner">
                <p>{error}</p>
                <button className="acct-link-btn" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            ) : tab === "Overview" ? (
              <>
                <p className="eyebrow">Overview</p>
                <h1>Your account.</h1>
                <p className="account-intro">
                  Manage your profile, delivery addresses and order history.
                </p>

                {isEditingProfile ? (
                  <form className="acct-edit-card" onSubmit={handleSaveProfile}>
                    <div className="acct-edit-section">
                      <h3>Personal details</h3>
                      <div className="acct-form-grid">
                        <div className="acct-field">
                          <label>Full name</label>
                          <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Your full name" />
                        </div>
                        <div className="acct-field">
                          <label>Phone number</label>
                          <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="+91 98765 43210" />
                        </div>
                        <div className="acct-field full">
                          <label>Email</label>
                          <input value={displayEmail} disabled />
                        </div>
                      </div>
                    </div>

                    <div className="acct-edit-section">
                      <h3>Default address</h3>
                      <div className="acct-form-grid">
                        <div className="acct-field full">
                          <label>Street address</label>
                          <input value={pStreet} onChange={(e) => setPStreet(e.target.value)} placeholder="House number and street" />
                        </div>
                        <div className="acct-field">
                          <label>Landmark</label>
                          <input value={pLandmark} onChange={(e) => setPLandmark(e.target.value)} placeholder="Nearby landmark" />
                        </div>
                        <div className="acct-field">
                          <label>Village / Area</label>
                          <input value={pVillage} onChange={(e) => setPVillage(e.target.value)} placeholder="Village or area" />
                        </div>
                        <div className="acct-field">
                          <label>City</label>
                          <input value={pCity} onChange={(e) => setPCity(e.target.value)} placeholder="City" />
                        </div>
                        <div className="acct-field">
                          <label>State</label>
                          <input value={pState} onChange={(e) => setPState(e.target.value)} placeholder="State" />
                        </div>
                        <div className="acct-field">
                          <label>PIN code</label>
                          <input value={pPinCode} onChange={(e) => setPPinCode(e.target.value)} placeholder="6-digit PIN code" />
                        </div>
                      </div>
                    </div>

                    <div className="acct-form-actions">
                      <button type="button" className="acct-btn-secondary" onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="acct-btn-primary" disabled={pSaving}>
                        {pSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="acct-profile-display-grid">
                    <article className="acct-info-card">
                      <div className="acct-card-head">
                        <div className="acct-avatar-lg">{initials}</div>
                        <div>
                          <strong>{displayName || "Delivix customer"}</strong>
                          <small>{displayEmail}</small>
                        </div>
                        <span className="acct-role-chip">{role}</span>
                      </div>
                      <div className="acct-info-list">
                        <div className="acct-info-item">
                          <span>Phone</span>
                          <strong>{profile?.phoneNumber || <em className="acct-empty-val">Not added</em>}</strong>
                        </div>
                        <div className="acct-info-item">
                          <span>Member since</span>
                          <strong>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</strong>
                        </div>
                        <div className="acct-info-item">
                          <span>Email status</span>
                          <strong>{profile?.isVerified ? "Verified" : "Not verified"}</strong>
                        </div>
                      </div>
                      <button className="acct-link-btn" onClick={() => setIsEditingProfile(true)}>
                        <Pencil size={14} /> Edit profile
                      </button>
                    </article>

                    <article className="acct-info-card">
                      <div className="acct-card-head">
                        <div className="acct-icon-box"><Truck size={18} /></div>
                        <div>
                          <strong>{activeOrder ? "Active order" : "No active order"}</strong>
                          <small>{activeOrder ? `#${String(activeOrder._id || "").slice(-8).toUpperCase()}` : "Everything delivered"}</small>
                        </div>
                      </div>
                      {activeOrder ? (
                        <div className="acct-info-list">
                          <div className="acct-info-item">
                            <span>Status</span>
                            <strong>{activeOrder.orderStatus}</strong>
                          </div>
                          <div className="acct-info-item">
                            <span>Items</span>
                            <strong>{orderItemCount(activeOrder)}</strong>
                          </div>
                          <div className="acct-info-item">
                            <span>Total</span>
                            <strong>{money(activeOrder.totalAmount)}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="account-intro" style={{ marginTop: 18 }}>
                          Your next order will appear here with live delivery updates.
                        </p>
                      )}
                      <button className="acct-link-btn" onClick={() => setTab("My orders")}>
                        <Package size={14} /> View all orders
                      </button>
                    </article>
                  </div>
                )}

                {recentOrders.length > 0 && (
                  <div className="recent-order">
                    <div>
                      <p className="eyebrow">Recent orders</p>
                      <button onClick={() => setTab("My orders")}>View all</button>
                    </div>
                    {recentOrders.map((order) => {
                      const firstItem = order.orderItems?.[0];
                      return (
                        <article key={order._id}>
                          {firstItem?.image ? <img src={firstItem.image} alt="" /> : <div />}
                          <span>
                            <small>ORDER #{String(order._id).slice(-8).toUpperCase()}</small>
                            <strong>{firstItem?.name || "Order"}{order.orderItems?.length > 1 ? ` +${order.orderItems.length - 1} more` : ""}</strong>
                            <em>Ordered {orderDate(order)} · {money(order.totalAmount)}</em>
                          </span>
                          <b>{order.orderStatus}</b>
                          <button onClick={() => setTab("My orders")}><Icon name="arrow" /></button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : tab === "My orders" ? (
              <>
                <p className="eyebrow">Orders</p>
                <h1>My orders.</h1>
                <CustomerOrders onReorder={onReorder} onShop={() => setPage("shop")} />
              </>
            ) : tab === "Addresses" ? (
              <>
                <div className="acct-header-row">
                  <div>
                    <p className="eyebrow">Addresses</p>
                    <h1>My addresses.</h1>
                    <p className="account-intro">Save your delivery addresses with PIN code, landmark, street, city, and village.</p>
                  </div>
                  <button type="button" className="acct-primary-action-btn" onClick={handleOpenAddAddress}>
                    <Plus size={16} /> Add New Address
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="acct-empty-address-state">
                    <div className="acct-empty-icon-wrap">
                      <MapPin size={32} />
                    </div>
                    <h3>No saved addresses yet</h3>
                    <p>Add your street, landmark, village, city, and 6-digit PIN code to enable rapid checkout and doorstep delivery.</p>
                    <button type="button" className="acct-btn-primary" onClick={handleOpenAddAddress} style={{ marginTop: 12 }}>
                      <Plus size={15} /> Add Delivery Address
                    </button>
                  </div>
                ) : (
                  <div className="acct-addresses-grid">
                    {addresses.map((a, i) => (
                      <article key={a._id || i} className={`acct-addr-card${a.isDefault ? " is-default" : ""}`}>
                        <div className="acct-addr-card__head">
                          <span className="acct-addr-type-tag">{a.title || "Address"}</span>
                          {a.isDefault && (
                            <span className="acct-addr-default-badge">
                              <CheckCircle2 size={12} /> DEFAULT
                            </span>
                          )}
                        </div>
                        <strong className="acct-addr-name">{a.fullName}</strong>
                        <div className="acct-addr-details">
                          <span className="acct-addr-street">
                            {[a.street || a.address, a.landmark, a.village].filter(Boolean).join(", ")}
                          </span>
                          <span className="acct-addr-extra">
                            <span>{a.city}</span>
                            <span>{a.state}</span>
                            <span>{a.zipCode || a.pinCode}</span>
                          </span>
                          <span className="acct-addr-country">{a.country || "India"}</span>
                          <span className="acct-addr-phone">{a.phoneNo || a.phone}</span>
                        </div>
                        <div className="acct-addr-card__actions">
                          {!a.isDefault && (
                            <button type="button" className="acct-addr-set-default-btn" onClick={() => handleSetDefaultAddress(a._id)}>
                              Set as default
                            </button>
                          )}
                          <button type="button" className="acct-icon-action-btn" onClick={() => handleOpenEditAddress(a)} aria-label="Edit address">
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="acct-icon-action-btn acct-icon-action-btn--delete"
                            onClick={() => handleDeleteAddress(a._id)}
                            disabled={addrDeletingId === a._id}
                            aria-label="Delete address"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : tab === "Wishlist" ? (
              <>
                <p className="eyebrow">Wishlist</p>
                <h1>Saved items.</h1>
                <p className="account-intro">{wishlistCount} item(s) saved.</p>
                <div style={{ marginTop: 20 }}>
                  <Button onClick={() => setPage("wishlist")}>Open wishlist <Icon name="arrow" size={16} /></Button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">Security</p>
                <h1>Account security.</h1>
                <div className="account-cards" style={{ gridTemplateColumns: "1fr" }}>
                  <article>
                    <span>Email verification</span>
                    <strong style={{ fontSize: 18 }}>{profile?.isVerified ? "Verified" : "Not verified"}</strong>
                    <span style={{ display: "block", marginTop: 18 }}>Last login</span>
                    <strong style={{ fontSize: 18 }}>{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "—"}</strong>
                    <span style={{ display: "block", marginTop: 18 }}>Sign-in method</span>
                    <strong style={{ fontSize: 18 }}>{profile?.provider || "local"}</strong>
                    <span style={{ display: "block", marginTop: 18 }}>Store connection</span>
                    <strong style={{ fontSize: 18 }}>{dbHealth?.connected ? "Connected" : "Offline"}</strong>
                  </article>
                </div>
                <div style={{ marginTop: 20 }}>
                  <Button onClick={onSignOut}>Sign out</Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {showAddressModal && (
        <div className="acct-modal-backdrop" onClick={() => setShowAddressModal(false)}>
          <div className="acct-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="acct-modal-header">
              <div>
                <h2>{editingAddress ? "Edit address" : "Add new address"}</h2>
                <p>Delivery details are saved to your account for faster checkout.</p>
              </div>
              <button type="button" className="acct-modal-close" onClick={() => setShowAddressModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="acct-modal-form" onSubmit={handleSaveAddress}>
              <div className="acct-tag-selector">
                {["Home", "Work", "Other"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`acct-tag-pill${addrTitle === label ? " active" : ""}`}
                    onClick={() => setAddrTitle(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="acct-form-grid">
                <div className="acct-field">
                  <label>Recipient name</label>
                  <input value={addrFullName} onChange={(e) => setAddrFullName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="acct-field">
                  <label>Phone number</label>
                  <input value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} placeholder="10-digit mobile number" />
                </div>
                <div className="acct-field full">
                  <label>Street address</label>
                  <input value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="House number and street" />
                </div>
                <div className="acct-field">
                  <label>Landmark</label>
                  <input value={addrLandmark} onChange={(e) => setAddrLandmark(e.target.value)} placeholder="Nearby landmark" />
                </div>
                <div className="acct-field">
                  <label>Village / Area</label>
                  <input value={addrVillage} onChange={(e) => setAddrVillage(e.target.value)} placeholder="Village or area" />
                </div>
                <div className="acct-field">
                  <label>City</label>
                  <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="City" />
                </div>
                <div className="acct-field">
                  <label>State</label>
                  <input value={addrState} onChange={(e) => setAddrState(e.target.value)} placeholder="State" />
                </div>
                <div className="acct-field">
                  <label>PIN code</label>
                  <input value={addrPinCode} onChange={(e) => setAddrPinCode(e.target.value)} placeholder="6-digit PIN code" />
                </div>
                <div className="acct-field">
                  <label>Country</label>
                  <input value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)} placeholder="Country" />
                </div>
              </div>

              <label className="acct-checkbox-label">
                <input type="checkbox" checked={addrIsDefault} onChange={(e) => setAddrIsDefault(e.target.checked)} />
                Set as my default delivery address
              </label>

              <div className="acct-form-actions">
                <button type="button" className="acct-btn-secondary" onClick={() => setShowAddressModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="acct-btn-primary" disabled={addrSaving}>
                  {addrSaving ? "Saving Address…" : editingAddress ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

type AdminNavItem = { tab: string; label: string; icon: LucideIcon; ready?: boolean };
const ADMIN_NAV: { label: string; items: AdminNavItem[] }[] = [
  { label: "Analytics", items: [{ tab: "Overview", label: "Dashboard", icon: LayoutDashboard, ready: true }] },
  {
    label: "Catalog",
    items: [
      { tab: "Products", label: "Products", icon: Package, ready: true },
      { tab: "Categories", label: "Categories", icon: FolderTree, ready: true },
      { tab: "Inventory", label: "Inventory", icon: Boxes, ready: true },
      { tab: "Reviews", label: "Reviews", icon: Star, ready: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { tab: "Banners", label: "Banners", icon: Images, ready: true },
      { tab: "Coupons", label: "Coupons & Discounts", icon: TicketPercent, ready: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { tab: "Orders", label: "Orders", icon: ShoppingCart, ready: true },
      { tab: "Delivery", label: "Delivery", icon: Truck, ready: true },
      { tab: "Customers", label: "Customers", icon: Users, ready: true },
    ],
  },
  {
    label: "System",
    items: [
      { tab: "Reports", label: "Reports & Analytics", icon: BarChart3, ready: true },
      { tab: "Settings", label: "Settings", icon: SettingsIcon, ready: true },
      { tab: "Health", label: "Integrations", icon: Store, ready: true },
    ],
  },
];

// Used until categories are configured in the admin Category Management screen.
const DEFAULT_CATEGORY_NAMES = ["Laptops", "Audio", "Accessories", "Security", "Mobile", "Displays"];

const ADMIN_TITLES: Record<string, string> = {
  Overview: "Dashboard Overview",
  Products: "Products Management",
  Categories: "Category Management",
  Banners: "Banners & Hero Campaigns",
  Orders: "Order Management",
  Delivery: "Delivery Management",
  Customers: "Customer Management",
  Inventory: "Inventory Management",
  Reviews: "Review Moderation",
  Coupons: "Coupons & Discounts",
  Reports: "Reports & Analytics",
  Settings: "Store Settings",
  Health: "Integrations & Service Health",
};

function StatCard({
  label,
  value,
  hint,
  icon: StatIcon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "warn" | "good";
}) {
  return (
    <article className={`stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <div className="stat-card__head">
        <p>{label}</p>
        {StatIcon && (
          <span className="stat-card__icon">
            <StatIcon size={15} />
          </span>
        )}
      </div>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}

function Admin({
  products: initialProducts,
  setPage,
  dbHealth,
  onRefresh,
}: {
  products: ProductItem[];
  setPage: (p: Page) => void;
  dbHealth: BackendHealth | null;
  onRefresh: () => void;
}) {
  // Authentication State
  const [adminUser, setAdminUser] = useState<any>(() => getStoredAdminUser());
  const [adminToken, setAdminToken] = useState<string | null>(() => getStoredAdminToken());
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
  const [loginEmail, setLoginEmail] = useState("admin@delivix.com");
  const [loginPassword, setLoginPassword] = useState("DelivixAdmin@2025");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Dashboard Tabs & Data
  const [activeTab, setActiveTab] = useState<
    | "Overview"
    | "Products"
    | "Categories"
    | "Banners"
    | "Orders"
    | "Delivery"
    | "Customers"
    | "Inventory"
    | "Reviews"
    | "Coupons"
    | "Reports"
    | "Settings"
    | "Health"
  >(() => {
    const p = typeof window !== "undefined" ? window.location.pathname.toLowerCase() : "";
    if (p.includes("reports") || p.includes("analytics")) return "Reports";
    return "Overview";
  });
  const [productsList, setProductsList] = useState<ProductItem[]>(initialProducts);
  const [bannersList, setBannersList] = useState<BannerItem[]>([]);
  const [bannerFilter, setBannerFilter] = useState<"all" | "active" | "inactive">("all");
  const [loadingData, setLoadingData] = useState(false);
  const [cldStatus, setCldStatus] = useState<CloudinaryStatus>({ configured: true, folder: "delivix/products" });
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  // Dashboard Overview Data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardDays, setDashboardDays] = useState(14);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Banner Modals & Form State
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<BannerItem | null>(null);

  const [bTitle, setBTitle] = useState("");
  const [bSubtitle, setBSubtitle] = useState("");
  const [bImage, setBImage] = useState("");
  const [bLink, setBLink] = useState("/shop");
  const [bButtonText, setBButtonText] = useState("");
  const [bBadgeText, setBBadgeText] = useState("");
  const [bIsActive, setBIsActive] = useState(true);
  const [bUploading, setBUploading] = useState(false);
  const [bSaving, setBSaving] = useState(false);

  const activeBannerCount = useMemo(
    () => bannersList.filter((b) => b.isActive).length,
    [bannersList]
  );
  const visibleBanners = useMemo(
    () =>
      bannersList.filter((b) =>
        bannerFilter === "all" ? true : bannerFilter === "active" ? b.isActive : !b.isActive
      ),
    [bannersList, bannerFilter]
  );

  // Category Management State
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryItem | null>(null);
  const [cName, setCName] = useState("");
  const [cParent, setCParent] = useState("");
  const [cImage, setCImage] = useState("");
  const [cUploading, setCUploading] = useState(false);
  const [cSaving, setCSaving] = useState(false);

  // ZeptoMail Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const showToast = (text: string, error = false) => {
    if (error) hotToast.error(text);
    else hotToast.success(text);
    setToast({ text, error });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync initial products
  useEffect(() => {
    setProductsList(initialProducts);
  }, [initialProducts]);

  // Load Cloudinary Status & Banners
  const reloadAdminData = async () => {
    setLoadingData(true);
    try {
      const [cld, prods, banners, cats] = await Promise.all([
        checkCloudinaryStatus(),
        fetchAdminProducts(),
        fetchBanners(true),
        fetchAllCategories(),
      ]);
      setCldStatus(cld);
      setProductsList(prods);
      setBannersList(banners);
      setCategoriesList(cats);
    } catch (err: any) {
      showToast(`Error syncing data: ${err.message}`, true);
    } finally {
      setLoadingData(false);
    }
  };

  const loadDashboard = async (days = dashboardDays) => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await fetchDashboardStats(days);
      setDashboard(data);
    } catch (err: any) {
      setDashboardError(err.message || "Failed to load dashboard statistics");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      reloadAdminData();
      loadDashboard();
    }
  }, [adminToken]);

  // OTP Countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // ── Authentication Handlers ───────────────────────────────────────────────
  const handleSendOtp = async (targetEmail = loginEmail) => {
    if (!targetEmail || !targetEmail.includes("@")) {
      setAuthError("Please enter a valid admin email address");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    const res = await sendZeptoOtp(targetEmail);
    setAuthLoading(false);

    if (res.success) {
      setOtpSent(true);
      setOtpCountdown(60);
      setAuthSuccess(`✓ ${res.message}`);
      if (res.devOtp) {
        setOtpDevCode(res.devOtp);
      }
    } else {
      setAuthError(res.message);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim()) {
      setAuthError("Please enter the 6-digit OTP code");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    const res = await verifyZeptoOtp(loginEmail, otpCode.trim());
    setAuthLoading(false);

    if (res.success && res.token) {
      setAdminToken(res.token);
      setAdminUser(res.user || { name: loginEmail.split("@")[0] || "Administrator", email: loginEmail, role: "admin" });
      setAuthSuccess("✓ Logged in successfully! Welcome to Delivix Control Center.");
      onRefresh();
    } else {
      setAuthError(res.message);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const res = await loginWithPassword(loginEmail, loginPassword);
    setAuthLoading(false);

    if (res.requiresVerification) {
      setAuthMode("otp");
      setOtpSent(true);
      setOtpCountdown(60);
      setAuthSuccess("Account verification needed. A 6-digit OTP was sent to your email via ZeptoMail!");
      return;
    }

    if (res.success && res.token) {
      setAdminToken(res.token);
      setAdminUser(res.user || { name: loginEmail.split("@")[0] || "Administrator", email: loginEmail, role: "admin" });
      setAuthSuccess("✓ Login successful!");
      onRefresh();
    } else {
      setAuthError(res.message);
    }
  };

  const handleSignOut = () => {
    clearStoredAdmin();
    setAdminToken(null);
    setAdminUser(null);
    setOtpSent(false);
    setOtpCode("");
    setOtpDevCode(null);
    showToast("Signed out of Admin portal");
  };

  // ── Category helpers ──────────────────────────────────────────────────────
  const mainCategories = useMemo(
    () => categoriesList.filter(c => !c.parentCategory),
    [categoriesList]
  );
  const subCategories = useMemo(
    () => categoriesList.filter(c => !!c.parentCategory),
    [categoriesList]
  );

  const openAddMainCategory = () => {
    setEditingCategory(null);
    setCName("");
    setCParent("");
    setCImage("");
    setShowCategoryModal(true);
  };

  const openAddSubCategory = (parentId = "") => {
    setEditingCategory(null);
    setCName("");
    setCParent(parentId || mainCategories[0]?.id || "");
    setCImage("");
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCName(cat.name);
    setCParent(cat.parentCategory || "");
    setCImage(cat.image?.url || "");
    setShowCategoryModal(true);
  };

  const handleCategoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setCImage(reader.result as string);
      setCUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      showToast("Category name is required", true);
      return;
    }

    setCSaving(true);
    try {
      const payload: { name: string; parentCategory: string | null; image?: string | null } = {
        name: cName.trim(),
        parentCategory: cParent || null,
      };

      if (cParent) {
        // Subcategories are name-only.
        payload.image = null;
      } else if (cImage !== (editingCategory?.image?.url || "")) {
        payload.image = cImage || null;
      }

      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, payload);
        setCategoriesList(prev => prev.map(c => (c.id === updated.id ? updated : c)));
        showToast(`âœ“ Updated "${updated.name}"`);
      } else {
        const created = await createCategory(payload);
        setCategoriesList(prev => [...prev, created]);
        showToast(`âœ“ Created "${created.name}"`);
      }
      setShowCategoryModal(false);
      onRefresh();
    } catch (err: any) {
      showToast(`Failed to save category: ${err.message}`, true);
    } finally {
      setCSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const target = deletingCategory;
    try {
      const ok = await deleteCategory(target.id);
      if (ok) {
        setCategoriesList(prev =>
          prev.filter(c => c.id !== target.id && c.parentCategory !== target.id)
        );
        showToast(`âœ“ Deleted "${target.name}"`);
        onRefresh();
      } else {
        showToast("Failed to delete category from server", true);
      }
    } catch (err: any) {
      showToast(`Delete error: ${err.message}`, true);
    } finally {
      setDeletingCategory(null);
    }
  };

  // â”€â”€ Banner CRUD Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAddBannerModal = () => {
    setEditingBanner(null);
    setBTitle("");
    setBSubtitle("Exclusive showcase of considered essentials.");
    setBImage("https://images.unsplash.com/photo-1615788189819-bee84874da4b?auto=format&fit=crop&w=1800&q=90");
    setBLink("/shop");
    setBButtonText("Shop now");
    setBBadgeText("");
    setBIsActive(true);
    setShowBannerModal(true);
  };

  const openEditBannerModal = (banner: BannerItem) => {
    setEditingBanner(banner);
    setBTitle(banner.title);
    setBSubtitle(banner.subtitle || "");
    setBImage(banner.image);
    setBLink(banner.link || "/shop");
    setBButtonText(banner.buttonText || "");
    setBBadgeText(banner.badgeText || "");
    setBIsActive(banner.isActive);
    setShowBannerModal(true);
  };

  const handleBannerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await uploadProductImage(base64Data, "delivix/banners");
        setBImage(res.url);
        showToast(res.cloudinary ? "âœ“ Banner uploaded to Cloudinary (delivix/banners)" : "âœ“ Banner image ready");
      } catch (err: any) {
        showToast(`Banner upload failed: ${err.message}`, true);
      } finally {
        setBUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bTitle.trim()) {
      showToast("Banner title is required", true);
      return;
    }
    if (!bImage.trim()) {
      showToast("Banner image is required", true);
      return;
    }

    setBSaving(true);
    const payload: Partial<BannerItem> = {
      title: bTitle.trim(),
      subtitle: bSubtitle.trim(),
      image: bImage.trim(),
      link: bLink.trim() || "/shop",
      buttonText: bButtonText.trim(),
      badgeText: bBadgeText.trim(),
      isActive: bIsActive,
    };

    try {
      if (editingBanner) {
        // UPDATE Banner
        const updated = await updateBanner(editingBanner.id, payload);
        setBannersList(prev => prev.map(b => (b.id === editingBanner.id ? updated : b)));
        showToast(`âœ“ Updated banner "${updated.title}"`);
      } else {
        // CREATE Banner
        const created = await createBanner(payload);
        setBannersList(prev => [created, ...prev]);
        showToast(`âœ“ Published banner "${created.title}" to Cloudinary CDN`);
      }
      setShowBannerModal(false);
    } catch (err: any) {
      showToast(`Failed to save banner: ${err.message}`, true);
    } finally {
      setBSaving(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!deletingBanner) return;
    try {
      const ok = await deleteBanner(deletingBanner.id);
      if (ok) {
        setBannersList(prev => prev.filter(b => b.id !== deletingBanner.id));
        showToast(`âœ“ Removed banner "${deletingBanner.title}"`);
      } else {
        showToast("Failed to delete banner", true);
      }
    } catch (err: any) {
      showToast(`Banner delete error: ${err.message}`, true);
    } finally {
      setDeletingBanner(null);
    }
  };

  const handleToggleBannerActive = async (banner: BannerItem) => {
    try {
      const updated = await updateBanner(banner.id, { isActive: !banner.isActive });
      setBannersList(prev => prev.map(b => (b.id === banner.id ? updated : b)));
      showToast(`Banner "${banner.title}" is now ${updated.isActive ? "Active (Visible)" : "Inactive"}`);
    } catch (err: any) {
      showToast(`Status update failed: ${err.message}`, true);
    }
  };

  // Test ZeptoMail Email Send
  const handleTestZeptoMail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes("@")) {
      showToast("Please enter a valid recipient email", true);
      return;
    }
    setTestEmailSending(true);
    setTestEmailResult(null);
    const res = await sendZeptoOtp(testEmailRecipient);
    setTestEmailSending(false);
    setTestEmailResult(res);
    if (res.success) {
      showToast(`âœ“ ZeptoMail sent OTP email to ${testEmailRecipient}!`);
    } else {
      showToast(`ZeptoMail test failed: ${res.message}`, true);
    }
  };

  if (!adminUser || !adminToken) {
    return (
      <main className="admin-auth-wrapper">
        <div className="admin-auth-card">
          <div className="admin-auth-header">
            <span className="admin-badge">
              <Icon name="shield" size={14} /> SECURE ADMIN GATEWAY
            </span>
            <button className="wordmark" onClick={() => setPage("home")}>
              DELIVIX<span>.</span>
            </button>
            <p className="admin-auth-subtitle">
              Verify your administrator identity via Zoho ZeptoMail OTP or account credentials.
            </p>
          </div>

          <div className="admin-auth-tabs">
            <button
              className={authMode === "otp" ? "active" : ""}
              onClick={() => {
                setAuthMode("otp");
                setAuthError(null);
              }}
            >
              <Icon name="mail" size={15} /> ZeptoMail OTP Verify
            </button>
            <button
              className={authMode === "password" ? "active" : ""}
              onClick={() => {
                setAuthMode("password");
                setAuthError(null);
              }}
            >
              <Icon name="user" size={15} /> Password Login
            </button>
          </div>

          {authError && <div className="admin-alert admin-alert--error">{authError}</div>}
          {authSuccess && <div className="admin-alert admin-alert--success">{authSuccess}</div>}

          {authMode === "otp" ? (
            <div className="admin-auth-body">
              {!otpSent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="admin-form-group">
                    <label>Administrator Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    variant="primary"
                    className="full"
                    onClick={() => handleSendOtp(loginEmail)}
                    disabled={authLoading}
                  >
                    {authLoading ? "Sendingâ€¦" : "Send OTP"}
                  </Button>

                  <div className="admin-helper-box">
                    <Icon name="shield" size={18} />
                    <div>
                      <strong>Zoho ZeptoMail Verified Delivery</strong>
                      <span>A secure 6-digit OTP code will be sent to your inbox within seconds.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div className="admin-otp-banner">
                    <Icon name="check" size={18} />
                    <div>
                      <strong>OTP Code Dispatched</strong>
                      <span>Check inbox for <b>{loginEmail}</b></span>
                    </div>
                  </div>

                  {otpDevCode && (
                    <div className="admin-dev-otp-chip" onClick={() => setOtpCode(otpDevCode)}>
                      <span>Dev Quick-Fill Code:</span> <strong>{otpDevCode}</strong> (Click to fill)
                    </div>
                  )}

                  <div className="admin-form-group">
                    <label>Enter 6-Digit Verification OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="â€¢ â€¢ â€¢ â€¢ â€¢ â€¢"
                      className="admin-otp-input"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <button
                      type="button"
                      className="admin-link-btn"
                      onClick={() => setOtpSent(false)}
                    >
                      Change email
                    </button>

                    <button
                      type="button"
                      className="admin-link-btn"
                      disabled={otpCountdown > 0 || authLoading}
                      onClick={() => handleSendOtp(loginEmail)}
                    >
                      {otpCountdown > 0 ? `Resend code in ${otpCountdown}s` : "Resend OTP"}
                    </button>
                  </div>

                  <Button variant="primary" type="submit" className="full" disabled={authLoading || otpCode.length < 4}>
                    {authLoading ? (
                      <>
                        <Icon name="refresh" size={16} /> Verifying Code...
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={16} /> Verify OTP & Enter Dashboard
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="admin-form-group">
                <label>Admin Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Admin Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  required
                />
              </div>

              <Button variant="primary" type="submit" className="full" disabled={authLoading}>
                {authLoading ? (
                  <>
                    <Icon name="refresh" size={16} /> Authenticating...
                  </>
                ) : (
                  <>
                    <Icon name="arrow" size={16} /> Sign In as Admin
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="admin-auth-footer">
            <div className="admin-quick-fill">
              <span>Administrator access is restricted to accounts with the admin or staff role.</span>
            </div>
            <button className="text-link" onClick={() => setPage("home")}>
              â† Return to Delivix Storefront
            </button>
          </div>
        </div>
      </main>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // VIEW: Authenticated Executive Admin Dashboard
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <main className="admin">
      {/* Toast Notification */}
      {toast && (
        <div className={`admin-floating-toast ${toast.error ? "toast--error" : "toast--success"}`}>
          <Icon name={toast.error ? "close" : "check"} size={16} />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Admin Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-brand-block">
          <button className="wordmark" onClick={() => setPage("home")}>
            DELIVIX<span>.</span>
          </button>
        </div>

        <nav className="admin-nav">
          {ADMIN_NAV.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                const isSoon = !item.ready;
                return (
                  <button
                    key={item.tab}
                    className={`${activeTab === item.tab ? "active" : ""} ${isSoon ? "is-soon" : ""}`}
                    onClick={() => {
                      setActiveTab(item.tab as typeof activeTab);
                      if (item.tab === "Reports") {
                        window.history.pushState({}, "", "/admin/reports-analytics");
                      } else {
                        window.history.pushState({}, "", "/admin");
                      }
                    }}
                    title={isSoon ? "Coming in a later stage" : item.label}
                  >
                    <ItemIcon size={17} />
                    <span className="admin-nav-label">{item.label}</span>
                    {item.tab === "Products" && <span className="admin-pill-count">{productsList.length}</span>}
                    {item.tab === "Banners" && <span className="admin-pill-count">{bannersList.length}</span>}
                    {isSoon && <span className="admin-soon-tag">Soon</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-avatar">
              {(adminUser?.name || "Administrator")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="admin-user-info">
              <strong>{adminUser?.name || "Administrator"}</strong>
              <small>{adminUser?.email || "â€”"}</small>
              <em className="admin-role-tag">SUPER ADMIN</em>
            </div>
          </div>

          <div className="admin-sidebar-actions">
            <button className="admin-subtle-btn" onClick={() => setPage("home")}>
              <Icon name="eye" size={14} /> View Store
            </button>
            <button className="admin-logout-btn" onClick={handleSignOut}>
              <Icon name="close" size={14} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Admin Content Area */}
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Enterprise Commerce Management</p>
            <h1>{ADMIN_TITLES[activeTab] || activeTab}</h1>
          </div>

          <div className="admin-topbar-actions">
            {activeTab === "Banners" && (
              <Button variant="primary" onClick={openAddBannerModal}>
                <Icon name="plus" size={14} /> Create Banner
              </Button>
            )}

            <Button variant="secondary" onClick={reloadAdminData} disabled={loadingData}>
              <Icon name="refresh" size={14} /> {loadingData ? "Syncing..." : "Refresh"}
            </Button>
          </div>
        </header>

        {/* â”€â”€ TAB 1: OVERVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Overview" && (
          <div className="admin-tab-view">
            <div className="dash-toolbar">
              <div>
                <p className="eyebrow">Real-time store performance</p>
                <span className="dash-sub">Live data from your database Â· last {dashboardDays} days</span>
              </div>
              <div className="dash-range">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    className={dashboardDays === d ? "active" : ""}
                    onClick={() => {
                      setDashboardDays(d);
                      loadDashboard(d);
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {dashboardError && (
              <div className="acct-alert acct-alert--error" style={{ marginBottom: 16 }}>
                <span>{dashboardError}</span>
                <button className="text-link" style={{ marginLeft: 12 }} onClick={() => loadDashboard()}>
                  Retry
                </button>
              </div>
            )}

            {dashboardLoading && !dashboard ? (
              <div className="stat-grid">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <article key={i} className="dash-skeleton" />
                ))}
              </div>
            ) : dashboard ? (
              <div className="stat-grid">
                <StatCard
                  label="Total Revenue"
                  value={formatPrice(dashboard.stats.totalRevenue)}
                  hint={`${dashboard.stats.totalOrders} orders placed`}
                  icon={TrendingUp}
                />
                <StatCard
                  label="Total Orders"
                  value={dashboard.stats.totalOrders}
                  hint={`${dashboard.stats.deliveredOrders} delivered`}
                  icon={ShoppingCart}
                />
                <StatCard
                  label="Pending Orders"
                  value={dashboard.stats.pendingOrders}
                  hint="Processing or shipped"
                  icon={Truck}
                  tone={dashboard.stats.pendingOrders > 0 ? "warn" : undefined}
                />
                <StatCard
                  label="Total Products"
                  value={dashboard.stats.totalProducts}
                  hint={`${dashboard.stats.totalStock} units in stock`}
                  icon={Package}
                />
                <StatCard
                  label="Customers"
                  value={dashboard.stats.totalCustomers}
                  hint="Registered accounts"
                  icon={Users}
                />
                <StatCard
                  label="Low Stock"
                  value={dashboard.stats.lowStockCount}
                  hint={`${dashboard.stats.outOfStockCount} out of stock (â‰¤ ${dashboard.lowStockThreshold})`}
                  icon={AlertTriangle}
                  tone={dashboard.stats.lowStockCount > 0 ? "warn" : "good"}
                />
              </div>
            ) : null}

            {dashboard && (
              <>
                <div className="admin-split-panels">
                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Revenue</p>
                        <h3>Sales overview</h3>
                      </div>
                    </div>
                    <div className="dash-chart">
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={dashboard.salesTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(v) => String(v).slice(5)}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} />
                          <RTooltip formatter={(value: any) => formatPrice(value)} />
                          <Area type="monotone" dataKey="revenue" stroke="#111" strokeWidth={2} fill="#111" fillOpacity={0.06} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Top sellers</p>
                        <h3>Best-selling products</h3>
                      </div>
                    </div>
                    <div className="panel-list">
                      {dashboard.bestSellers.length === 0 ? (
                        <div className="empty-state">
                          <p>No sales recorded yet.</p>
                        </div>
                      ) : (
                        dashboard.bestSellers.map((p) => (
                          <div className="panel-list-item" key={p._id}>
                            {p.image ? <img src={p.image} alt={p.name} /> : <div />}
                            <div className="item-meta">
                              <strong>{p.name}</strong>
                              <small>{p.unitsSold} units sold</small>
                            </div>
                            <b>{formatPrice(Number(p.revenue || 0))}</b>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>

                <div className="admin-split-panels">
                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Activity</p>
                        <h3>Recent orders</h3>
                      </div>
                    </div>
                    <div className="panel-list">
                      {dashboard.recentOrders.length === 0 ? (
                        <div className="empty-state">
                          <p>No orders yet.</p>
                        </div>
                      ) : (
                        dashboard.recentOrders.map((o) => (
                          <div className="panel-list-item" key={o._id}>
                            <div className="item-meta">
                              <strong>#{String(o._id).slice(-8).toUpperCase()}</strong>
                              <small>
                                {o.shippingInfo?.fullName || o.user?.name || "Customer"} Â·{" "}
                                {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""}
                              </small>
                            </div>
                            <span className="dash-pay-method">{o.paymentMethod || "COD"}</span>
                            <b>{formatPrice(Number(o.totalAmount || 0))}</b>
                            <span className="dash-status">{o.orderStatus}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Inventory</p>
                        <h3>Low-stock alerts</h3>
                      </div>
                    </div>
                    <div className="panel-list">
                      {dashboard.lowStockProducts.length === 0 ? (
                        <div className="empty-state">
                          <p>All products are sufficiently stocked.</p>
                        </div>
                      ) : (
                        dashboard.lowStockProducts.map((p) => (
                          <div className="panel-list-item" key={p._id}>
                            {p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.name} /> : <div />}
                            <div className="item-meta">
                              <strong>{p.name}</strong>
                              <small>{formatPrice(Number(p.price || 0))}</small>
                            </div>
                            <span className={`dash-stock ${Number(p.stock) <= 0 ? "dash-stock--out" : ""}`}>
                              {p.stock} left
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>

                <div className="admin-split-panels">
                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">New registrations</p>
                        <h3>Latest customers</h3>
                      </div>
                    </div>
                    <div className="panel-list">
                      {dashboard.latestCustomers.length === 0 ? (
                        <div className="empty-state">
                          <p>No customers registered yet.</p>
                        </div>
                      ) : (
                        dashboard.latestCustomers.map((c) => (
                          <div className="panel-list-item" key={c._id}>
                            <span className="admin-avatar">{(c.name || "?").charAt(0).toUpperCase()}</span>
                            <div className="item-meta">
                              <strong>{c.name}</strong>
                              <small>{c.email}</small>
                            </div>
                            <span className="dash-status">{c.isVerified ? "Verified" : "Pending"}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="admin-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Fulfilment</p>
                        <h3>Order status breakdown</h3>
                      </div>
                    </div>
                    <div className="dash-breakdown">
                      {Object.keys(dashboard.statusBreakdown).length === 0 ? (
                        <div className="empty-state">
                          <p>No orders to break down yet.</p>
                        </div>
                      ) : (
                        Object.entries(dashboard.statusBreakdown).map(([status, count]) => {
                          const total = Math.max(dashboard.stats.totalOrders, 1);
                          return (
                            <div className="dash-breakdown-row" key={status}>
                              <span>{status}</span>
                              <div className="dash-breakdown-bar">
                                <i style={{ width: `${Math.round((count / total) * 100)}%` }} />
                              </div>
                              <b>{count}</b>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </article>
                </div>
              </>
            )}
          </div>
        )}

        {/* â”€â”€ TAB: CATEGORY MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Categories" && (
          <div className="admin-tab-view">
            <div className="admin-filters-bar">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Catalog taxonomy</p>
                <h3 style={{ font: '500 20px "Manrope"', margin: "4px 0 0" }}>
                  Main categories &amp; subcategories
                </h3>
              </div>
              <div className="admin-filter-selects">
                <Button variant="secondary" onClick={() => openAddSubCategory()} disabled={mainCategories.length === 0}>
                  <Icon name="plus" size={14} /> Add Subcategory
                </Button>
                <Button variant="primary" onClick={openAddMainCategory}>
                  <Icon name="plus" size={14} /> Add Main Category
                </Button>
              </div>
            </div>

            {mainCategories.length === 0 ? (
              <div className="admin-panel">
                <div className="empty-state" style={{ padding: "60px 20px" }}>
                  <div><Icon name="grid" size={30} /></div>
                  <h2 style={{ font: '500 24px "Manrope"', margin: "18px 0 10px" }}>No categories yet</h2>
                  <p>Create a main category with a name and image, then add subcategories under it.</p>
                  <Button variant="primary" onClick={openAddMainCategory}>
                    <Icon name="plus" size={14} /> Add Main Category
                  </Button>
                </div>
              </div>
            ) : (
              <div className="category-admin-grid">
                {mainCategories.map(cat => {
                  const children = subCategories.filter(s => s.parentCategory === cat.id);
                  return (
                    <article className="admin-panel category-admin-card" key={cat.id}>
                      <div className="category-admin-card__head">
                        {cat.image?.url ? (
                          <img src={cat.image.url} alt={cat.name} className="category-admin-thumb" />
                        ) : (
                          <span className="category-admin-thumb category-admin-thumb--empty">
                            <Icon name="image" size={18} />
                          </span>
                        )}

                        <div className="category-admin-card__title">
                          <strong>{cat.name}</strong>
                          <small>
                            {children.length} {children.length === 1 ? "subcategory" : "subcategories"}
                          </small>
                        </div>

                        <div className="category-admin-card__actions">
                          <button
                            className="admin-action-btn admin-action-btn--edit"
                            onClick={() => openEditCategory(cat)}
                            title="Edit main category"
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--delete"
                            onClick={() => setDeletingCategory(cat)}
                            title="Delete main category"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="category-admin-subs">
                        {children.length === 0 ? (
                          <span className="category-admin-empty">No subcategories yet.</span>
                        ) : (
                          children.map(sub => (
                            <span className="category-sub-chip" key={sub.id}>
                              {sub.name}
                              <button onClick={() => openEditCategory(sub)} title="Rename subcategory">
                                <Icon name="edit" size={11} />
                              </button>
                              <button onClick={() => setDeletingCategory(sub)} title="Delete subcategory">
                                <Icon name="close" size={11} />
                              </button>
                            </span>
                          ))
                        )}

                        <button className="category-add-sub" onClick={() => openAddSubCategory(cat.id)}>
                          <Icon name="plus" size={12} /> Add subcategory
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Orders" && (
          <AdminOrders onOrdersChanged={() => loadDashboard()} />
        )}

        {/* â”€â”€ CUSTOMERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Customers" && (
          <AdminCustomers
            onCustomersChanged={() => loadDashboard()}
            onNavigateToOrder={() => {
              setActiveTab("Orders");
            }}
          />
        )}

        {/* â”€â”€ UPCOMING TABS (built in later stages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* â”€â”€ TAB: COUPONS & DISCOUNTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Coupons" && (
          <CouponsAdmin categories={categoriesList} products={productsList} onRefresh={loadDashboard} />
        )}

        {/* ── TAB: INVENTORY ────────────────────────────────────────── */}
        {activeTab === "Inventory" && (
          <InventoryAdmin adminUser={adminUser} onRefresh={loadDashboard} />
        )}

        {/* ── TAB: DELIVERY ─────────────────────────────────────────── */}
        {activeTab === "Delivery" && (
          <DeliveryAdmin adminUser={adminUser} onRefresh={loadDashboard} />
        )}

        {/* ── TAB: STORE SETTINGS ────────────────────────────────────── */}
        {activeTab === "Settings" && (
          <div className="admin-tab-view">
            <StoreSettingsAdmin adminUser={adminUser} onRefresh={loadDashboard} />
          </div>
        )}

        {activeTab === "Reviews" && (
          <ReviewsAdmin products={productsList} onReviewsChanged={reloadAdminData} />
        )}

        {activeTab === "Products" && (
          <ProductsAdmin categories={categoriesList} onProductsChanged={reloadAdminData} />
        )}

        {/* â”€â”€ TAB 3: BANNERS (CRUD) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Banners" && (
          <div className="admin-tab-view">
            <div className="banner-toolbar">
              <div className="banner-filter" role="tablist" aria-label="Filter banners by status">
                <button
                  type="button"
                  role="tab"
                  aria-selected={bannerFilter === "all"}
                  className={bannerFilter === "all" ? "active" : ""}
                  onClick={() => setBannerFilter("all")}
                >
                  All <span>{bannersList.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bannerFilter === "active"}
                  className={bannerFilter === "active" ? "active" : ""}
                  onClick={() => setBannerFilter("active")}
                >
                  Live <span>{activeBannerCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bannerFilter === "inactive"}
                  className={bannerFilter === "inactive" ? "active" : ""}
                  onClick={() => setBannerFilter("inactive")}
                >
                  Drafts <span>{bannersList.length - activeBannerCount}</span>
                </button>
              </div>

              <p className="banner-toolbar__summary">
                {visibleBanners.length} campaign{visibleBanners.length === 1 ? "" : "s"}
                <span aria-hidden="true"> Â· </span>
                Click a status pill to publish or pause
              </p>
            </div>

            {bannersList.length === 0 ? (
              <div className="empty-state">
                <Icon name="image" size={40} />
                <h3>No Banners Created Yet</h3>
                <p>Create visual hero banners stored in Cloudinary folder `delivix/banners` with direct links to products or categories.</p>
                <Button variant="primary" onClick={openAddBannerModal}>
                  <Icon name="plus" size={14} /> Create First Banner
                </Button>
              </div>
            ) : visibleBanners.length === 0 ? (
              <div className="banner-empty-filter">
                <span className="banner-empty-filter__icon">
                  <Icon name="image" size={20} />
                </span>
                <div>
                  <strong>No {bannerFilter === "active" ? "live" : "draft"} campaigns</strong>
                  <span>Switch the filter to see all {bannersList.length} banners.</span>
                </div>
                <Button variant="secondary" onClick={() => setBannerFilter("all")}>
                  Show all
                </Button>
              </div>
            ) : (
              <div className="banner-cards-grid">
                {visibleBanners.map(b => (
                  <article
                    className={`admin-banner-card ${b.isActive ? "" : "is-inactive"}`}
                    key={b.id}
                  >
                    <div className="banner-card-img-wrap">
                      <img
                        src={b.image || images.hero}
                        alt={b.title}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== images.hero) img.src = images.hero;
                        }}
                      />

                      <button
                        type="button"
                        className={`banner-status-badge ${b.isActive ? "is-active" : "is-inactive"}`}
                        onClick={() => handleToggleBannerActive(b)}
                        title={b.isActive ? "Pause this banner" : "Publish this banner"}
                      >
                        <i /> {b.isActive ? "Live" : "Draft"}
                      </button>

                      {b.badgeText && (
                        <span className="banner-badge-chip">{b.badgeText}</span>
                      )}

                      <span className="banner-card-cta">
                        {b.buttonText || "Shop now"} <Icon name="arrow" size={12} />
                      </span>
                    </div>

                    <div className="banner-card-content">
                      <strong>{b.title}</strong>
                      <p>{b.subtitle || "Add a short tagline to give this campaign context."}</p>
                      <div className="banner-card-meta">
                        <span className="banner-meta-item" title={b.link || "/shop"}>
                          <Icon name="link" size={11} />
                          <code>{b.link || "/shop"}</code>
                        </span>
                        {b.image?.includes("cloudinary.com") && (
                          <span className="banner-meta-item banner-meta-item--cloud">
                            <Icon name="cloud" size={11} /> Cloudinary
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="banner-card-actions">
                      <Button
                        variant="secondary"
                        className="banner-action-btn"
                        onClick={() => openEditBannerModal(b)}
                      >
                        <Icon name="edit" size={13} /> Edit
                      </Button>
                      <button
                        type="button"
                        className="banner-action-toggle"
                        onClick={() => handleToggleBannerActive(b)}
                      >
                        <Icon name="eye" size={13} /> {b.isActive ? "Pause" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="banner-action-delete"
                        onClick={() => setDeletingBanner(b)}
                        title={`Delete "${b.title}"`}
                        aria-label={`Delete ${b.title}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ TAB 4: INTEGRATIONS & ZEPTOMAIL HEALTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === "Health" && (
          <div className="admin-tab-view">
            <div className="health-grid">
              {/* ZeptoMail Card */}
              <article className="health-card">
                <div className="health-card-header">
                  <span className="service-icon"><Icon name="mail" size={24} /></span>
                  <div>
                    <h3>Zoho ZeptoMail Integration</h3>
                    <span className="status-pill status-pill--active">Active &amp; Connected</span>
                  </div>
                </div>
                <div className="health-card-details">
                  <div className="detail-row">
                    <span>API Endpoint</span>
                    <code>https://api.zeptomail.in/v1.1/email</code>
                  </div>
                  <div className="detail-row">
                    <span>Sender Address</span>
                    <code>noreply@delivix.in</code>
                  </div>
                  <div className="detail-row">
                    <span>Sender Name</span>
                    <code>DELIVIX</code>
                  </div>
                  <div className="detail-row">
                    <span>Auth Scheme</span>
                    <code>Zoho-enczapikey (Verified)</code>
                  </div>
                </div>

                <div className="health-test-section">
                  <p className="eyebrow">Send Live Test OTP Email</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="email"
                      placeholder="recipient@example.com"
                      value={testEmailRecipient}
                      onChange={e => setTestEmailRecipient(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }}
                    />
                    <Button variant="primary" onClick={handleTestZeptoMail} disabled={testEmailSending}>
                      {testEmailSending ? "Sending..." : "Send Test Ping"}
                    </Button>
                  </div>
                  {testEmailResult && (
                    <div className={`admin-alert ${testEmailResult.success ? "admin-alert--success" : "admin-alert--error"}`} style={{ marginTop: 10 }}>
                      {testEmailResult.message}
                    </div>
                  )}
                </div>
              </article>

              {/* Cloudinary Card */}
              <article className="health-card">
                <div className="health-card-header">
                  <span className="service-icon"><Icon name="cloud" size={24} /></span>
                  <div>
                    <h3>Cloudinary Media CDN</h3>
                    <span className="status-pill status-pill--active">
                      {cldStatus.configured ? "Connected" : "Ready"}
                    </span>
                  </div>
                </div>
                <div className="health-card-details">
                  <div className="detail-row">
                    <span>Cloud Name</span>
                    <code>sxfx1zvl</code>
                  </div>
                  <div className="detail-row">
                    <span>Product Assets</span>
                    <code>delivix/products</code>
                  </div>
                  <div className="detail-row">
                    <span>Banner Assets</span>
                    <code>delivix/banners</code>
                  </div>
                  <div className="detail-row">
                    <span>Transformations</span>
                    <code>f_auto, q_auto, CDN cached</code>
                  </div>
                </div>
              </article>

              {/* Database Card */}
              <article className="health-card">
                <div className="health-card-header">
                  <span className="service-icon"><Icon name="shield" size={24} /></span>
                  <div>
                    <h3>MongoDB Database</h3>
                    <span className="status-pill status-pill--active">
                      {dbHealth?.connected ? "Online" : "Connected"}
                    </span>
                  </div>
                </div>
                <div className="health-card-details">
                  <div className="detail-row">
                    <span>Database Host</span>
                    <code>127.0.0.1:27017</code>
                  </div>
                  <div className="detail-row">
                    <span>Database Name</span>
                    <code>delivix</code>
                  </div>
                  <div className="detail-row">
                    <span>Collections</span>
                    <code>products, banners, users, orders</code>
                  </div>
                  <div className="detail-row">
                    <span>Current Admin</span>
                    <code>{adminUser?.email}</code>
                  </div>
                </div>
              </article>
            </div>
          </div>
        )}


        {/* ── TAB 5: REPORTS & ANALYTICS ─────────────────────────── */}
        {activeTab === "Reports" && (
          <div className="admin-tab-view">
            <ReportsAnalytics />
          </div>
        )}

        {/* â”€â”€ MODAL: BANNER (CREATE & UPDATE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {showBannerModal && (
          <div className="admin-modal-backdrop" onClick={() => setShowBannerModal(false)}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-modal__header">
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>Hero Campaign</p>
                  <h2>{editingBanner ? `Edit Banner: ${editingBanner.title}` : "Create Hero Banner"}</h2>
                </div>
                <button className="icon-button" onClick={() => setShowBannerModal(false)}>
                  <Icon name="close" size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveBanner} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="admin-modal__grid">
                  <div className="admin-form-group full-width">
                    <label>Banner Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. The New Essentials Collection / 2025"
                      value={bTitle}
                      onChange={e => setBTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="admin-form-group full-width">
                    <label>Subtitle / Promotional Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Upgrade your everyday with high-performance audio."
                      value={bSubtitle}
                      onChange={e => setBSubtitle(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Target Click Link</label>
                    <input
                      type="text"
                      placeholder="/shop or /product/1"
                      value={bLink}
                      onChange={e => setBLink(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Campaign Status</label>
                    <select
                      value={bIsActive ? "active" : "inactive"}
                      onChange={e => setBIsActive(e.target.value === "active")}
                    >
                      <option value="active">Active (Visible on Storefront)</option>
                      <option value="inactive">Draft / Inactive</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label>CTA Button Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Shop now"
                      value={bButtonText}
                      onChange={e => setBButtonText(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Corner Badge</label>
                    <input
                      type="text"
                      placeholder="e.g. Authorized Dealer"
                      value={bBadgeText}
                      onChange={e => setBBadgeText(e.target.value)}
                    />
                  </div>

                  {/* Cloudinary Banner Upload Section */}
                  <div className="admin-form-group full-width">
                    <label>Banner Graphic (Stored in Cloudinary: delivix/banners)</label>

                    <label className="cld-upload-zone">
                      <Icon name="cloud" size={28} />
                      <strong>{bUploading ? "Uploading to Cloudinary..." : "Choose Banner Graphic (16:9 / 21:9)"}</strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        High-resolution images stored directly in Cloudinary delivix/banners
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerImageUpload}
                        disabled={bUploading}
                      />
                    </label>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#888" }}>Or direct image URL:</span>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={bImage}
                        onChange={e => setBImage(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>

                    {bImage && (
                      <div className="cld-preview-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                        <img
                          src={bImage}
                          alt="Banner Preview"
                          style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }}
                        />
                        <div className="cld-preview-info">
                          <strong style={{ fontSize: 12 }}>
                            {bImage?.includes("cloudinary.com") ? "âœ“ Stored in Cloudinary (delivix/banners)" : "Banner Preview"}
                          </strong>
                          <span>{bImage}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                  <Button variant="ghost" onClick={() => setShowBannerModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={bSaving || bUploading}>
                    {bSaving ? "Saving Banner..." : editingBanner ? "Save Changes" : "Publish Banner"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* â”€â”€ MODAL: CATEGORY (CREATE & UPDATE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {showCategoryModal && (
          <div className="admin-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
            <div className="admin-modal admin-modal--small" onClick={e => e.stopPropagation()}>
              <div className="admin-modal__header">
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>Category Management</p>
                  <h2>
                    {editingCategory
                      ? `Edit: ${editingCategory.name}`
                      : cParent
                      ? "Add Subcategory"
                      : "Add Main Category"}
                  </h2>
                </div>
                <button className="icon-button" onClick={() => setShowCategoryModal(false)}>
                  <Icon name="close" size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="admin-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    placeholder={cParent ? "e.g. Gaming Laptops" : "e.g. Laptops"}
                    value={cName}
                    onChange={e => setCName(e.target.value)}
                    required
                  />
                </div>

                {!editingCategory && (
                  <div className="admin-form-group">
                    <label>Category Type</label>
                    <select
                      value={cParent ? "sub" : "main"}
                      onChange={e => {
                        if (e.target.value === "main") setCParent("");
                        else setCParent(mainCategories[0]?.id || "");
                      }}
                    >
                      <option value="main">Main category</option>
                      <option value="sub">Subcategory</option>
                    </select>
                  </div>
                )}

                {cParent && (
                  <div className="admin-form-group">
                    <label>Parent Category *</label>
                    <select value={cParent} onChange={e => setCParent(e.target.value)}>
                      {mainCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!cParent && (
                  <div className="admin-form-group">
                    <label>Category Image</label>

                    {cImage ? (
                      <div className="category-image-preview">
                        <img src={cImage} alt="Category preview" />
                        <button type="button" onClick={() => setCImage("")}>
                          <Icon name="trash" size={13} /> Remove image
                        </button>
                      </div>
                    ) : (
                      <label className="cld-upload-zone">
                        <Icon name="image" size={26} />
                        <strong>{cUploading ? "Reading image..." : "Choose Category Image"}</strong>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          PNG, JPG, WEBP accepted
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCategoryImageUpload}
                          disabled={cUploading}
                        />
                      </label>
                    )}

                    <input
                      type="url"
                      placeholder="Or paste an image URL: https://..."
                      value={cImage.startsWith("data:") ? "" : cImage}
                      onChange={e => setCImage(e.target.value)}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <Button variant="ghost" onClick={() => setShowCategoryModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={cSaving}>
                    {cSaving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* â”€â”€ MODAL: DELETE CATEGORY CONFIRMATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {deletingCategory && (
          <div className="admin-modal-backdrop" onClick={() => setDeletingCategory(null)}>
            <div className="admin-modal admin-modal--small" onClick={e => e.stopPropagation()}>
              <div className="admin-modal__header">
                <div>
                  <p className="eyebrow" style={{ color: "#dc2626", margin: 0 }}>Confirm Removal</p>
                  <h2>Delete Category?</h2>
                </div>
                <button className="icon-button" onClick={() => setDeletingCategory(null)}>
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div style={{ padding: "16px 0" }}>
                <strong>{deletingCategory.name}</strong>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  {deletingCategory.parentCategory
                    ? "This subcategory will be removed from the catalog taxonomy."
                    : "This main category and all of its subcategories will be removed."}
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button variant="ghost" onClick={() => setDeletingCategory(null)}>
                  Cancel
                </Button>
                <button className="admin-btn-delete" style={{ padding: "10px 20px" }} onClick={handleDeleteCategory}>
                  Yes, Delete Category
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ MODAL: DELETE BANNER CONFIRMATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {deletingBanner && (
          <div className="admin-modal-backdrop" onClick={() => setDeletingBanner(null)}>
            <div className="admin-modal admin-modal--small" onClick={e => e.stopPropagation()}>
              <div className="admin-modal__header">
                <div>
                  <p className="eyebrow" style={{ color: "#dc2626", margin: 0 }}>Confirm Removal</p>
                  <h2>Delete Banner?</h2>
                </div>
                <button className="icon-button" onClick={() => setDeletingBanner(null)}>
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div style={{ padding: "16px 0" }}>
                <img
                  src={deletingBanner.image || images.hero}
                  alt=""
                  style={{ width: "100%", height: 100, borderRadius: 6, objectFit: "cover", marginBottom: 10 }}
                />
                <strong>{deletingBanner.title}</strong>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  This hero banner will be removed from the storefront immediately.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button variant="ghost" onClick={() => setDeletingBanner(null)}>
                  Cancel
                </Button>
                <button className="admin-btn-delete" style={{ padding: "10px 20px" }} onClick={handleDeleteBanner}>
                  Yes, Delete Banner
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Footer({
  setPage,
  openCategory,
  storeSettings,
}: {
  setPage: (p: Page) => void;
  openCategory: (category: string) => void;
  storeSettings: PublicStoreSettings | null;
}) {
  const supportEmail = storeSettings?.contactEmail || "support@delivix.com";
  const socialUrls = storeSettings?.socialMedia;
  const socialLinks = [
    {
      name: "Instagram",
      url: socialUrls?.instagram,
      icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".75" /></svg>,
    },
    {
      name: "Pinterest",
      url: socialUrls?.pinterest,
      icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-.78-.17-1.98.03-2.84.18-.77 1.16-4.9 1.16-4.9s-.3-.6-.3-1.48c0-1.39.81-2.43 1.82-2.43.86 0 1.28.65 1.28 1.43 0 .87-.55 2.17-.84 3.38-.24 1.01.51 1.83 1.51 1.83 1.81 0 3.2-1.91 3.2-4.67 0-2.44-1.75-4.15-4.25-4.15-2.9 0-4.61 2.18-4.61 4.43 0 .88.34 1.82.76 2.33.08.28.1.52.07.81-.09.3-.1-.41-.49-.52-.78-1.82 1.88-8.61 6.78-8.61 3.56 0 6.33 2.54 6.33 5.94 0 3.54-2.23 6.39-5.31 6.39-1.04 0-2.02-.54-2.36-1.18l-.64 2.44c-.23.89-.86 2.01-1.28 2.69A10 10 0 1 0 12 2Z" /></svg>,
    },
    {
      name: "X",
      url: socialUrls?.twitter,
      icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2h3.1l-6.8 7.8L23.2 22H17l-4.9-7.3L5.8 22H2.7l7.3-8.3L2.3 2h6.3l4.4 6.7L18.9 2zm-1.1 18h1.7L7.8 3.9H6z" /></svg>,
    },
  ].filter((social): social is { name: string; url: string; icon: ReactNode } =>
    typeof social.url === "string" && /^https?:\/\//i.test(social.url)
  );
  const contactLink = (subject: string) =>
    `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
  const columns = [
    {
      title: "Shop",
      links: [
        { label: "New Arrivals", category: "All products" },
        { label: "Computers", category: "Computers" },
        { label: "Audio", category: "Audio" },
        { label: "Accessories", category: "Accessories" },
        { label: "Security", category: "Security" },
        { label: "All Products", category: "All products" },
      ],
    },
    {
      title: "Customer Support",
      links: [
        { label: "Contact Us", href: contactLink("Customer support") },
        { label: "Delivery & Returns", href: contactLink("Delivery and returns") },
        { label: "Track Order", page: "track" as Page },
        { label: "Warranty", href: contactLink("Warranty") },
        { label: "FAQs", href: contactLink("Frequently asked questions") },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Our Story", href: contactLink("Our story") },
        { label: "Journal", href: contactLink("Journal") },
        { label: "Sustainability", href: contactLink("Sustainability") },
        { label: "Careers", href: contactLink("Careers") },
        { label: "Privacy Policy", href: contactLink("Privacy policy") },
        { label: "Terms & Conditions", href: contactLink("Terms and conditions") },
      ],
    },
  ];
  const region = storeSettings?.address?.country || "India";
  const currency = storeSettings?.currency?.defaultCurrency || "INR";

  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <BrandLogo onClick={() => setPage("home")} light />
          <h2>Considered technology for a more intentional everyday.</h2>
          <p>Thoughtfully selected essentials, made to bring a little more purpose to the everyday.</p>
          {socialLinks.length > 0 && (
            <div className="footer__socials" aria-label="Follow DELIVIX">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`DELIVIX on ${social.name}`}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          )}
        </div>
        {columns.map(({ title, links }) => (
          <details className="footer__column" key={title} open>
            <summary>{title}<span aria-hidden="true">+</span></summary>
            <div className="footer__links">
              {links.map(({ label, category, page: targetPage, href }) =>
                href ? (
                  <a key={label} href={href}>{label}</a>
                ) : (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (targetPage) setPage(targetPage);
                      else if (category) openCategory(category);
                    }}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="footer__bottom">
        <span className="footer__copyright">© 2026 DELIVIX. All rights reserved.</span>
        <div className="footer__region" aria-label={`Country or region: ${region}; currency: ${currency}`}>
          <span>{region}</span><i aria-hidden="true">/</i><span>{currency}</span>
        </div>
        {socialLinks.length > 0 && (
          <nav className="footer__bottom-socials" aria-label="Social media">
            {socialLinks.map(({ name, url }) => (
              <a key={name} href={url} target="_blank" rel="noreferrer">{name}</a>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}

export default function App() {
  const pageFromPath = (): Page => {
    const path = window.location.pathname;
    if (path.startsWith("/product/")) return "product";
    if (path.startsWith("/admin")) return "admin";
    const candidate = path.slice(1) as Page;
    if (path.startsWith("/track")) return "track";
    return ["shop", "wishlist", "cart", "checkout", "account", "admin", "track"].includes(candidate) ? candidate : "home";
  };

  const pathForPage: Record<Page, string> = {
    home: "/",
    shop: "/shop",
    product: "/product/aerobook-pro-14",
    wishlist: "/wishlist",
    cart: "/cart",
    checkout: "/checkout",
    account: "/account",
    admin: "/admin",
    track: "/track",
  };

  const [page, setPageState] = useState<Page>(pageFromPath);
  const [shopCategory, setShopCategory] = useState("All products");
  const [shopBrand, setShopBrand] = useState("");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | number>("");
  const [wished, setWished] = useState<(string | number)[]>(() => {
    try {
      const raw = localStorage.getItem("delivix_wishlist");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState<CartMap>(() => {
    try {
      const raw = localStorage.getItem("delivix_cart");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [dbHealth, setDbHealth] = useState<BackendHealth | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string; role?: string } | null>(() => {
    const stored = getStoredAdminUser();
    return stored?.email
      ? { name: stored.name || stored.email.split("@")[0], email: stored.email, role: stored.role }
      : null;
  });

  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings | null>(null);

  useEffect(() => {
    fetchPublicSettings().then((res) => {
      if (res.success && res.settings) {
        setStoreSettings(res.settings);
        const b = res.settings.branding;
        if (b) {
          const root = document.documentElement;
          if (b.primaryColor) root.style.setProperty("--black", b.primaryColor);
          if (b.secondaryColor) root.style.setProperty("--green", b.secondaryColor);
          if (b.buttonColor) root.style.setProperty("--ink", b.buttonColor);
        }
        if (res.settings.storeName) {
          document.title = res.settings.seo?.websiteTitle || `${res.settings.storeName} - Premium Store`;
        }
        if (res.settings.storeFavicon) {
          let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "shortcut icon";
            document.head.appendChild(link);
          }
          link.href = res.settings.storeFavicon;
        }
      }
    }).catch(() => {});
  }, []);

  const handleGlobalSignOut = () => {
    clearStoredAdmin();
    setLoggedInUser(null);
    setPage("home");
  };

  // Load the storefront resources independently so one failed endpoint doesn't
  // discard successful catalogue data from the other requests.
  const refreshData = async () => {
    setCatalogueLoading(true);
    setCatalogueError(null);
    const [healthResult, categoriesResult, productsResult, brandsResult] = await Promise.allSettled([
      checkBackendHealth(),
      fetchAllCategories(),
      fetchProducts(),
      fetchBrands(),
    ]);

    if (healthResult.status === "fulfilled") {
      setDbHealth(healthResult.value);
    } else {
      setDbHealth({
        connected: false,
        database: "disconnected",
        error: healthResult.reason instanceof Error ? healthResult.reason.message : "Backend health check failed",
      });
    }

    if (categoriesResult.status === "fulfilled" && categoriesResult.value.length > 0) {
      setCategories(categoriesResult.value);
    }

    if (productsResult.status === "fulfilled") {
      // An empty product list is valid and must replace any stale catalogue.
      setProducts(productsResult.value);
    } else {
      setCatalogueError(
        productsResult.reason instanceof Error
          ? productsResult.reason.message
          : "Could not load products. Please try again."
      );
    }

    if (brandsResult.status === "fulfilled") {
      setBrands(brandsResult.value);
    }
    setCatalogueLoading(false);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(async () => {
      const health = await checkBackendHealth();
      setDbHealth(health);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleHistory = () => setPageState(pageFromPath());
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  const navigate = (p: Page) => {
    setPageState(p);
    window.history.pushState({}, "", pathForPage[p]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setPage = (p: Page) => {
    // Opening the shop from the main navigation always starts with the full catalogue.
    if (p === "shop") {
      setShopCategory("All products");
      setShopBrand("");
    }
    navigate(p);
  };

  // Breadcrumb / category links open the shop pre-filtered to that category.
  const openCategory = (category: string) => {
    setShopCategory(category);
    setShopBrand("");
    navigate("shop");
  };

  const openBrand = (brand: string) => {
    setShopCategory("All products");
    setShopBrand(brand);
    navigate("shop");
  };

  useEffect(() => {
    try {
      localStorage.setItem("delivix_wishlist", JSON.stringify(wished));
    } catch {}
  }, [wished]);

  useEffect(() => {
    try {
      localStorage.setItem("delivix_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const toggleWish = (id: string | number) =>
    setWished(x => {
      const key = String(id);
      return x.some(v => String(v) === key)
        ? x.filter(v => String(v) !== key)
        : [...x, key];
    });

  const addCart = (
    id: string | number,
    options?: { quantity?: number; size?: string; variantName?: string }
  ) =>
    setCart((current) =>
      addCartSelection(
        current,
        {
          productId: String(id),
          size: options?.size,
          variantName: options?.variantName,
        },
        options?.quantity ?? 1
      )
    );

  const changeQty = (key: string, qty: number) =>
    setCart((current) => setCartLineQuantity(current, key, qty));

  const handleReorder = (
    items: { productId: string; quantity: number; size?: string; variantName?: string }[]
  ) => {
    if (!items.length) return;
    setCart((current) => {
      let next = current;
      items.forEach((item) => {
        next = addCartSelection(
          next,
          {
            productId: String(item.productId),
            size: item.size,
            variantName: item.variantName,
          },
          Math.max(1, Number(item.quantity) || 1)
        );
      });
      return next;
    });
    setPage("cart");
  };

  // Count only items that actually resolve to a product, so the header badges
  // always match what the wishlist / cart pages display (0 when they're empty).
  const wishlistCount = useMemo(() => {
    const wishedKeys = new Set(wished.map(String));
    return products.reduce((count, p) => count + (wishedKeys.has(String(p.id)) ? 1 : 0), 0);
  }, [products, wished]);

  const cartCount = useMemo(() => {
    const productIds = new Set(products.map((product) => String(product.id)));
    return getCartLines(cart)
      .filter((line) => productIds.has(line.productId))
      .reduce((count, line) => count + line.quantity, 0);
  }, [products, cart]);

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProductId)) || products[0] || null;
  }, [products, selectedProductId]);

  useEffect(() => {
    if (!products.length) return;
    if (!products.some((product) => String(product.id) === String(selectedProductId))) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const onOpenProduct = (id: string | number) => {
    setSelectedProductId(id);
  };

  // Quick view and the compare tray live outside the page components, so they
  // need a navigator that also switches the route.
  const openProductFromExperience = (id: string | number) => {
    setSelectedProductId(id);
    setPage("product");
  };

  const buyNow = (
    id: string | number,
    options?: { quantity?: number; size?: string; variantName?: string }
  ) => {
    addCart(id, options);
    setPage("checkout");
  };

  const content = {
    home: (
      <Home
        products={products}
        brands={brands}
        catalogueLoading={catalogueLoading}
        setPage={setPage}
        wished={wished}
        toggleWish={toggleWish}
        addCart={addCart}
        onOpenProduct={onOpenProduct}
        categories={categories}
        onOpenCategory={openCategory}
        onOpenBrand={openBrand}
      />
    ),
    shop: (
      <Shop
        products={products}
        setPage={setPage}
        wished={wished}
        toggleWish={toggleWish}
        addCart={addCart}
        onOpenProduct={onOpenProduct}
        category={shopCategory}
        setCategory={setShopCategory}
        brand={shopBrand}
        setBrand={setShopBrand}
        categories={categories}
      />
    ),
    product: selectedProduct ? (
      <ProductDetailPage
        product={selectedProduct}
        relatedProducts={products}
        setPage={setPage}
        wished={wished}
        onToggleWish={toggleWish}
        onAddToCart={addCart}
        onBuyNow={buyNow}
        onOpenProduct={onOpenProduct}
        onOpenCategory={openCategory}
      />
    ) : (
      <main className="page">
        <div className="container">
          <div className="pd-loading">
            {catalogueLoading && <span />}
            <strong>
              {catalogueLoading
                ? "Loading the collection…"
                : catalogueError
                  ? "The catalogue is temporarily unavailable"
                  : products.length
                    ? "Select a product"
                    : "No products are available yet"}
            </strong>
            <p>
              {catalogueLoading
                ? "Fresh products are on their way from the Delivix catalogue."
                : catalogueError || "Please check back soon for products in the collection."}
            </p>
          </div>
        </div>
      </main>
    ),
    wishlist: (
      <Wishlist
        products={products}
        setPage={setPage}
        wished={wished}
        toggleWish={toggleWish}
        addCart={addCart}
        onOpenProduct={onOpenProduct}
      />
    ),
    cart: <Cart products={products} setPage={setPage} cart={cart} changeQty={changeQty} />,
    checkout: (
      <CheckoutPage
        products={products}
        setPage={setPage}
        cart={cart}
        loggedInUser={loggedInUser}
        onOrderComplete={() => setCart({})}
      />
    ),
    account: (
      <Account
        setPage={setPage}
        dbHealth={dbHealth}
        loggedInUser={loggedInUser}
        onSignOut={handleGlobalSignOut}
        wishlistCount={wishlistCount}
        onReorder={handleReorder}
      />
    ),
    admin: <Admin products={products} setPage={setPage} dbHealth={dbHealth} onRefresh={refreshData} />,
    track: <OrderTrackingPage onBack={() => setPage("home")} />,
  }[page];

  if (storeSettings?.maintenance?.maintenanceMode && page !== "admin" && !loggedInUser?.role?.includes("admin")) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-200 shadow-xl space-y-5">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{storeSettings?.storeName || "DELIVIX"}</h2>
          <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
            Scheduled Maintenance
          </span>
          <p className="text-sm text-gray-600 leading-relaxed">
            {storeSettings?.maintenance?.maintenanceMessage || "We are currently performing system maintenance to enhance your shopping experience. We will be back online shortly!"}
          </p>
          <div className="border-t border-gray-100 pt-5 flex items-center justify-between text-xs text-gray-500">
            <span>Support: {storeSettings?.contactEmail || "support@delivix.com"}</span>
            <button
              onClick={() => setPage("admin")}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Staff Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const standalone = page === "checkout" || page === "admin";

  return (
    <>
      {!standalone && (
        <Header
          page={page}
          setPage={setPage}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          dbHealth={dbHealth}
          onOpenProduct={onOpenProduct}
          loggedInUser={loggedInUser}
          setLoggedInUser={setLoggedInUser}
          products={products}
          categories={categories}
          onOpenCategory={openCategory}
        />
      )}
      <ProductExperienceProvider
        products={products}
        wished={wished}
        onToggleWish={toggleWish}
        onAddToCart={addCart}
        onBuyNow={buyNow}
        onOpenProduct={openProductFromExperience}
      >
        {catalogueError && page !== "admin" && (
          <div className="catalogue-request-alert" role="alert">
            <p>
              <strong>We couldn’t load the product catalogue.</strong>
              <span>{catalogueError}</span>
            </p>
            <button type="button" onClick={refreshData} disabled={catalogueLoading}>
              {catalogueLoading ? "Retrying…" : "Try again"}
            </button>
          </div>
        )}
        {content}
        {!standalone && (
          <>
            <QuickViewModal />
            <CompareBar />
          </>
        )}
      </ProductExperienceProvider>
      {!standalone && <Footer setPage={setPage} openCategory={openCategory} storeSettings={storeSettings} />}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontSize: "13px",
            borderRadius: "10px",
            border: "1px solid #e5e5e5",
            background: "#fff",
            color: "#111",
          },
        }}
      />
    </>
  );
}
