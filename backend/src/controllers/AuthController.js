import AuthService from "../services/AuthService.js";
import { sendResponse } from "../helpers/response.js";
import UserRepository from "../repositories/UserRepository.js";
import EmailService from "../services/EmailService.js";
import bcrypt from "bcryptjs";

// Helper function to set cookies
const setCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "PRODUCTION",
    sameSite: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "PRODUCTION" ? "none" : "lax",
  };

  res.cookie("jwt", accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};

export class AuthController {
  async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      return sendResponse(res, 201, true, result.message, { userId: result.userId });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const result = await AuthService.verifyEmail(req.body);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return sendResponse(res, 400, false, "Email is required");
      }
      const result = await AuthService.resendVerificationEmail(email);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async sendLoginOtp(req, res, next) {
    try {
      const { email } = req.body;
      const result = await AuthService.sendLoginOtp(email);
      return sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to send OTP",
      });
    }
  }

  async verifyLoginOtp(req, res, next) {
    try {
      const { email, otp } = req.body;
      const result = await AuthService.verifyLoginOtp({ email, otp });
      setCookies(res, result.accessToken, result.refreshToken);
      return sendResponse(res, 200, true, result.message, {
        user: result.user,
        token: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to verify OTP",
      });
    }
  }

  async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body);

      if (result.requiresVerification) {
        return res.status(200).json({
          success: false,
          requiresVerification: true,
          email: result.email,
          message: result.message
        });
      }

      setCookies(res, result.accessToken, result.refreshToken);

      return sendResponse(res, 200, true, "Login successful", {
        user: result.user,
        token: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      // AuthService throws plain Error with no statusCode → default to 401 for auth errors
      const status = error.statusCode || 401;
      return res.status(status).json({
        success: false,
        message: error.message || "Login failed"
      });
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      const result = await AuthService.verifyRefreshToken(token);

      setCookies(res, result.accessToken, result.refreshToken);

      return sendResponse(res, 200, true, "Token refreshed successfully", {
        token: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return sendResponse(res, 400, false, "Email is required");
      }
      const result = await AuthService.forgotPassword(email);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const result = await AuthService.verifyPasswordResetOtp(req.body);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await AuthService.resetPassword(req.body);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await UserRepository.findById(req.user._id);
      return sendResponse(res, 200, true, "Profile fetched successfully", { user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { name, email, phoneNumber, altPhoneNumber, address } = req.body;
      const user = await UserRepository.findById(req.user._id);

      if (!user) {
        return sendResponse(res, 404, false, "User not found");
      }

      if (name) user.name = name;
      if (email) user.email = email;
      if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
      if (req.body.phone !== undefined && !phoneNumber) user.phoneNumber = req.body.phone;
      if (altPhoneNumber !== undefined) user.altPhoneNumber = altPhoneNumber;
      if (address !== undefined && typeof address === "object") {
        user.address = {
          ...(user.address && user.address.toObject ? user.address.toObject() : (user.address || {})),
          ...address,
        };
      } else if (address !== undefined) {
        user.address = address;
      }

      await user.save();
      return sendResponse(res, 200, true, "Profile updated successfully", { user });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { oldPassword, password } = req.body;
      const user = await UserRepository.findById(req.user._id, "+password");

      if (!user) {
        return sendResponse(res, 404, false, "User not found");
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return sendResponse(res, 400, false, "Invalid old password");
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();

      return sendResponse(res, 200, true, "Password updated successfully");
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      await UserRepository.deleteById(req.user._id);
      res.clearCookie("jwt");
      res.clearCookie("refreshToken");
      return sendResponse(res, 200, true, "Account deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // --- Phone OTP Handlers via MSG91 ---
  async sendPhoneOtp(req, res, next) {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return sendResponse(res, 400, false, "Phone number is required");
      }
      const result = await AuthService.sendPhoneOtp(req.user._id, phoneNumber);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async verifyPhoneOtp(req, res, next) {
    try {
      const { otp } = req.body;
      if (!otp) {
        return sendResponse(res, 400, false, "OTP code is required");
      }
      const result = await AuthService.verifyPhoneOtp(req.user._id, otp);
      return sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const userId = req.user ? req.user._id : null;
      await AuthService.logout(userId);
      res.clearCookie("jwt");
      res.clearCookie("refreshToken");
      return sendResponse(res, 200, true, "Logged out successfully");
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req, res, next) {
    const clientUrl = process.env.CLIENT_URL || 'https://www.delivix.in';

    try {
      if (!req.user) {
        return res.redirect(`${clientUrl}/login?error=Google auth failed`);
      }

      const accessToken = AuthService.generateAccessToken(req.user._id);
      const refreshToken = AuthService.generateRefreshToken(req.user._id);

      // Save refresh token
      req.user.refreshToken = refreshToken;
      req.user.lastLogin = Date.now();
      
      if (!req.user.isVerified) {
        req.user.isVerified = true;
        EmailService.sendWelcomeEmail(req.user.email, req.user.name).catch(e => console.error(e));
      }
      
      await req.user.save();

      setCookies(res, accessToken, refreshToken);

      res.redirect(`${clientUrl}/login?token=${accessToken}&refreshToken=${refreshToken}`);
    } catch (error) {
      console.error("Google Callback Error:", error);
      res.redirect(`${clientUrl}/login?error=Server error`);
    }
  }
}

export default new AuthController();
