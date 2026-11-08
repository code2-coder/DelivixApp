import catchAsyncErrors from "../middleware/catchAsyncErrors.js";
import { checkServiceability } from "../utils/delhiveryService.js";

//
// 📍 CHECK PINCODE SERVICEABILITY
//
export const checkPincode = catchAsyncErrors(async (req, res, next) => {
  const { pincode } = req.params;

  if (!pincode) {
    return res.status(400).json({
      success: false,
      message: "Pincode is required",
    });
  }

  const result = await checkServiceability(pincode);

  res.status(200).json({
    success: true,
    data: result,
  });
});
