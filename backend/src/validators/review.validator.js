import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    rating: z.number().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
    comment: z.string().min(3, "Review comment must be at least 3 characters").max(2000, "Review cannot exceed 2000 characters"),
    images: z.array(z.any()).max(10, "Maximum 10 images allowed").optional(),
    videos: z.array(z.any()).max(2, "Maximum 2 videos allowed").optional(),
  }),
});

export const updateReviewStatusSchema = z.object({
  body: z.object({
    status: z.enum(["Approved", "Rejected"]),
  }),
});

export const adminReplySchema = z.object({
  body: z.object({
    comment: z.string().min(2, "Reply comment is required").max(1000),
  }),
});
