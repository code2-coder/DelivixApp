import express from "express";
import { subscribeNewsletter, getSubscribers } from "../controllers/subscriberControllers.js";
import { isAuthenticatedUser, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.route("/newsletter/subscribe").post(subscribeNewsletter);
router.route("/admin/subscribers").get(isAuthenticatedUser, authorizeRoles("admin"), getSubscribers);

export default router;
