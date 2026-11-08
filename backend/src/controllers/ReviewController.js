import Review from "../models/Review.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import UploadService from "../services/UploadService.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import { sendResponse } from "../helpers/response.js";
import mongoose from "mongoose";
import { clearCache } from "../middleware/cache.js";

// Utility function to escape HTML tags and protect against XSS
const sanitizeHtml = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

// Recalculates and updates the product's aggregated average rating and review counts (Approved only)
const recalculateProductRatings = async (productId) => {
  const approvedReviews = await Review.find({
    product: productId,
    status: "Approved",
  }).select("rating");

  const numOfReviews = approvedReviews.length;
  let averageRating = 0;

  if (numOfReviews > 0) {
    const totalStars = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
    averageRating = Number((totalStars / numOfReviews).toFixed(1));
  }

  await Product.findByIdAndUpdate(productId, {
    ratings: averageRating,
    numOfReviews,
  });

  await Promise.all([
    clearCache("/api/v1/products"),
    clearCache(`/api/v1/products/${productId}`),
    clearCache(`/api/v1/reviews/product/${productId}`),
    clearCache("shk:products"),
  ]);
};

const reviewStatsPipeline = [
  {
    $group: {
      _id: null,
      total: { $sum: 1 },
      pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
      approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
      rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
      featured: { $sum: { $cond: ["$isFeatured", 1, 0] } },
      reported: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$reportsCount", 0] }, 0] }, 1, 0] } },
      averageRating: { $avg: "$rating" },
    },
  },
];

