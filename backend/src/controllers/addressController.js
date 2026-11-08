import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import User from "../models/User.js";
import ErrorHandler from "../utils/errorHandler.js";
import { checkServiceability } from "../utils/delhiveryService.js";
import OtpService from "../services/OtpService.js";
import EmailService from "../services/EmailService.js";
import crypto from "crypto";

//
// 📌 GET ALL ADDRESSES
//
export const getAddresses = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    success: true,
    addresses: user.addresses || [],
  });
});

//
// 📌 ADD NEW ADDRESS
//
export const addAddress = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const { isDefault, ...addressData } = req.body;

  // Support phone / phoneNo and pinCode / zipCode aliases
  if (!addressData.phoneNo && addressData.phone) {
    addressData.phoneNo = addressData.phone;
  }
  if (!addressData.zipCode && addressData.pinCode) {
    addressData.zipCode = addressData.pinCode;
  }
  if (!addressData.country) {
    addressData.country = "India";
  }

  // Construct composite address string if not provided
  if (!addressData.address) {
    const parts = [
      addressData.street,
      addressData.landmark ? `Near ${addressData.landmark}` : null,
      addressData.village ? `Village: ${addressData.village}` : null,
      addressData.city,
    ].filter(Boolean);
    addressData.address = parts.join(", ") || addressData.city || "Address";
  }

  if (addressData.country === "India") {
    if (!addressData.zipCode || addressData.zipCode.length !== 6) {
      return next(new ErrorHandler("Valid 6-digit India pincode is required.", 400));
    }

    try {
      const serviceability = await checkServiceability(addressData.zipCode);
      if (serviceability && !serviceability.isServiceable) {
        console.warn(`Pincode ${addressData.zipCode} standard express not serviceable; saving address for local delivery.`);
      }
    } catch (err) {
      console.warn("Delhivery check warning (bypassed):", err.message);
    }
  }

  // If this is the first address or set as default, unset others
  const isFirstAddress = !user.addresses || user.addresses.length === 0;
  const setAsDefault = isDefault || isFirstAddress;

  if (setAsDefault && user.addresses) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  const newAddress = {
    ...addressData,
    isDefault: setAsDefault,
  };

  if (!user.addresses) {
    user.addresses = [];
  }

  user.addresses.push(newAddress);
  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    success: true,
    message: "Address added successfully",
    addresses: user.addresses,
  });
});

//
// 📌 UPDATE ADDRESS
//
export const updateAddress = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const address = user.addresses.id(req.params.id);

  if (!address) {
    return next(new ErrorHandler("Address not found", 404));
  }

  const { isDefault, ...updateData } = req.body;

  if (!updateData.phoneNo && updateData.phone) {
    updateData.phoneNo = updateData.phone;
  }
  if (!updateData.zipCode && updateData.pinCode) {
    updateData.zipCode = updateData.pinCode;
  }

  const zipCodeToCheck = updateData.zipCode || address.zipCode;
  const countryToCheck = updateData.country || address.country || "India";

  if (countryToCheck === "India" && zipCodeToCheck) {
    if (zipCodeToCheck.length !== 6) {
      return next(new ErrorHandler("Valid 6-digit India pincode is required.", 400));
    }

    try {
      await checkServiceability(zipCodeToCheck);
    } catch (err) {
      console.warn("Delhivery check warning (bypassed):", err.message);
    }
  }

  // Re-generate composite address if parts were updated and address not explicitly provided
  if (!updateData.address && (updateData.street || updateData.village || updateData.landmark || updateData.city)) {
    const street = updateData.street !== undefined ? updateData.street : address.street;
    const landmark = updateData.landmark !== undefined ? updateData.landmark : address.landmark;
    const village = updateData.village !== undefined ? updateData.village : address.village;
    const city = updateData.city !== undefined ? updateData.city : address.city;
    const parts = [
      street,
      landmark ? `Near ${landmark}` : null,
      village ? `Village: ${village}` : null,
      city,
    ].filter(Boolean);
    if (parts.length > 0) {
      updateData.address = parts.join(", ");
    }
  }

  // Update fields
  Object.keys(updateData).forEach((key) => {
    address[key] = updateData[key];
  });

  // Handle default flag
  if (isDefault && !address.isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
    address.isDefault = true;
  } else if (!isDefault && address.isDefault) {
    address.isDefault = false;
    const otherAddress = user.addresses.find((addr) => addr._id.toString() !== req.params.id);
    if (otherAddress) {
      otherAddress.isDefault = true;
    }
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    addresses: user.addresses,
  });
});

