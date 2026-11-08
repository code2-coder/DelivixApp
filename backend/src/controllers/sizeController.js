import Size from "../models/size.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

export const getSizes = catchAsyncErrors(async (req, res, next) => {
  const sizes = await Size.find().sort({ name: 1 }).lean();
  res.status(200).json({ success: true, sizes });
});

export const createSize = catchAsyncErrors(async (req, res, next) => {
  const sizeExists = await Size.findOne({ name: req.body.name });
  if (sizeExists) {
      return next(new ErrorHandler("Size already exists", 400));
  }
  const size = await Size.create(req.body);
  res.status(201).json({ success: true, size });
});

export const deleteSize = catchAsyncErrors(async (req, res, next) => {
  const size = await Size.findByIdAndDelete(req.params.id);
  if (!size) {
    return next(new ErrorHandler("Size not found", 404));
  }
  res.status(200).json({ success: true, message: "Size deleted" });
});

export const updateSize = catchAsyncErrors(async (req, res, next) => {
  let size = await Size.findById(req.params.id);
  if (!size) {
    return next(new ErrorHandler("Size not found", 404));
  }
  size = await Size.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({ success: true, size });
});
