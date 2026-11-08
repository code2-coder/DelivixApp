import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import Courier from "../models/courier.js";
import ErrorHandler from "../utils/errorHandler.js";

export const getAllCouriers = catchAsyncErrors(async (req, res) => {
  const { activeOnly } = req.query;
  const filter = activeOnly === "true" ? { isActive: true } : {};
  const couriers = await Courier.find(filter).sort({ name: 1 }).lean();

  res.status(200).json({ success: true, couriers });
});

export const createCourier = catchAsyncErrors(async (req, res, next) => {
  const { name, contactPerson, phoneNumber, email, website } = req.body;

  if (!name?.trim()) {
    return next(new ErrorHandler("Courier name is required", 400));
  }

  const existing = await Courier.findOne({ name: name.trim() });
  if (existing) {
    return next(new ErrorHandler("Courier with this name already exists", 400));
  }

  const courier = await Courier.create({
    name: name.trim(),
    contactPerson,
    phoneNumber,
    email,
    website,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, courier });
});

export const updateCourier = catchAsyncErrors(async (req, res, next) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    return next(new ErrorHandler("Courier not found", 404));
  }

  const { name, contactPerson, phoneNumber, email, website, isActive } = req.body;

  if (name !== undefined) courier.name = name.trim();
  if (contactPerson !== undefined) courier.contactPerson = contactPerson;
  if (phoneNumber !== undefined) courier.phoneNumber = phoneNumber;
  if (email !== undefined) courier.email = email;
  if (website !== undefined) courier.website = website;
  if (isActive !== undefined) courier.isActive = isActive;

  await courier.save();

  res.status(200).json({ success: true, courier });
});

export const toggleCourier = catchAsyncErrors(async (req, res, next) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    return next(new ErrorHandler("Courier not found", 404));
  }

  courier.isActive = !courier.isActive;
  await courier.save();

  res.status(200).json({ success: true, courier });
});

export const deleteCourier = catchAsyncErrors(async (req, res, next) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) {
    return next(new ErrorHandler("Courier not found", 404));
  }

  await courier.deleteOne();

  res.status(200).json({ success: true, message: "Courier deleted successfully" });
});
