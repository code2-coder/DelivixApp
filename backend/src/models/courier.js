import mongoose from "mongoose";

const courierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Courier name is required"],
      trim: true,
    },
    partnerCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    trackingUrlTemplate: {
      type: String,
      trim: true,
      default: "", // e.g. "https://www.delhivery.com/track/package/{trackingNumber}"
    },
    serviceTypes: {
      type: [String],
      default: ["Standard", "Express", "Surface", "Air"],
    },
    apiConfig: {
      provider: { type: String, default: "" }, // "delhivery", "shiprocket", "bluedart", "custom"
      apiKey: { type: String, default: "" },
      apiSecret: { type: String, default: "" },
      accountId: { type: String, default: "" },
      endpointUrl: { type: String, default: "" },
      isLive: { type: Boolean, default: false },
      webhookSecret: { type: String, default: "" },
    },
    serviceAvailability: {
      allIndia: { type: Boolean, default: true },
      codAvailable: { type: Boolean, default: true },
      international: { type: Boolean, default: false },
    },
    performance: {
      totalShipments: { type: Number, default: 0 },
      deliveredShipments: { type: Number, default: 0 },
      failedShipments: { type: Number, default: 0 },
      avgDeliveryDays: { type: Number, default: 3.2 },
      rating: { type: Number, default: 4.8 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

courierSchema.index({ name: 1 });
courierSchema.index({ isActive: 1 });

export default mongoose.model("Courier", courierSchema);
