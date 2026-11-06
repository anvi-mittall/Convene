import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Feedback } from '../models/Feedback.js';
import { Resource } from '../models/Resource.js';
import { ApiError } from '../utils/ApiError.js';
import { enrichEvent, computeEventPhase } from '../utils/eventPhase.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { deleteFileIfExists } from '../middleware/upload.js';
import { promoteWaitlist } from '../services/seats.js';
import { sendEventUpdatedEmail, sendEventCancelledEmail } from '../services/mailer.js';

function assertOwnership(event, user) {
  if (user.role === 'admin') return;
  if (event.createdBy.toString() !== user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not have permission to manage this event');
  }
}

export async function getEvents(req, res) {
  const { q, category, mode, phase, from, to, sort = 'startTime' } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);

  const now = new Date();
  const filter = { status: 'published' };

  if (category) filter.category = category;
  if (mode) filter.mode = mode;

  if (q && q.trim()) {
    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escapedQuery, $options: 'i' } },
      { description: { $regex: escapedQuery, $options: 'i' } },
      { speakerName: { $regex: escapedQuery, $options: 'i' } }
    ];
  }

  if (from || to) {
    filter.startTime = {};
    if (from) filter.startTime.$gte = new Date(from);
    if (to) filter.startTime.$lte = new Date(to);
  }

  if (phase) {
    if (phase === 'upcoming') {
      filter.startTime = { ...(filter.startTime || {}), $gt: now };
    } else if (phase === 'ongoing') {
      filter.startTime = { ...(filter.startTime || {}), $lte: now };
      filter.endTime = { $gt: now };
    } else if (phase === 'completed') {
      filter.endTime = { $lte: now };
    }
  }

  const sortOrder = sort === '-startTime' ? { startTime: -1 } : { startTime: 1 };

  const total = await Event.countDocuments(filter);
  const events = await Event.find(filter)
    .populate('createdBy', 'name email role')
    .sort(sortOrder)
    .skip(skip)
    .limit(limit);

  const enrichedItems = events.map((e) => enrichEvent(e, now));

  res.json({
    success: true,
    data: formatPaginatedResponse(enrichedItems, total, page, limit)
  });
}

export async function getMyEvents(req, res) {
  const { page, limit, skip } = getPaginationParams(req.query);
  const now = new Date();

  // Admin sees all events (including cancelled), organizer sees own
  const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };

  const total = await Event.countDocuments(filter);
  const events = await Event.find(filter)
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const enrichedItems = events.map((e) => enrichEvent(e, now));

  res.json({
    success: true,
    data: formatPaginatedResponse(enrichedItems, total, page, limit)
  });
}

export async function getEventById(req, res) {
  const { id } = req.params;
  const now = new Date();

  const event = await Event.findById(id).populate('createdBy', 'name email role');
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  // If event is not published, only owner or admin can view
  if (event.status !== 'published') {
    if (!req.user || (req.user.role !== 'admin' && event.createdBy._id.toString() !== req.user._id.toString())) {
      throw ApiError.notFound('NOT_FOUND', 'Event not found');
    }
  }

  const enriched = enrichEvent(event, now);

  // Fetch feedback stats (avgRating and ratingCount)
  const feedbackStats = await Feedback.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 }
      }
    }
  ]);

  enriched.avgRating = feedbackStats[0] ? Number(feedbackStats[0].avgRating.toFixed(1)) : null;
  enriched.ratingCount = feedbackStats[0] ? feedbackStats[0].ratingCount : 0;

  // If user is authenticated, attach their registration status
  if (req.user) {
    const myRegistration = await Registration.findOne({
      user: req.user._id,
      event: event._id
    });
    enriched.myRegistration = myRegistration || null;
  } else {
    enriched.myRegistration = null;
  }

  res.json({
    success: true,
    data: enriched
  });
}

