/**
 * Standardized Operational API Error Class
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 403, 404, 500)
   * @param {string} message - Error description message
   * @param {Array|Object} [errors=[]] - Array of validation or error details
   * @param {string} [code="INTERNAL_SERVER_ERROR"] - Standard machine-readable error code
   * @param {string} [stack=""] - Custom stack trace if available
   */
  constructor(
    statusCode = 500,
    message = "Internal Server Error",
    errors = [],
    code = "INTERNAL_SERVER_ERROR",
    stack = ""
  ) {
    // Support legacy signature: new ErrorHandler("message", statusCode)
    if (typeof statusCode === "string") {
      const legacyMessage = statusCode;
      const legacyStatus = typeof message === "number" ? message : 500;
      statusCode = legacyStatus;
      message = legacyMessage;
    } else if (typeof message !== "string") {
      message = message == null ? "Internal Server Error" : String(message);
    }

    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad Request", errors = [], code = "BAD_REQUEST") {
    return new ApiError(400, message, errors, code);
  }

  static unauthorized(message = "Unauthorized access", errors = [], code = "UNAUTHORIZED") {
    return new ApiError(401, message, errors, code);
  }

  static forbidden(message = "Forbidden access", errors = [], code = "FORBIDDEN") {
    return new ApiError(403, message, errors, code);
  }

  static notFound(message = "Resource not found", errors = [], code = "NOT_FOUND") {
    return new ApiError(404, message, errors, code);
  }

  static conflict(message = "Conflict with existing resource", errors = [], code = "CONFLICT") {
    return new ApiError(409, message, errors, code);
  }

  static validationError(message = "Validation failed", errors = [], code = "VALIDATION_ERROR") {
    return new ApiError(422, message, errors, code);
  }

  static internal(message = "Internal server error", errors = [], code = "INTERNAL_SERVER_ERROR") {
    return new ApiError(500, message, errors, code);
  }
}

// Backward compatibility alias for ErrorHandler
export const ErrorHandler = ApiError;
export default ApiError;
