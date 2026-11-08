import { z } from "zod";

export const addressSchema = z.object({
  body: z.object({
    title: z.string().default("Home"),
    fullName: z.string().min(2, "Full name is required"),
    phoneNo: z.string().min(6, "Valid phone number is required"),
    altPhoneNo: z.string().optional().nullable(),
    address: z.string().min(3, "Address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().optional().nullable(),
    zipCode: z.string().min(2, "Valid postal/zip code is required"),
    country: z.string().min(2, "Country is required"),
    isDefault: z.boolean().default(false),
  }),
});