export async function createEvent(req, res) {
  const {
    title,
    description,
    category,
    speakerName,
    speakerBio,
    mode,
    venue,
    meetingLink,
    startTime,
    endTime,
    capacity
  } = req.body;

  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start <= now) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Start time must be in the future');
  }
  if (end <= start) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'End time must be after start time');
  }
  if (['offline', 'hybrid'].includes(mode) && (!venue || !venue.trim())) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Venue is required for offline and hybrid events');
  }
  if (['online', 'hybrid'].includes(mode) && (!meetingLink || !/^https?:\/\/.+/i.test(meetingLink))) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'A valid HTTP(S) meeting link is required for online and hybrid events');
  }

  let posterUrl = undefined;
  if (req.file) {
    posterUrl = `/uploads/posters/${req.file.filename}`;
  }

  const event = await Event.create({
    title: title.trim(),
    description: description.trim(),
    category,
    speakerName: speakerName.trim(),
    speakerBio: speakerBio ? speakerBio.trim() : undefined,
    mode,
    venue: ['offline', 'hybrid'].includes(mode) ? venue?.trim() : undefined,
    meetingLink: ['online', 'hybrid'].includes(mode) ? meetingLink?.trim() : undefined,
    startTime: start,
    endTime: end,
    capacity: parseInt(capacity, 10),
    confirmedCount: 0,
    posterUrl,
    status: 'published',
    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    data: enrichEvent(event, now),
    message: 'Event created successfully'
  });
}

export async function updateEvent(req, res) {
  const { id } = req.params;
  const event = await Event.findById(id);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  assertOwnership(event, req.user);

  const phase = computeEventPhase(event);
  if (phase === 'completed' || phase === 'cancelled') {
    throw ApiError.conflict('EVENT_LOCKED', 'Completed or cancelled events cannot be modified');
  }

  const {
    title,
    description,
    category,
    speakerName,
    speakerBio,
    mode,
    venue,
    meetingLink,
    startTime,
    endTime,
    capacity
  } = req.body;

  let importantChange = false;
  let newStart = event.startTime;

  if (startTime) {
    const s = new Date(startTime);
    if (s.getTime() !== event.startTime.getTime()) {
      importantChange = true;
      newStart = s;
      event.startTime = s;
    }
  }

  if (endTime) {
    const e = new Date(endTime);
    if (e.getTime() !== event.endTime.getTime()) {
      importantChange = true;
      event.endTime = e;
    }
  }

  if (event.endTime <= event.startTime) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'End time must be after start time');
  }

  const newMode = mode || event.mode;
  event.mode = newMode;

  if (venue !== undefined) {
    if (['offline', 'hybrid'].includes(newMode) && (!venue || !venue.trim())) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Venue is required for offline and hybrid events');
    }
    if (venue !== event.venue) {
      importantChange = true;
      event.venue = venue?.trim();
    }
  }

  if (meetingLink !== undefined) {
    if (['online', 'hybrid'].includes(newMode) && (!meetingLink || !/^https?:\/\/.+/i.test(meetingLink))) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'A valid HTTP(S) meeting link is required for online and hybrid events');
    }
    if (meetingLink !== event.meetingLink) {
      importantChange = true;
      event.meetingLink = meetingLink?.trim();
    }
  }

  if (title) event.title = title.trim();
  if (description) event.description = description.trim();
  if (category) event.category = category;
  if (speakerName) event.speakerName = speakerName.trim();
  if (speakerBio !== undefined) event.speakerBio = speakerBio?.trim();

  let capacityIncreased = false;
  if (capacity !== undefined) {
    const capNum = parseInt(capacity, 10);
    if (capNum < event.confirmedCount) {
      throw ApiError.conflict('CAPACITY_BELOW_CONFIRMED', 'Capacity cannot be set below currently confirmed attendees count');
    }
    if (capNum > event.capacity) {
      capacityIncreased = true;
    }
    event.capacity = capNum;
  }

  // Handle poster replacement
  if (req.file) {
    if (event.posterUrl) {
      deleteFileIfExists(event.posterUrl);
    }
    event.posterUrl = `/uploads/posters/${req.file.filename}`;
  }

  // If timing or location changed, notify confirmed registrants and check reminder reset
  if (importantChange) {
    const now = new Date();
    const moreThan24hAway = newStart.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
    if (moreThan24hAway) {
      event.reminderSent = false;
    }
  }

  await event.save();

  // If capacity increased, promote waitlisted attendees
  if (capacityIncreased) {
    await promoteWaitlist(event._id);
  }

  // Send update notifications if important details changed
  if (importantChange) {
    const confirmedRegistrations = await Registration.find({
      event: event._id,
      status: 'confirmed'
    }).populate('user');

    for (const reg of confirmedRegistrations) {
      if (reg.user) {
        sendEventUpdatedEmail(reg.user, event);
      }
    }
  }

  res.json({
    success: true,
    data: enrichEvent(event),
    message: 'Event updated successfully'
  });
}

