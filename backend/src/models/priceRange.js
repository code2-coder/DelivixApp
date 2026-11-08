import mongoose from "mongoose";

const priceRangeSchema = new mongoose.Schema(
  {
    min: {
      type: Number,
      required: [true, "Please enter minimum price"],
      min: [0, "Minimum price cannot be less than 0"],
    },
    max: {
      type: Number,
      default: null, // null means Above min limit
    },
    label: {
      type: String,
      trim: true,
    }
  },
  { timestamps: true }
);

export default mongoose.model("PriceRange", priceRangeSchema);
