import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { registerUserForEvent, cancelUserRegistration } from '../services/seats.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { enrichEvent } from '../utils/eventPhase.js';

function assertOwnership(event, user) {
  if (user.role === 'admin') return;
  if (event.createdBy.toString() !== user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not have permission to view registrations for this event');
  }
}

export async function register(req, res) {
  const { id } = req.params;
  const registration = await registerUserForEvent(req.user._id, id);

  res.status(201).json({
    success: true,
    data: registration,
    message: registration.status === 'confirmed' ? 'Registration confirmed' : 'Added to waitlist'
  });
}

export async function cancel(req, res) {
  const { id } = req.params;
  const registration = await cancelUserRegistration(req.user._id, id);

  res.json({
    success: true,
    data: registration,
    message: 'Registration cancelled successfully'
  });
}

export async function getMyRegistrations(req, res) {
  const { status } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter = { user: req.user._id };
  if (status) {
    filter.status = status;
  }

  const total = await Registration.countDocuments(filter);
  const registrations = await Registration.find(filter)
    .populate({
      path: 'event',
      populate: { path: 'createdBy', select: 'name email' }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Compute waitlist positions and enrich event details
  const enrichedItems = await Promise.all(
    registrations.map(async (regDoc) => {
      const reg = regDoc.toObject();
      if (reg.event) {
        reg.event = enrichEvent(reg.event);
      }

      if (reg.status === 'waitlisted' && reg.queuedAt && reg.event) {
        const aheadCount = await Registration.countDocuments({
          event: reg.event._id,
          status: 'waitlisted',
          queuedAt: { $lt: reg.queuedAt }
        });
        reg.waitlistPosition = aheadCount + 1;
      } else {
        reg.waitlistPosition = null;
      }

      return reg;
    })
  );

  res.json({
    success: true,
    data: formatPaginatedResponse(enrichedItems, total, page, limit)
  });
}

export async function getEventRegistrations(req, res) {
  const { id } = req.params;
  const { status, q } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);

  const event = await Event.findById(id);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  assertOwnership(event, req.user);

  const filter = { event: event._id };
  if (status) {
    filter.status = status;
  }

  // If search query by user name or email
  let userIds = null;
  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingUsers = await (await import('../models/User.js')).User.find({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ]
    }).select('_id');

    userIds = matchingUsers.map((u) => u._id);
    filter.user = { $in: userIds };
  }

  const total = await Registration.countDocuments(filter);
  const registrations = await Registration.find(filter)
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: formatPaginatedResponse(registrations, total, page, limit)
  });
}
