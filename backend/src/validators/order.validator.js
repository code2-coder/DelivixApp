import { z } from "zod";
import { ORDER_STATUSES } from "../utils/orderPolicy.js";
import { SHIPMENT_STATUSES } from "../models/shipment.js";

const orderItemSchema = z
  .object({
    productId: z.string().optional(),
    product: z.string().optional(),
    id: z.string().optional(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(999),
    size: z.string().max(100).optional().nullable(),
    variantName: z.string().max(100).optional().nullable(),
  })
  .refine((item) => item.productId || item.product || item.id, {
    message: "Product ID is required",
    path: ["productId"],
  });

const shippingInfoSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  address: z.string().min(3, "Address is required").max(500).optional(),
  addressLine1: z.string().min(3, "Address is required").max(300).optional(),
  addressLine2: z.string().max(300).optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  city: z.string().min(2, "City is required").max(120),
  state: z.string().max(120).optional().nullable(),
  phoneNo: z.string().min(6, "Valid phone number is required").max(30),
  altPhoneNo: z.string().max(30).optional().nullable(),
  zipCode: z.string().min(2, "Valid postal/zip code is required").max(20),
  pinCode: z.string().max(20).optional().nullable(),
  country: z.string().min(2, "Country is required").max(120),
});

const billingAddressSchema = shippingInfoSchema.partial().extend({
  fullName: z.string().min(2).max(120),
  phoneNo: z.string().min(6).max(30),
  city: z.string().min(2).max(120),
  country: z.string().min(2).max(120),
  zipCode: z.string().min(2).max(20),
});

const baseOrderBody = {
  items: z.array(orderItemSchema).optional(),
  orderItems: z.array(orderItemSchema).optional(),
  shippingInfo: shippingInfoSchema,
  billingAddress: billingAddressSchema.optional(),
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
  packagingOption: z.enum(["standard", "exquisite"]).default("standard"),
  currency: z.string().min(3).max(3).default("INR"),
  couponCode: z.string().trim().min(1).optional().nullable(),
};

const requireItems = (body) => Boolean(body.items?.length || body.orderItems?.length);

export const quoteOrderSchema = z.object({
  body: z
    .object(baseOrderBody)
    .refine(requireItems, { message: "At least one item is required", path: ["items"] }),
});

export const createOrderSchema = z.object({
  body: z
    .object({
      ...baseOrderBody,
      paymentMethod: z.enum(["COD", "Card", "Stripe", "Razorpay"]),
      idempotencyKey: z.string().max(200).optional(),
    })
    .refine(requireItems, { message: "At least one item is required", path: ["items"] }),
});

export const cancelOrderSchema = z.object({
  body: z.object({
    reason: z.string().min(3, "Please provide a cancellation reason").max(500),
  }),
});

const returnItemSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999),
  reason: z.enum([
    "Defective/Damaged",
    "Wrong Item Received",
    "Size Issue",
    "Quality Not as Expected",
    "Other",
  ]),
  description: z.string().min(5, "Please describe the issue").max(2000),
  returnType: z.enum(["Refund", "Replacement", "Exchange"]).optional(),
  media: z.array(z.any()).optional(),
});

export const returnRequestSchema = z.object({
  body: z
    .object({
      orderId: z.string().optional(),
      orderItemId: z.string().optional(),
      productId: z.string().optional(),
      quantity: z.coerce.number().int().min(1).max(999).optional(),
      reason: z
        .enum([
          "Defective/Damaged",
          "Wrong Item Received",
          "Size Issue",
          "Quality Not as Expected",
          "Other",
        ])
        .optional(),
      description: z.string().min(5).max(2000).optional(),
      returnType: z.enum(["Refund", "Replacement", "Exchange"]).optional(),
      media: z.array(z.any()).optional(),
      items: z.array(returnItemSchema).min(1).optional(),
    })
    .refine((body) => body.items?.length || (body.orderItemId && body.reason && body.description), {
      message: "Provide return items with a reason and description",
      path: ["items"],
    }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().max(1000).optional(),
    reason: z.string().max(500).optional(),
    codCollected: z.boolean().optional(),
  }),
});

export const bulkUpdateOrderStatusSchema = z.object({
  body: z.object({
    orderIds: z.array(z.string()).min(1).max(100),
    status: z.enum(ORDER_STATUSES),
    note: z.string().max(1000).optional(),
    codCollected: z.boolean().optional(),
  }),
});

const dateInputSchema = (label) =>
  z
    .string()
    .max(40)
    .optional()
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: `${label} must be a valid date.`,
    });

export const updateShipmentSchema = z
  .object({
    body: z.object({
      courierName: z.string().max(100).optional().nullable(),
      trackingNumber: z.string().max(100).optional().nullable(),
      awbNumber: z.string().max(100).optional().nullable(),
      trackingUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")),
      shippingMethod: z.enum(["standard", "express", "surface", "air", "other"]).optional(),
      shipmentDate: dateInputSchema("Shipment date"),
      estimatedDeliveryDate: dateInputSchema("Estimated delivery date"),
      status: z.enum(SHIPMENT_STATUSES).optional(),
      note: z.string().max(1000).optional(),
      remarks: z.string().max(1000).optional().nullable(),
      codCollected: z.boolean().optional(),
    }),
  })
  .refine(
    (payload) => {
      const { shipmentDate, estimatedDeliveryDate } = payload.body;
      if (!shipmentDate || !estimatedDeliveryDate) return true;
      return (
        new Date(estimatedDeliveryDate).getTime() >= new Date(shipmentDate).getTime()
      );
    },
    {
      message: "Estimated delivery date cannot be before the shipment date.",
      path: ["body", "estimatedDeliveryDate"],
    }
  );

export const refundOrderSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive().optional(),
    reason: z.string().max(500).optional(),
    reference: z.string().max(200).optional(),
    confirmManual: z.boolean().optional(),
  }),
});

export const paymentOrderSchema = z.object({
  body: z.object({
    orderId: z.string().min(1, "Order ID is required"),
  }),
});

export const verifyRazorpaySchema = z.object({
  body: z.object({
    orderId: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});

export const verifyStripeSchema = z.object({
  body: z.object({
    orderId: z.string().min(1),
    sessionId: z.string().min(1),
  }),
});

export const updateOrderStatusLegacySchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    trackingId: z.string().max(100).optional(),
    trackingUrl: z.string().max(1000).optional(),
  }),
});
