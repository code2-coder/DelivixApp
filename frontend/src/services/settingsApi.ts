import { apiFetch, getStoredAdminToken, API_BASE } from "./api";

export interface StoreGeneralSettings {
  storeName: string;
  storeLogo: string;
  storeFavicon: string;
  storeDescription: string;
  storeTagline: string;
  storeEmail: string;
  customerSupportEmail: string;
  contactNumber: string;
  whatsappNumber: string;
  businessAddress: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  googleMapsLocation: string;
  websiteUrl: string;
}

export interface StoreBrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  headerBackground: string;
  footerBackground: string;
  fontFamily: string;
  headingTypography: string;
  bodyTypography: string;
  borderRadius: string;
  buttonStyle: "rounded" | "pill" | "sharp";
  themeMode: "light" | "dark" | "system";
  customCss: string;
}

export interface StoreSocialSettings {
  instagram: string;
  facebook: string;
  youtube: string;
  linkedin: string;
  pinterest: string;
  twitter: string;
  whatsapp: string;
}

export interface BusinessInfoSettings {
  legalBusinessName: string;
  businessType: string;
  registrationNumber: string;
  gstin: string;
  panNumber: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  registeredOfficeAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contactPhone: string;
  contactEmail: string;
  invoicePrefix: string;
  invoiceNotes: string;
  invoiceTerms: string;
}

export interface CurrencyRegionalSettings {
  defaultCurrency: string;
  currencySymbol: string;
  currencyPosition: "left" | "right" | "left_with_space" | "right_with_space";
  decimalPlaces: number;
  numberFormat: "indian" | "international";
  defaultCountry: string;
  defaultState: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  measurementUnit: string;
  weightUnit: string;
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  autoUpdateRates: boolean;
}

export interface TaxGstSettings {
  enableTaxes: boolean;
  gstRegistrationType: string;
  gstin: string;
  storeOriginState: string;
  pricesIncludeTax: boolean;
  defaultTaxRate: number;
  intraStateCGST: number;
  intraStateSGST: number;
  interStateIGST: number;
  categoryTaxRates: Array<{
    category: string;
    rate: number;
    hsnCode: string;
  }>;
  defaultHsnCode: string;
  showTaxBreakdownOnInvoice: boolean;
  calculateTaxOnShipping: boolean;
}

export interface PaymentGatewaysSettings {
  razorpay: {
    enabled: boolean;
    testMode: boolean;
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    hasKeySecret?: boolean;
    hasWebhookSecret?: boolean;
    autoCapture: boolean;
  };
  stripe: {
    enabled: boolean;
    testMode: boolean;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    hasSecretKey?: boolean;
    hasWebhookSecret?: boolean;
  };
  cod: {
    enabled: boolean;
    minOrderAmount: number;
    maxOrderAmount: number;
    fee: number;
    verificationRequired: boolean;
    instructions: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
    instructions: string;
  };
  defaultGateway: string;
  enableWebhookVerification: boolean;
  paymentTimeoutMinutes: number;
}

export interface ShippingDeliverySettings {
  defaultMethod: string;
  standardShippingFee: number;
  expressShippingFee: number;
  freeShippingThreshold: number;
  flatShippingRate: number;
  standardDeliveryEstimate: string;
  expressDeliveryEstimate: string;
  internationalShippingEnabled: boolean;
  internationalShippingFee: number;
  internationalFreeThreshold: number;
  codFee: number;
  codEnabled: boolean;
  weightRules: Array<{
    minWeightKg: number;
    maxWeightKg: number;
    additionalCharge: number;
  }>;
  deliveryZones: Array<{
    name: string;
    states: string[];
    deliveryDays: string;
    additionalFee: number;
  }>;
  originAddress: {
    companyName: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    phone: string;
    email: string;
  };
  returnAddress: {
    companyName: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
    phone: string;
    email: string;
  };
}

export interface OrderManagementSettings {
  orderIdPrefix: string;
  orderNumberFormat: string;
  defaultOrderStatus: string;
  instantConfirmation: boolean;
  autoProcessOrders: boolean;
  allowCustomerCancellation: boolean;
  cancellationWindowHours: number;
  allowCancellationAfterShipment: boolean;
  allowCustomerAddressEdit: boolean;
  allowAdminOrderEditing: boolean;
  autoGenerateInvoice: boolean;
  autoGeneratePackingSlip: boolean;
  returnWindowDays: number;
  refundMode: string;
}

