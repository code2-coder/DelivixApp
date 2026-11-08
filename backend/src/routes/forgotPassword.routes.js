import express from 'express';
import forgotPasswordController from '../controllers/forgotPassword.controller.js';
import { validate } from '../middleware/validator.js';
import {
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  resendOtpSchema
} from '../validators/forgotPassword.validator.js';
import { forgotPasswordLimiter, verifyOtpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  (req, res, next) => forgotPasswordController.forgotPassword(req, res, next)
);

router.post(
  '/verify-otp',
  verifyOtpLimiter,
  validate(verifyOtpSchema),
  (req, res, next) => forgotPasswordController.verifyOtp(req, res, next)
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  (req, res, next) => forgotPasswordController.resetPassword(req, res, next)
);

router.post(
  '/resend-otp',
  forgotPasswordLimiter,
  validate(resendOtpSchema),
  (req, res, next) => forgotPasswordController.resendOtp(req, res, next)
);

export default router;
