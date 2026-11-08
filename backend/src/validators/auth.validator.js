import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phoneNumber: z.string().optional()
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    otp: z.string().min(6, "OTP must be 6 digits").max(6, "OTP must be 6 digits"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    otp: z.string().min(6, "OTP must be 6 digits").max(6, "OTP must be 6 digits"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
  }),
});

export const updatePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    password: z.string().min(6, "New password must be at least 6 characters"),
  }),
});
