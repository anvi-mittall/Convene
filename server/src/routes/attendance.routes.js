import { Router } from 'express';
import { z } from 'zod';
import { scanAttendance } from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate, objectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const scanSchema = z.object({
  eventId: objectIdSchema,
  qrToken: z.string().min(1, 'QR token is required')
});

router.post(
  '/scan',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ body: scanSchema }),
  asyncHandler(scanAttendance)
);

export default router;
