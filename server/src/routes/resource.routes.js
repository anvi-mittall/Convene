import { Router } from 'express';
import { z } from 'zod';
import { downloadResource, deleteResourceById } from '../controllers/resource.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate, objectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const resourceParamSchema = z.object({
  resourceId: objectIdSchema
});

// GET /resources/:resourceId/download (owner, admin, confirmed registrant)
router.get(
  '/:resourceId/download',
  authenticate,
  validate({ params: resourceParamSchema }),
  asyncHandler(downloadResource)
);

// DELETE /resources/:resourceId (owner, admin)
router.delete(
  '/:resourceId',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: resourceParamSchema }),
  asyncHandler(deleteResourceById)
);

export default router;
