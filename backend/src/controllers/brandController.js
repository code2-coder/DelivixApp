import Brand from "../models/brand.js";
import Product from "../models/product.js";
import { sendResponse } from "../helpers/response.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import { clearCache } from "../middleware/cache.js";

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureSlug = async (name, currentId = null) => {
  const base = slugify(name) || `brand-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (await Brand.exists({ slug: candidate, _id: { $ne: currentId } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
};

export const getBrands = catchAsyncErrors(async (req, res) => {
  const isAdminRequest = String(req.originalUrl || "").includes("/admin/brands");
  const includeInactive = isAdminRequest || req.query.all === "true";
  const filter = includeInactive ? {} : { isActive: true };
  const brands = await Brand.find(filter).sort({ name: 1 }).lean();
  return sendResponse(res, 200, true, "Brands fetched successfully", { brands });
});

export const createBrand = catchAsyncErrors(async (req, res, next) => {
  const name = String(req.body.name || "").trim();
  if (!name) return next(new ErrorHandler("Brand name is required", 400));

  const existing = await Brand.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (existing) return next(new ErrorHandler("A brand with this name already exists", 400));

  const brand = await Brand.create({
    name,
    slug: await ensureSlug(name),
    description: req.body.description || "",
    logo: req.body.logo || undefined,
    isActive: req.body.isActive !== false,
  });

  await clearCache("/api/v1/brands");
  return sendResponse(res, 201, true, "Brand created successfully", { brand });
});

export const updateBrand = catchAsyncErrors(async (req, res, next) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) return next(new ErrorHandler("Brand not found", 404));

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return next(new ErrorHandler("Brand name is required", 400));
    brand.name = name;
    brand.slug = await ensureSlug(name, brand._id);
  }
  if (req.body.description !== undefined) brand.description = req.body.description;
  if (req.body.logo !== undefined) brand.logo = req.body.logo;
  if (req.body.isActive !== undefined) brand.isActive = Boolean(req.body.isActive);

  await brand.save();
  await clearCache("/api/v1/brands");
  return sendResponse(res, 200, true, "Brand updated successfully", { brand });
});

export const deleteBrand = catchAsyncErrors(async (req, res, next) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) return next(new ErrorHandler("Brand not found", 404));

  const products = await Product.countDocuments({ brand: brand._id });
  if (products > 0) {
    return next(
      new ErrorHandler(
        `This brand is assigned to ${products} product(s). Reassign them before deleting the brand.`,
        400
      )
    );
  }

  await brand.deleteOne();
  await clearCache("/api/v1/brands");
  return sendResponse(res, 200, true, "Brand deleted successfully");
});
