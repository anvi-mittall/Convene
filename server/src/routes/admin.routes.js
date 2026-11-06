import { Router } from 'express';
import { z } from 'zod';
import {
  getUsers,
  updateUserRole,
  updateUserActiveStatus,
  getAdminStats
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate, objectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const updateRoleSchema = z.object({
  role: z.enum(['attendee', 'organizer'])
});

const updateActiveSchema = z.object({
  isActive: z.boolean()
});

const idParamSchema = z.object({
  id: objectIdSchema
});

// All admin routes require authenticate and requireRole('admin')
router.use(authenticate, requireRole('admin'));

router.get('/users', asyncHandler(getUsers));

router.patch(
  '/users/:id/role',
  validate({ params: idParamSchema, body: updateRoleSchema }),
  asyncHandler(updateUserRole)
);

router.patch(
  '/users/:id/active',
  validate({ params: idParamSchema, body: updateActiveSchema }),
  asyncHandler(updateUserActiveStatus)
);

router.get('/stats', asyncHandler(getAdminStats));

export default router;
