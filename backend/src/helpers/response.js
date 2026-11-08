/**
 * Centralized API response helper to ensure all responses match the required standard.
 */
export const sendResponse = (res, statusCode, success, message, data = null, errors = null) => {
  const payload = {
    success,
    message,
    errors
  };

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(payload, data);
  } else if (data !== null) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};
