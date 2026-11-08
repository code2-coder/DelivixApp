import rateLimit from "express-rate-limit";

const isProduction = (process.env.NODE_ENV || "").toLowerCase() === "production";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 500 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 login/register attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    code: "AUTH_RATE_LIMIT",
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    code: "FORGOT_PASSWORD_RATE_LIMIT",
    message: "Too many password reset requests. Please try again after 15 minutes.",
  },
});

export const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    code: "OTP_RATE_LIMIT",
    message: "Too many verification attempts. Please try again after 15 minutes.",
  },
});

export default {
  apiLimiter,
  authLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
};
