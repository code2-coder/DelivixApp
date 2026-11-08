import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import UploadService from "../services/UploadService.js";
import { isCloudinaryConfigured } from "../utils/cloudinary.js";

// Check Cloudinary configuration and storage folder status
export const getCloudinaryStatus = catchAsyncErrors(async (req, res) => {
  res.status(200).json({
    success: true,
    configured: isCloudinaryConfigured(),
    folder: "delivix/products",
    provider: "Cloudinary",
  });
});

// Upload a single media file (Image or Video) to Cloudinary
export const uploadMedia = catchAsyncErrors(async (req, res, next) => {
  const { file, image, type = "image", folder = "delivix/products" } = req.body;
  const target = file || image;

  if (!target) {
    return next(new ErrorHandler("No file or image provided", 400));
  }

  try {
    const result = await UploadService.uploadMedia(target, { type, folder });

    res.status(200).json({
      success: true,
      cloudinary: isCloudinaryConfigured(),
      media: {
        public_id: result.public_id,
        url: result.url,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(error.message || "Cloudinary upload failed", 500));
  }
});

// Delete media from Cloudinary
export const deleteMedia = catchAsyncErrors(async (req, res, next) => {
  const { public_id, type = "image" } = req.body;
  if (!public_id) {
    return next(new ErrorHandler("No public_id provided", 400));
  }

  await UploadService.deleteMedia(public_id, type);

  res.status(200).json({ success: true, message: "Media deleted from Cloudinary successfully" });
});

