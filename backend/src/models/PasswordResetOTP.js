import mongoose from 'mongoose';

const passwordResetOTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    required: true
  }
}, { timestamps: true });

// Auto-delete index to expire documents automatically
passwordResetOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetOTP = mongoose.model('PasswordResetOTP', passwordResetOTPSchema);
export default PasswordResetOTP;
