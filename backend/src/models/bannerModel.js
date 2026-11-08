import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
    },
    // Legacy field used by the admin form. Kept in sync with `imageUrl` so
    // both older seeded documents and newer clients keep working.
    image: {
      type: String, // store URL (Cloudinary / local path)
      default: "",
    },
    // Canonical field returned by the live API / seeded documents.
    imageUrl: {
      type: String,
      default: "",
    },
    mobileImageUrl: {
      type: String,
      default: "",
    },
    buttonText: {
      type: String,
      default: "",
    },
    badgeText: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      enum: ["HERO", "PROMO", "STRIP", "SIDEBAR"],
      default: "HERO",
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    link: {
      type: String, // where user goes when clicked
      default: "/shop",
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

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
