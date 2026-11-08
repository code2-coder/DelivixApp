import mongoose from "mongoose";

const deliveryPincodeSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      unique: true,
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryZone",
    },
    zoneName: {
      type: String,
      default: "",
    },
    isServiceable: {
      type: Boolean,
      default: true,
    },
    codAvailable: {
      type: Boolean,
      default: true,
    },
    prepaidAvailable: {
      type: Boolean,
      default: true,
    },
    estimatedDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    maxWeightKg: {
      type: Number,
      default: 10,
    },
    courierPartners: {
      type: [String],
      default: ["Delhivery", "Blue Dart", "DTDC"],
    },
  },
  { timestamps: true }
);

deliveryPincodeSchema.index({ isServiceable: 1 });
deliveryPincodeSchema.index({ city: 1, state: 1 });

export default mongoose.model("DeliveryPincode", deliveryPincodeSchema);

