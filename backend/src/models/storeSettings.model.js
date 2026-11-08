import mongoose from "mongoose";

const storeSettingsSchema = new mongoose.Schema(
  {
    // 1. General Store Information
    storeName: {
      type: String,
      default: "DELIVIX",
      trim: true,
      required: true,
    },
    storeLogo: {
      type: String,
      default: "",
    },
    storeFavicon: {
      type: String,
      default: "",
    },
    storeDescription: {
      type: String,
      default: "Premium e-commerce shopping experience with ultrafast express delivery across India and worldwide.",
      trim: true,
    },
    storeTagline: {
      type: String,
      default: "Delivering Excellence To Your Doorstep",
      trim: true,
    },
    storeEmail: {
      type: String,
      default: "contact@delivix.com",
      trim: true,
    },
    customerSupportEmail: {
      type: String,
      default: "support@delivix.com",
      trim: true,
    },
    contactNumber: {
      type: String,
      default: "+91 98765 43210",
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: "+91 98765 43210",
      trim: true,
    },
    businessAddress: {
      type: String,
      default: "123 Commerce Avenue, Cyber City",
      trim: true,
    },
    city: {
      type: String,
      default: "Mumbai",
      trim: true,
    },
    state: {
      type: String,
      default: "Maharashtra",
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    pincode: {
      type: String,
      default: "400001",
      trim: true,
    },
    googleMapsLocation: {
      type: String,
      default: "https://maps.google.com/?q=Mumbai,Maharashtra",
    },
    websiteUrl: {
      type: String,
      default: "https://delivix.com",
    },

    // 2. Store Branding & Appearance
    branding: {
      primaryColor: {
        type: String,
        default: "#111111",
      },
      secondaryColor: {
        type: String,
        default: "#225c3b",
      },
      backgroundColor: {
        type: String,
        default: "#ffffff",
      },
      textColor: {
        type: String,
        default: "#111111",
      },
      buttonColor: {
        type: String,
        default: "#111111",
      },
      headerBackground: {
        type: String,
        default: "rgba(255, 255, 255, 0.96)",
      },
      footerBackground: {
        type: String,
        default: "#0a0a0a",
      },
      fontFamily: {
        type: String,
        default: "Inter, sans-serif",
      },
      headingTypography: {
        type: String,
        default: "Manrope, sans-serif",
      },
      bodyTypography: {
        type: String,
        default: "Inter, sans-serif",
      },
      borderRadius: {
        type: String,
        default: "8px",
      },
      buttonStyle: {
        type: String,
        enum: ["rounded", "pill", "sharp"],
        default: "rounded",
      },
      themeMode: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "light",
      },
      customCss: {
        type: String,
        default: "",
      },
    },

    // 13. Social Media Settings
    socialMedia: {
      instagram: { type: String, default: "https://instagram.com/delivix" },
      facebook: { type: String, default: "https://facebook.com/delivix" },
      youtube: { type: String, default: "https://youtube.com/@delivix" },
      linkedin: { type: String, default: "https://linkedin.com/company/delivix" },
      pinterest: { type: String, default: "https://pinterest.com/delivix" },
      twitter: { type: String, default: "https://x.com/delivix" },
      whatsapp: { type: String, default: "https://wa.me/919876543210" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("StoreSettings", storeSettingsSchema);

