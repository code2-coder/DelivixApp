import { isAuthenticatedUser, protect } from "./auth.middleware.js";
import { authorizeRoles, requireAdmin, requireStaffOrAdmin } from "./admin.middleware.js";

export {
  isAuthenticatedUser,
  protect,
  authorizeRoles,
  requireAdmin,
  requireStaffOrAdmin,
};

export default {
  isAuthenticatedUser,
  protect,
  authorizeRoles,
};
