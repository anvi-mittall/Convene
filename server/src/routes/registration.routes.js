import { Router } from 'express';
import { z } from 'zod';
import { getMyRegistrations } from '../controllers/registration.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate, objectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const idParamSchema = z.object({
  id: objectIdSchema
});

// GET /registrations/mine (auth)
router.get('/mine', authenticate, asyncHandler(getMyRegistrations));

// Phase 4 will mount /:id/qr and /:id/certificate here
router.get(
  '/:id/qr',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { getRegistrationQr } = await import('../controllers/attendance.controller.js');
    return getRegistrationQr(req, res, next);
  })
);

router.get(
  '/:id/certificate',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { getCertificate } = await import('../controllers/certificate.controller.js');
    return getCertificate(req, res, next);
  })
);

export default router;
