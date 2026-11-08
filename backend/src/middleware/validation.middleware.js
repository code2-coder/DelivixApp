import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";

/**
 * Validation runner middleware supporting Zod schemas
 * @param {import('zod').ZodSchema} schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Use the sanitized/coerced values returned by Zod (strips unknown keys, applies defaults)
    if (parsed && typeof parsed === "object") {
      if (parsed.body !== undefined) {
        try {
          req.body = parsed.body;
        } catch {
          /* req.body may be read-only in some setups; ignore */
        }
      }
      if (parsed.params !== undefined) {
        try {
          req.params = parsed.params;
        } catch {
          /* ignore */
        }
      }
    }

    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Zod v4 exposes issues on `err.issues` (err.errors is not populated)
      const issues = err.issues || err.errors || [];
      const formattedErrors = issues.map((e) => ({
        field: Array.isArray(e.path) ? e.path.join(".") : String(e.path ?? ""),
        message: e.message,
      }));
      const errorMessage = formattedErrors.map((e) => e.message).join(", ") || "Invalid request payload";
      return next(
        new ApiError(400, `Validation Error: ${errorMessage}`, formattedErrors, "VALIDATION_ERROR")
      );
    }
    next(err);
  }
};

export default {
  validate,
};
