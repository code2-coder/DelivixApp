import { z } from "zod";
import mongoose from "mongoose";

const couponCodeSchema = z
  .string()
  .min(1, "Coupon code is required")
  .max(30, "Coupon code cannot exceed 30 characters")
  .refine(
    (v) => /^[A-Z0-9_-]+$/.test(String(v).trim().toUpperCase().replace(/\s+/g, "")),
    { message: "Coupon code may only contain uppercase letters, numbers, underscores and hyphens" }
  );

const dateInputSchema = (label) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(60)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: `${label} must be a valid date.`,
    });

const objectIdSchema = (label) =>
  z.string().refine((value) => mongoose.isValidObjectId(value), {
    message: `${label} must be a valid id.`,
  });

const objectIdArraySchema = (label) =>
  z.array(objectIdSchema(label)).max(500).optional().default([]);

const shippingMethodsSchema = z
  .array(z.enum(["standard", "express"]))
  .max(2)
  .optional()
  .default([]);

const couponBodyFields = {
  code: couponCodeSchema.optional(),
  name: z.string().trim().min(2, "Coupon name must be at least 2 characters").max(120),
  description: z.string().max(500).optional().default(""),
  discountType: z.enum(["percentage", "fixed", "free_shipping"]),
  discountValue: z.coerce.number().min(0, "Discount value cannot be negative").max(10000),
  maxDiscount: z.coerce.number().min(0).max(10000000).default(0),
  minOrderValue: z.coerce.number().min(0).max(10000000).default(0),
  minQuantity: z.coerce.number().int().min(1).max(999).default(1),
  startDate: dateInputSchema("Start date"),
  expiryDate: dateInputSchema("Expiry date"),
  usageLimit: z.coerce.number().int().min(1).max(1000000).optional().nullable(),
  perCustomerLimit: z.coerce.number().int().min(1).max(1000).default(1),
  firstOrderOnly: z.boolean().default(false).optional(),
  combinable: z.boolean().default(true).optional(),
  shippingMethods: shippingMethodsSchema,
  eligibleCategories: objectIdArraySchema("Eligible category"),
  eligibleProducts: objectIdArraySchema("Eligible product"),
  excludedCategories: objectIdArraySchema("Excluded category"),
  excludedProducts: objectIdArraySchema("Excluded product"),
  eligibleCustomers: objectIdArraySchema("Eligible customer"),
  isActive: z.boolean().default(true).optional(),
};

const validateCouponRules = (data, ctx) => {
  if (data.startDate && data.expiryDate) {
    const start = Date.parse(data.startDate);
    const expiry = Date.parse(data.expiryDate);
    if (!Number.isNaN(start) && !Number.isNaN(expiry) && expiry <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after the start date.",
      });
    }
  }

  if (data.discountType === "percentage") {
    if (Number(data.discountValue) > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100%.",
      });
    }
    if (!(Number(data.discountValue) > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Percentage discount must be greater than zero.",
      });
    }
  }

  if (data.discountType === "fixed" && !(Number(data.discountValue) > 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Fixed discount must be greater than zero.",
    });
  }

  if (data.discountType === "free_shipping" && Number(data.discountValue) !== 0) {
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Free-shipping coupons must have a discount value of 0.",
    });
  }
};

export const couponListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    search: z.string().max(200).optional(),
    status: z
      .enum(["active", "disabled", "scheduled", "expired", "exhausted", "archived"])
      .optional(),
    discountType: z.enum(["percentage", "fixed", "free_shipping"]).optional(),
    dateFrom: z.string().max(60).optional(),
    dateTo: z.string().max(60).optional(),
    sort: z.string().max(40).optional(),
  }),
});

export const couponCreateSchema = z.object({
  body: z.object(couponBodyFields).superRefine(validateCouponRules),
});

export const couponUpdateSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      ...couponBodyFields,
      code: couponCodeSchema.optional(),
      name: couponBodyFields.name.optional(),
      description: z.string().max(500).optional(),
      discountType: couponBodyFields.discountType.optional(),
      discountValue: z.coerce.number().min(0).max(10000).optional(),
      maxDiscount: z.coerce.number().min(0).max(10000000).optional(),
      minOrderValue: z.coerce.number().min(0).max(10000000).optional(),
      minQuantity: z.coerce.number().int().min(1).max(999).optional(),
      startDate: dateInputSchema("Start date").optional(),
      expiryDate: dateInputSchema("Expiry date").optional(),
      usageLimit: z.coerce.number().int().min(1).max(1000000).optional().nullable(),
      perCustomerLimit: z.coerce.number().int().min(1).max(1000).optional(),
      firstOrderOnly: z.boolean().optional(),
      combinable: z.boolean().optional(),
      // Update schemas must not inject create-time defaults. Otherwise a
      // PATCH-style update that only changes the description would silently
      // reset shipping methods and product/category/customer targeting.
      shippingMethods: z.array(z.enum(["standard", "express"])).max(2).optional(),
      eligibleCategories: z.array(objectIdSchema("Eligible category")).max(500).optional(),
      eligibleProducts: z.array(objectIdSchema("Eligible product")).max(500).optional(),
      excludedCategories: z.array(objectIdSchema("Excluded category")).max(500).optional(),
      excludedProducts: z.array(objectIdSchema("Excluded product")).max(500).optional(),
      eligibleCustomers: z.array(objectIdSchema("Eligible customer")).max(500).optional(),
      isActive: z.boolean().optional(),
    })
    .superRefine(validateCouponRules),
});

export const couponStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const couponArchiveSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const couponDeleteSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const couponDuplicateSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const couponStatsSchema = z.object({
  query: z.object({}).passthrough(),
});

const validateItemSchema = z.object({
  productId: z.string().min(1).refine((value) => mongoose.isValidObjectId(value), {
    message: "Product id must be valid.",
  }),
  quantity: z.coerce.number().int().min(1).max(999),
  size: z.string().max(100).optional().nullable(),
  variantName: z.string().max(150).optional().nullable(),
});

export const couponValidateSchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .min(1, "Coupon code is required")
      .max(30, "Coupon code is too long"),
    items: z.array(validateItemSchema).max(200).optional().default([]),
    shippingInfo: z
      .object({
        country: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        zipCode: z.string().max(30).optional(),
      })
      .passthrough()
      .optional()
      .default({}),
    shippingMethod: z.enum(["standard", "express"]).optional().default("standard"),
    currency: z.string().trim().length(3).optional().default("INR"),
    shippingAmount: z.coerce.number().min(0).max(10000000).optional().default(0),
  }),
});

export const couponAnalyticsSchema = z.object({
  query: z.object({
    dateFrom: z.string().max(60).optional(),
    dateTo: z.string().max(60).optional(),
    sort: z.string().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  }),
});
