import {
  apiLimiter,
  authLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
} from "./rateLimit.middleware.js";

export {
  apiLimiter,
  authLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
};

export default {
  apiLimiter,
  authLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
};
