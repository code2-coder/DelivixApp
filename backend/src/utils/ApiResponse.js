/**
 * Standardized API Response Wrapper
 */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {any} data - Response payload
   * @param {string} [message="Success"] - Informative message
   */
  constructor(statusCode = 200, data = null, message = "Success") {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.message = message;
    this.data = data;
  }

  /**
   * Send response through Express res object with backward compatibility for root-level keys
   * @param {import('express').Response} res
   * @param {number} [statusCode=200]
   * @param {any} [data=null]
   * @param {string} [message="Success"]
   */
  static send(res, statusCode = 200, data = null, message = "Success") {
    const success = statusCode >= 200 && statusCode < 300;
    const payload = {
      success,
      message,
    };

    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      // Merge properties for existing frontend compatibility (e.g. res.data.products, res.data.user)
      Object.assign(payload, data);
      if (!payload.data) {
        payload.data = data;
      }
    } else if (data !== null) {
      payload.data = data;
    }

    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
