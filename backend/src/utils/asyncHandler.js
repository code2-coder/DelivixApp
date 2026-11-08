/**
 * Higher-order function to wrap async express route handlers and forward uncaught rejections to error middleware.
 * @param {Function} requestHandler - Async function (req, res, next)
 * @returns {Function} Express route handler
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

// Backward compatibility alias for catchAsyncErrors
export const catchAsyncErrors = asyncHandler;
export default asyncHandler;
