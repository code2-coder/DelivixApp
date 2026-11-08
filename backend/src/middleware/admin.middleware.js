import { ApiError } from "../utils/ApiError.js";

/**
 * Middleware to restrict route access by role
 * @param  {...string} roles - Permitted roles (e.g. 'admin', 'staff')
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required to verify permissions.", [], "AUTH_REQUIRED"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Role (${req.user.role}) is not authorized to perform this operation.`,
          [],
          "FORBIDDEN_ROLE"
        )
      );
    }

    next();
  };
};

export const requireAdmin = authorizeRoles("admin");
export const requireStaffOrAdmin = authorizeRoles("admin", "staff");

export default {
  authorizeRoles,
  requireAdmin,
  requireStaffOrAdmin,
};
