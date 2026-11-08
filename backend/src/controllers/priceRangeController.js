import PriceRange from "../models/priceRange.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

// Get all price ranges, sorted by min price ascending
export const getPriceRanges = catchAsyncErrors(async (req, res, next) => {
  const priceRanges = await PriceRange.find().sort({ min: 1 }).lean();
  res.status(200).json({ success: true, priceRanges });
});

// Create new price range
export const createPriceRange = catchAsyncErrors(async (req, res, next) => {
  const { min, max, label } = req.body;
  
  const parsedMin = Number(min);
  const parsedMax = max !== undefined && max !== null && max !== "" ? Number(max) : null;

  const priceRange = await PriceRange.create({
    min: parsedMin,
    max: parsedMax,
    label
  });

  res.status(201).json({ success: true, priceRange });
});

// Update price range
export const updatePriceRange = catchAsyncErrors(async (req, res, next) => {
  let priceRange = await PriceRange.findById(req.params.id);
  if (!priceRange) {
    return next(new ErrorHandler("Price range not found", 404));
  }

  const { min, max, label } = req.body;
  const parsedMin = Number(min);
  const parsedMax = max !== undefined && max !== null && max !== "" ? Number(max) : null;

  priceRange = await PriceRange.findByIdAndUpdate(
    req.params.id,
    { min: parsedMin, max: parsedMax, label },
    { new: true, runValidators: true }
  );

  res.status(200).json({ success: true, priceRange });
});

// Delete price range
export const deletePriceRange = catchAsyncErrors(async (req, res, next) => {
  const priceRange = await PriceRange.findByIdAndDelete(req.params.id);
  if (!priceRange) {
    return next(new ErrorHandler("Price range not found", 404));
  }
  res.status(200).json({ success: true, message: "Price range deleted successfully" });
});
