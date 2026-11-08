import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Category name must be at least 2 characters").max(100),
    parentCategory: z.string().optional().nullable(),
    image: z.any().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    parentCategory: z.string().optional().nullable(),
    image: z.any().optional(),
  }),
});
