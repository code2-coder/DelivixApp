import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name must be at least 2 characters").max(200, "Product name cannot exceed 200 characters"),
    price: z.number().positive("Price must be greater than 0"),
    description: z.string().min(5, "Product description must be at least 5 characters"),
    category: z.string().optional(),
    categoryName: z.string().optional(),
    seller: z.string().default("Delivix"),
    stock: z.number().int().min(0, "Stock cannot be negative").default(0),
    status: z.enum(["draft", "published"]).default("published"),
    features: z.array(z.string()).optional(),
    images: z.array(z.any()).optional(),
    image: z.string().optional(),
    variants: z.array(z.any()).optional(),
    sizes: z.array(z.any()).optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    price: z.number().positive().optional(),
    description: z.string().min(5).optional(),
    category: z.string().optional(),
    stock: z.number().int().min(0).optional(),
    status: z.enum(["draft", "published"]).optional(),
    features: z.array(z.string()).optional(),
    variants: z.array(z.any()).optional(),
    sizes: z.array(z.any()).optional(),
  }),
});

export const visualSearchSchema = z.object({
  body: z.object({
    embedding: z.array(z.number()).min(1, "Visual embedding array is required"),
  }),
});