export class ReviewController {
  //
  // ✍️ CUSTOMER SUBMIT REVIEW
  //
  createReview = catchAsyncErrors(async (req, res, next) => {
    const { productId, rating, comment, title = "", images = [], videos = [] } = req.body;
    const userId = req.user._id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(new ErrorHandler("Please provide a valid product ID", 400));
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return next(new ErrorHandler("Rating must be a whole number between 1 and 5", 400));
    }

    const cleanComment = String(comment || "").trim();
    if (cleanComment.length < 3) {
      return next(new ErrorHandler("Please write at least a few words in your review", 400));
    }
    if (cleanComment.length > 4000) {
      return next(new ErrorHandler("Review description cannot exceed 4000 characters", 400));
    }

    const cleanTitle = String(title || "").trim();
    if (cleanTitle.length > 150) {
      return next(new ErrorHandler("Review title cannot exceed 150 characters", 400));
    }

    const product = await Product.findById(productId);
    if (!product) return next(new ErrorHandler("Product not found", 404));

    // 1. Uniqueness check: One review per user per product
    const existingReview = await Review.findOne({ product: productId, user: userId });
    if (existingReview) {
      return next(new ErrorHandler("You have already submitted a review for this product", 400));
    }

    // 2. Eligibility check: Customer must have purchased and received the product
    const order = await Order.findOne({
      user: userId,
      orderStatus: "Delivered",
      "orderItems.product": productId,
    }).sort({ createdAt: -1 });

    if (!order) {
      return next(
        new ErrorHandler(
          "Only customers who have purchased and received this product can write a review",
          403
        )
      );
    }

    // 3. Validation limits: Up to 10 images, up to 2 videos
    if (!Array.isArray(images) || images.length > 10) {
      return next(new ErrorHandler("You can upload a maximum of 10 images", 400));
    }
    if (!Array.isArray(videos) || videos.length > 2) {
      return next(new ErrorHandler("You can upload a maximum of 2 videos", 400));
    }

    const normalizedImages = images
      .filter((image) => image?.url && image?.public_id)
      .map((image) => ({ url: String(image.url), public_id: String(image.public_id) }));
    const normalizedVideos = videos
      .filter((video) => video?.url && video?.public_id)
      .map((video) => ({ url: String(video.url), public_id: String(video.public_id) }));

    const review = await Review.create({
      product: productId,
      user: userId,
      rating: numericRating,
      title: sanitizeHtml(cleanTitle),
      comment: sanitizeHtml(cleanComment),
      images: normalizedImages,
      videos: normalizedVideos,
      isVerifiedPurchase: true,
      order: order._id,
      status: "Pending",
    });

    return sendResponse(
      res,
      201,
      true,
      "Review submitted successfully and is pending administrator approval",
      { review }
    );
  });

  //
  // 👁️ PUBLIC GET APPROVED REVIEWS (PAGINATED, FILTERED & SORTED)
  //
  getProductReviews = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(new ErrorHandler("Please provide a valid product ID", 400));
    }

    const filter = { product: productId, status: "Approved" };

    if (req.query.rating) {
      const rating = Number(req.query.rating);
      if (rating >= 1 && rating <= 5) filter.rating = rating;
    }
    if (req.query.hasPhotos === "true") filter["images.0"] = { $exists: true };
    if (req.query.hasVideos === "true") filter["videos.0"] = { $exists: true };
    if (req.query.isVerified === "true") filter.isVerifiedPurchase = true;
    if (req.query.featured === "true") filter.isFeatured = true;
    if (req.query.keyword) {
      const keyword = String(req.query.keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { comment: { $regex: keyword, $options: "i" } },
      ];
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      recent: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
      featured: { isFeatured: -1, createdAt: -1 },
    };
    const sortOption = sortOptions[req.query.sort] || sortOptions.newest;

    const limit = clampNumber(req.query.limit || 10, 1, 50);
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const [totalReviews, reviews] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .populate("user", "name avatar")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const normalized = reviews.map((review) => ({
      ...review,
      helpfulCount: review.helpfulCount ?? review.helpfulVotes?.length ?? 0,
      reportsCount: review.reportsCount ?? review.reports?.length ?? 0,
      helpfulVotes: undefined,
      reports: undefined,
    }));

    return sendResponse(res, 200, true, "Reviews fetched successfully", {
      totalReviews,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totalReviews / limit)),
      reviews: normalized,
    });
  });

  //
  // 📊 PUBLIC GET REVIEW SUMMARY & STAR DISTRIBUTION
  //
  getProductReviewsSummary = catchAsyncErrors(async (req, res, next) => {
    const productId = req.params.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(new ErrorHandler("Please provide a valid product ID", 400));
    }

    const [reviews, featuredReviews] = await Promise.all([
      Review.find({ product: productId, status: "Approved" }).select("rating").lean(),
      Review.find({ product: productId, status: "Approved", isFeatured: true })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
    ]);

    const totalReviews = reviews.length;
    const ratingsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;

    reviews.forEach((review) => {
      ratingsCount[review.rating] = (ratingsCount[review.rating] || 0) + 1;
      sumRating += review.rating;
    });

    const averageRating = totalReviews === 0 ? 0 : Number((sumRating / totalReviews).toFixed(1));

    const distribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = ratingsCount[stars];
      return {
        stars,
        count,
        percentage: totalReviews === 0 ? 0 : Math.round((count / totalReviews) * 100),
      };
    });

    return sendResponse(res, 200, true, "Reviews summary fetched successfully", {
      summary: {
        averageRating,
        totalRatings: totalReviews,
        totalReviews,
        distribution,
        featuredReviews,
      },
    });
  });

  //
  // 👍 CUSTOMER HELPFUL VOTE (TOGGLE)
  //
  toggleHelpfulVote = catchAsyncErrors(async (req, res, next) => {
    const reviewId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return next(new ErrorHandler("Review not found", 404));
    }

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));
    if (review.status !== "Approved") {
      return next(new ErrorHandler("Only approved reviews can be voted on", 400));
    }
    if (String(review.user) === String(userId)) {
      return next(new ErrorHandler("You cannot vote on your own review", 400));
    }

    const existingIndex = review.helpfulVotes.findIndex(
      (vote) => String(vote) === String(userId)
    );
    let voted;
    if (existingIndex >= 0) {
      review.helpfulVotes.splice(existingIndex, 1);
      voted = false;
    } else {
      review.helpfulVotes.push(userId);
      voted = true;
    }
    review.helpfulCount = review.helpfulVotes.length;
    await review.save();

    return sendResponse(res, 200, true, voted ? "Thanks for your feedback" : "Vote removed", {
      voted,
      helpfulCount: review.helpfulCount,
    });
  });

  //
  // 🚩 CUSTOMER REPORT REVIEW
  //
  reportReview = catchAsyncErrors(async (req, res, next) => {
    const reviewId = req.params.id;
    const userId = req.user._id;
    const reason = String(req.body.reason || "").trim();

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return next(new ErrorHandler("Review not found", 404));
    }
    if (!reason) return next(new ErrorHandler("Please tell us why you are reporting this review", 400));
    if (reason.length > 500) {
      return next(new ErrorHandler("Report reason cannot exceed 500 characters", 400));
    }

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));
    if (review.status !== "Approved") {
      return next(new ErrorHandler("Only approved reviews can be reported", 400));
    }
    if (String(review.user) === String(userId)) {
      return next(new ErrorHandler("You cannot report your own review", 400));
    }

    const alreadyReported = review.reports.some(
      (report) => String(report.user) === String(userId)
    );
    if (alreadyReported) {
      return next(new ErrorHandler("You have already reported this review", 400));
    }

    review.reports.push({ user: userId, reason: sanitizeHtml(reason), createdAt: new Date() });
    review.reportsCount = review.reports.length;
    await review.save();

    return sendResponse(res, 200, true, "Review reported. Our team will review it shortly.", {
      reportsCount: review.reportsCount,
    });
  });

  //
  // 📤 SECURE CUSTOMER REVIEW MEDIA UPLOAD
  //
  uploadReviewMedia = catchAsyncErrors(async (req, res, next) => {
    const { file, type = "image" } = req.body;

    if (!file) return next(new ErrorHandler("No file payload provided", 400));
    if (type !== "image" && type !== "video") {
      return next(new ErrorHandler("Media type must be either 'image' or 'video'", 400));
    }

    const approxBytes = (file.length * 3) / 4;

    if (type === "image") {
      const allowedImagePrefixes = ["data:image/jpeg", "data:image/png", "data:image/webp", "data:image/jpg"];
      if (!allowedImagePrefixes.some((prefix) => file.startsWith(prefix))) {
        return next(new ErrorHandler("Invalid image format. Only JPG, PNG, and WEBP are allowed.", 400));
      }
      if (approxBytes > 5 * 1024 * 1024) {
        return next(new ErrorHandler("Image size exceeds the 5MB limit", 400));
      }
    } else {
      const allowedVideoPrefixes = ["data:video/mp4", "data:video/quicktime"];
      if (!allowedVideoPrefixes.some((prefix) => file.startsWith(prefix))) {
        return next(new ErrorHandler("Invalid video format. Only MP4 and MOV are allowed.", 400));
      }
      if (approxBytes > 30 * 1024 * 1024) {
        return next(new ErrorHandler("Video size exceeds the 30MB limit", 400));
      }
    }

    try {
      const result = await UploadService.uploadMedia(file, {
        type,
        folder: "delivix/reviews",
      });
      return sendResponse(res, 200, true, "Media uploaded successfully", {
        media: { public_id: result.public_id, url: result.url },
      });
    } catch (uploadError) {
      return next(new ErrorHandler(uploadError.message || "Media upload to Cloudinary failed", 500));
    }
  });

  //
  // 👑 ADMIN: REVIEW STATS
  //
  adminGetReviewStats = catchAsyncErrors(async (req, res) => {
    const [stats] = await Review.aggregate(reviewStatsPipeline);
    return sendResponse(res, 200, true, "Review statistics fetched successfully", {
      stats: {
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        approved: stats?.approved || 0,
        rejected: stats?.rejected || 0,
        featured: stats?.featured || 0,
        reported: stats?.reported || 0,
        averageRating: Number((stats?.averageRating || 0).toFixed(1)),
      },
    });
  });

  //
  // 👑 ADMIN: FETCH ALL REVIEWS (FOR MODERATION LIST)
  //
  adminGetReviews = catchAsyncErrors(async (req, res, next) => {
    const filter = {};

    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.rating) {
      const rating = Number(req.query.rating);
      if (rating >= 1 && rating <= 5) filter.rating = rating;
    }
    if (req.query.product && mongoose.Types.ObjectId.isValid(req.query.product)) {
      filter.product = req.query.product;
    }
    if (req.query.reported === "true") filter["reports.0"] = { $exists: true };
    if (req.query.featured === "true") filter.isFeatured = true;
    if (req.query.keyword) {
      const keyword = String(req.query.keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { comment: { $regex: keyword, $options: "i" } },
      ];
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
      helpful: { helpfulCount: -1, createdAt: -1 },
      reported: { reportsCount: -1, createdAt: -1 },
    };
    const sortOption = sortOptions[req.query.sort] || sortOptions.newest;

    const limit = clampNumber(req.query.limit || 20, 1, 100);
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const [totalReviews, reviews, statsResult] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .populate("product", "name images sku slug")
        .populate("user", "name email")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.aggregate(reviewStatsPipeline),
    ]);

    return sendResponse(res, 200, true, "Admin reviews fetched successfully", {
      totalReviews,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totalReviews / limit)),
      reviews,
      stats: statsResult[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        featured: 0,
        reported: 0,
        averageRating: 0,
      },
    });
  });

  //
  // 👑 ADMIN: EDIT REVIEW CONTENT / STATUS / FEATURED
  //
  adminUpdateReview = catchAsyncErrors(async (req, res, next) => {
    const review = await Review.findById(req.params.id);
    if (!review) return next(new ErrorHandler("Review not found", 404));

    const previousStatus = review.status;
    const previousRating = review.rating;

    if (req.body.rating !== undefined) {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return next(new ErrorHandler("Rating must be a whole number between 1 and 5", 400));
      }
      review.rating = rating;
    }
    if (req.body.title !== undefined) {
      const title = String(req.body.title || "").trim();
      if (title.length > 150) return next(new ErrorHandler("Review title cannot exceed 150 characters", 400));
      review.title = sanitizeHtml(title);
    }
    if (req.body.comment !== undefined) {
      const comment = String(req.body.comment || "").trim();
      if (!comment) return next(new ErrorHandler("Review description cannot be empty", 400));
      if (comment.length > 4000) return next(new ErrorHandler("Review description cannot exceed 4000 characters", 400));
      review.comment = sanitizeHtml(comment);
    }
    if (req.body.status !== undefined) {
      if (!["Pending", "Approved", "Rejected"].includes(req.body.status)) {
        return next(new ErrorHandler("Status must be Pending, Approved or Rejected", 400));
      }
      review.status = req.body.status;
    }
    if (req.body.isFeatured !== undefined) {
      review.isFeatured = Boolean(req.body.isFeatured);
    }

    await review.save();

    if (previousStatus !== review.status || previousRating !== review.rating) {
      await recalculateProductRatings(review.product);
    }

    return sendResponse(res, 200, true, "Review updated successfully", { review });
  });

  //
  // 👑 ADMIN: MODERATE REVIEW STATUS (APPROVE / REJECT)
  //
  adminUpdateReviewStatus = catchAsyncErrors(async (req, res, next) => {
    const { status } = req.body;
    const reviewId = req.params.id;

    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return next(new ErrorHandler("Status must be 'Pending', 'Approved' or 'Rejected'", 400));
    }

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));

    review.status = status;
    await review.save();
    await recalculateProductRatings(review.product);

    return sendResponse(res, 200, true, `Review status updated to ${status} successfully`, {
      review,
    });
  });

  //
  // 👑 ADMIN: BULK MODERATION
  //
  adminBulkReviews = catchAsyncErrors(async (req, res, next) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    const action = String(req.body?.action || "");

    if (!ids.length) return next(new ErrorHandler("Select at least one review", 400));
    if (!["approve", "reject", "pending", "feature", "unfeature", "delete"].includes(action)) {
      return next(new ErrorHandler("Unsupported bulk review action", 400));
    }

    if (action === "delete") {
      const reviews = await Review.find({ _id: { $in: ids } });
      const productIds = [...new Set(reviews.map((review) => String(review.product)))];
      for (const review of reviews) {
        for (const image of review.images) {
          await UploadService.deleteMedia(image.public_id, "image").catch(() => {});
        }
        for (const video of review.videos) {
          await UploadService.deleteMedia(video.public_id, "video").catch(() => {});
        }
      }
      await Review.deleteMany({ _id: { $in: ids } });
      for (const productId of productIds) await recalculateProductRatings(productId);
      return sendResponse(res, 200, true, "Selected reviews deleted", {
        action,
        modified: reviews.length,
      });
    }

    const updates = {
      approve: { status: "Approved" },
      reject: { status: "Rejected" },
      pending: { status: "Pending" },
      feature: { isFeatured: true },
      unfeature: { isFeatured: false },
    };
    const result = await Review.updateMany({ _id: { $in: ids } }, { $set: updates[action] });

    if (["approve", "reject", "pending"].includes(action)) {
      const reviews = await Review.find({ _id: { $in: ids } }).select("product");
      const productIds = [...new Set(reviews.map((review) => String(review.product)))];
      for (const productId of productIds) await recalculateProductRatings(productId);
    }

    return sendResponse(res, 200, true, "Bulk review action completed", {
      action,
      modified: result.modifiedCount,
    });
  });

  //
  // 👑 ADMIN: SUBMIT OR EDIT OFFICIAL ADMIN REPLY
  //
  adminReplyToReview = catchAsyncErrors(async (req, res, next) => {
    const { comment } = req.body;
    const reviewId = req.params.id;

    const cleanComment = String(comment || "").trim();
    if (!cleanComment) return next(new ErrorHandler("Reply message is required", 400));
    if (cleanComment.length > 2000) {
      return next(new ErrorHandler("Reply cannot exceed 2000 characters", 400));
    }

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));

    review.adminReply = {
      comment: sanitizeHtml(cleanComment),
      repliedAt: new Date(),
    };
    await review.save();

    return sendResponse(res, 200, true, "Admin reply saved successfully", { review });
  });

  //
  // 👑 ADMIN: REMOVE SPECIFIC MEDIA
  //
  adminRemoveReviewMedia = catchAsyncErrors(async (req, res, next) => {
    const { public_id, type = "image" } = req.body;
    const reviewId = req.params.id;

    if (!public_id) return next(new ErrorHandler("Media id is required", 400));

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));

    await UploadService.deleteMedia(public_id, type);

    if (type === "video") {
      review.videos = review.videos.filter((video) => video.public_id !== public_id);
    } else {
      review.images = review.images.filter((image) => image.public_id !== public_id);
    }

    await review.save();
    return sendResponse(res, 200, true, "Review media deleted successfully", { review });
  });

  //
  // 👑 ADMIN: DELETE REVIEW COMPLETELY
  //
  adminDeleteReview = catchAsyncErrors(async (req, res, next) => {
    const reviewId = req.params.id;

    const review = await Review.findById(reviewId);
    if (!review) return next(new ErrorHandler("Review not found", 404));

    for (const image of review.images) {
      await UploadService.deleteMedia(image.public_id, "image").catch((err) =>
        console.error(`Failed to delete review image ${image.public_id}:`, err.message)
      );
    }
    for (const video of review.videos) {
      await UploadService.deleteMedia(video.public_id, "video").catch((err) =>
        console.error(`Failed to delete review video ${video.public_id}:`, err.message)
      );
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);
    await recalculateProductRatings(productId);

    return sendResponse(res, 200, true, "Review and associated media deleted successfully");
  });

  //
  // ✍️ CHECK ELIGIBILITY
  //
  checkReviewEligibility = catchAsyncErrors(async (req, res, next) => {
    const { productId } = req.query;
    const userId = req.user._id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(new ErrorHandler("Please provide a valid product ID", 400));
    }

    const existingReview = await Review.findOne({ product: productId, user: userId });
    if (existingReview) {
      return sendResponse(res, 200, true, "You have already submitted a review for this product", {
        eligible: false,
        reason: "already_reviewed",
        review: existingReview,
      });
    }

    const order = await Order.findOne({
      user: userId,
      orderStatus: "Delivered",
      "orderItems.product": productId,
    }).sort({ createdAt: -1 });

    if (!order) {
      return sendResponse(
        res,
        200,
        true,
        "Only customers who have purchased and received this product can write a review.",
        { eligible: false, reason: "no_purchase" }
      );
    }

    return sendResponse(res, 200, true, "You are eligible to submit a review.", {
      eligible: true,
      orderId: order._id,
    });
  });
}

export default new ReviewController();
