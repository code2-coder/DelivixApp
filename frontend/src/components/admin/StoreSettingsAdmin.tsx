import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Store,
  Palette,
  Briefcase,
  Coins,
  Receipt,
  CreditCard,
  Truck,
  ShoppingCart,
  Boxes,
  Mail,
  MessageSquare,
  Globe,
  Share2,
  FileText,
  AlertOctagon,
  Shield,
  Database,
  Save,
  RotateCcw,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  UploadCloud,
  Check,
  X,
  History,
  FileSpreadsheet,
  Send,
  Sliders,
  Copy,
  Lock,
  Smartphone,
  Monitor,
  Info,
} from "lucide-react";

import {
  fetchAllSettings,
  updateSettingsSection,
  resetSettingsSection,
  sendTestEmail,
  sendTestSms,
  triggerBackup,
  fetchBackupHistory,
  downloadBackupFile,
  restoreFromBackup,
  exportStoreData,
  fetchAuditLogs,
  uploadBrandingImage,
  fetchLegalPages,
  saveLegalPage,
  AllStoreSettings,
  BackupItem,
  AuditLogItem,
} from "../../services/settingsApi";

interface StoreSettingsAdminProps {
  adminUser?: any;
  onRefresh?: () => void;
}

type SettingsTab =
  | "general"
  | "branding"
  | "business"
  | "currency"
  | "tax"
  | "payment"
  | "shipping"
  | "order"
  | "inventory"
  | "notification"
  | "whatsappSms"
  | "seo"
  | "social"
  | "legal"
  | "maintenance"
  | "security"
  | "backup";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = [
  { id: "general", label: "General Information", icon: Store },
  { id: "branding", label: "Branding & Appearance", icon: Palette },
  { id: "business", label: "Business Details", icon: Briefcase },
  { id: "currency", label: "Currency & Regional", icon: Coins },
  { id: "tax", label: "Tax & GST Settings", icon: Receipt },
  { id: "payment", label: "Payment Gateways", icon: CreditCard },
  { id: "shipping", label: "Shipping & Delivery", icon: Truck },
  { id: "order", label: "Order Management", icon: ShoppingCart },
  { id: "inventory", label: "Inventory Rules", icon: Boxes },
  { id: "notification", label: "Email & Notifications", icon: Mail },
  { id: "whatsappSms", label: "WhatsApp & SMS", icon: MessageSquare },
  { id: "seo", label: "SEO & Web Optimization", icon: Globe },
  { id: "social", label: "Social Media Channels", icon: Share2 },
  { id: "legal", label: "Legal Pages & Policies", icon: FileText },
  { id: "maintenance", label: "Store Maintenance", icon: AlertOctagon },
  { id: "security", label: "Admin Security", icon: Shield },
  { id: "backup", label: "Backup & Data Export", icon: Database },
];

