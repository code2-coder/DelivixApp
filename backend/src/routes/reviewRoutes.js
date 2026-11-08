import express from "express";
import reviewController from "../controllers/ReviewController.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";

const router = express.Router();

//
// ✍️ CUSTOMER REVIEWS
//
router.post("/reviews", isAuthenticatedUser, reviewController.createReview);
router.post("/reviews/upload-media", isAuthenticatedUser, reviewController.uploadReviewMedia);
router.get("/reviews/check-eligibility", isAuthenticatedUser, reviewController.checkReviewEligibility);
router.put("/reviews/:id/helpful", isAuthenticatedUser, reviewController.toggleHelpfulVote);
router.post("/reviews/:id/report", isAuthenticatedUser, reviewController.reportReview);

//
// 👁️ PUBLIC PRODUCT REVIEWS & SUMMARIES
//
router.get("/reviews/product/:id", cacheMiddleware(300), reviewController.getProductReviews);
router.get("/reviews/product/:id/summary", cacheMiddleware(300), reviewController.getProductReviewsSummary);

//
// 👑 ADMIN PANEL MODERATION
//
const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

router.get("/admin/reviews/stats", adminGuard, reviewController.adminGetReviewStats);
router.post("/admin/reviews/bulk", adminGuard, reviewController.adminBulkReviews);
router.get("/admin/reviews", adminGuard, reviewController.adminGetReviews);
router.put("/admin/reviews/:id/status", adminGuard, reviewController.adminUpdateReviewStatus);
router.put("/admin/reviews/:id", adminGuard, reviewController.adminUpdateReview);
router.post("/admin/reviews/:id/reply", adminGuard, reviewController.adminReplyToReview);
router.delete("/admin/reviews/:id/media", adminGuard, reviewController.adminRemoveReviewMedia);
router.delete("/admin/reviews/:id", adminGuard, reviewController.adminDeleteReview);

export default router;
