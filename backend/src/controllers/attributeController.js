import Attribute from "../models/attribute.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

// @desc    Get all attributes
// @route   GET /api/v1/attributes
// @access  Public
export const getAttributes = catchAsyncErrors(async (req, res, next) => {
  const attributes = await Attribute.find().lean();
  
  res.status(200).json({
    success: true,
    attributes,
  });
});

// @desc    Create new attribute
// @route   POST /api/v1/admin/attribute/new
// @access  Admin
export const newAttribute = catchAsyncErrors(async (req, res, next) => {
  const { type, value } = req.body;

  if (!type || !value) {
    return res.status(400).json({
      success: false,
      message: "Please provide both type and value for the attribute.",
    });
  }

  // Check if it already exists
  const exists = await Attribute.findOne({ type, value });
  if (exists) {
    return res.status(400).json({
      success: false,
      message: `Attribute '${value}' already exists under '${type}'.`,
    });
  }

  const attribute = await Attribute.create({ type, value });

  res.status(201).json({
    success: true,
    attribute,
  });
});

// @desc    Update attribute
// @route   PUT /api/v1/admin/attribute/:id
// @access  Admin
export const updateAttribute = catchAsyncErrors(async (req, res, next) => {
  let attribute = await Attribute.findById(req.params.id);

  if (!attribute) {
    return res.status(404).json({
      success: false,
      message: "Attribute not found",
    });
  }

  attribute = await Attribute.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    attribute,
  });
});

// @desc    Delete attribute
// @route   DELETE /api/v1/admin/attribute/:id
// @access  Admin
export const deleteAttribute = catchAsyncErrors(async (req, res, next) => {
  const attribute = await Attribute.findById(req.params.id);

  if (!attribute) {
    return res.status(404).json({
      success: false,
      message: "Attribute not found",
    });
  }

  await attribute.deleteOne();

  res.status(200).json({
    success: true,
    message: "Attribute deleted",
  });
});
