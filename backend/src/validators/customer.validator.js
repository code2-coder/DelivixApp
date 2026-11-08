import { z } from "zod";

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    phoneNumber: z.string().max(25, "Phone number too long").nullable().optional(),
    altPhoneNumber: z.string().max(25, "Alternate phone number too long").nullable().optional(),
    isVerified: z.boolean().optional(),
    status: z.enum(["active", "inactive", "suspended", "blocked"]).optional(),
  }),
});

export const updateCustomerStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "inactive", "suspended", "blocked"], {
      required_error: "Status must be active, inactive, suspended, or blocked",
    }),
    reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
  }),
});

export const addCustomerNoteSchema = z.object({
  body: z.object({
    note: z
      .string()
      .trim()
      .min(1, "Note text is required")
      .max(2000, "Note cannot exceed 2000 characters"),
  }),
});

export default {
  updateCustomerSchema,
  updateCustomerStatusSchema,
  addCustomerNoteSchema,
};
