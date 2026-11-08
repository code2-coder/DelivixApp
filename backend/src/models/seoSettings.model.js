import mongoose from "mongoose";

const seoSettingsSchema = new mongoose.Schema(
  {
    websiteTitle: {
      type: String,
      default: "DELIVIX | Premium Tech & Lifestyle E-Commerce Store",
      trim: true,
    },
    metaDescription: {
      type: String,
      default: "Shop the latest premium gadgets, accessories, and curated essentials at Delivix. Fast delivery across India & worldwide.",
      trim: true,
    },
    metaKeywords: {
      type: String,
      default: "delivix, ecommerce, electronics, gadgets, online shopping, fast delivery",
      trim: true,
    },
    defaultOgImage: {
      type: String,
      default: "",
    },
    faviconUrl: {
      type: String,
      default: "",
    },
    canonicalUrl: {
      type: String,
      default: "https://delivix.com",
    },
    robotsTxt: {
      type: String,
      default: "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://delivix.com/sitemap.xml",
    },
    sitemapEnabled: {
      type: Boolean,
      default: true,
    },
    googleConsoleVerification: {
      type: String,
      default: "",
    },
    googleAnalyticsId: {
      type: String,
      default: "",
    },
    facebookPixelId: {
      type: String,
      default: "",
    },
    ogTitle: {
      type: String,
      default: "DELIVIX - Premium E-Commerce Experience",
    },
    ogDescription: {
      type: String,
      default: "Discover top-tier electronics and lifestyle products with instant order dispatch.",
    },
    twitterCardType: {
      type: String,
      enum: ["summary", "summary_large_image"],
      default: "summary_large_image",
    },
    twitterHandle: {
      type: String,
      default: "@delivix",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SEOSettings", seoSettingsSchema);

