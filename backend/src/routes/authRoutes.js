import express from "express";
import authController from "../controllers/AuthController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validator.js";
import {
  registerSchema,
  loginSchema,
  updatePasswordSchema
} from "../validators/auth.validator.js";
import passport from "passport";

const router = express.Router();

// Direct Registration and Login
router.post("/register", validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post("/login", validate(loginSchema), (req, res, next) => authController.login(req, res, next)); 
router.post("/refresh-token", (req, res, next) => authController.refreshToken(req, res, next)); 

// Email Verification & ZeptoMail OTP Login
router.post("/verify-email", (req, res, next) => authController.verifyEmail(req, res, next));
router.post("/resend-verification", (req, res, next) => authController.resendVerification(req, res, next));
router.post("/auth/send-otp", (req, res, next) => authController.sendLoginOtp(req, res, next));
router.post("/auth/verify-otp", (req, res, next) => authController.verifyLoginOtp(req, res, next));
router.post("/admin/send-otp", (req, res, next) => authController.sendLoginOtp(req, res, next));
router.post("/admin/verify-otp", (req, res, next) => authController.verifyLoginOtp(req, res, next));

// Password Management (Handled by forgotPassword.routes.js)


// Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL}/login` }),
  (req, res, next) => authController.googleCallback(req, res, next)
);

// Profile and Logout
router.get("/me", protect, (req, res, next) => authController.getProfile(req, res, next));
router.get("/logout", (req, res, next) => authController.logout(req, res, next));
router.post("/logout", (req, res, next) => authController.logout(req, res, next));
router.get("/profile", protect, (req, res, next) => authController.getProfile(req, res, next));



// User Profile management
router.put("/me/update", protect, (req, res, next) => authController.updateProfile(req, res, next));
router.put("/user/profile", protect, (req, res, next) => authController.updateProfile(req, res, next));
router.put("/user/change-password", protect, validate(updatePasswordSchema), (req, res, next) => authController.changePassword(req, res, next));
router.delete("/user/delete-account", protect, (req, res, next) => authController.deleteAccount(req, res, next));

// --- MSG91 OTP Phone Endpoints ---
router.post("/auth/send-phone-otp", protect, (req, res, next) => authController.sendPhoneOtp(req, res, next));
router.post("/auth/verify-phone-otp", protect, (req, res, next) => authController.verifyPhoneOtp(req, res, next));

export default router;
