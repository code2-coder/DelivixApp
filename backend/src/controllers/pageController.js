import Page from "../models/page.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import { clearCache } from "../middleware/cache.js";

// GET all pages (slugs and basic info)
export const getPages = catchAsyncErrors(async (req, res, next) => {
  const pages = await Page.find().select("slug title subtitle").lean();
  res.status(200).json({
    success: true,
    pages,
  });
});

// GET a single page by slug
export const getPageBySlug = catchAsyncErrors(async (req, res, next) => {
  const page = await Page.findOne({ slug: req.params.slug.toLowerCase() });

  if (!page) {
    return next(new ErrorHandler("Page not found", 404));
  }

  res.status(200).json({
    success: true,
    page,
  });
});

// CREATE a page configuration
export const createPage = catchAsyncErrors(async (req, res, next) => {
  const { slug, title, subtitle, highlights, sections } = req.body;

  if (!slug || !title) {
    return next(new ErrorHandler("Slug and Title are required", 400));
  }

  const existingPage = await Page.findOne({ slug: slug.toLowerCase() });
  if (existingPage) {
    return next(new ErrorHandler("Page with this slug already exists", 400));
  }

  const page = await Page.create({
    slug: slug.toLowerCase(),
    title,
    subtitle,
    highlights: highlights || [],
    sections: sections || [],
  });

  clearCache("/api/v1/pages");

  res.status(201).json({
    success: true,
    page,
  });
});

// UPDATE a page's content
export const updatePage = catchAsyncErrors(async (req, res, next) => {
  let page = await Page.findOne({ slug: req.params.slug.toLowerCase() });

  if (!page) {
    return next(new ErrorHandler("Page not found", 404));
  }

  const { title, subtitle, highlights, sections } = req.body;

  if (title !== undefined) page.title = title;
  if (subtitle !== undefined) page.subtitle = subtitle;
  if (highlights !== undefined) page.highlights = highlights;
  if (sections !== undefined) page.sections = sections;

  await page.save();

  clearCache("/api/v1/pages");

  res.status(200).json({
    success: true,
    page,
  });
});

// DELETE a page
export const deletePage = catchAsyncErrors(async (req, res, next) => {
  const page = await Page.findOne({ slug: req.params.slug.toLowerCase() });

  if (!page) {
    return next(new ErrorHandler("Page not found", 404));
  }

  await page.deleteOne();

  clearCache("/api/v1/pages");

  res.status(200).json({
    success: true,
    message: "Page deleted successfully",
  });
});
