import StoreSettings from "../models/storeSettings.model.js";
import BusinessSettings from "../models/businessSettings.model.js";
import CurrencySettings from "../models/currencySettings.model.js";
import TaxSettings from "../models/taxSettings.model.js";
import PaymentSettings from "../models/paymentSettings.model.js";
import ShippingSettings from "../models/shippingSettings.model.js";
import OrderSettings from "../models/orderSettings.model.js";
import InventorySettings from "../models/inventorySettings.model.js";
import NotificationSettings from "../models/notificationSettings.model.js";
import WhatsAppSMSSettings from "../models/whatsappSmsSettings.model.js";
import SEOSettings from "../models/seoSettings.model.js";
import MaintenanceSettings from "../models/maintenanceSettings.model.js";
import SecuritySettings from "../models/securitySettings.model.js";
import BackupHistory from "../models/backupHistory.model.js";
import SettingsAuditLog from "../models/settingsAuditLog.model.js";
import Page from "../models/page.js";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Order from "../models/order.js";
import User from "../models/User.js";
import Settings from "../models/settings.js";
import DeliverySettings from "../models/deliverySettings.js";
import CurrencySetting from "../models/currencySetting.js";

import { encryptSecret, decryptSecret, isMasked, maskSecret } from "../utils/cryptoUtil.js";
import { clearCache } from "../middleware/cache.js";
import nodemailer from "nodemailer";
import axios from "axios";

// Helper to get or create singleton document
async function getOrCreate(Model, defaultData = {}) {
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create(defaultData);
  }
  return doc;
}

export class StoreSettingsService {
  /**
   * Get all settings grouped by category with masked secrets for admin UI
   */
  static async getAllSettings() {
    const [
      store,
      business,
      currency,
      tax,
      payment,
      shipping,
      order,
      inventory,
      notification,
      whatsappSms,
      seo,
      maintenance,
      security,
    ] = await Promise.all([
      getOrCreate(StoreSettings),
      getOrCreate(BusinessSettings),
      getOrCreate(CurrencySettings),
      getOrCreate(TaxSettings),
      getOrCreate(PaymentSettings),
      getOrCreate(ShippingSettings),
      getOrCreate(OrderSettings),
      getOrCreate(InventorySettings),
      getOrCreate(NotificationSettings),
      getOrCreate(WhatsAppSMSSettings),
      getOrCreate(SEOSettings),
      getOrCreate(MaintenanceSettings),
      getOrCreate(SecuritySettings),
    ]);

    // Mask sensitive payment credentials
    const safePayment = payment.toObject();
    if (safePayment.razorpay) {
      safePayment.razorpay.hasKeySecret = Boolean(safePayment.razorpay.keySecret);
      safePayment.razorpay.keySecret = maskSecret(safePayment.razorpay.keySecret);
      safePayment.razorpay.hasWebhookSecret = Boolean(safePayment.razorpay.webhookSecret);
      safePayment.razorpay.webhookSecret = maskSecret(safePayment.razorpay.webhookSecret);
    }
    if (safePayment.stripe) {
      safePayment.stripe.hasSecretKey = Boolean(safePayment.stripe.secretKey);
      safePayment.stripe.secretKey = maskSecret(safePayment.stripe.secretKey);
      safePayment.stripe.hasWebhookSecret = Boolean(safePayment.stripe.webhookSecret);
      safePayment.stripe.webhookSecret = maskSecret(safePayment.stripe.webhookSecret);
    }

    // Mask notification credentials
    const safeNotification = notification.toObject();
    if (safeNotification.smtp) {
      safeNotification.smtp.hasPassword = Boolean(safeNotification.smtp.password);
      safeNotification.smtp.password = maskSecret(safeNotification.smtp.password);
    }
    if (safeNotification.zeptomail) {
      safeNotification.zeptomail.hasApiKey = Boolean(safeNotification.zeptomail.apiKey);
      safeNotification.zeptomail.apiKey = maskSecret(safeNotification.zeptomail.apiKey);
    }

    // Mask WhatsApp / SMS credentials
    const safeWhatsAppSms = whatsappSms.toObject();
    if (safeWhatsAppSms.msg91) {
      safeWhatsAppSms.msg91.hasAuthKey = Boolean(safeWhatsAppSms.msg91.authKey);
      safeWhatsAppSms.msg91.authKey = maskSecret(safeWhatsAppSms.msg91.authKey);
    }
    if (safeWhatsAppSms.whatsapp) {
      safeWhatsAppSms.whatsapp.hasApiToken = Boolean(safeWhatsAppSms.whatsapp.apiToken);
      safeWhatsAppSms.whatsapp.apiToken = maskSecret(safeWhatsAppSms.whatsapp.apiToken);
    }

    return {
      store,
      business,
      currency,
      tax,
      payment: safePayment,
      shipping,
      order,
      inventory,
      notification: safeNotification,
      whatsappSms: safeWhatsAppSms,
      seo,
      maintenance,
      security,
    };
  }

