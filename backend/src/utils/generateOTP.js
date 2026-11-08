import crypto from 'crypto';

export const generateOTP = () => {
  // Generate a cryptographically secure 6-digit numeric OTP
  return crypto.randomInt(100000, 999999).toString();
};
