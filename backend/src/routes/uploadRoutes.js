import express from "express";
import { uploadMedia, deleteMedia, getCloudinaryStatus } from "../controllers/uploadController.js";
import { authorizeRoles, isAuthenticatedUser } from "../middleware/auth.js";

const router = express.Router();

// Cloudinary service status (public, returns only non-sensitive config)
router.route("/upload/status").get(getCloudinaryStatus);

// 🔒 All write operations require an authenticated admin/staff user.
// Uploads go through the backend so Cloudinary secrets never reach the client.
const adminGuard = [isAuthenticatedUser, authorizeRoles("admin", "staff")];

router.route("/upload/product-image").post(adminGuard, uploadMedia);
router.route("/upload").post(adminGuard, uploadMedia);
router.route("/upload").delete(adminGuard, deleteMedia);

router.route("/admin/upload").post(adminGuard, uploadMedia);
router.route("/admin/upload").delete(adminGuard, deleteMedia);

export default router;

