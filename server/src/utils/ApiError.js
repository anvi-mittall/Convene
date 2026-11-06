export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code = 'VALIDATION_ERROR', message = 'Bad request', details = undefined) {
    return new ApiError(400, code, message, details);
  }

  static unauthenticated(code = 'UNAUTHENTICATED', message = 'Authentication required') {
    return new ApiError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Access denied') {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
    return new ApiError(404, code, message);
  }

  static conflict(code = 'CONFLICT', message = 'Conflict detected') {
    return new ApiError(409, code, message);
  }

  static payloadTooLarge(code = 'FILE_TOO_LARGE', message = 'File too large') {
    return new ApiError(413, code, message);
  }

  static rateLimited(code = 'RATE_LIMITED', message = 'Too many requests') {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
