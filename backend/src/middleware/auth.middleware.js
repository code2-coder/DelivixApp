import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/User.js";

/**
 * Middleware to verify user authentication via Bearer token header or cookies
 */
export const isAuthenticatedUser = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies) {
    token = req.cookies.jwt || req.cookies.token;
  }

  if (!token) {
    return next(ApiError.unauthorized("Authentication required. Please log in to continue.", [], "AUTH_REQUIRED"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(ApiError.unauthorized("User account associated with this token no longer exists.", [], "USER_NOT_FOUND"));
    }

    if (user.status === "blocked") {
      return next(
        ApiError.forbidden(
          "Your account has been blocked by an administrator. Please contact customer support.",
          [],
          "ACCOUNT_BLOCKED"
        )
      );
    }
    if (user.status === "suspended") {
      return next(
        ApiError.forbidden(
          "Your account is temporarily suspended. Please contact customer support.",
          [],
          "ACCOUNT_SUSPENDED"
        )
      );
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(ApiError.unauthorized("Session token has expired. Please log in again.", [], "TOKEN_EXPIRED"));
    }
    return next(ApiError.unauthorized("Invalid authentication token.", [], "INVALID_TOKEN"));
  }
});

/**
 * Backward compatibility alias
 */
export const protect = isAuthenticatedUser;

export default {
  isAuthenticatedUser,
  protect,
};
