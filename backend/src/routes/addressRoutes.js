import express from "express";
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  sendAddressOtp,
  verifyAddressOtp,
  sendAddressEmailOtp,
  verifyAddressEmailOtp,
} from "../controllers/addressController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/send-otp", sendAddressOtp);
router.post("/verify-otp", verifyAddressOtp);
router.post("/send-email-otp", sendAddressEmailOtp);
router.post("/verify-email-otp", verifyAddressEmailOtp);

router.route("/")
  .get(getAddresses)
  .post(addAddress);

router.route("/:id")
  .put(updateAddress)
  .delete(deleteAddress);

router.route("/:id/default")
  .put(setDefaultAddress);

export default router;
