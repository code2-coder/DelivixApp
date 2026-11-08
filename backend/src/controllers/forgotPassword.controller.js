import UserRepository from '../repositories/UserRepository.js';
import PasswordResetOTP from '../models/PasswordResetOTP.js';
import zeptoMailService from '../services/zeptoMail.service.js';
import { generateOTP } from '../utils/generateOTP.js';
import { hashOTP, compareOTP } from '../utils/hashOTP.js';
import { generateResetToken, verifyResetToken } from '../utils/jwt.js';
import bcrypt from 'bcryptjs';
import ErrorHandler from '../utils/errorHandler.js';

export class ForgotPasswordController {
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const formattedEmail = email.toLowerCase().trim();

      // Find user - to prevent user enumeration we return generic success even if user doesn't exist
      const user = await UserRepository.findByEmail(formattedEmail);
      if (!user) {
        // Simulate a slight delay to mimic hash/email operations and prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(200).json({
          success: true,
          message: "If your email is registered in our system, a 6-digit verification code has been sent."
        });
      }

      // Generate secure OTP
      const otp = generateOTP();
      const otpHash = hashOTP(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // Store in DB, overwriting any previous OTP records for this email
      await PasswordResetOTP.findOneAndDelete({ email: formattedEmail });
      await PasswordResetOTP.create({
        email: formattedEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        isVerified: false
      });

      // Send via ZeptoMail
      await zeptoMailService.sendOTPEmail(formattedEmail, user.name, otp);

      return res.status(200).json({
        success: true,
        message: "If your email is registered in our system, a 6-digit verification code has been sent."
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { email, otp } = req.body;
      const formattedEmail = email.toLowerCase().trim();

      // Find OTP record
      const otpRecord = await PasswordResetOTP.findOne({ email: formattedEmail });
      if (!otpRecord) {
        return next(new ErrorHandler("Invalid or expired OTP", 400));
      }

      // Check expiry
      if (otpRecord.expiresAt < new Date()) {
        await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
        return next(new ErrorHandler("Invalid or expired OTP", 400));
      }

      // Check max attempts
      if (otpRecord.attempts >= 5) {
        await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
        return next(new ErrorHandler("Max verification attempts exceeded. Please request a new OTP.", 400));
      }

      // Verify OTP hash
      const isMatch = compareOTP(otp, otpRecord.otpHash);
      if (!isMatch) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        // Return generic error message to prevent brute forcing
        return next(new ErrorHandler("Invalid or expired OTP", 400));
      }

      // Mark as verified & delete record immediately (token is proof of verification)
      await PasswordResetOTP.deleteOne({ _id: otpRecord._id });

      // Generate short-lived reset token (JWT)
      const resetToken = generateResetToken(formattedEmail);

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        token: resetToken
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      // Verify JWT token
      const decoded = verifyResetToken(token);
      if (!decoded || !decoded.email) {
        return next(new ErrorHandler("Invalid or expired reset token", 400));
      }

      // Find user
      const user = await UserRepository.findByEmail(decoded.email);
      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }

      // Hash password with bcrypt
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update user password
      user.password = hashedPassword;
      await user.save();

      // Clean up any remaining OTP records for this email
      await PasswordResetOTP.deleteMany({ email: decoded.email });

      return res.status(200).json({
        success: true,
        message: "Password reset successful. You can now login with your new password."
      });
    } catch (error) {
      next(error);
    }
  }

  async resendOtp(req, res, next) {
    try {
      const { email } = req.body;
      const formattedEmail = email.toLowerCase().trim();

      // Find user - prevent enumeration
      const user = await UserRepository.findByEmail(formattedEmail);
      if (!user) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return res.status(200).json({
          success: true,
          message: "A new verification code has been sent if this email is registered."
        });
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpHash = hashOTP(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Store in DB, overwriting any previous OTP records for this email
      await PasswordResetOTP.findOneAndDelete({ email: formattedEmail });
      await PasswordResetOTP.create({
        email: formattedEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        isVerified: false
      });

      // Send via ZeptoMail
      await zeptoMailService.sendOTPEmail(formattedEmail, user.name, otp);

      return res.status(200).json({
        success: true,
        message: "A new verification code has been sent if this email is registered."
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ForgotPasswordController();
