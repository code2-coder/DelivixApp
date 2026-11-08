import { v2 as cloudinary } from "cloudinary";

/**
 * Configure Cloudinary with environment variables.
 * Supports both CLOUDINARY_URL and separate credentials:
 * CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
export function configureCloudinary() {
  const urlStr = process.env.CLOUDINARY_URL || "";
  if (urlStr.startsWith("cloudinary://")) {
    try {
      const trimmed = urlStr.replace("cloudinary://", "");
      const [keySecret, cloudName] = trimmed.split("@");
      if (keySecret && cloudName) {
        const [apiKey, apiSecret] = keySecret.split(":");
        cloudinary.config({
          cloud_name: cloudName.trim(),
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          secure: true,
        });
        return true;
      }
    } catch (err) {
      console.warn("[Cloudinary] Failed to parse CLOUDINARY_URL:", err.message);
    }
  }

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true,
    });
    return true;
  }

  return false;
}

/**
 * Returns true if Cloudinary is configured with valid credentials
 */
export function isCloudinaryConfigured() {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

// Initial configuration
configureCloudinary();

export { cloudinary };
export default cloudinary;

