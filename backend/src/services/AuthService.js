import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import UserRepository from "../repositories/UserRepository.js";
import EmailService from "./EmailService.js";
import OtpService from "./OtpService.js";
import ErrorHandler from "../utils/errorHandler.js";

export class AuthService {
  // Helper to generate access token
  generateAccessToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: "7d", // 7 days long-lived
    });
  }

  // Helper to generate refresh token
  generateRefreshToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: "7d", // 7 days long-lived
    });
  }

  async register({ name, email, password, phoneNumber }) {
    const formattedEmail = email.toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await UserRepository.findByEmail(formattedEmail);
    if (existingUser) {
      throw new ErrorHandler("User already exists. Please login.", 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Create user
    const user = await UserRepository.create({
      name,
      email: formattedEmail,
      password: hashedPassword,
      phoneNumber,
      isVerified: false,
      emailVerificationOTP: otpHash,
      emailVerificationOTPExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Send verification email
    try {
      await EmailService.sendVerificationEmail(formattedEmail, name, otp);
    } catch (emailError) {
      console.error("Verification email failed during registration:", emailError.message);
      // Clean up user if verification email fails, since they cannot verify
      await UserRepository.deleteById(user._id);
      throw new Error(`Failed to send verification email: ${emailError.message}`);
    }

    // Send welcome email (async non-blocking)
    EmailService.sendWelcomeEmail(formattedEmail, name).catch(err => {
      console.error("Welcome email failed during registration:", err.message);
    });

    return {
      userId: user._id,
      email: user.email,
      message: "Registration successful. Please check your email for verification OTP."
    };
  }

  async verifyEmail({ email, otp }) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail, { select: "+emailVerificationOTP +emailVerificationOTPExpires +isVerified" });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (user.isVerified) {
      return { message: "Email already verified. You can now login." };
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      throw new ErrorHandler("No OTP found. Please request a new verification OTP.", 400);
    }

    if (user.emailVerificationOTPExpires < Date.now()) {
      throw new ErrorHandler("OTP has expired. Please request a new one.", 400);
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (user.emailVerificationOTP !== otpHash) {
      throw new ErrorHandler("Invalid OTP", 400);
    }

    user.isVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    return { success: true, message: "Email verified successfully. You can now login." };
  }

  async resendVerificationEmail(email) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail);

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (user.isVerified) {
      return { message: "Email already verified." };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    user.emailVerificationOTP = otpHash;
    user.emailVerificationOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await EmailService.sendVerificationEmail(user.email, user.name, otp);

    return { success: true, message: "Verification OTP has been resent to your email." };
  }

  async login({ email, password }) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail, { select: "+password +isVerified" });

    if (!user) {
      throw new ErrorHandler("Invalid email or password", 401);
    }

    if (!user.password && user.provider === "google") {
      throw new ErrorHandler("This account is registered via Google Login. Please use Google OAuth.", 400);
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new ErrorHandler("Invalid email or password", 401);
    }

    if (user.status === "blocked") {
      throw new ErrorHandler("Your account has been blocked by an administrator. Please contact customer support.", 403);
    }
    if (user.status === "suspended") {
      throw new ErrorHandler("Your account is temporarily suspended. Please contact customer support.", 403);
    }

    if (!user.isVerified) {
      return {
        requiresVerification: true,
        email: user.email,
        message: "Please verify your account before logging in."
      };
    }

    const accessToken = this.generateAccessToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token to user DB
    user.refreshToken = refreshToken;
    user.lastLogin = Date.now();
    await user.save();

    // Remove password field
    user.password = undefined;

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  async verifyRefreshToken(token) {
    if (!token) {
      throw new ErrorHandler("Refresh token is required", 400);
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await UserRepository.findById(decoded.id, "+refreshToken");

      if (!user || user.refreshToken !== token) {
        throw new ErrorHandler("Invalid refresh token", 401);
      }

      const accessToken = this.generateAccessToken(user._id);
      const newRefreshToken = this.generateRefreshToken(user._id);

      user.refreshToken = newRefreshToken;
      await user.save();

      return {
        accessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      if (error instanceof ErrorHandler) throw error;
      throw new ErrorHandler("Invalid or expired refresh token", 401);
    }
  }

  async forgotPassword(email) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail);

    if (!user) {
      throw new ErrorHandler("User not found", 400);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.resetPasswordToken = hashedOtp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await EmailService.sendPasswordResetEmail(user.email, user.name, otp);

    return { success: true, message: "Password reset OTP sent to your email." };
  }

  async verifyPasswordResetOtp({ email, otp }) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail, { select: "+resetPasswordToken +resetPasswordExpires" });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (!user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new ErrorHandler("No password reset OTP found or already used", 400);
    }

    if (user.resetPasswordExpires < Date.now()) {
      throw new ErrorHandler("OTP has expired. Please request a new one.", 400);
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    if (user.resetPasswordToken !== hashedOtp) {
      throw new ErrorHandler("Invalid OTP", 400);
    }

    return { success: true, message: "OTP verified. You can now reset your password." };
  }

  async resetPassword({ email, otp, newPassword }) {
    const formattedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(formattedEmail, { select: "+resetPasswordToken +resetPasswordExpires" });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    // Verify OTP first
    await this.verifyPasswordResetOtp({ email, otp });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    EmailService.sendPasswordChangedEmail(user.email, user.name).catch(err => {
      console.error("Password change confirmation email failed:", err.message);
    });

    return { success: true, message: "Password reset successful. You can now login with your new password." };
  }

  // --- Phone OTP Verification Services via MSG91 ---
  async sendPhoneOtp(userId, phoneNumber) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Send MSG91 OTP
    const result = await OtpService.sendOtp(phoneNumber);
    if (!result.success) {
      throw new Error(result.error || "Failed to send phone OTP");
    }

    // Save phone temporarily in user profile if they want to update it
    user.phoneNumber = phoneNumber;
    await user.save();

    return { success: true, message: "OTP sent to your phone number." };
  }

  async verifyPhoneOtp(userId, otp) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.phoneNumber) {
      throw new Error("No phone number registered for OTP verification");
    }

    const result = await OtpService.verifyOtp(user.phoneNumber, otp);
    if (!result.success) {
      throw new Error(result.message || "Invalid OTP");
    }

    // Mark user as phone verified or save phone permanently
    user.isVerified = true; // Auto verify account if phone verified
    await user.save();

    return { success: true, message: "Phone number verified successfully." };
  }

  async sendLoginOtp(email) {
    const formattedEmail = (email || "").toLowerCase().trim();
    if (!formattedEmail) {
      throw new ErrorHandler("Email is required", 400);
    }

    let user = await UserRepository.findByEmail(formattedEmail);
    if (!user) {
      throw new ErrorHandler("User with this email not found. Please register first.", 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    user.emailVerificationOTP = otpHash;
    user.emailVerificationOTPExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    let emailSent = false;
    try {
      await EmailService.sendVerificationEmail(user.email, user.name || "User", otp);
      emailSent = true;
    } catch (emailError) {
      console.error("ZeptoMail sending failed during OTP login request:", emailError.message);
    }

    return {
      success: true,
      emailSent,
      message: emailSent
        ? `Verification OTP sent to ${formattedEmail} via ZeptoMail.`
        : `Generated OTP for ${formattedEmail}. (ZeptoMail delivery simulation)`,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  }

  async verifyLoginOtp({ email, otp }) {
    const formattedEmail = (email || "").toLowerCase().trim();
    if (!formattedEmail || !otp) {
      throw new ErrorHandler("Email and OTP are required", 400);
    }

    const user = await UserRepository.findByEmail(formattedEmail, {
      select: "+emailVerificationOTP +emailVerificationOTPExpires +isVerified +role +status",
    });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (user.status === "blocked") {
      throw new ErrorHandler("Your account has been blocked by an administrator. Please contact customer support.", 403);
    }
    if (user.status === "suspended") {
      throw new ErrorHandler("Your account is temporarily suspended. Please contact customer support.", 403);
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      throw new ErrorHandler("No pending OTP found. Please request a new verification OTP.", 400);
    }

    if (user.emailVerificationOTPExpires < Date.now()) {
      throw new ErrorHandler("OTP has expired. Please request a new one.", 400);
    }

    const otpHash = crypto.createHash("sha256").update(otp.toString().trim()).digest("hex");
    if (user.emailVerificationOTP !== otpHash) {
      throw new ErrorHandler("Invalid OTP code", 400);
    }

    user.isVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;

    const accessToken = this.generateAccessToken(user._id);
    const refreshToken = this.generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = Date.now();
    await user.save();

    return {
      success: true,
      message: "Email verified & Login successful",
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  async logout(userId) {
    if (userId) {
      const user = await UserRepository.findById(userId);
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    }
    return { success: true, message: "Logged out successfully" };
  }
}

export default new AuthService();