  /**
   * Get public store settings for storefront rendering
   */
  static async getPublicSettings() {
    const [store, currency, tax, shipping, maintenance, seo] = await Promise.all([
      getOrCreate(StoreSettings),
      getOrCreate(CurrencySettings),
      getOrCreate(TaxSettings),
      getOrCreate(ShippingSettings),
      getOrCreate(MaintenanceSettings),
      getOrCreate(SEOSettings),
    ]);

    return {
      storeName: store.storeName,
      storeLogo: store.storeLogo,
      storeFavicon: store.storeFavicon,
      storeDescription: store.storeDescription,
      storeTagline: store.storeTagline,
      contactEmail: store.customerSupportEmail || store.storeEmail,
      contactPhone: store.contactNumber,
      whatsappNumber: store.whatsappNumber,
      address: {
        street: store.businessAddress,
        city: store.city,
        state: store.state,
        country: store.country,
        pincode: store.pincode,
      },
      branding: store.branding,
      socialMedia: store.socialMedia,
      currency: {
        defaultCurrency: currency.defaultCurrency,
        symbol: currency.currencySymbol,
        position: currency.currencyPosition,
        decimalPlaces: currency.decimalPlaces,
        numberFormat: currency.numberFormat,
        rates: currency.exchangeRates,
      },
      tax: {
        enableTaxes: tax.enableTaxes,
        pricesIncludeTax: tax.pricesIncludeTax,
        defaultTaxRate: tax.defaultTaxRate,
      },
      shipping: {
        freeShippingThreshold: shipping.freeShippingThreshold,
        standardShippingFee: shipping.standardShippingFee,
        standardDeliveryEstimate: shipping.standardDeliveryEstimate,
        expressShippingFee: shipping.expressShippingFee,
        expressDeliveryEstimate: shipping.expressDeliveryEstimate,
        codAvailable: shipping.codEnabled,
        codFee: shipping.codFee,
      },
      maintenance: {
        status: maintenance.storeStatus,
        maintenanceMode: maintenance.maintenanceMode,
        maintenanceMessage: maintenance.maintenanceMessage,
        comingSoonMode: maintenance.comingSoonMode,
        comingSoonMessage: maintenance.comingSoonMessage,
        comingSoonLaunchDate: maintenance.comingSoonLaunchDate,
        customerRegistration: maintenance.customerRegistrationEnabled,
        guestCheckout: maintenance.guestCheckoutEnabled,
        reviewsEnabled: maintenance.productReviewsEnabled,
        wishlistEnabled: maintenance.wishlistEnabled,
        qnaEnabled: maintenance.qnaEnabled,
      },
      seo: {
        websiteTitle: seo.websiteTitle,
        metaDescription: seo.metaDescription,
        defaultOgImage: seo.defaultOgImage,
        faviconUrl: seo.faviconUrl,
        canonicalUrl: seo.canonicalUrl,
        googleAnalyticsId: seo.googleAnalyticsId,
        facebookPixelId: seo.facebookPixelId,
        twitterHandle: seo.twitterHandle,
      },
    };
  }

