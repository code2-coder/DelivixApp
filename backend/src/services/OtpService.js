import axios from "axios";

export class OtpService {
  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  }

  /**
   * Send OTP using MSG91
   * @param {string} mobile - Mobile number with country code (e.g. 919876543210)
   * @param {string} [otp] - Optional custom OTP. If not provided, MSG91 generates it.
   */
  async sendOtp(mobile, otp) {
    if (!this.authKey) {
      console.log(`[MSG91 MOCK] Sending OTP ${otp || "auto-generated"} to mobile: ${mobile}`);
      return { success: true, mock: true, message: "Mock OTP Sent successfully." };
    }

    try {
      const params = {
        authkey: this.authKey,
        mobile: mobile.replace(/[+\s]/g, ""), // Clean mobile number format
        template_id: this.templateId
      };

      if (otp) {
        params.otp = otp;
      }

      const response = await axios.get("https://control.msg91.com/api/v5/otp", { params });

      if (response.data && response.data.type === "success") {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.data?.message || "Failed to send OTP via MSG91");
      }
    } catch (error) {
      console.error("MSG91 sendOtp Error:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify OTP using MSG91
   * @param {string} mobile - Mobile number with country code
   * @param {string} otp - OTP to verify
   */
  async verifyOtp(mobile, otp) {
    if (!this.authKey) {
      console.log(`[MSG91 MOCK] Verifying OTP ${otp} for mobile: ${mobile}`);
      // Dev fallback: allow verification of OTP 123456 or matches mock pattern
      if (otp === "123456" || otp.length === 6) {
        return { success: true, mock: true, message: "Mock OTP verified successfully." };
      }
      return { success: false, message: "Invalid Mock OTP" };
    }

    try {
      const params = {
        authkey: this.authKey,
        mobile: mobile.replace(/[+\s]/g, ""),
        otp: otp
      };

      const response = await axios.get("https://control.msg91.com/api/v5/otp/verify", { params });

      if (response.data && response.data.type === "success") {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.data?.message || "Invalid OTP" };
      }
    } catch (error) {
      console.error("MSG91 verifyOtp Error:", error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new OtpService();
