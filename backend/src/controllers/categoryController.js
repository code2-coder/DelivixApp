import Category from "../models/category.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import cloudinary from "../utils/cloudinary.js";
import { clearCache } from "../middleware/cache.js";

//
// 🆕 CREATE CATEGORY (ADMIN)
//
export const createCategory = catchAsyncErrors(async (req, res, next) => {
  const { name, parentCategory, image } = req.body;
  
  const catPayload = { name };
  if (parentCategory) catPayload.parentCategory = parentCategory;

  // Handle Image Upload
  if (image && typeof image === "string" && image.startsWith("data:image")) {
    const result = await cloudinary.uploader.upload(image, {
      folder: "delivix/categories",
    });

    catPayload.image = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  } else if (image && typeof image === "object" && image.url) {
    // Allows passing an already structured image object (e.g. from seeders)
    catPayload.image = image;
  } else if (typeof image === "string" && image.trim()) {
    // Accept a plain hosted image URL as well as an uploaded file
    catPayload.image = { url: image.trim() };
  }

  const category = await Category.create(catPayload);
  
  clearCache("/api/v1/categories");
  clearCache("/api/v1/products/filter-options");
  clearCache("shk:categories");

  res.status(201).json({ 
    success: true, 
    category 
  });
});

//
// 📦 GET ALL CATEGORIES
//
export const getAllCategories = catchAsyncErrors(async (req, res, next) => {
  const categories = await Category.find().lean();
  
  res.status(200).json({ 
    success: true, 
    categories 
  });
});

//
// 🔍 GET SINGLE CATEGORY
//
export const getCategory = catchAsyncErrors(async (req, res, next) => {
  const category = await Category.findById(req.params.id).lean();
  
  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }
  
  res.status(200).json({ 
    success: true, 
    category 
  });
});

//
// ✏️ UPDATE CATEGORY (ADMIN)
//
export const updateCategory = catchAsyncErrors(async (req, res, next) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }

  let image = req.body.image;

  // Handle Image Update
  if (image && typeof image === "string" && image.startsWith("data:image")) {
    // 1. Destroy old image
    if (category.image && category.image.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id);
    }

    // 2. Upload new image
    const result = await cloudinary.uploader.upload(image, {
      folder: "delivix/categories",
    });

    req.body.image = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  } else if (typeof image === "string") {
    // Plain hosted URL, or an empty string to clear the image
    req.body.image = image.trim() ? { url: image.trim() } : null;
  }

  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : null;
  const nameChanged = !!nextName && nextName !== category.name;

  if (req.body.name !== undefined) category.name = nextName;
  if (req.body.parentCategory !== undefined) {
    category.parentCategory = req.body.parentCategory || null;
  }
  if (req.body.image !== undefined) category.image = req.body.image;

  // Regenerate the slug when the name changes, or when an older category
  // record is missing one. The model's pre-validate hook fills it in.
  if (nameChanged || !category.slug) {
    category.slug = undefined;
  }

  await category.save();

  clearCache("/api/v1/categories");
  clearCache("/api/v1/products/filter-options");
  clearCache("shk:categories");

  res.status(200).json({ 
    success: true, 
    category 
  });
});

//
// ❌ DELETE CATEGORY (ADMIN)
//
export const deleteCategory = catchAsyncErrors(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorHandler("Category not found", 404));
  }

  // Delete category image from cloudinary if it exists
  if (category.image && category.image.public_id) {
    await cloudinary.uploader.destroy(category.image.public_id);
  }

  // Find and delete all subcategories (supports the legacy `parent` field too)
  const subcategories = await Category.find({
    $or: [{ parentCategory: category._id }, { parent: category._id }],
  });
  for (const sub of subcategories) {
    if (sub.image && sub.image.public_id) {
      await cloudinary.uploader.destroy(sub.image.public_id);
    }
    await sub.deleteOne();
  }

  await category.deleteOne();

  clearCache("/api/v1/categories");
  clearCache("/api/v1/products/filter-options");
  clearCache("shk:categories");

  res.status(200).json({ 
    success: true, 
    message: "Category and its subcategories deleted successfully" 
  });
});