export default function StoreSettingsAdmin({ adminUser, onRefresh }: StoreSettingsAdminProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState<AllStoreSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<AllStoreSettings | null>(null);

  // Modals & UI states
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Backup states
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupNotes, setBackupNotes] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Test email modal
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(adminUser?.email || "admin@delivix.com");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Test SMS state
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("+91 98765 43210");
  const [sendingTestSms, setSendingTestSms] = useState(false);

  // Secret visibility toggles
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showRazorpayWebhook, setShowRazorpayWebhook] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showZeptoKey, setShowZeptoKey] = useState(false);
  const [showMsg91Key, setShowMsg91Key] = useState(false);
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);

  // Branding preview device
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Legal Pages CMS state
  const [legalPages, setLegalPages] = useState<any[]>([]);
  const [selectedLegalSlug, setSelectedLegalSlug] = useState<string>("privacy-policy");
  const [currentLegalPage, setCurrentLegalPage] = useState({
    slug: "privacy-policy",
    title: "Privacy Policy",
    subtitle: "How we collect, protect and process your data",
    content: "We take your privacy seriously. This policy explains what information Delivix collects...",
    status: "published",
    metaTitle: "Privacy Policy | Delivix",
    metaDescription: "Learn about how Delivix secures your personal information and orders.",
  });
  const [savingLegalPage, setSavingLegalPage] = useState(false);

  // Load all settings on mount
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAllSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
        setOriginalSettings(JSON.parse(JSON.stringify(res.settings)));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load store settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load legal pages when switching to legal tab
  useEffect(() => {
    if (activeTab === "legal") {
      fetchLegalPages().then((pages) => {
        setLegalPages(pages);
        if (pages.length > 0 && !pages.find((p) => p.slug === selectedLegalSlug)) {
          setSelectedLegalSlug(pages[0].slug);
        }
      });
    } else if (activeTab === "backup") {
      loadBackupList();
    }
  }, [activeTab]);

  const loadBackupList = async () => {
    try {
      setLoadingBackups(true);
      const res = await fetchBackupHistory();
      if (res.success) setBackups(res.history);
    } catch (e: any) {
      toast.error(e.message || "Failed to load backup history");
    } finally {
      setLoadingBackups(false);
    }
  };

  const loadAuditHistory = async () => {
    try {
      setLoadingAudit(true);
      setShowAuditModal(true);
      const res = await fetchAuditLogs();
      if (res.success) setAuditLogs(res.logs);
    } catch (e: any) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoadingAudit(false);
    }
  };

  // State update helpers
  const updateField = (section: keyof AllStoreSettings, fieldPath: string, value: any) => {
    if (!settings) return;
    setHasChanges(true);

    setSettings((prev: any) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = fieldPath.split(".");
      let target = copy[section];
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  // Save changes for current tab
  const handleSaveCurrentSection = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      let payload: any = {};

      if (activeTab === "general") {
        payload = {
          storeName: settings.store.storeName,
          storeLogo: settings.store.storeLogo,
          storeFavicon: settings.store.storeFavicon,
          storeDescription: settings.store.storeDescription,
          storeTagline: settings.store.storeTagline,
          storeEmail: settings.store.storeEmail,
          customerSupportEmail: settings.store.customerSupportEmail,
          contactNumber: settings.store.contactNumber,
          whatsappNumber: settings.store.whatsappNumber,
          businessAddress: settings.store.businessAddress,
          city: settings.store.city,
          state: settings.store.state,
          country: settings.store.country,
          pincode: settings.store.pincode,
          googleMapsLocation: settings.store.googleMapsLocation,
          websiteUrl: settings.store.websiteUrl,
        };
        await updateSettingsSection("general", payload);
      } else if (activeTab === "branding") {
        payload = settings.store.branding;
        await updateSettingsSection("branding", payload);
        // Apply CSS variables to current document so change is instant
        applyCssVariables(settings.store.branding);
      } else if (activeTab === "social") {
        payload = settings.store.socialMedia;
        await updateSettingsSection("social", payload);
      } else if (activeTab === "business") {
        payload = settings.business;
        await updateSettingsSection("business", payload);
      } else if (activeTab === "currency") {
        payload = settings.currency;
        await updateSettingsSection("currency", payload);
      } else if (activeTab === "tax") {
        payload = settings.tax;
        await updateSettingsSection("tax", payload);
      } else if (activeTab === "payment") {
        payload = settings.payment;
        await updateSettingsSection("payment", payload);
      } else if (activeTab === "shipping") {
        payload = settings.shipping;
        await updateSettingsSection("shipping", payload);
      } else if (activeTab === "order") {
        payload = settings.order;
        await updateSettingsSection("order", payload);
      } else if (activeTab === "inventory") {
        payload = settings.inventory;
        await updateSettingsSection("inventory", payload);
      } else if (activeTab === "notification") {
        payload = settings.notification;
        await updateSettingsSection("notification", payload);
      } else if (activeTab === "whatsappSms") {
        payload = settings.whatsappSms;
        await updateSettingsSection("whatsappSms", payload);
      } else if (activeTab === "seo") {
        payload = settings.seo;
        await updateSettingsSection("seo", payload);
      } else if (activeTab === "maintenance") {
        payload = settings.maintenance;
        await updateSettingsSection("maintenance", payload);
      } else if (activeTab === "security") {
        payload = settings.security;
        await updateSettingsSection("security", payload);
      }

      toast.success(`${TABS.find((t) => t.id === activeTab)?.label} saved to database!`);
      setHasChanges(false);
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Reset current section to defaults
  const handleResetSection = async () => {
    if (!window.confirm(`Are you sure you want to reset ${TABS.find((t) => t.id === activeTab)?.label} to defaults? This cannot be undone.`)) {
      return;
    }
    try {
      setSaving(true);
      await resetSettingsSection(activeTab);
      toast.success(`${TABS.find((t) => t.id === activeTab)?.label} reset to factory defaults!`);
      await loadData();
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset settings");
    } finally {
      setSaving(false);
    }
  };

  // Image upload helper
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, targetField: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        toast.loading("Uploading image...", { id: "uploading" });
        const uploadedUrl = await uploadBrandingImage(base64, "delivix/branding");
        toast.dismiss("uploading");
        toast.success("Image uploaded successfully!");
        updateField("store", targetField, uploadedUrl);
      } catch (err: any) {
        toast.dismiss("uploading");
        toast.error(err.message || "Image upload failed. Saving local preview instead.");
        updateField("store", targetField, reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply CSS variables dynamically to the document root
  const applyCssVariables = (branding: any) => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primaryColor) root.style.setProperty("--primary-color", branding.primaryColor);
    if (branding.secondaryColor) root.style.setProperty("--secondary-color", branding.secondaryColor);
    if (branding.buttonColor) root.style.setProperty("--btn-color", branding.buttonColor);
    if (branding.borderRadius) root.style.setProperty("--store-radius", branding.borderRadius);
  };

  // Send Test Email Action
  const handleTriggerTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error("Please enter a valid recipient email address");
      return;
    }
    try {
      setSendingTestEmail(true);
      const res = await sendTestEmail(testEmailAddress);
      toast.success(res.message || "Test email dispatched successfully!");
      setShowTestEmailModal(false);
    } catch (e: any) {
      toast.error(e.message || "Test email failed to send");
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Send Test SMS Action
  const handleTriggerTestSms = async (channel: string) => {
    if (!testPhoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }
    try {
      setSendingTestSms(true);
      const res = await sendTestSms(testPhoneNumber, channel);
      toast.success(res.message);
      setShowTestSmsModal(false);
    } catch (e: any) {
      toast.error(e.message || "Test notification failed");
    } finally {
      setSendingTestSms(false);
    }
  };

  // Trigger Backup Action
  const handleCreateBackup = async () => {
    try {
      setLoadingBackups(true);
      toast.loading("Generating database snapshot...", { id: "backup" });
      const res = await triggerBackup(backupNotes);
      toast.dismiss("backup");
      toast.success(`Backup generated! Size: ${res.backup.fileSizeKb} KB (${res.backup.totalDocuments} records)`);
      setBackupNotes("");
      loadBackupList();
    } catch (e: any) {
      toast.dismiss("backup");
      toast.error(e.message || "Failed to generate backup");
    } finally {
      setLoadingBackups(false);
    }
  };

  // Restore Backup Action
  const handleRestoreBackup = async (backupId: string) => {
    if (!window.confirm("WARNING: Restoring this backup will replace current store configuration settings. Are you sure you want to proceed?")) {
      return;
    }
    try {
      setRestoringId(backupId);
      toast.loading("Restoring system snapshot...", { id: "restore" });
      const res = await restoreFromBackup(backupId);
      toast.dismiss("restore");
      toast.success(res.message);
      await loadData();
    } catch (e: any) {
      toast.dismiss("restore");
      toast.error(e.message || "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  // Export Data Action
  const handleExportData = async (entity: string, format: string) => {
    try {
      toast.loading(`Exporting ${entity} as ${format.toUpperCase()}...`, { id: "export" });
      await exportStoreData(entity, format);
      toast.dismiss("export");
      toast.success(`${entity.toUpperCase()} data exported successfully!`);
    } catch (e: any) {
      toast.dismiss("export");
      toast.error(e.message || "Export failed");
    }
  };

  // Legal Page CMS Save
  const handleSaveLegalPage = async () => {
    try {
      setSavingLegalPage(true);
      await saveLegalPage(selectedLegalSlug, currentLegalPage);
      toast.success(`Policy page "${currentLegalPage.title}" published!`);
      const updated = await fetchLegalPages();
      setLegalPages(updated);
    } catch (e: any) {
      toast.error(e.message || "Failed to publish policy page");
    } finally {
      setSavingLegalPage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading Store Settings Architecture...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <h4 className="font-semibold text-red-900">Unable to load Store Settings</h4>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="admin-store-settings-container space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Store Settings & Configuration</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                Production Ready
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Centralized enterprise management for storefront branding, payment gateways, tax GST, logistics, and security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAuditHistory}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition"
          >
            <History className="w-4 h-4 text-gray-500" />
            Audit Logs
          </button>

          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved Changes
            </span>
          )}

          <button
            onClick={handleResetSection}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section
          </button>

          <button
            onClick={handleSaveCurrentSection}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar Navigation + Settings Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-3 space-y-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sticky top-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2">
              Configuration Modules
            </p>
            <div className="space-y-1">
              {TABS.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (hasChanges) {
                        if (!window.confirm("You have unsaved changes in this tab. Switch tabs anyway?")) {
                          return;
                        }
                        setHasChanges(false);
                      }
                      setActiveTab(tab.id);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm font-bold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-400"}`} />
                      <span>{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Canvas */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: GENERAL INFORMATION */}
          {activeTab === "general" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">General Store Information</h3>
                <p className="text-xs text-gray-500">Configure your public store identity, contact details, and location.</p>
              </div>

              {/* Logo & Favicon Upload Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <label className="block text-xs font-bold text-gray-700">Store Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-2">
                      {settings.store.storeLogo ? (
                        <img src={settings.store.storeLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Store className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        id="logo-upload"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "storeLogo")}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Choose Logo Image
                      </label>
                      <p className="text-[10px] text-gray-400">PNG, SVG or WEBP. Max 2MB.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <label className="block text-xs font-bold text-gray-700">Store Favicon</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-2">
                      {settings.store.storeFavicon ? (
                        <img src={settings.store.storeFavicon} alt="Favicon" className="w-8 h-8 object-contain" />
                      ) : (
                        <Globe className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        id="favicon-upload"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "storeFavicon")}
                      />
                      <label
                        htmlFor="favicon-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Favicon
                      </label>
                      <p className="text-[10px] text-gray-400">32x32px or 64x64px ICO/PNG.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store Name *</label>
                  <input
                    type="text"
                    value={settings.store.storeName}
                    onChange={(e) => updateField("store", "storeName", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store Tagline</label>
                  <input
                    type="text"
                    value={settings.store.storeTagline}
                    onChange={(e) => updateField("store", "storeTagline", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Store Email *</label>
                  <input
                    type="email"
                    value={settings.store.storeEmail}
                    onChange={(e) => updateField("store", "storeEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Support Email</label>
                  <input
                    type="email"
                    value={settings.store.customerSupportEmail}
                    onChange={(e) => updateField("store", "customerSupportEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone Number</label>
                  <input
                    type="text"
                    value={settings.store.contactNumber}
                    onChange={(e) => updateField("store", "contactNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp Business Number</label>
                  <input
                    type="text"
                    value={settings.store.whatsappNumber}
                    onChange={(e) => updateField("store", "whatsappNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store Description</label>
                  <textarea
                    rows={2}
                    value={settings.store.storeDescription}
                    onChange={(e) => updateField("store", "storeDescription", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Physical Location */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Physical Store & Fulfillment Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={settings.store.businessAddress}
                      onChange={(e) => updateField("store", "businessAddress", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={settings.store.city}
                      onChange={(e) => updateField("store", "city", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={settings.store.state}
                      onChange={(e) => updateField("store", "state", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={settings.store.country}
                      onChange={(e) => updateField("store", "country", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PIN / Postal Code</label>
                    <input
                      type="text"
                      value={settings.store.pincode}
                      onChange={(e) => updateField("store", "pincode", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Google Maps URL</label>
                    <input
                      type="text"
                      value={settings.store.googleMapsLocation}
                      onChange={(e) => updateField("store", "googleMapsLocation", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRANDING & APPEARANCE */}
          {activeTab === "branding" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Store Branding & Theme Appearance</h3>
                  <p className="text-xs text-gray-500">Live customize your storefront typography, palette, border radii, and buttons.</p>
                </div>
                <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      previewDevice === "desktop" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      previewDevice === "mobile" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>
              </div>

              {/* Color Pickers Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.store.branding.primaryColor || "#111111"}
                      onChange={(e) => updateField("store", "branding.primaryColor", e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={settings.store.branding.primaryColor}
                      onChange={(e) => updateField("store", "branding.primaryColor", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Secondary / Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.store.branding.secondaryColor || "#225c3b"}
                      onChange={(e) => updateField("store", "branding.secondaryColor", e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={settings.store.branding.secondaryColor}
                      onChange={(e) => updateField("store", "branding.secondaryColor", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Button Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.store.branding.buttonColor || "#111111"}
                      onChange={(e) => updateField("store", "branding.buttonColor", e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={settings.store.branding.buttonColor}
                      onChange={(e) => updateField("store", "branding.buttonColor", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Footer Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.store.branding.footerBackground || "#0a0a0a"}
                      onChange={(e) => updateField("store", "branding.footerBackground", e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={settings.store.branding.footerBackground}
                      onChange={(e) => updateField("store", "branding.footerBackground", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Typography & Shape */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Heading Typography</label>
                  <select
                    value={settings.store.branding.headingTypography}
                    onChange={(e) => updateField("store", "branding.headingTypography", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Manrope, sans-serif">Manrope (Clean Modern)</option>
                    <option value="Inter, sans-serif">Inter (Standard SaaS)</option>
                    <option value="Playfair Display, serif">Playfair Display (Luxury Editorial)</option>
                    <option value="Plus Jakarta Sans, sans-serif">Plus Jakarta Sans (High Tech)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Border Radius</label>
                  <select
                    value={settings.store.branding.borderRadius}
                    onChange={(e) => updateField("store", "branding.borderRadius", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="4px">4px (Subtle Sharp)</option>
                    <option value="8px">8px (Modern Standard)</option>
                    <option value="12px">12px (Smooth Curved)</option>
                    <option value="16px">16px (Extra Soft)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Button Style</label>
                  <select
                    value={settings.store.branding.buttonStyle}
                    onChange={(e) => updateField("store", "branding.buttonStyle", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="rounded">Rounded Box</option>
                    <option value="pill">Pill (Fully Rounded)</option>
                    <option value="sharp">Sharp (0px Edges)</option>
                  </select>
                </div>
              </div>

              {/* Live Theme Preview Box */}
              <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    Live Storefront Preview ({previewDevice.toUpperCase()})
                  </span>
                  <span className="text-[11px] text-gray-400">Updates dynamically as you tweak settings</span>
                </div>

                <div
                  className={`mx-auto bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${
                    previewDevice === "mobile" ? "max-w-[340px]" : "w-full"
                  }`}
                  style={{ fontFamily: settings.store.branding.bodyTypography }}
                >
                  {/* Simulated Header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between border-b"
                    style={{ background: settings.store.branding.headerBackground || "#ffffff" }}
                  >
                    <div className="flex items-center gap-2">
                      {settings.store.storeLogo ? (
                        <img src={settings.store.storeLogo} alt="Logo" className="h-5 object-contain" />
                      ) : (
                        <span
                          className="font-bold text-sm tracking-tight"
                          style={{
                            fontFamily: settings.store.branding.headingTypography,
                            color: settings.store.branding.primaryColor,
                          }}
                        >
                          {settings.store.storeName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 text-[11px]">Shop</span>
                      <span className="text-gray-500 text-[11px]">Deals</span>
                    </div>
                  </div>

                  {/* Simulated Hero Card */}
                  <div className="p-6 text-center space-y-3">
                    <span
                      className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{
                        backgroundColor: settings.store.branding.secondaryColor,
                        borderRadius: settings.store.branding.borderRadius,
                      }}
                    >
                      New Season Arrivals
                    </span>
                    <h3
                      className="text-lg font-bold"
                      style={{
                        fontFamily: settings.store.branding.headingTypography,
                        color: settings.store.branding.textColor,
                      }}
                    >
                      Curated Premium Electronics & Lifestyle
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      {settings.store.storeDescription || "Delivering exceptional shopping directly to your door."}
                    </p>
                    <button
                      className="px-5 py-2 text-xs font-semibold text-white shadow-sm transition"
                      style={{
                        backgroundColor: settings.store.branding.buttonColor,
                        borderRadius:
                          settings.store.branding.buttonStyle === "pill"
                            ? "9999px"
                            : settings.store.branding.buttonStyle === "sharp"
                            ? "0px"
                            : settings.store.branding.borderRadius,
                      }}
                    >
                      Explore Catalog
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BUSINESS INFORMATION */}
          {activeTab === "business" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Legal Business Information & Invoicing</h3>
                <p className="text-xs text-gray-500">Corporate registration, taxation IDs, and billing details for invoices.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Legal Business Name *</label>
                  <input
                    type="text"
                    value={settings.business.legalBusinessName}
                    onChange={(e) => updateField("business", "legalBusinessName", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Business Type</label>
                  <select
                    value={settings.business.businessType}
                    onChange={(e) => updateField("business", "businessType", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="LLP">Limited Liability Partnership (LLP)</option>
                    <option value="Partnership">Partnership Firm</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">CIN / Registration Number</label>
                  <input
                    type="text"
                    value={settings.business.registrationNumber}
                    onChange={(e) => updateField("business", "registrationNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={settings.business.panNumber}
                    onChange={(e) => updateField("business", "panNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Corporate GSTIN</label>
                  <input
                    type="text"
                    value={settings.business.gstin}
                    onChange={(e) => updateField("business", "gstin", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Billing Phone</label>
                  <input
                    type="text"
                    value={settings.business.contactPhone}
                    onChange={(e) => updateField("business", "contactPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Invoice Customization */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Invoice Document Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number Prefix</label>
                    <input
                      type="text"
                      value={settings.business.invoicePrefix}
                      onChange={(e) => updateField("business", "invoicePrefix", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Billing Support Email</label>
                    <input
                      type="email"
                      value={settings.business.contactEmail}
                      onChange={(e) => updateField("business", "contactEmail", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Notes (Footer)</label>
                    <input
                      type="text"
                      value={settings.business.invoiceNotes}
                      onChange={(e) => updateField("business", "invoiceNotes", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Terms & Conditions</label>
                    <textarea
                      rows={2}
                      value={settings.business.invoiceTerms}
                      onChange={(e) => updateField("business", "invoiceTerms", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CURRENCY & REGIONAL */}
          {activeTab === "currency" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Currency & Regional Settings</h3>
                <p className="text-xs text-gray-500">Configure store base currency, decimal places, number formats, and live exchange rates.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Default Store Currency *</label>
                  <select
                    value={settings.currency.defaultCurrency}
                    onChange={(e) => updateField("currency", "defaultCurrency", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-bold"
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="AUD">AUD (A$ - Australian Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="AED">AED (د.إ - UAE Dirham)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currency.currencySymbol}
                    onChange={(e) => updateField("currency", "currencySymbol", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Symbol Position</label>
                  <select
                    value={settings.currency.currencyPosition}
                    onChange={(e) => updateField("currency", "currencyPosition", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="left">Left (e.g. ₹100)</option>
                    <option value="left_with_space">Left with space (e.g. ₹ 100)</option>
                    <option value="right">Right (e.g. 100₹)</option>
                    <option value="right_with_space">Right with space (e.g. 100 ₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Decimal Places</label>
                  <select
                    value={settings.currency.decimalPlaces}
                    onChange={(e) => updateField("currency", "decimalPlaces", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value={0}>0 (e.g. ₹100)</option>
                    <option value={2}>2 (e.g. ₹100.50)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Number Formatting</label>
                  <select
                    value={settings.currency.numberFormat}
                    onChange={(e) => updateField("currency", "numberFormat", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="indian">Indian (Lakhs & Crores: 1,00,000)</option>
                    <option value="international">International (Millions: 100,000)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Time Zone</label>
                  <select
                    value={settings.currency.timeZone}
                    onChange={(e) => updateField("currency", "timeZone", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
              </div>

              {/* Exchange Rates Table */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Exchange Rates (Base: {settings.currency.baseCurrency})
                  </h4>
                  <span className="text-[11px] text-gray-400">1 {settings.currency.baseCurrency} in foreign currencies</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(settings.currency.exchangeRates || {}).map(([code, rate]) => (
                    <div key={code} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">{code}</span>
                        <span className="text-[10px] text-gray-400">Rate</span>
                      </div>
                      <input
                        type="number"
                        step="0.0001"
                        value={rate}
                        onChange={(e) => {
                          const newRates = { ...settings.currency.exchangeRates, [code]: Number(e.target.value) };
                          updateField("currency", "exchangeRates", newRates);
                        }}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TAX & GST */}
          {activeTab === "tax" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Tax & GST Configuration</h3>
                <p className="text-xs text-gray-500">Configure Indian GST rules, Intra-state (CGST+SGST), Inter-state (IGST), and tax inclusivity.</p>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <strong className="text-xs font-bold text-gray-900 block">Enable Automated Taxes</strong>
                    <span className="text-[11px] text-gray-500">Calculate GST on carts and orders automatically</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tax.enableTaxes}
                    onChange={(e) => updateField("tax", "enableTaxes", e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <strong className="text-xs font-bold text-gray-900 block">Tax-Inclusive Catalog Pricing</strong>
                    <span className="text-[11px] text-gray-500">Product prices in catalog already include GST</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.tax.pricesIncludeTax}
                    onChange={(e) => updateField("tax", "pricesIncludeTax", e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* GST Rates Slab */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store Origin State *</label>
                  <input
                    type="text"
                    value={settings.tax.storeOriginState}
                    onChange={(e) => updateField("tax", "storeOriginState", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Orders within this state apply CGST + SGST</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Intra-State CGST Rate (%)</label>
                  <input
                    type="number"
                    value={settings.tax.intraStateCGST}
                    onChange={(e) => updateField("tax", "intraStateCGST", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Intra-State SGST Rate (%)</label>
                  <input
                    type="number"
                    value={settings.tax.intraStateSGST}
                    onChange={(e) => updateField("tax", "intraStateSGST", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Inter-State IGST Rate (%)</label>
                  <input
                    type="number"
                    value={settings.tax.interStateIGST}
                    onChange={(e) => updateField("tax", "interStateIGST", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Applied when customer state differs from store origin</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Default HSN / SAC Code</label>
                  <input
                    type="text"
                    value={settings.tax.defaultHsnCode}
                    onChange={(e) => updateField("tax", "defaultHsnCode", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Show Tax Breakdown on Invoice</label>
                  <select
                    value={settings.tax.showTaxBreakdownOnInvoice ? "yes" : "no"}
                    onChange={(e) => updateField("tax", "showTaxBreakdownOnInvoice", e.target.value === "yes")}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="yes">Yes (Itemized CGST/SGST/IGST)</option>
                    <option value="no">No (Combined GST only)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PAYMENTS */}
          {activeTab === "payment" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Payment Gateway Integrations</h3>
                <p className="text-xs text-gray-500">
                  Configure live and sandbox credentials for Razorpay, Stripe, Cash on Delivery, and Direct Bank Transfers.
                </p>
              </div>

              {/* RAZORPAY */}
              <div className="p-5 border border-gray-200 rounded-2xl space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      R
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Razorpay (India UPI, Cards & NetBanking)</h4>
                      <p className="text-[11px] text-gray-500">Supports UPI QR, GPay, PhonePe, Paytm, and EMI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">Active</span>
                    <input
                      type="checkbox"
                      checked={settings.payment.razorpay.enabled}
                      onChange={(e) => updateField("payment", "razorpay.enabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Environment Mode</label>
                    <select
                      value={settings.payment.razorpay.testMode ? "test" : "live"}
                      onChange={(e) => updateField("payment", "razorpay.testMode", e.target.value === "test")}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="test">Test / Sandbox Mode</option>
                      <option value="live">Live Production</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Razorpay Key ID</label>
                    <input
                      type="text"
                      value={settings.payment.razorpay.keyId}
                      onChange={(e) => updateField("payment", "razorpay.keyId", e.target.value)}
                      placeholder="rzp_live_..."
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Razorpay Key Secret</label>
                    <div className="relative">
                      <input
                        type={showRazorpaySecret ? "text" : "password"}
                        value={settings.payment.razorpay.keySecret}
                        onChange={(e) => updateField("payment", "razorpay.keySecret", e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRazorpaySecret(!showRazorpaySecret)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showRazorpaySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Webhook Secret</label>
                    <div className="relative">
                      <input
                        type={showRazorpayWebhook ? "text" : "password"}
                        value={settings.payment.razorpay.webhookSecret}
                        onChange={(e) => updateField("payment", "razorpay.webhookSecret", e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRazorpayWebhook(!showRazorpayWebhook)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showRazorpayWebhook ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* STRIPE */}
              <div className="p-5 border border-gray-200 rounded-2xl space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#635BFF] text-white flex items-center justify-center font-bold text-sm">
                      S
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Stripe (International Credit/Debit Cards)</h4>
                      <p className="text-[11px] text-gray-500">Supports USD, AUD, EUR, GBP, Apple Pay & Google Pay</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">Active</span>
                    <input
                      type="checkbox"
                      checked={settings.payment.stripe.enabled}
                      onChange={(e) => updateField("payment", "stripe.enabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Stripe Publishable Key</label>
                    <input
                      type="text"
                      value={settings.payment.stripe.publishableKey}
                      onChange={(e) => updateField("payment", "stripe.publishableKey", e.target.value)}
                      placeholder="pk_live_..."
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Stripe Secret Key</label>
                    <div className="relative">
                      <input
                        type={showStripeSecret ? "text" : "password"}
                        value={settings.payment.stripe.secretKey}
                        onChange={(e) => updateField("payment", "stripe.secretKey", e.target.value)}
                        placeholder="sk_live_••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStripeSecret(!showStripeSecret)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showStripeSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CASH ON DELIVERY */}
              <div className="p-5 border border-gray-200 rounded-2xl space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      ₹
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Cash on Delivery (COD)</h4>
                      <p className="text-[11px] text-gray-500">Collect payment upon parcel arrival</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">Active</span>
                    <input
                      type="checkbox"
                      checked={settings.payment.cod.enabled}
                      onChange={(e) => updateField("payment", "cod.enabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Min Order Amount (₹)</label>
                    <input
                      type="number"
                      value={settings.payment.cod.minOrderAmount}
                      onChange={(e) => updateField("payment", "cod.minOrderAmount", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Max Order Limit (₹)</label>
                    <input
                      type="number"
                      value={settings.payment.cod.maxOrderAmount}
                      onChange={(e) => updateField("payment", "cod.maxOrderAmount", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Additional COD Handling Fee (₹)</label>
                    <input
                      type="number"
                      value={settings.payment.cod.fee}
                      onChange={(e) => updateField("payment", "cod.fee", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* BANK TRANSFER */}
              <div className="p-5 border border-gray-200 rounded-2xl space-y-4 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                      B
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Direct Bank Transfer / NEFT / RTGS</h4>
                      <p className="text-[11px] text-gray-500">Customer transfers directly to your corporate account</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-600">Active</span>
                    <input
                      type="checkbox"
                      checked={settings.payment.bankTransfer.enabled}
                      onChange={(e) => updateField("payment", "bankTransfer.enabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {settings.payment.bankTransfer.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={settings.payment.bankTransfer.bankName}
                        onChange={(e) => updateField("payment", "bankTransfer.bankName", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={settings.payment.bankTransfer.accountHolderName}
                        onChange={(e) => updateField("payment", "bankTransfer.accountHolderName", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={settings.payment.bankTransfer.accountNumber}
                        onChange={(e) => updateField("payment", "bankTransfer.accountNumber", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">IFSC / Routing Code</label>
                      <input
                        type="text"
                        value={settings.payment.bankTransfer.ifscCode}
                        onChange={(e) => updateField("payment", "bankTransfer.ifscCode", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SHIPPING & DELIVERY */}
          {activeTab === "shipping" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Shipping & Delivery Rates</h3>
                <p className="text-xs text-gray-500">Configure standard & express delivery charges, free shipping thresholds, and origin hubs.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Standard Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settings.shipping.standardShippingFee}
                    onChange={(e) => updateField("shipping", "standardShippingFee", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Express Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settings.shipping.expressShippingFee}
                    onChange={(e) => updateField("shipping", "expressShippingFee", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Free Shipping Order Threshold (₹)</label>
                  <input
                    type="number"
                    value={settings.shipping.freeShippingThreshold}
                    onChange={(e) => updateField("shipping", "freeShippingThreshold", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Orders above this qualify for free standard delivery</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Standard Delivery Estimate</label>
                  <input
                    type="text"
                    value={settings.shipping.standardDeliveryEstimate}
                    onChange={(e) => updateField("shipping", "standardDeliveryEstimate", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Express Delivery Estimate</label>
                  <input
                    type="text"
                    value={settings.shipping.expressDeliveryEstimate}
                    onChange={(e) => updateField("shipping", "expressDeliveryEstimate", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">International Shipping</label>
                  <select
                    value={settings.shipping.internationalShippingEnabled ? "yes" : "no"}
                    onChange={(e) => updateField("shipping", "internationalShippingEnabled", e.target.value === "yes")}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="yes">Enabled (Global Dispatch)</option>
                    <option value="no">Disabled (Domestic Only)</option>
                  </select>
                </div>
              </div>

              {/* Origin Address */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Shipping Origin & Pickup Facility</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Hub Name</label>
                    <input
                      type="text"
                      value={settings.shipping.originAddress.companyName}
                      onChange={(e) => updateField("shipping", "originAddress.companyName", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={settings.shipping.originAddress.city}
                      onChange={(e) => updateField("shipping", "originAddress.city", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={settings.shipping.originAddress.pinCode}
                      onChange={(e) => updateField("shipping", "originAddress.pinCode", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ORDER SETTINGS */}
          {activeTab === "order" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Order Processing & Cancellation Rules</h3>
                <p className="text-xs text-gray-500">Configure order numbering prefixes, cancellation windows, and return policies.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Order ID Prefix</label>
                  <input
                    type="text"
                    value={settings.order.orderIdPrefix}
                    onChange={(e) => updateField("order", "orderIdPrefix", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-bold"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">e.g. DLX- creates DLX-982341</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Cancellation Window</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.order.cancellationWindowHours}
                      onChange={(e) => updateField("order", "cancellationWindowHours", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-500">hours</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Return Window</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.order.returnWindowDays}
                      onChange={(e) => updateField("order", "returnWindowDays", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Refund Processing Mode</label>
                  <select
                    value={settings.order.refundMode}
                    onChange={(e) => updateField("order", "refundMode", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="automatic_source">Automatic Refund to Original Payment Source</option>
                    <option value="manual_approval">Manual Admin Review & Approval Required</option>
                    <option value="store_credit">Store Credit / Wallet Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Instant Order Confirmation</label>
                  <select
                    value={settings.order.instantConfirmation ? "yes" : "no"}
                    onChange={(e) => updateField("order", "instantConfirmation", e.target.value === "yes")}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="yes">Yes (Immediate Confirmed Status)</option>
                    <option value="no">No (Held in Pending Status)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Auto-Generate Packing Slips</label>
                  <select
                    value={settings.order.autoGeneratePackingSlip ? "yes" : "no"}
                    onChange={(e) => updateField("order", "autoGeneratePackingSlip", e.target.value === "yes")}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="yes">Yes (Upon Order Creation)</option>
                    <option value="no">No (Manual On-Demand)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: INVENTORY SETTINGS */}
          {activeTab === "inventory" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Inventory & Stock Rules</h3>
                <p className="text-xs text-gray-500">Configure stock reservation, backorder handling, and low-stock warning thresholds.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Low Stock Warning Threshold</label>
                  <input
                    type="number"
                    value={settings.inventory.defaultLowStockThreshold}
                    onChange={(e) => updateField("inventory", "defaultLowStockThreshold", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Triggers admin alert when product units drop below this</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Out-of-Stock Behavior</label>
                  <select
                    value={settings.inventory.outOfStockBehavior}
                    onChange={(e) => updateField("inventory", "outOfStockBehavior", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="show_badge">Show 'Out of Stock' Badge (Keep Visible)</option>
                    <option value="hide_product">Automatically Hide Product from Storefront</option>
                    <option value="allow_backorder">Allow Backorders & Pre-orders</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Reservation Timeout</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.inventory.stockReservationMinutes}
                      onChange={(e) => updateField("inventory", "stockReservationMinutes", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-500">mins</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Duration cart holds stock before returning to pool</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Restoration</label>
                  <select
                    value={settings.inventory.autoRestoreOnCancellation ? "yes" : "no"}
                    onChange={(e) => updateField("inventory", "autoRestoreOnCancellation", e.target.value === "yes")}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="yes">Automatically Restore Stock on Cancel/Refund</option>
                    <option value="no">Require Manual Stock Readjustment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">SKU Generation Prefix</label>
                  <input
                    type="text"
                    value={settings.inventory.skuPrefix}
                    onChange={(e) => updateField("inventory", "skuPrefix", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Barcode Standard</label>
                  <select
                    value={settings.inventory.barcodeFormat}
                    onChange={(e) => updateField("inventory", "barcodeFormat", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="Code128">Code 128 (Standard Industrial)</option>
                    <option value="EAN13">EAN-13 (Retail Standard)</option>
                    <option value="UPC">UPC-A (North America)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: EMAIL & NOTIFICATIONS */}
          {activeTab === "notification" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Email & Transactional Notifications</h3>
                  <p className="text-xs text-gray-500">Configure ZeptoMail API or Custom SMTP credentials and order lifecycle triggers.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestEmailModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test Email
                </button>
              </div>

              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Delivery Provider</label>
                  <select
                    value={settings.notification.provider}
                    onChange={(e) => updateField("notification", "provider", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-bold"
                  >
                    <option value="zeptomail">ZeptoMail (Zoho API - Default)</option>
                    <option value="smtp">Custom SMTP Server (Nodemailer)</option>
                    <option value="resend">Resend API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sender Display Name</label>
                  <input
                    type="text"
                    value={settings.notification.senderName}
                    onChange={(e) => updateField("notification", "senderName", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sender Email Address</label>
                  <input
                    type="email"
                    value={settings.notification.senderEmail}
                    onChange={(e) => updateField("notification", "senderEmail", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* ZeptoMail Config */}
              {settings.notification.provider === "zeptomail" && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">ZeptoMail API Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">ZeptoMail API URL</label>
                      <input
                        type="text"
                        value={settings.notification.zeptomail.apiUrl}
                        onChange={(e) => updateField("notification", "zeptomail.apiUrl", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">API Key (Send Mail Token)</label>
                      <div className="relative">
                        <input
                          type={showZeptoKey ? "text" : "password"}
                          value={settings.notification.zeptomail.apiKey}
                          onChange={(e) => updateField("notification", "zeptomail.apiKey", e.target.value)}
                          placeholder="Zoho-enczapikey-..."
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowZeptoKey(!showZeptoKey)}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {showZeptoKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SMTP Config */}
              {settings.notification.provider === "smtp" && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">SMTP Server Credentials</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.notification.smtp.host}
                        onChange={(e) => updateField("notification", "smtp.host", e.target.value)}
                        placeholder="smtp.example.com"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={settings.notification.smtp.port}
                        onChange={(e) => updateField("notification", "smtp.port", Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">SSL/TLS</label>
                      <select
                        value={settings.notification.smtp.secure ? "yes" : "no"}
                        onChange={(e) => updateField("notification", "smtp.secure", e.target.value === "yes")}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      >
                        <option value="no">STARTTLS (Port 587)</option>
                        <option value="yes">SSL / TLS (Port 465)</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={settings.notification.smtp.username}
                        onChange={(e) => updateField("notification", "smtp.username", e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">SMTP Password</label>
                      <div className="relative">
                        <input
                          type={showSmtpPassword ? "text" : "password"}
                          value={settings.notification.smtp.password}
                          onChange={(e) => updateField("notification", "smtp.password", e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Event Triggers Checklist */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Automated Notification Triggers</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: "orderConfirmation", label: "Order Placed" },
                    { key: "paymentConfirmation", label: "Payment Received" },
                    { key: "orderShipped", label: "Parcel Dispatched" },
                    { key: "orderDelivered", label: "Parcel Delivered" },
                    { key: "orderCancelled", label: "Order Cancelled" },
                    { key: "refundProcessed", label: "Refund Processed" },
                    { key: "lowStockAlerts", label: "Admin Low Stock Alert" },
                    { key: "customerRegistration", label: "Welcome New User" },
                    { key: "passwordReset", label: "Password Reset OTP" },
                  ].map((trigger) => (
                    <label
                      key={trigger.key}
                      className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 text-xs text-gray-700 font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean((settings.notification.triggers as any)?.[trigger.key])}
                        onChange={(e) => updateField("notification", `triggers.${trigger.key}`, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span>{trigger.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: WHATSAPP & SMS */}
          {activeTab === "whatsappSms" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">WhatsApp & SMS Gateway Settings</h3>
                  <p className="text-xs text-gray-500">Configure MSG91 SMS, Meta WhatsApp Business API, and automated dispatch templates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestSmsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Test SMS / WhatsApp
                </button>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <strong className="text-xs font-bold text-gray-900 block">Enable MSG91 SMS Alerts</strong>
                    <span className="text-[11px] text-gray-500">Send transactional SMS for order dispatch and OTP</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.whatsappSms.smsEnabled}
                    onChange={(e) => updateField("whatsappSms", "smsEnabled", e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <strong className="text-xs font-bold text-gray-900 block">Enable WhatsApp Business API</strong>
                    <span className="text-[11px] text-gray-500">Dispatch interactive WhatsApp updates with tracking links</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.whatsappSms.whatsappEnabled}
                    onChange={(e) => updateField("whatsappSms", "whatsappEnabled", e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* MSG91 Fields */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">MSG91 Credentials</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">MSG91 Sender ID</label>
                    <input
                      type="text"
                      value={settings.whatsappSms.msg91.senderId}
                      onChange={(e) => updateField("whatsappSms", "msg91.senderId", e.target.value)}
                      placeholder="DELIVX"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">OTP Flow Template ID</label>
                    <input
                      type="text"
                      value={settings.whatsappSms.msg91.otpTemplateId}
                      onChange={(e) => updateField("whatsappSms", "msg91.otpTemplateId", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">MSG91 Auth Key</label>
                    <div className="relative">
                      <input
                        type={showMsg91Key ? "text" : "password"}
                        value={settings.whatsappSms.msg91.authKey}
                        onChange={(e) => updateField("whatsappSms", "msg91.authKey", e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMsg91Key(!showMsg91Key)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showMsg91Key ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Business API */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">WhatsApp Business API (Cloud API)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number ID</label>
                    <input
                      type="text"
                      value={settings.whatsappSms.whatsapp.phoneNumberId}
                      onChange={(e) => updateField("whatsappSms", "whatsapp.phoneNumberId", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Support Phone</label>
                    <input
                      type="text"
                      value={settings.whatsappSms.whatsapp.customerSupportNumber}
                      onChange={(e) => updateField("whatsappSms", "whatsapp.customerSupportNumber", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp System User Token</label>
                    <div className="relative">
                      <input
                        type={showWhatsAppToken ? "text" : "password"}
                        value={settings.whatsappSms.whatsapp.apiToken}
                        onChange={(e) => updateField("whatsappSms", "whatsapp.apiToken", e.target.value)}
                        placeholder="EAAB••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showWhatsAppToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: SEO & WEBSITE */}
          {activeTab === "seo" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">SEO & Web Visibility Optimization</h3>
                  <p className="text-xs text-gray-500">Configure global metadata, search engine crawlers, sitemap, and analytics tags.</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    View robots.txt <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    View sitemap.xml <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Global Website Meta Title *</label>
                  <input
                    type="text"
                    value={settings.seo.websiteTitle}
                    onChange={(e) => updateField("seo", "websiteTitle", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Meta Description *</label>
                  <textarea
                    rows={2}
                    value={settings.seo.metaDescription}
                    onChange={(e) => updateField("seo", "metaDescription", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Canonical Base URL</label>
                  <input
                    type="text"
                    value={settings.seo.canonicalUrl}
                    onChange={(e) => updateField("seo", "canonicalUrl", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Google Analytics 4 Measurement ID</label>
                  <input
                    type="text"
                    value={settings.seo.googleAnalyticsId}
                    onChange={(e) => updateField("seo", "googleAnalyticsId", e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Meta / Facebook Pixel ID</label>
                  <input
                    type="text"
                    value={settings.seo.facebookPixelId}
                    onChange={(e) => updateField("seo", "facebookPixelId", e.target.value)}
                    placeholder="1234567890"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Google Search Console Verification Tag</label>
                  <input
                    type="text"
                    value={settings.seo.googleConsoleVerification}
                    onChange={(e) => updateField("seo", "googleConsoleVerification", e.target.value)}
                    placeholder="google-site-verification=..."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Custom robots.txt Content</label>
                  <textarea
                    rows={3}
                    value={settings.seo.robotsTxt}
                    onChange={(e) => updateField("seo", "robotsTxt", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 13: SOCIAL MEDIA */}
          {activeTab === "social" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Social Media Channels</h3>
                <p className="text-xs text-gray-500">Configure your official social handles shown in storefront headers, footers, and emails.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Instagram URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.instagram}
                    onChange={(e) => updateField("store", "socialMedia.instagram", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Facebook Page URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.facebook}
                    onChange={(e) => updateField("store", "socialMedia.facebook", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">YouTube Channel URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.youtube}
                    onChange={(e) => updateField("store", "socialMedia.youtube", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">LinkedIn Profile / Company URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.linkedin}
                    onChange={(e) => updateField("store", "socialMedia.linkedin", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pinterest Page URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.pinterest}
                    onChange={(e) => updateField("store", "socialMedia.pinterest", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">X (Twitter) Profile URL</label>
                  <input
                    type="text"
                    value={settings.store.socialMedia.twitter}
                    onChange={(e) => updateField("store", "socialMedia.twitter", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 14: LEGAL PAGES & POLICIES */}
          {activeTab === "legal" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Legal Pages & Terms Content Management</h3>
                  <p className="text-xs text-gray-500">Edit, draft, and publish your Terms of Service, Privacy Policy, Shipping & Refund terms.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveLegalPage}
                  disabled={savingLegalPage}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {savingLegalPage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Publish Legal Page
                </button>
              </div>

              {/* Policy Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
                {[
                  { slug: "privacy-policy", title: "Privacy Policy" },
                  { slug: "terms-and-conditions", title: "Terms & Conditions" },
                  { slug: "refund-policy", title: "Refund Policy" },
                  { slug: "return-policy", title: "Return Policy" },
                  { slug: "shipping-policy", title: "Shipping Policy" },
                  { slug: "cancellation-policy", title: "Cancellation Policy" },
                  { slug: "about-us", title: "About Us" },
                  { slug: "contact-us", title: "Contact Us" },
                ].map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      setSelectedLegalSlug(p.slug);
                      const existing = legalPages.find((item) => item.slug === p.slug);
                      if (existing) {
                        setCurrentLegalPage({
                          slug: existing.slug,
                          title: existing.title || p.title,
                          subtitle: existing.subtitle || "",
                          content: existing.content || (existing.sections?.[0]?.content) || "",
                          status: existing.status || "published",
                          metaTitle: existing.metaTitle || `${p.title} | Delivix`,
                          metaDescription: existing.metaDescription || "",
                        });
                      } else {
                        setCurrentLegalPage({
                          slug: p.slug,
                          title: p.title,
                          subtitle: `Official store policy for ${p.title.toLowerCase()}`,
                          content: `Welcome to Delivix. This ${p.title} sets forth our practices...`,
                          status: "published",
                          metaTitle: `${p.title} | Delivix`,
                          metaDescription: `Read our comprehensive ${p.title}.`,
                        });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedLegalSlug === p.slug
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>

              {/* Editor Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={currentLegalPage.title}
                      onChange={(e) => setCurrentLegalPage({ ...currentLegalPage, title: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Publication Status</label>
                    <select
                      value={currentLegalPage.status}
                      onChange={(e) => setCurrentLegalPage({ ...currentLegalPage, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    >
                      <option value="published">Published & Live</option>
                      <option value="draft">Draft (Hidden from Public)</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Page Subtitle / Summary</label>
                    <input
                      type="text"
                      value={currentLegalPage.subtitle}
                      onChange={(e) => setCurrentLegalPage({ ...currentLegalPage, subtitle: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Content (Markdown / HTML)</label>
                    <textarea
                      rows={12}
                      value={currentLegalPage.content}
                      onChange={(e) => setCurrentLegalPage({ ...currentLegalPage, content: e.target.value })}
                      className="w-full px-4 py-3 text-xs border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 15: MAINTENANCE MODE */}
          {activeTab === "maintenance" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Store Maintenance & Feature Flags</h3>
                <p className="text-xs text-gray-500">Put the storefront into maintenance mode or selectively toggle store features.</p>
              </div>

              {/* Status Selector */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Storefront Status Mode</h4>
                    <p className="text-[11px] text-amber-700">When maintenance mode is active, customers see an maintenance screen while admins have access.</p>
                  </div>
                  <select
                    value={settings.maintenance.storeStatus}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      updateField("maintenance", "storeStatus", val);
                      updateField("maintenance", "maintenanceMode", val === "maintenance");
                      updateField("maintenance", "comingSoonMode", val === "coming_soon");
                    }}
                    className="px-3 py-2 text-xs font-bold border border-amber-300 rounded-lg bg-white"
                  >
                    <option value="active">Active (Normal Operation)</option>
                    <option value="maintenance">Maintenance Mode</option>
                    <option value="coming_soon">Coming Soon Splash</option>
                  </select>
                </div>

                {settings.maintenance.storeStatus === "maintenance" && (
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">Maintenance Notice Message</label>
                    <textarea
                      rows={2}
                      value={settings.maintenance.maintenanceMessage}
                      onChange={(e) => updateField("maintenance", "maintenanceMessage", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Feature Toggles */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Storefront Functional Controls</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <strong className="text-xs font-bold text-gray-900 block">Customer Account Registration</strong>
                      <span className="text-[11px] text-gray-500">Allow new shoppers to sign up</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenance.customerRegistrationEnabled}
                      onChange={(e) => updateField("maintenance", "customerRegistrationEnabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <strong className="text-xs font-bold text-gray-900 block">Guest Checkout</strong>
                      <span className="text-[11px] text-gray-500">Allow orders without account registration</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenance.guestCheckoutEnabled}
                      onChange={(e) => updateField("maintenance", "guestCheckoutEnabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <strong className="text-xs font-bold text-gray-900 block">Product Reviews & Ratings</strong>
                      <span className="text-[11px] text-gray-500">Allow customers to submit and view reviews</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenance.productReviewsEnabled}
                      onChange={(e) => updateField("maintenance", "productReviewsEnabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <strong className="text-xs font-bold text-gray-900 block">Customer Wishlist</strong>
                      <span className="text-[11px] text-gray-500">Enable heart bookmarking and wishlist</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenance.wishlistEnabled}
                      onChange={(e) => updateField("maintenance", "wishlistEnabled", e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 16: ADMIN SECURITY */}
          {activeTab === "security" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Admin Security & Access Controls</h3>
                <p className="text-xs text-gray-500">Session lifespans, password complexity policies, and brute-force attempt limits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Session Timeout</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.security.sessionTimeoutMinutes}
                      onChange={(e) => updateField("security", "sessionTimeoutMinutes", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-500">mins</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Max Login Attempts (Lockout)</label>
                  <input
                    type="number"
                    value={settings.security.loginAttemptLimits.maxAttempts}
                    onChange={(e) => updateField("security", "loginAttemptLimits.maxAttempts", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Lockout Duration</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.security.loginAttemptLimits.lockoutDurationMinutes}
                      onChange={(e) => updateField("security", "loginAttemptLimits.lockoutDurationMinutes", Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-500">mins</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Two-Factor Authentication (2FA)</label>
                  <select
                    value={settings.security.twoFactorAuthMode}
                    onChange={(e) => updateField("security", "twoFactorAuthMode", e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="disabled">Disabled</option>
                    <option value="optional">Optional for Staff</option>
                    <option value="enforced">Strictly Enforced (All Admins)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Minimum Password Length</label>
                  <input
                    type="number"
                    value={settings.security.passwordPolicy.minLength}
                    onChange={(e) => updateField("security", "passwordPolicy.minLength", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">API Rate Limiting (per min)</label>
                  <input
                    type="number"
                    value={settings.security.apiSecurity.maxRequestsPerMinute}
                    onChange={(e) => updateField("security", "apiSecurity.maxRequestsPerMinute", Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 17: BACKUP & DATA MANAGEMENT */}
          {activeTab === "backup" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-base font-bold text-gray-900">Backup, Data Export & Restore Management</h3>
                <p className="text-xs text-gray-500">Generate on-demand database snapshots, download archives, and export store entities as CSV or JSON.</p>
              </div>

              {/* Backup Trigger Card */}
              <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900">Create New Database Snapshot</h4>
                  <p className="text-[11px] text-indigo-700">Exports all products, categories, pages, settings, and orders into an immutable backup package.</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Optional backup note..."
                    value={backupNotes}
                    onChange={(e) => setBackupNotes(e.target.value)}
                    className="px-3 py-2 text-xs border border-indigo-200 rounded-lg bg-white"
                  />
                  <button
                    onClick={handleCreateBackup}
                    disabled={loadingBackups}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Backup Now
                  </button>
                </div>
              </div>

              {/* Data Export Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Direct Data Export Tools</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "products", label: "Catalog Products" },
                    { key: "orders", label: "Sales Orders" },
                    { key: "customers", label: "Registered Users" },
                    { key: "inventory", label: "Stock Ledger" },
                  ].map((item) => (
                    <div key={item.key} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <strong className="text-xs text-gray-800 block">{item.label}</strong>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExportData(item.key, "csv")}
                          className="flex-1 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> CSV
                        </button>
                        <button
                          onClick={() => handleExportData(item.key, "json")}
                          className="flex-1 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3 text-indigo-600" /> JSON
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Backup History Table */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Snapshot Archive History</h4>
                  <button onClick={loadBackupList} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh History
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Snapshot Name</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Records</th>
                        <th className="py-2.5 px-3">Triggered By</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-gray-400">
                            No backup archives created yet. Click "Backup Now" to create your first snapshot.
                          </td>
                        </tr>
                      ) : (
                        backups.map((b) => (
                          <tr key={b._id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-gray-900">{b.backupName}</td>
                            <td className="py-2.5 px-3 text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-gray-700 font-mono">{b.fileSizeKb} KB</td>
                            <td className="py-2.5 px-3 text-gray-700">{b.totalDocuments}</td>
                            <td className="py-2.5 px-3 text-gray-500">{b.triggeredBy}</td>
                            <td className="py-2.5 px-3 text-right space-x-2">
                              <button
                                onClick={() => downloadBackupFile(b._id, b.backupName)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                              >
                                <Download className="w-3 h-3 text-indigo-600" /> Download
                              </button>
                              <button
                                onClick={() => handleRestoreBackup(b._id)}
                                disabled={restoringId === b._id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                              >
                                <UploadCloud className="w-3 h-3 text-red-500" /> Restore
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-sm">Store Settings Audit History</h3>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingAudit ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs text-gray-500">Loading audit trail...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">No modification logs recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 uppercase text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                          {log.section}
                        </span>
                        <span className="font-semibold text-gray-700">{log.action}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{log.changesSummary}</p>
                      <span className="text-[10px] text-gray-400">
                        By {log.performedBy?.name || "Admin"} ({log.performedBy?.email})
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Send Test Verification Email</h3>
              <button onClick={() => setShowTestEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Sends an immediate transactional test message using your configured provider ({settings.notification.provider.toUpperCase()}).
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Email Address</label>
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTestEmailModal(false)}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerTestEmail}
                disabled={sendingTestEmail}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingTestEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Dispatch Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test SMS Modal */}
      {showTestSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Test SMS / WhatsApp Delivery</h3>
              <button onClick={() => setShowTestSmsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Mobile Number</label>
              <input
                type="text"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleTriggerTestSms("sms")}
                disabled={sendingTestSms}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Test SMS
              </button>
              <button
                type="button"
                onClick={() => handleTriggerTestSms("whatsapp")}
                disabled={sendingTestSms}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                Test WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

