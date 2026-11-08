import cloudinary, { isCloudinaryConfigured } from "../utils/cloudinary.js";

export class UploadService {
  /**
   * Check whether Cloudinary has valid credentials configured
   */
  isConfigured() {
    return isCloudinaryConfigured();
  }

  /**
   * Upload media to Cloudinary (image or video)
   * @param {string} file - Base64 data URI, image URL, or file path
   * @param {object} options - Options (type: "image"|"video", folder: string)
   */
  async uploadMedia(file, { type = "image", folder = "delivix/products" } = {}) {
    if (!file) {
      throw new Error("No file or image provided for upload");
    }

    if (!this.isConfigured()) {
      console.warn(
        `[UploadService] Cloudinary credentials not configured in .env. Storing reference in offline/development mode.`
      );
      return {
        public_id: `delivix_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        url: file,
        duration: 0,
      };
    }

    const uploadOptions = {
      folder: folder || "delivix/products",
      resource_type: type === "video" ? "video" : "image",
    };

    if (type === "image") {
      uploadOptions.quality = "auto";
      uploadOptions.fetch_format = "auto";
    }

    try {
      const result = await cloudinary.uploader.upload(file, uploadOptions);

      // Video length restriction (e.g. 30 seconds max)
      if (type === "video" && result.duration > 30) {
        await cloudinary.uploader.destroy(result.public_id, { resource_type: "video" });
        throw new Error("Video must be under 30 seconds");
      }

      return {
        public_id: result.public_id,
        url: result.secure_url || result.url,
        duration: result.duration,
      };
    } catch (error) {
      console.error("[UploadService] Cloudinary upload error:", error.message);
      throw error;
    }
  }

  /**
   * Delete media from Cloudinary
   * @param {string} publicId - The public ID of the resource
   * @param {string} type - "image" or "video"
   */
  async deleteMedia(publicId, type = "image") {
    if (!this.isConfigured() || !publicId || publicId.startsWith("delivix_") || publicId.startsWith("img_")) {
      return true;
    }

    try {
      const resourceType = type === "video" ? "video" : "image";
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      return result.result === "ok" || result.result === "not found";
    } catch (error) {
      console.error(`[UploadService] Cloudinary delete error for ${publicId}:`, error.message);
      throw error;
    }
  }
}

export default new UploadService();

