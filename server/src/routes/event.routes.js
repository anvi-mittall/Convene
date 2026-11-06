import { Router } from 'express';
import { z } from 'zod';
import {
  getEvents,
  getMyEvents,
  getEventById,
  createEvent,
  updateEvent,
  cancelEvent,
  deleteEvent,
  getEventStats
} from '../controllers/event.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate, objectIdSchema } from '../middleware/validate.js';
import { uploadPoster } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const createEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(['workshop', 'seminar', 'webinar', 'conference', 'other']),
  speakerName: z.string().trim().min(2).max(100),
  speakerBio: z.string().trim().max(1000).optional(),
  mode: z.enum(['offline', 'online', 'hybrid']),
  venue: z.string().trim().max(200).optional(),
  meetingLink: z.string().trim().optional(),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  capacity: z.coerce.number().int().min(1).max(10000)
});

const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  category: z.enum(['workshop', 'seminar', 'webinar', 'conference', 'other']).optional(),
  speakerName: z.string().trim().min(2).max(100).optional(),
  speakerBio: z.string().trim().max(1000).optional(),
  mode: z.enum(['offline', 'online', 'hybrid']).optional(),
  venue: z.string().trim().max(200).optional(),
  meetingLink: z.string().trim().optional(),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  capacity: z.coerce.number().int().min(1).max(10000).optional()
});

const idParamSchema = z.object({
  id: objectIdSchema
});

// 1. GET /events (public)
router.get('/', asyncHandler(getEvents));

// 2. GET /events/mine (organizer, admin) - declared before /:id as required
router.get(
  '/mine',
  authenticate,
  requireRole('organizer', 'admin'),
  asyncHandler(getMyEvents)
);

// 3. GET /events/:id (public, optional auth)
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  optionalAuthenticate,
  asyncHandler(getEventById)
);

// 4. POST /events (organizer, admin) - multipart
router.post(
  '/',
  authenticate,
  requireRole('organizer', 'admin'),
  uploadPoster,
  validate({ body: createEventSchema }),
  asyncHandler(createEvent)
);

// 5. PUT /events/:id (owner, admin) - multipart
router.put(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  uploadPoster,
  validate({ body: updateEventSchema }),
  asyncHandler(updateEvent)
);

// 6. POST /events/:id/cancel (owner, admin)
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  asyncHandler(cancelEvent)
);

// 7. DELETE /events/:id (owner, admin)
router.delete(
  '/:id',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  asyncHandler(deleteEvent)
);

// 8. GET /events/:id/stats (owner, admin)
router.get(
  '/:id/stats',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  asyncHandler(getEventStats)
);

// 9. POST /events/:id/register (auth)
router.post(
  '/:id/register',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { register } = await import('../controllers/registration.controller.js');
    return register(req, res, next);
  })
);

// 10. DELETE /events/:id/register (auth)
router.delete(
  '/:id/register',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { cancel } = await import('../controllers/registration.controller.js');
    return cancel(req, res, next);
  })
);

// 11. GET /events/:id/registrations (owner, admin)
router.get(
  '/:id/registrations',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { getEventRegistrations } = await import('../controllers/registration.controller.js');
    return getEventRegistrations(req, res, next);
  })
);

const manualAttendanceSchema = z.object({
  id: objectIdSchema,
  regId: objectIdSchema
});

const attendanceBodySchema = z.object({
  attended: z.boolean()
});

// 12. PATCH /events/:id/registrations/:regId/attendance (owner, admin)
router.patch(
  '/:id/registrations/:regId/attendance',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: manualAttendanceSchema, body: attendanceBodySchema }),
  asyncHandler(async (req, res, next) => {
    const { updateAttendanceManual } = await import('../controllers/attendance.controller.js');
    return updateAttendanceManual(req, res, next);
  })
);

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional()
});

// 13. POST /events/:id/feedback (auth)
router.post(
  '/:id/feedback',
  authenticate,
  validate({ params: idParamSchema, body: feedbackSchema }),
  asyncHandler(async (req, res, next) => {
    const { createFeedback } = await import('../controllers/feedback.controller.js');
    return createFeedback(req, res, next);
  })
);

// 14. GET /events/:id/feedback (owner, admin)
router.get(
  '/:id/feedback',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { getEventFeedback } = await import('../controllers/feedback.controller.js');
    return getEventFeedback(req, res, next);
  })
);

const uploadResourceSchema = z.object({
  title: z.string().trim().min(2).max(120)
});

// 15. POST /events/:id/resources (owner, admin)
router.post(
  '/:id/resources',
  authenticate,
  requireRole('organizer', 'admin'),
  validate({ params: idParamSchema }),
  (await import('../middleware/upload.js')).uploadResource,
  validate({ body: uploadResourceSchema }),
  asyncHandler(async (req, res, next) => {
    const { uploadEventResource } = await import('../controllers/resource.controller.js');
    return uploadEventResource(req, res, next);
  })
);

// 16. GET /events/:id/resources (owner, admin, confirmed registrant)
router.get(
  '/:id/resources',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res, next) => {
    const { getEventResources } = await import('../controllers/resource.controller.js');
    return getEventResources(req, res, next);
  })
);

export default router;
