import axios from 'axios';

export class ZeptoMailError extends Error {
  constructor({ statusCode, errorCode, message, details }) {
    super(message || "ZeptoMail sending failed");
    this.name = 'ZeptoMailError';
    this.statusCode = statusCode || 500;
    this.errorCode = errorCode || 'ZEPTOMAIL_ERROR';
    this.details = details || null;
    this.isZeptoMailError = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ZeptoMailService {
  constructor() {
    this.appName = process.env.APP_NAME || 'Shreeharikripa';
  }

  static logDebugInfo() {
    const url = process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/v1.1/email';
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL || 'Not Configured';
    const fromName = process.env.ZEPTOMAIL_FROM_NAME || 'Not Configured';
    const keyExists = !!process.env.ZEPTOMAIL_API_KEY;

    console.log('--- ZeptoMail Service Configuration ---');
    console.log(`API Endpoint     : ${url}`);
    console.log(`Sender Name      : ${fromName}`);
    console.log(`Sender Email     : ${fromEmail}`);
    console.log(`ZeptoMail Config : ${keyExists ? 'Ready (API Key Present)' : 'Missing Key'}`);
    console.log('---------------------------------------');
  }

  static validateConfig() {
    const key = process.env.ZEPTOMAIL_API_KEY;
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;
    const fromName = process.env.ZEPTOMAIL_FROM_NAME;

    if (!key) {
      throw new Error("ZeptoMail Config Error: ZEPTOMAIL_API_KEY is missing.");
    }
    if (!fromEmail) {
      throw new Error("ZeptoMail Config Error: ZEPTOMAIL_FROM_EMAIL is missing.");
    }
    if (!fromName) {
      throw new Error("ZeptoMail Config Error: ZEPTOMAIL_FROM_NAME is missing.");
    }

    // Email validation
    if (!fromEmail.includes('@') || !fromEmail.includes('.')) {
      throw new Error(`ZeptoMail Config Error: ZEPTOMAIL_FROM_EMAIL is not a valid email address. Got: "${fromEmail}"`);
    }
  }

  getFromAddress() {
    return {
      address: process.env.ZEPTOMAIL_FROM_EMAIL,
      name: process.env.ZEPTOMAIL_FROM_NAME || this.appName
    };
  }

  getOTPHtmlTemplate(name, otp) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; color: #111111;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e5e5; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);">
    <!-- Top Accent Bar -->
    <tr>
      <td style="background-color: #111111; height: 5px; line-height: 5px; font-size: 0;">&nbsp;</td>
    </tr>
    <!-- Header Logo -->
    <tr>
      <td style="padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #f0f0f0;">
        <h1 style="font-size: 26px; font-weight: 800; color: #111111; margin: 0; letter-spacing: -0.6px; text-transform: uppercase;">
          DELIVIX<span style="color: #9a9a9a;">.</span>
        </h1>
        <p style="margin: 8px 0 0 0; font-size: 10px; letter-spacing: 2.2px; color: #6b7280; text-transform: uppercase; font-weight: 600;">
          Administration &amp; Security Portal
        </p>
      </td>
    </tr>
    <!-- Body Content -->
    <tr>
      <td style="padding: 32px 40px 36px 40px; color: #27272a; font-size: 15px; line-height: 26px;">
        <p style="margin: 0 0 16px 0; font-size: 17px; font-weight: 600; color: #111111;">Hello ${name},</p>
        <p style="margin-bottom: 20px;">We received a request to reset the password for your account. Please use the verification code below to proceed:</p>

        <!-- OTP Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
          <tr>
            <td align="center" style="background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 12px; padding: 26px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; color: #111111; letter-spacing: 10px; padding-left: 10px; display: inline-block;">${otp}</span>
            </td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #4b5563; text-align: center; margin-top: 16px;">This code is valid for <strong style="color: #111111;">10 minutes</strong>. Please do not share this OTP with anyone.</p>

        <!-- Security Warning -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
          <tr>
            <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; color: #92400e; font-size: 13px; line-height: 20px;">
              <strong style="display: block; margin-bottom: 4px; font-size: 14px; color: #78350f;">Security Notice:</strong>
              If you did not request a password reset, please ignore this email or contact support if you suspect unauthorized access.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #f0f0f0; color: #6b7280;">
        <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 19px; color: #6b7280;">
          This is an automated message from DELIVIX. Please do not reply to this email.
        </p>
        <p style="margin: 0; font-size: 11px; line-height: 18px; color: #9a9a9a;">
          &copy; ${new Date().getFullYear()} DELIVIX Technologies. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendOTPEmail(to, name, otp) {
    const url = process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/v1.1/email';
    const key = process.env.ZEPTOMAIL_API_KEY;

    if (!key) {
      throw new ZeptoMailError({
        statusCode: 500,
        errorCode: 'CONFIG_ERROR',
        message: 'ZeptoMail API key is missing'
      });
    }

    const payload = {
      from: this.getFromAddress(),
      to: [
        {
          email_address: {
            address: to,
            name: to.split('@')[0]
          }
        }
      ],
      subject: "Reset Your Password - Verification Code",
      htmlbody: this.getOTPHtmlTemplate(name, otp)
    };

    try {
      console.log(`Sending OTP email to ${to} via ZeptoMail API (Axios)...`);
      const authHeader = key.startsWith('Zoho-enczapikey') ? key : `Zoho-enczapikey ${key}`;
      const response = await axios.post(url, payload, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });
      return response.data;
    } catch (error) {
      let statusCode = 500;
      let errorCode = 'ZEPTOMAIL_API_ERROR';
      let message = error.message;
      let details = null;

      if (error.response) {
        statusCode = error.response.status;
        const resData = error.response.data;
        details = resData;
        if (resData && resData.error) {
          errorCode = resData.error.code || errorCode;
          message = resData.error.message || message;
          details = resData.error.details || resData;
        }
      }

      console.error("ZeptoMail API send failed:", { statusCode, errorCode, message, details });
      throw new ZeptoMailError({
        statusCode,
        errorCode,
        message,
        details
      });
    }
  }
}

export default new ZeptoMailService();
