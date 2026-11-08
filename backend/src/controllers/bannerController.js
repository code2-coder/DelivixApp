import Banner from "../models/bannerModel.js";
import cloudinary from "../utils/cloudinary.js";
import { clearCache } from "../middleware/cache.js";

const ALLOWED_POSITIONS = ["HERO", "PROMO", "STRIP", "SIDEBAR"];

const normalizePosition = (position) => {
  const value = String(position || "HERO").toUpperCase();
  return ALLOWED_POSITIONS.includes(value) ? value : "HERO";
};

// Older documents only have `imageUrl`; newer ones may only have `image`.
// Always return both so any client (admin, storefront, integrations) works.
const serializeBanner = (banner) => {
  const raw = typeof banner?.toObject === "function" ? banner.toObject() : banner || {};
  const image = raw.image || raw.imageUrl || "";
  return {
    ...raw,
    image,
    imageUrl: raw.imageUrl || raw.image || "",
  };
};

// CREATE Banner
export const createBanner = async (req, res) => {
  try {
    const { title, subtitle, link, buttonText, badgeText, position, displayOrder, isActive } = req.body;
    const imageInput = req.body.imageUrl ?? req.body.image ?? "";

    if (!imageInput) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    let imageUrl = imageInput;
    if (typeof imageUrl === "string" && imageUrl.startsWith("data:image")) {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: "delivix/banners",
      });
      imageUrl = result.secure_url;
    }

    const banner = await Banner.create({
      title,
      subtitle,
      image: imageUrl,
      imageUrl,
      mobileImageUrl: req.body.mobileImageUrl ?? req.body.mobileImage ?? "",
      buttonText,
      badgeText,
      position: normalizePosition(position),
      displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
      link: link || "/shop",
      isActive: isActive ?? true,
    });

    clearCache("/api/v1/banners");
    clearCache("/api/v1/banner");
    clearCache("shk:banners");

    res.status(201).json({
      success: true,
      banner: serializeBanner(banner),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET all banners
export const getBanners = async (req, res) => {
  try {
    const filter = req.query.all === "true" || req.query.admin === "true" ? {} : { isActive: true };
    const banners = await Banner.find(filter).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      banners: banners.map(serializeBanner),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET all banners for admin
export const getAdminBanners = async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      banners: banners.map(serializeBanner),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET single banner
export const getSingleBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).lean();

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      banner: serializeBanner(banner),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE banner
export const updateBanner = async (req, res) => {
  try {
    let banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    const updateData = { ...req.body };

    // Accept either field name; keep both in sync.
    const imageInput = req.body.imageUrl ?? req.body.image;
    if (imageInput !== undefined) {
      let imageUrl = imageInput;
      if (typeof imageUrl === "string" && imageUrl.startsWith("data:image")) {
        const result = await cloudinary.uploader.upload(imageUrl, {
          folder: "delivix/banners",
        });
        imageUrl = result.secure_url;
      }
      updateData.image = imageUrl;
      updateData.imageUrl = imageUrl;
    }

    if (req.body.mobileImage !== undefined && req.body.mobileImageUrl === undefined) {
      updateData.mobileImageUrl = req.body.mobileImage;
    }

    if (updateData.position !== undefined) {
      updateData.position = normalizePosition(updateData.position);
    }

    banner = await Banner.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    clearCache("/api/v1/banners");
    clearCache("/api/v1/banner");
    clearCache("shk:banners");

    res.status(200).json({
      success: true,
      banner: serializeBanner(banner),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE banner
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    await banner.deleteOne();

    clearCache("/api/v1/banners");
    clearCache("/api/v1/banner");
    clearCache("shk:banners");

    res.status(200).json({
      success: true,
      message: "Banner deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
