import { ApiError } from '../utils/ApiError.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthenticated('UNAUTHENTICATED', 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('FORBIDDEN', 'You do not have permission to perform this action'));
    }

    next();
  };
}
