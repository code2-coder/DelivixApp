import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required for a review"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required for a review"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required (1-5 stars)"],
      min: [1, "Rating must be at least 1 star"],
      max: [5, "Rating cannot exceed 5 stars"],
    },
    title: {
      type: String,
      trim: true,
      maxLength: [150, "Review title cannot exceed 150 characters"],
      default: "",
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    videos: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    helpfulVotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reports: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, trim: true, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reportsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    adminReply: {
      comment: {
        type: String,
        trim: true,
      },
      repliedAt: {
        type: Date,
      },
    },
  },
  { timestamps: true }
);

// Compound indexes for fast querying of approved reviews by product
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
// Compound index to guarantee one review per product per user
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
// Index on status for admin queries
reviewSchema.index({ status: 1 });
reviewSchema.index({ isFeatured: 1, status: 1 });
reviewSchema.index({ "reports.0": 1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
