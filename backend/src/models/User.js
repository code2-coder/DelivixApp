import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: false, // Optional for Google OAuth users
      select: false, // Don't return password by default
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "customer", "admin", "staff"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "blocked"],
      default: "active",
    },
    googleId: {
      type: String,
    },
    provider: {
      type: String,
      default: "local",
    },
    avatar: {
      public_id: { type: String },
      url: { type: String },
    },
    addresses: [
      {
        title: { type: String, default: "Home" },
        fullName: { type: String, required: true },
        phoneNo: { type: String, required: true },
        altPhoneNo: { type: String },
        street: { type: String },
        landmark: { type: String },
        village: { type: String },
        address: { type: String, required: false },
        city: { type: String, required: true },
        state: { type: String },
        zipCode: { type: String, required: true },
        country: { type: String, default: "India" },
        isDefault: { type: Boolean, default: false },
      }
    ],
    phoneNumber: {
      type: String,
    },
    altPhoneNumber: {
      type: String,
    },
    address: {
      street: { type: String },
      landmark: { type: String },
      village: { type: String },
      city: { type: String },
      state: { type: String },
      pinCode: { type: String },
    },
    emailVerificationOTP: {
      type: String,
      select: false,
    },
    emailVerificationOTPExpires: {
      type: Date,
      select: false,
    },
    addressVerificationOTP: {
      type: String,
      select: false,
    },
    addressVerificationOTPExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    adminNotes: [
      {
        note: { type: String, required: true, trim: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedByName: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        status: { type: String, required: true },
        reason: { type: String, default: "" },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedByName: { type: String },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ phoneNumber: 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
