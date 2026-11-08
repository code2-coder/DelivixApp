import mongoose from "mongoose";

const adPosterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["offer", "discount", "new_arrival"],
      required: true,
      default: "offer",
    },
    image: {
      type: String, // store URL (Cloudinary / local path)
      required: true,
    },
    link: {
      type: String, // where user goes when clicked
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const AdPoster = mongoose.model("AdPoster", adPosterSchema);

export default AdPoster;
