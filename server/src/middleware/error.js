import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = `Invalid format for identifier: ${err.value}`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = Object.values(err.errors).map((e) => ({
      path: [e.path],
      message: e.message
    }));
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    if (field === 'email') {
      code = 'EMAIL_TAKEN';
      message = 'An account with this email already exists';
    } else if (err.keyPattern?.user && err.keyPattern?.event) {
      code = 'ALREADY_REGISTERED';
      message = 'User is already registered for this event';
    } else {
      code = 'CONFLICT';
      message = 'Duplicate key conflict';
    }
  } else if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      code = 'FILE_TOO_LARGE';
      message = 'File size exceeds limit';
    } else {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = err.message;
    }
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHENTICATED';
    message = 'Invalid or expired authentication token';
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details })
    }
  };

  if (env.NODE_ENV !== 'production' && statusCode === 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