export async function cancelEvent(req, res) {
  const { id } = req.params;
  const event = await Event.findById(id);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  assertOwnership(event, req.user);

  const phase = computeEventPhase(event);
  if (phase === 'completed') {
    throw ApiError.conflict('EVENT_LOCKED', 'Completed events cannot be cancelled');
  }
  if (event.status === 'cancelled') {
    throw ApiError.conflict('EVENT_CANCELLED', 'Event is already cancelled');
  }

  event.status = 'cancelled';
  event.confirmedCount = 0;
  await event.save();

  // Find all affected confirmed & waitlisted registrations
  const affected = await Registration.find({
    event: event._id,
    status: { $in: ['confirmed', 'waitlisted'] }
  }).populate('user');

  // Cancel registrations and remove QR tokens
  await Registration.updateMany(
    { event: event._id, status: { $in: ['confirmed', 'waitlisted'] } },
    { status: 'cancelled', $unset: { qrToken: 1 } }
  );

  // Send cancellation notice to all affected attendees
  for (const reg of affected) {
    if (reg.user) {
      sendEventCancelledEmail(reg.user, event);
    }
  }

  res.json({
    success: true,
    data: enrichEvent(event),
    message: 'Event cancelled successfully'
  });
}

export async function deleteEvent(req, res) {
  const { id } = req.params;
  const event = await Event.findById(id);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  assertOwnership(event, req.user);

  // Check if any registrations exist
  const regCount = await Registration.countDocuments({ event: event._id });
  if (regCount > 0) {
    throw ApiError.conflict('HAS_REGISTRATIONS', 'Cannot delete an event that has registrations');
  }

  // Remove resources from DB and disk
  const resources = await Resource.find({ event: event._id });
  for (const res of resources) {
    deleteFileIfExists(`/uploads/resources/${res.storedName}`);
  }
  await Resource.deleteMany({ event: event._id });

  // Remove poster from disk
  if (event.posterUrl) {
    deleteFileIfExists(event.posterUrl);
  }

  await event.deleteOne();

  res.json({
    success: true,
    data: { _id: id },
    message: 'Event deleted successfully'
  });
}

export async function getEventStats(req, res) {
  const { id } = req.params;
  const event = await Event.findById(id);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  assertOwnership(event, req.user);

  const [confirmed, waitlisted, cancelled, attended] = await Promise.all([
    Registration.countDocuments({ event: event._id, status: 'confirmed' }),
    Registration.countDocuments({ event: event._id, status: 'waitlisted' }),
    Registration.countDocuments({ event: event._id, status: 'cancelled' }),
    Registration.countDocuments({ event: event._id, attended: true })
  ]);

  // attendanceRate = attended / confirmed-or-attended as a 0-100 number, 0 if none
  const confirmedOrAttended = await Registration.countDocuments({
    event: event._id,
    $or: [{ status: 'confirmed' }, { attended: true }]
  });

  const attendanceRate = confirmedOrAttended > 0
    ? Math.round((attended / confirmedOrAttended) * 100)
    : 0;

  // Feedback statistics
  const feedbacks = await Feedback.find({ event: event._id });
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;

  feedbacks.forEach((fb) => {
    if (ratingDistribution[fb.rating] !== undefined) {
      ratingDistribution[fb.rating]++;
      ratingSum += fb.rating;
    }
  });

  const avgRating = feedbacks.length > 0 ? Number((ratingSum / feedbacks.length).toFixed(1)) : null;

  res.json({
    success: true,
    data: {
      confirmed,
      waitlisted,
      cancelled,
      attended,
      attendanceRate,
      avgRating,
      ratingDistribution
    }
  });
}