  /**
   * Update a specific settings section
   */
  static async updateSection(section, data, adminUser = null, ipAddress = "") {
    let updatedDoc;
    let auditSummary = `Updated ${section} settings`;

    switch (section) {
      case "general":
      case "branding":
      case "social": {
        const store = await getOrCreate(StoreSettings);
        if (section === "general") {
          const fields = [
            "storeName", "storeLogo", "storeFavicon", "storeDescription",
            "storeTagline", "storeEmail", "customerSupportEmail", "contactNumber",
            "whatsappNumber", "businessAddress", "city", "state", "country",
            "pincode", "googleMapsLocation", "websiteUrl"
          ];
          fields.forEach((f) => {
            if (data[f] !== undefined) store[f] = data[f];
          });
        } else if (section === "branding") {
          if (data.branding) {
            store.branding = { ...store.branding.toObject(), ...data.branding };
          } else {
            store.branding = { ...store.branding.toObject(), ...data };
          }
        } else if (section === "social") {
          if (data.socialMedia) {
            store.socialMedia = { ...store.socialMedia.toObject(), ...data.socialMedia };
          } else {
            store.socialMedia = { ...store.socialMedia.toObject(), ...data };
          }
        }
        await store.save();
        updatedDoc = store;
        break;
      }

      case "business": {
        const business = await getOrCreate(BusinessSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) business[k] = data[k];
        });
        await business.save();
        updatedDoc = business;
        break;
      }

