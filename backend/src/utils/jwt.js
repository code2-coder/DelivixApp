import jwt from 'jsonwebtoken';

export const generateResetToken = (email) => {
  return jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: '10m' // 10 minutes expiry
  });
};

export const verifyResetToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};
