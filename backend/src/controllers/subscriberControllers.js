import Subscriber from "../models/subscriber.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middleware/catchAsyncErrors.js";

//
// 📧 SUBSCRIBE TO NEWSLETTER
//
export const subscribeNewsletter = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Please provide an email address", 400));
  }

  // Check if email already exists
  const existingSubscriber = await Subscriber.findOne({ email });

  if (existingSubscriber) {
    // We can either return an error, or just return 200 with a gentle message.
    // Let's return 400 so the frontend can handle it nicely as a warning toast.
    return next(new ErrorHandler("You are already subscribed to our newsletter!", 400));
  }

  const subscriber = await Subscriber.create({ email });

  res.status(201).json({
    success: true,
    message: "Successfully joined the Shreeharikripa Family!",
    subscriber,
  });
});

//
// 👑 GET ALL SUBSCRIBERS (ADMIN)
//
export const getSubscribers = catchAsyncErrors(async (req, res, next) => {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 }).lean();

  res.status(200).json({
    success: true,
    results: subscribers.length,
    subscribers,
  });
});
