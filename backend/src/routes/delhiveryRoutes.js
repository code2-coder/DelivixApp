import express from "express";
import { checkPincode } from "../controllers/delhiveryControllers.js";

const router = express.Router();

router.route("/serviceability/:pincode").get(checkPincode);

export default router;