export interface InventoryManagementSettings {
  enableStockManagement: boolean;
  defaultLowStockThreshold: number;
  outOfStockBehavior: "show_badge" | "hide_product" | "allow_backorder";
  allowBackorders: boolean;
  stockDeductionPoint: "on_order_created" | "on_payment_success";
  stockReservationMinutes: number;
  autoRestoreOnCancellation: boolean;
  stockDisplayFormat: "exact_count" | "in_stock_badge" | "low_stock_warning_only";
  lowStockAlertEmail: boolean;
  skuPrefix: string;
  barcodeFormat: string;
  autoGenerateBarcode: boolean;
}

export interface NotificationEmailSettings {
  provider: "zeptomail" | "smtp" | "resend";
  senderName: string;
  senderEmail: string;
  adminNotificationEmail: string;
  zeptomail: {
    apiUrl: string;
    apiKey: string;
    hasApiKey?: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    hasPassword?: boolean;
  };
  triggers: {
    orderConfirmation: boolean;
    paymentConfirmation: boolean;
    orderShipped: boolean;
    orderDelivered: boolean;
    orderCancelled: boolean;
    refundProcessed: boolean;
    lowStockAlerts: boolean;
    customerRegistration: boolean;
    passwordReset: boolean;
  };
}

export interface WhatsAppSmsSettings {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  msg91: {
    authKey: string;
    hasAuthKey?: boolean;
    senderId: string;
    otpTemplateId: string;
  };
  whatsapp: {
    provider: string;
    phoneNumberId: string;
    businessAccountId: string;
    apiToken: string;
    hasApiToken?: boolean;
    customerSupportNumber: string;
  };
  otp: {
    length: number;
    expiryMinutes: number;
    maxAttempts: number;
  };
  templates: {
    orderConfirmation: string;
    orderShipped: string;
    orderDelivered: string;
  };
}

export interface SeoWebsiteSettings {
  websiteTitle: string;
  metaDescription: string;
  metaKeywords: string;
  defaultOgImage: string;
  faviconUrl: string;
  canonicalUrl: string;
  robotsTxt: string;
  sitemapEnabled: boolean;
  googleConsoleVerification: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
  ogTitle: string;
  ogDescription: string;
  twitterCardType: "summary" | "summary_large_image";
  twitterHandle: string;
}

export interface StoreMaintenanceSettings {
  storeStatus: "active" | "maintenance" | "coming_soon";
  maintenanceMode: boolean;
  maintenanceMessage: string;
  comingSoonMode: boolean;
  comingSoonMessage: string;
  comingSoonLaunchDate: string | null;
  storeVisibility: "public" | "private";
  customerRegistrationEnabled: boolean;
  guestCheckoutEnabled: boolean;
  productReviewsEnabled: boolean;
  wishlistEnabled: boolean;
  qnaEnabled: boolean;
  allowedIps: string[];
}

export interface AdminSecuritySettings {
  sessionTimeoutMinutes: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  loginAttemptLimits: {
    maxAttempts: number;
    lockoutDurationMinutes: number;
  };
  twoFactorAuthMode: "disabled" | "optional" | "enforced";
  ipRestrictions: {
    enabled: boolean;
    allowedIps: string[];
  };
  apiSecurity: {
    rateLimitingEnabled: boolean;
    maxRequestsPerMinute: number;
  };
}

export interface BackupItem {
  _id: string;
  backupName: string;
  backupType: "manual" | "scheduled" | "export";
  status: "completed" | "failed" | "in_progress";
  fileSizeKb: number;
  totalCollections: number;
  totalDocuments: number;
  collectionsIncluded: string[];
  triggeredBy: string;
  createdAt: string;
  notes?: string;
}

export interface AuditLogItem {
  _id: string;
  section: string;
  action: string;
  performedBy: {
    name: string;
    email: string;
  };
  ipAddress: string;
  changesSummary: string;
  createdAt: string;
}

export interface AllStoreSettings {
  store: StoreGeneralSettings & { branding: StoreBrandingSettings; socialMedia: StoreSocialSettings };
  business: BusinessInfoSettings;
  currency: CurrencyRegionalSettings;
  tax: TaxGstSettings;
  payment: PaymentGatewaysSettings;
  shipping: ShippingDeliverySettings;
  order: OrderManagementSettings;
  inventory: InventoryManagementSettings;
  notification: NotificationEmailSettings;
  whatsappSms: WhatsAppSmsSettings;
  seo: SeoWebsiteSettings;
  maintenance: StoreMaintenanceSettings;
  security: AdminSecuritySettings;
}

