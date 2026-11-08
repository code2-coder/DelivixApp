import rateLimit from "express-rate-limit";

export const couponValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 coupon-validation attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    code: "COUPON_RATE_LIMIT",
    message: "Too many coupon validation attempts. Please try again after 15 minutes.",
  },
});