//
// 📌 DELETE ADDRESS
//
export const deleteAddress = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const address = user.addresses.id(req.params.id);

  if (!address) {
    return next(new ErrorHandler("Address not found", 404));
  }

  const wasDefault = address.isDefault;

  // Remove the address
  user.addresses.pull({ _id: req.params.id });

  // If we deleted the default address, set the first available address as default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Address deleted successfully",
    addresses: user.addresses,
  });
});

//
// 📌 SET DEFAULT ADDRESS
//
export const setDefaultAddress = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const address = user.addresses.id(req.params.id);

  if (!address) {
    return next(new ErrorHandler("Address not found", 404));
  }

  user.addresses.forEach((addr) => {
    addr.isDefault = false;
  });

  address.isDefault = true;

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Default address updated",
    addresses: user.addresses,
  });
});

//
// 📌 SEND ADDRESS OTP
//
export const sendAddressOtp = catchAsyncErrors(async (req, res, next) => {
  const { phoneNo } = req.body;
  if (!phoneNo) {
    return next(new ErrorHandler("Phone number is required", 400));
  }

  const result = await OtpService.sendOtp(phoneNo);
  if (!result.success) {
    return next(new ErrorHandler(result.error || "Failed to send OTP", 500));
  }

  res.status(200).json({
    success: true,
    message: result.message || "OTP sent successfully to phone number",
  });
});

//
// 📌 VERIFY ADDRESS OTP
//
export const verifyAddressOtp = catchAsyncErrors(async (req, res, next) => {
  const { phoneNo, otp } = req.body;
  if (!phoneNo || !otp) {
    return next(new ErrorHandler("Phone number and OTP are required", 400));
  }

  const result = await OtpService.verifyOtp(phoneNo, otp);
  if (!result.success) {
    return next(new ErrorHandler(result.message || "Invalid OTP", 400));
  }

  res.status(200).json({
    success: true,
    message: result.message || "Phone number verified successfully",
  });
});

//
// 📌 SEND ADDRESS EMAIL OTP
//
export const sendAddressEmailOtp = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  user.addressVerificationOTP = otpHash;
  user.addressVerificationOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  // Fallback for local development if ZeptoMail isn't configured
  if (!process.env.ZEPTOMAIL_API_KEY) {
    console.log(`[EMAIL MOCK] Sending Address OTP ${otp} to email: ${user.email}`);
    res.status(200).json({
      success: true,
      message: "Mock Email OTP sent successfully.",
    });
    return;
  }

  // Send email
  try {
    await EmailService.sendAddressVerificationEmail(user.email, user.name, otp);
  } catch (emailError) {
    console.error("Address verification email failed:", emailError.message);
    return next(new ErrorHandler(`Failed to send verification email: ${emailError.message}`, 500));
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully to your email address",
  });
});

//
// 📌 VERIFY ADDRESS EMAIL OTP
//
export const verifyAddressEmailOtp = catchAsyncErrors(async (req, res, next) => {
  const { otp } = req.body;
  if (!otp) {
    return next(new ErrorHandler("OTP code is required", 400));
  }

  const user = await User.findById(req.user._id).select("+addressVerificationOTP +addressVerificationOTPExpires");
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  if (!user.addressVerificationOTP || !user.addressVerificationOTPExpires) {
    return next(new ErrorHandler("No OTP found. Please request a new verification OTP.", 400));
  }

  if (user.addressVerificationOTPExpires < Date.now()) {
    return next(new ErrorHandler("OTP has expired. Please request a new one.", 400));
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (user.addressVerificationOTP !== otpHash) {
    return next(new ErrorHandler("Invalid OTP", 400));
  }

  // Clear OTP fields
  user.addressVerificationOTP = undefined;
  user.addressVerificationOTPExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Email OTP verified successfully",
  });
});
