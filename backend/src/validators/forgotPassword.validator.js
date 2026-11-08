import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format")
  })
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 numeric digits")
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format")
  })
});
