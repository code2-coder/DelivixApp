import mongoose from "mongoose";

const deliveryPersonnelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Personnel name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: "",
    },
    vehicleType: {
      type: String,
      enum: ["Bike", "Van", "Scooter", "Truck", "Other"],
      default: "Bike",
    },
    status: {
      type: String,
      enum: ["Available", "On Delivery", "Off Duty"],
      default: "Available",
    },
    assignedOrdersCount: {
      type: Number,
      default: 0,
    },
    completedDeliveries: {
      type: Number,
      default: 0,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    currentRoute: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

deliveryPersonnelSchema.index({ phone: 1 });
deliveryPersonnelSchema.index({ status: 1 });
deliveryPersonnelSchema.index({ isActive: 1 });

export default mongoose.model("DeliveryPersonnel", deliveryPersonnelSchema);

