import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";

/**
 * Global centralized error middleware
 */
export const errorMiddleware = (err, req, res, next) => {
  // Handle ZeptoMail Errors
  if (err.isZeptoMailError) {
    return res.status(err.statusCode || 500).json({
      success: false,
      statusCode: err.statusCode || 500,
      code: err.errorCode || "ZEPTOMAIL_ERROR",
      message: err.message,
      details: err.details || null,
    });
  }

  let error = err;

  // Convert raw errors to ApiError instances with appropriate status codes & messages
  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal Server Error";
    let code = "INTERNAL_SERVER_ERROR";
    let errors = [];

    // Mongoose CastError (e.g. invalid ObjectId)
    if (error.name === "CastError") {
      statusCode = 404;
      message = `Resource not found. Invalid identifier: ${error.path}`;
      code = "INVALID_IDENTIFIER";
    }

    // Mongoose ValidationError
    if (error.name === "ValidationError") {
      statusCode = 400;
      message = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      errors = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
      code = "VALIDATION_ERROR";
    }

    // Mongoose Duplicate Key Error
    if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyValue || {})[0] || "field";
      message = `An entry with that ${field} already exists`;
      code = "DUPLICATE_RESOURCE";
    }

    // JWT Errors
    if (error.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid token. Please authenticate again.";
      code = "INVALID_TOKEN";
    }

    if (error.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Session token has expired. Please log in again.";
      code = "EXPIRED_TOKEN";
    }

    error = new ApiError(statusCode, message, errors, code, error.stack);
  }

  const isDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "PRODUCTION";

  // Structured Logging
  if (error.statusCode >= 500) {
    logger.error(`[500] ${error.message}`, error, {
      path: req.originalUrl || req.path,
      method: req.method,
      ip: req.ip,
    });
  } else if (isDev) {
    logger.info(`[${error.statusCode}] Client Error: ${error.message}`, {
      path: req.originalUrl || req.path,
      method: req.method,
      code: error.code,
    });
  }

  // Response Payload
  const response = {
    success: false,
    statusCode: error.statusCode,
    code: error.code || "ERROR",
    message: error.message,
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  if (isDev) {
    response.stack = error.stack;
  }

  return res.status(error.statusCode).json(response);
};

export default errorMiddleware;
