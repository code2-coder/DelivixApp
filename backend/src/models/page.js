import mongoose from "mongoose";

const pageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["published", "draft"],
      default: "published",
    },
    metaTitle: {
      type: String,
      default: "",
    },
    metaDescription: {
      type: String,
      default: "",
    },
    highlights: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        iconName: { type: String, default: "" },
      },
    ],
    sections: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
      },
    ],
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Page", pageSchema);