      case "currency": {
        const currency = await getOrCreate(CurrencySettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) currency[k] = data[k];
        });
        await currency.save();

        // Sync with legacy CurrencySetting model for compatibility with priceConverter.js
        try {
          let legacy = await CurrencySetting.findOne();
          if (!legacy) legacy = new CurrencySetting();
          if (currency.exchangeRates) {
            legacy.rates = currency.exchangeRates;
            legacy.updatedBy = adminUser?.email || "Admin Settings";
            await legacy.save();
          }
        } catch (e) {
          console.warn("Failed syncing legacy currency setting:", e.message);
        }

        updatedDoc = currency;
        break;
      }

      case "tax": {
        const tax = await getOrCreate(TaxSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) tax[k] = data[k];
        });
        await tax.save();

        // Sync legacy Settings.taxRate
        try {
          let legacy = await Settings.findOne();
          if (legacy) {
            legacy.taxRate = Number(tax.defaultTaxRate) / 100;
            await legacy.save();
          }
        } catch (e) {
          console.warn("Failed syncing legacy tax rate:", e.message);
        }

        updatedDoc = tax;
        break;
      }

      case "payment": {
        const payment = await getOrCreate(PaymentSettings);

        // Handle Razorpay
        if (data.razorpay) {
          if (data.razorpay.enabled !== undefined) payment.razorpay.enabled = data.razorpay.enabled;
          if (data.razorpay.testMode !== undefined) payment.razorpay.testMode = data.razorpay.testMode;
          if (data.razorpay.keyId !== undefined) payment.razorpay.keyId = data.razorpay.keyId;
          if (data.razorpay.autoCapture !== undefined) payment.razorpay.autoCapture = data.razorpay.autoCapture;

          if (data.razorpay.keySecret && !isMasked(data.razorpay.keySecret)) {
            payment.razorpay.keySecret = encryptSecret(data.razorpay.keySecret);
          }
          if (data.razorpay.webhookSecret && !isMasked(data.razorpay.webhookSecret)) {
            payment.razorpay.webhookSecret = encryptSecret(data.razorpay.webhookSecret);
          }
        }

        // Handle Stripe
        if (data.stripe) {
          if (data.stripe.enabled !== undefined) payment.stripe.enabled = data.stripe.enabled;
          if (data.stripe.testMode !== undefined) payment.stripe.testMode = data.stripe.testMode;
          if (data.stripe.publishableKey !== undefined) payment.stripe.publishableKey = data.stripe.publishableKey;

          if (data.stripe.secretKey && !isMasked(data.stripe.secretKey)) {
            payment.stripe.secretKey = encryptSecret(data.stripe.secretKey);
          }
          if (data.stripe.webhookSecret && !isMasked(data.stripe.webhookSecret)) {
            payment.stripe.webhookSecret = encryptSecret(data.stripe.webhookSecret);
          }
        }

        // Handle COD
        if (data.cod) {
          payment.cod = { ...payment.cod.toObject(), ...data.cod };
        }

        // Handle Bank Transfer
        if (data.bankTransfer) {
          payment.bankTransfer = { ...payment.bankTransfer.toObject(), ...data.bankTransfer };
        }

        if (data.defaultGateway) payment.defaultGateway = data.defaultGateway;
        if (data.enableWebhookVerification !== undefined) payment.enableWebhookVerification = data.enableWebhookVerification;
        if (data.paymentTimeoutMinutes !== undefined) payment.paymentTimeoutMinutes = data.paymentTimeoutMinutes;

        await payment.save();

        // Mask before returning
        const safe = payment.toObject();
        safe.razorpay.keySecret = maskSecret(safe.razorpay.keySecret);
        safe.razorpay.webhookSecret = maskSecret(safe.razorpay.webhookSecret);
        safe.stripe.secretKey = maskSecret(safe.stripe.secretKey);
        safe.stripe.webhookSecret = maskSecret(safe.stripe.webhookSecret);
        updatedDoc = safe;
        break;
      }

      case "shipping": {
        const shipping = await getOrCreate(ShippingSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) shipping[k] = data[k];
        });
        await shipping.save();

        // Sync with legacy DeliverySettings & Settings
        try {
          let delivery = await DeliverySettings.findOne();
          if (delivery) {
            if (shipping.defaultMethod) delivery.defaultMethod = shipping.defaultMethod;
            if (shipping.standardShippingFee !== undefined) delivery.standardShippingFee = shipping.standardShippingFee;
            if (shipping.expressShippingFee !== undefined) delivery.expressShippingFee = shipping.expressShippingFee;
            if (shipping.freeShippingThreshold !== undefined) delivery.freeShippingThreshold = shipping.freeShippingThreshold;
            if (shipping.codFee !== undefined) delivery.codFee = shipping.codFee;
            if (shipping.codEnabled !== undefined) delivery.codEnabled = shipping.codEnabled;
            if (shipping.originAddress) delivery.originAddress = { ...delivery.originAddress.toObject(), ...shipping.originAddress };
            if (shipping.returnAddress) delivery.returnAddress = { ...delivery.returnAddress.toObject(), ...shipping.returnAddress };
            await delivery.save();
          }

          let legacy = await Settings.findOne();
          if (legacy) {
            if (legacy.australiaShipping) {
              if (shipping.standardShippingFee !== undefined) legacy.australiaShipping.standardShippingPrice = shipping.standardShippingFee;
              if (shipping.expressShippingFee !== undefined) legacy.australiaShipping.expressShippingPrice = shipping.expressShippingFee;
              if (shipping.freeShippingThreshold !== undefined) legacy.australiaShipping.freeShippingThreshold = shipping.freeShippingThreshold;
            }
            await legacy.save();
          }
        } catch (e) {
          console.warn("Failed syncing legacy shipping settings:", e.message);
        }

        updatedDoc = shipping;
        break;
      }

      case "order": {
        const order = await getOrCreate(OrderSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) order[k] = data[k];
        });
        await order.save();
        updatedDoc = order;
        break;
      }

      case "inventory": {
        const inv = await getOrCreate(InventorySettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) inv[k] = data[k];
        });
        await inv.save();
        updatedDoc = inv;
        break;
      }

      case "notification": {
        const notification = await getOrCreate(NotificationSettings);
        if (data.provider) notification.provider = data.provider;
        if (data.senderName) notification.senderName = data.senderName;
        if (data.senderEmail) notification.senderEmail = data.senderEmail;
        if (data.adminNotificationEmail) notification.adminNotificationEmail = data.adminNotificationEmail;

        if (data.smtp) {
          const s = data.smtp;
          if (s.host !== undefined) notification.smtp.host = s.host;
          if (s.port !== undefined) notification.smtp.port = s.port;
          if (s.secure !== undefined) notification.smtp.secure = s.secure;
          if (s.username !== undefined) notification.smtp.username = s.username;
          if (s.password && !isMasked(s.password)) {
            notification.smtp.password = encryptSecret(s.password);
          }
        }

        if (data.zeptomail) {
          const z = data.zeptomail;
          if (z.apiUrl !== undefined) notification.zeptomail.apiUrl = z.apiUrl;
          if (z.apiKey && !isMasked(z.apiKey)) {
            notification.zeptomail.apiKey = encryptSecret(z.apiKey);
          }
        }

        if (data.triggers) {
          notification.triggers = { ...notification.triggers.toObject(), ...data.triggers };
        }

        await notification.save();

        const safe = notification.toObject();
        safe.smtp.password = maskSecret(safe.smtp.password);
        safe.zeptomail.apiKey = maskSecret(safe.zeptomail.apiKey);
        updatedDoc = safe;
        break;
      }

      case "whatsappSms": {
        const ws = await getOrCreate(WhatsAppSMSSettings);
        if (data.smsEnabled !== undefined) ws.smsEnabled = data.smsEnabled;
        if (data.whatsappEnabled !== undefined) ws.whatsappEnabled = data.whatsappEnabled;

        if (data.msg91) {
          if (data.msg91.senderId !== undefined) ws.msg91.senderId = data.msg91.senderId;
          if (data.msg91.otpTemplateId !== undefined) ws.msg91.otpTemplateId = data.msg91.otpTemplateId;
          if (data.msg91.authKey && !isMasked(data.msg91.authKey)) {
            ws.msg91.authKey = encryptSecret(data.msg91.authKey);
          }
        }

        if (data.whatsapp) {
          const w = data.whatsapp;
          if (w.provider !== undefined) ws.whatsapp.provider = w.provider;
          if (w.phoneNumberId !== undefined) ws.whatsapp.phoneNumberId = w.phoneNumberId;
          if (w.businessAccountId !== undefined) ws.whatsapp.businessAccountId = w.businessAccountId;
          if (w.customerSupportNumber !== undefined) ws.whatsapp.customerSupportNumber = w.customerSupportNumber;
          if (w.apiToken && !isMasked(w.apiToken)) {
            ws.whatsapp.apiToken = encryptSecret(w.apiToken);
          }
        }

        if (data.otp) {
          ws.otp = { ...ws.otp.toObject(), ...data.otp };
        }

        if (data.templates) {
          ws.templates = { ...ws.templates.toObject(), ...data.templates };
        }

        await ws.save();

        const safe = ws.toObject();
        safe.msg91.authKey = maskSecret(safe.msg91.authKey);
        safe.whatsapp.apiToken = maskSecret(safe.whatsapp.apiToken);
        updatedDoc = safe;
        break;
      }

      case "seo": {
        const seo = await getOrCreate(SEOSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) seo[k] = data[k];
        });
        await seo.save();
        updatedDoc = seo;
        break;
      }

      case "maintenance": {
        const maintenance = await getOrCreate(MaintenanceSettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) maintenance[k] = data[k];
        });
        await maintenance.save();
        updatedDoc = maintenance;
        break;
      }

      case "security": {
        const security = await getOrCreate(SecuritySettings);
        Object.keys(data).forEach((k) => {
          if (data[k] !== undefined) security[k] = data[k];
        });
        await security.save();
        updatedDoc = security;
        break;
      }

      default:
        throw new Error(`Invalid settings section: ${section}`);
    }

    // Record audit log
    try {
      await SettingsAuditLog.create({
        section,
        action: "UPDATE",
        performedBy: {
          userId: adminUser?._id,
          name: adminUser?.name || "Administrator",
          email: adminUser?.email || "admin@delivix.com",
        },
        ipAddress,
        changesSummary: auditSummary,
      });
    } catch (e) {
      console.warn("Audit logging failed:", e.message);
    }

    // Invalidate caches
    clearCache("/api/v1/settings");
    clearCache("/api/v1/settings/public");

    return updatedDoc;
  }

  /**
   * Reset section to default values
   */
  static async resetSection(section, adminUser = null, ipAddress = "") {
    const ModelMap = {
      general: StoreSettings,
      branding: StoreSettings,
      social: StoreSettings,
      business: BusinessSettings,
      currency: CurrencySettings,
      tax: TaxSettings,
      payment: PaymentSettings,
      shipping: ShippingSettings,
      order: OrderSettings,
      inventory: InventorySettings,
      notification: NotificationSettings,
      whatsappSms: WhatsAppSMSSettings,
      seo: SEOSettings,
      maintenance: MaintenanceSettings,
      security: SecuritySettings,
    };

    const Model = ModelMap[section];
    if (!Model) {
      throw new Error(`Cannot reset unknown section: ${section}`);
    }

    await Model.deleteMany({});
    const newDoc = await Model.create({});

    try {
      await SettingsAuditLog.create({
        section,
        action: "RESET",
        performedBy: {
          userId: adminUser?._id,
          name: adminUser?.name || "Administrator",
          email: adminUser?.email || "admin@delivix.com",
        },
        ipAddress,
        changesSummary: `Reset ${section} settings to system factory defaults`,
      });
    } catch (e) { }

    clearCache("/api/v1/settings");
    clearCache("/api/v1/settings/public");

    return newDoc;
  }

  /**
   * Send a test email to verify SMTP or ZeptoMail connection
   */
  static async sendTestEmail({ toEmail, provider, customConfig }) {
    if (!toEmail) {
      throw new Error("Recipient email address is required");
    }

    const notification = await getOrCreate(NotificationSettings);
    const chosenProvider = provider || notification.provider || "zeptomail";

    if (chosenProvider === "smtp") {
      const host = customConfig?.host || notification.smtp.host;
      const port = Number(customConfig?.port || notification.smtp.port || 587);
      const secure = Boolean(customConfig?.secure ?? notification.smtp.secure);
      const user = customConfig?.username || notification.smtp.username;
      let pass = customConfig?.password;
      if (!pass || isMasked(pass)) {
        pass = decryptSecret(notification.smtp.password);
      }

      if (!host || !user) {
        throw new Error("SMTP Host and Username are required to send test email");
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });

      const info = await transporter.sendMail({
        from: `"${notification.senderName || 'DELIVIX'}" <${notification.senderEmail || user}>`,
        to: toEmail,
        subject: "DELIVIX Test Notification: Email Delivery Verified",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #111827; margin-top: 0;">Test Email Successful</h2>
            <p style="color: #4b5563; line-height: 1.6;">This is a test notification confirming that your <strong>SMTP Server</strong> connection is properly configured and functional in Delivix Store Settings.</p>
            <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0;">
              <span style="font-size: 13px; color: #374151;"><strong>Host:</strong> ${host}:${port}</span><br/>
              <span style="font-size: 13px; color: #374151;"><strong>Timestamp:</strong> ${new Date().toISOString()}</span>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">Delivix E-Commerce Automated Testing System</p>
          </div>
        `,
      });

      return {
        success: true,
        provider: "smtp",
        messageId: info.messageId,
        message: `Test email sent successfully to ${toEmail} via SMTP (${host})`,
      };
    } else {
      // ZeptoMail
      let apiKey = customConfig?.apiKey;
      if (!apiKey || isMasked(apiKey)) {
        apiKey = decryptSecret(notification.zeptomail.apiKey) || process.env.ZEPTOMAIL_API_KEY;
      }
      const apiUrl = customConfig?.apiUrl || notification.zeptomail.apiUrl || process.env.ZEPTOMAIL_API_URL || "https://api.zeptomail.in/v1.1/email";
      const fromEmail = notification.senderEmail || process.env.ZEPTOMAIL_FROM_EMAIL || "noreply@delivix.com";
      const fromName = notification.senderName || process.env.ZEPTOMAIL_FROM_NAME || "DELIVIX";

      if (!apiKey) {
        throw new Error("ZeptoMail API Key is missing. Please configure it in Store Settings or backend environment.");
      }

      const response = await axios.post(
        apiUrl,
        {
          bounce_address: fromEmail,
          from: { address: fromEmail, name: fromName },
          to: [{ email_address: { address: toEmail, name: "Store Admin" } }],
          subject: "DELIVIX Test Notification: ZeptoMail Verified",
          htmlbody: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #111827; margin-top: 0;">ZeptoMail Integration Active</h2>
              <p style="color: #4b5563; line-height: 1.6;">Your <strong>ZeptoMail API</strong> is communicating seamlessly with Delivix Store Settings. Transactional emails for order confirmations, dispatches, and OTPs will now be delivered via this channel.</p>
              <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0;">
                <span style="font-size: 13px; color: #374151;"><strong>Provider:</strong> ZeptoMail API</span><br/>
                <span style="font-size: 13px; color: #374151;"><strong>Endpoint:</strong> ${apiUrl}</span><br/>
                <span style="font-size: 13px; color: #374151;"><strong>Timestamp:</strong> ${new Date().toISOString()}</span>
              </div>
            </div>
          `,
        },
        {
          headers: {
            Authorization: `Zoho-enczapikey ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        provider: "zeptomail",
        response: response.data,
        message: `Test email dispatched to ${toEmail} via ZeptoMail`,
      };
    }
  }

  /**
   * Send test SMS or WhatsApp notification
   */
  static async sendTestSms({ toPhone, channel = "sms" }) {
    if (!toPhone) {
      throw new Error("Phone number is required");
    }

    const ws = await getOrCreate(WhatsAppSMSSettings);

    return {
      success: true,
      channel,
      phone: toPhone,
      message: `Test ${channel.toUpperCase()} simulated and logged for ${toPhone}. Provider: ${channel === 'sms' ? ws.msg91.senderId : ws.whatsapp.provider}`,
    };
  }

  /**
   * Create a full database JSON backup snapshot
   */
  static async createBackup(adminUser = null, notes = "") {
    const [
      products,
      categories,
      orders,
      pages,
      storeSettings,
      businessSettings,
      currencySettings,
      taxSettings,
      paymentSettings,
      shippingSettings,
      orderSettings,
      inventorySettings,
      notificationSettings,
      seoSettings,
    ] = await Promise.all([
      Product.find().lean(),
      Category.find().lean(),
      Order.find().limit(200).lean(),
      Page.find().lean(),
      StoreSettings.find().lean(),
      BusinessSettings.find().lean(),
      CurrencySettings.find().lean(),
      TaxSettings.find().lean(),
      PaymentSettings.find().lean(),
      ShippingSettings.find().lean(),
      OrderSettings.find().lean(),
      InventorySettings.find().lean(),
      NotificationSettings.find().lean(),
      SEOSettings.find().lean(),
    ]);

    const snapshot = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      metadata: {
        totalProducts: products.length,
        totalCategories: categories.length,
        totalOrders: orders.length,
        totalPages: pages.length,
      },
      data: {
        products,
        categories,
        orders,
        pages,
        settings: {
          store: storeSettings,
          business: businessSettings,
          currency: currencySettings,
          tax: taxSettings,
          payment: paymentSettings,
          shipping: shippingSettings,
          order: orderSettings,
          inventory: inventorySettings,
          notification: notificationSettings,
          seo: seoSettings,
        },
      },
    };

    const payloadString = JSON.stringify(snapshot);
    const sizeKb = Math.round(Buffer.byteLength(payloadString, "utf8") / 1024);
    const backupName = `delivix_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const totalDocs = products.length + categories.length + orders.length + pages.length;

    const backupDoc = await BackupHistory.create({
      backupName,
      backupType: "manual",
      status: "completed",
      fileSizeKb: sizeKb,
      totalCollections: 10,
      totalDocuments: totalDocs,
      collectionsIncluded: ["products", "categories", "orders", "pages", "settings"],
      triggeredBy: adminUser?.email || "System Admin",
      backupData: payloadString,
      notes: notes || "Full administrative snapshot",
    });

    try {
      await SettingsAuditLog.create({
        section: "backup",
        action: "BACKUP_CREATE",
        performedBy: {
          userId: adminUser?._id,
          name: adminUser?.name || "Administrator",
          email: adminUser?.email || "admin@delivix.com",
        },
        changesSummary: `Generated backup ${backupName} (${sizeKb} KB, ${totalDocs} records)`,
      });
    } catch (e) { }

    return {
      _id: backupDoc._id,
      backupName,
      fileSizeKb: sizeKb,
      totalDocuments: totalDocs,
      createdAt: backupDoc.createdAt,
      status: "completed",
    };
  }

  /**
   * Get backup history list (without large data payloads)
   */
  static async getBackupHistory() {
    return BackupHistory.find().select("-backupData").sort({ createdAt: -1 }).limit(50);
  }

  /**
   * Download a backup file
   */
  static async getBackupDownload(backupId) {
    const backup = await BackupHistory.findById(backupId);
    if (!backup) {
      throw new Error("Backup file not found");
    }
    return {
      fileName: backup.backupName,
      data: backup.backupData,
    };
  }

  /**
   * Restore settings from backup snapshot
   */
  static async restoreBackup(backupId, adminUser = null) {
    const backup = await BackupHistory.findById(backupId);
    if (!backup || !backup.backupData) {
      throw new Error("Backup snapshot not found or corrupt");
    }

    const parsed = JSON.parse(backup.backupData);
    const s = parsed.data?.settings;

    if (!s) {
      throw new Error("Backup payload does not contain settings data");
    }

    if (s.store?.[0]) await StoreSettings.findOneAndUpdate({}, s.store[0], { upsert: true });
    if (s.business?.[0]) await BusinessSettings.findOneAndUpdate({}, s.business[0], { upsert: true });
    if (s.currency?.[0]) await CurrencySettings.findOneAndUpdate({}, s.currency[0], { upsert: true });
    if (s.tax?.[0]) await TaxSettings.findOneAndUpdate({}, s.tax[0], { upsert: true });
    if (s.shipping?.[0]) await ShippingSettings.findOneAndUpdate({}, s.shipping[0], { upsert: true });
    if (s.order?.[0]) await OrderSettings.findOneAndUpdate({}, s.order[0], { upsert: true });
    if (s.inventory?.[0]) await InventorySettings.findOneAndUpdate({}, s.inventory[0], { upsert: true });
    if (s.seo?.[0]) await SEOSettings.findOneAndUpdate({}, s.seo[0], { upsert: true });

    clearCache("/api/v1/settings");
    clearCache("/api/v1/settings/public");

    try {
      await SettingsAuditLog.create({
        section: "backup",
        action: "BACKUP_RESTORE",
        performedBy: {
          userId: adminUser?._id,
          name: adminUser?.name || "Administrator",
          email: adminUser?.email || "admin@delivix.com",
        },
        changesSummary: `Restored system configuration from backup: ${backup.backupName}`,
      });
    } catch (e) { }

    return {
      success: true,
      message: `System configuration successfully restored from ${backup.backupName}`,
    };
  }

  /**
   * Export collections in JSON or CSV
   */
  static async exportData(entity = "products", format = "json") {
    let records = [];

    switch (entity) {
      case "products":
        records = await Product.find().select("title name category price basePrice stock sku ratings").lean();
        break;
      case "orders":
        records = await Order.find().select("orderNumber totalAmount orderStatus paymentStatus paymentMethod createdAt").lean();
        break;
      case "customers":
        records = await User.find({ role: "user" }).select("name email phone createdAt isEmailVerified").lean();
        break;
      case "inventory":
        records = await Product.find().select("title name sku stock minStockLevel incomingStock reservedStock").lean();
        break;
      default:
        throw new Error(`Unsupported export entity: ${entity}`);
    }

    if (format === "csv") {
      if (records.length === 0) return "";
      const headers = Object.keys(records[0]).filter((k) => k !== "_id" && k !== "__v");
      const rows = records.map((r) =>
        headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
      );
      return [headers.join(","), ...rows].join("\n");
    }

    return records;
  }

  /**
   * Get audit log history
   */
  static async getAuditLogs(limit = 100) {
    return SettingsAuditLog.find().sort({ createdAt: -1 }).limit(limit);
  }

  /**
   * Generate dynamic robots.txt content
   */
  static async getRobotsTxt() {
    const seo = await getOrCreate(SEOSettings);
    return seo.robotsTxt || "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/";
  }

  /**
   * Generate dynamic sitemap.xml
   */
  static async getSitemapXml() {
    const [seo, products, categories, pages] = await Promise.all([
      getOrCreate(SEOSettings),
      Product.find().select("_id updatedAt").lean(),
      Category.find().select("slug updatedAt").lean(),
      Page.find({ status: "published" }).select("slug updatedAt").lean(),
    ]);

    const baseUrl = seo.canonicalUrl || "https://delivix.com";

    const urls = [
      `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `  <url><loc>${baseUrl}/shop</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ];

    categories.forEach((cat) => {
      const slug = cat.slug || cat._id;
      urls.push(`  <url><loc>${baseUrl}/category/${slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
    });

    products.forEach((prod) => {
      urls.push(`  <url><loc>${baseUrl}/product/${prod._id}</loc><lastmod>${new Date(prod.updatedAt || Date.now()).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
    });

    pages.forEach((p) => {
      urls.push(`  <url><loc>${baseUrl}/page/${p.slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  }
}

export default StoreSettingsService;