export interface PublicStoreSettings {
  storeName: string;
  storeLogo: string;
  storeFavicon: string;
  storeDescription: string;
  storeTagline: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  branding: StoreBrandingSettings;
  socialMedia: StoreSocialSettings;
  currency: {
    defaultCurrency: string;
    symbol: string;
    position: string;
    decimalPlaces: number;
    numberFormat: string;
    rates: Record<string, number>;
  };
  tax: {
    enableTaxes: boolean;
    pricesIncludeTax: boolean;
    defaultTaxRate: number;
  };
  shipping: {
    freeShippingThreshold: number;
    standardShippingFee: number;
    standardDeliveryEstimate: string;
    expressShippingFee: number;
    expressDeliveryEstimate: string;
    codAvailable: boolean;
    codFee: number;
  };
  maintenance: {
    status: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    comingSoonMode: boolean;
    comingSoonMessage: string;
    comingSoonLaunchDate: string | null;
    customerRegistration: boolean;
    guestCheckout: boolean;
    reviewsEnabled: boolean;
    wishlistEnabled: boolean;
    qnaEnabled: boolean;
  };
  seo: {
    websiteTitle: string;
    metaDescription: string;
    defaultOgImage: string;
    faviconUrl: string;
    canonicalUrl: string;
    googleAnalyticsId: string;
    facebookPixelId: string;
    twitterHandle: string;
  };
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// 1. Fetch All Settings for Admin
export async function fetchAllSettings(): Promise<{ success: boolean; settings: AllStoreSettings }> {
  const res = await fetch(`${API_BASE}/settings/all`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch settings (${res.status})`);
  }
  return res.json();
}

// 2. Fetch Public Settings for Storefront
export async function fetchPublicSettings(): Promise<{ success: boolean; settings: PublicStoreSettings }> {
  const res = await apiFetch(`${API_BASE}/settings/public`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch public store settings (${res.status})`);
  }
  return res.json();
}

// 3. Update Settings Section
export async function updateSettingsSection(section: string, data: any): Promise<{ success: boolean; message: string; data: any }> {
  const res = await fetch(`${API_BASE}/settings/section/${section}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || `Failed to update ${section} settings`);
  }
  return resData;
}

// 4. Reset Settings Section
export async function resetSettingsSection(section: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/settings/section/${section}/reset`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || `Failed to reset ${section} settings`);
  }
  return resData;
}

// 5. Send Test Email
export async function sendTestEmail(toEmail: string, provider?: string, customConfig?: any): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/settings/test-email`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ toEmail, provider, customConfig }),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || "Failed to dispatch test email");
  }
  return resData;
}

// 6. Send Test SMS / WhatsApp
export async function sendTestSms(toPhone: string, channel: string = "sms"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/settings/test-sms`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ toPhone, channel }),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || "Failed to test SMS/WhatsApp");
  }
  return resData;
}

// 7. Trigger Backup
export async function triggerBackup(notes?: string): Promise<{ success: boolean; message: string; backup: any }> {
  const res = await fetch(`${API_BASE}/settings/backup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes }),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || "Failed to create database backup");
  }
  return resData;
}

// 8. Fetch Backup History
export async function fetchBackupHistory(): Promise<{ success: boolean; history: BackupItem[] }> {
  const res = await fetch(`${API_BASE}/settings/backup/history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to load backup history");
  }
  return res.json();
}

// 9. Download Backup File
export async function downloadBackupFile(backupId: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/settings/backup/download/${backupId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to download backup file");
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `delivix_backup_${backupId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// 10. Restore from Backup
export async function restoreFromBackup(backupId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/settings/backup/restore/${backupId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData.message || "Failed to restore backup snapshot");
  }
  return resData;
}

// 11. Export Store Data
export async function exportStoreData(entity: string = "products", format: string = "json"): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/export?entity=${entity}&format=${format}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to export data");
  }
  if (format === "csv") {
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivix_${entity}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
  return res.json();
}

// 12. Fetch Audit Logs
export async function fetchAuditLogs(): Promise<{ success: boolean; logs: AuditLogItem[] }> {
  const res = await fetch(`${API_BASE}/settings/audit-logs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to load audit logs");
  }
  return res.json();
}

// 13. Upload image (for logo, favicon, banner)
export async function uploadBrandingImage(fileBase64: string, folder: string = "delivix/branding"): Promise<string> {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ file: fileBase64, folder }),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok || !resData.media?.url) {
    throw new Error(resData.message || "Failed to upload image to cloud storage");
  }
  return resData.media.url;
}

// 14. Legal Pages CRUD helpers
export async function fetchLegalPages(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/pages`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pages || [];
}

export async function fetchLegalPageBySlug(slug: string): Promise<any> {
  const res = await fetch(`${API_BASE}/pages/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.page || null;
}

export async function saveLegalPage(slug: string, pageData: any): Promise<any> {
  const existing = await fetchLegalPageBySlug(slug);
  const method = existing ? "PUT" : "POST";
  const url = existing ? `${API_BASE}/pages/${slug}` : `${API_BASE}/pages`;

  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify({ slug, ...pageData }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to save page ${slug}`);
  }
  return data.page;
}
