import mongoose from "mongoose";

const maintenanceSettingsSchema = new mongoose.Schema(
  {
    storeStatus: {
      type: String,
      enum: ["active", "maintenance", "coming_soon"],
      default: "active",
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "We are currently performing scheduled maintenance to upgrade our platform. We'll be back online shortly!",
    },
    comingSoonMode: {
      type: Boolean,
      default: false,
    },
    comingSoonMessage: {
      type: String,
      default: "Something incredible is launching soon at Delivix. Stay tuned!",
    },
    comingSoonLaunchDate: {
      type: Date,
      default: null,
    },
    storeVisibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    customerRegistrationEnabled: {
      type: Boolean,
      default: true,
    },
    guestCheckoutEnabled: {
      type: Boolean,
      default: true,
    },
    productReviewsEnabled: {
      type: Boolean,
      default: true,
    },
    wishlistEnabled: {
      type: Boolean,
      default: true,
    },
    qnaEnabled: {
      type: Boolean,
      default: true,
    },
    allowedIps: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("MaintenanceSettings", maintenanceSettingsSchema);

