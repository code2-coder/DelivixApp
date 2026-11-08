import crypto from 'crypto';

export const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const compareOTP = (otp, hashedOtp) => {
  const hash = hashOTP(otp);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedOtp));
};
