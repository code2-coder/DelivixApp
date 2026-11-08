import AdPoster from "../models/adPosterModel.js";
import cloudinary from "../utils/cloudinary.js";
import { clearCache } from "../middleware/cache.js";

// CREATE AdPoster
export const createAdPoster = async (req, res) => {
  try {
    const { title, type, image, link } = req.body;
    let imageUrl = image;

    if (image && image.startsWith("data:image")) {
      const result = await cloudinary.uploader.upload(image, {
        folder: "delivix/adposters",
      });
      imageUrl = result.secure_url;
    }

    const adPoster = await AdPoster.create({
      title,
      type,
      image: imageUrl,
      link,
    });

    clearCache("/api/v1/ad-posters");
    clearCache("/api/v1/ad-poster");
    clearCache("shk:adposters");

    res.status(201).json({
      success: true,
      adPoster,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET all active AdPosters
export const getAdPosters = async (req, res) => {
  try {
    const adPosters = await AdPoster.find({ isActive: true }).lean();

    res.status(200).json({
      success: true,
      adPosters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET single AdPoster
export const getSingleAdPoster = async (req, res) => {
  try {
    const adPoster = await AdPoster.findById(req.params.id).lean();

    if (!adPoster) {
      return res.status(404).json({
        success: false,
        message: "Ad Poster not found",
      });
    }

    res.status(200).json({
      success: true,
      adPoster,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE AdPoster
export const updateAdPoster = async (req, res) => {
  try {
    let adPoster = await AdPoster.findById(req.params.id);

    if (!adPoster) {
      return res.status(404).json({
        success: false,
        message: "Ad Poster not found",
      });
    }

    let updateData = { ...req.body };

    // If the user uploaded a new image (base64)
    if (req.body.image && req.body.image.startsWith("data:image")) {
      const result = await cloudinary.uploader.upload(req.body.image, {
        folder: "delivix/adposters",
      });
      updateData.image = result.secure_url;
    }

    adPoster = await AdPoster.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    clearCache("/api/v1/ad-posters");
    clearCache("/api/v1/ad-poster");
    clearCache("shk:adposters");

    res.status(200).json({
      success: true,
      adPoster,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE AdPoster
export const deleteAdPoster = async (req, res) => {
  try {
    const adPoster = await AdPoster.findById(req.params.id);

    if (!adPoster) {
      return res.status(404).json({
        success: false,
        message: "Ad Poster not found",
      });
    }

    await adPoster.deleteOne();

    clearCache("/api/v1/ad-posters");
    clearCache("/api/v1/ad-poster");
    clearCache("shk:adposters");

    res.status(200).json({
      success: true,
      message: "Ad Poster deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
