import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res, next) => {
    next(ApiError.rateLimited('RATE_LIMITED', 'Too many requests, please try again later'));
  }
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name cannot exceed 80 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(register)
);

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(login)
);

router.get(
  '/me',
  authenticate,
  asyncHandler(getMe)
);

export default router;
