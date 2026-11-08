import mongoose from "mongoose";

const securitySettingsSchema = new mongoose.Schema(
  {
    sessionTimeoutMinutes: {
      type: Number,
      default: 120, // 2 hours
      min: 15,
      max: 1440,
    },
    passwordPolicy: {
      minLength: { type: Number, default: 8, min: 6 },
      requireUppercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: true },
    },
    loginAttemptLimits: {
      maxAttempts: { type: Number, default: 5, min: 3, max: 20 },
      lockoutDurationMinutes: { type: Number, default: 15, min: 5, max: 1440 },
    },
    twoFactorAuthMode: {
      type: String,
      enum: ["disabled", "optional", "enforced"],
      default: "optional",
    },
    ipRestrictions: {
      enabled: { type: Boolean, default: false },
      allowedIps: [{ type: String }],
    },
    apiSecurity: {
      rateLimitingEnabled: { type: Boolean, default: true },
      maxRequestsPerMinute: { type: Number, default: 120 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("SecuritySettings", securitySettingsSchema);

