import mongoose from "mongoose";

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Zone code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    states: {
      type: [String],
      default: [],
    },
    cities: {
      type: [String],
      default: [],
    },
    standardDeliveryDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    expressDeliveryDays: {
      type: Number,
      default: 1,
      min: 1,
    },
    standardRate: {
      type: Number,
      default: 49,
      min: 0,
    },
    expressRate: {
      type: Number,
      default: 99,
      min: 0,
    },
    codAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

deliveryZoneSchema.index({ isActive: 1 });

export default mongoose.model("DeliveryZone", deliveryZoneSchema);

