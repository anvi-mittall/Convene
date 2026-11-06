import { Feedback } from '../models/Feedback.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { ApiError } from '../utils/ApiError.js';
import { computeEventPhase } from '../utils/eventPhase.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function createFeedback(req, res) {
  const { id: eventId } = req.params;
  const { rating, comment } = req.body;
  const now = new Date();

  const event = await Event.findById(eventId);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  // Event must be completed
  const phase = computeEventPhase(event, now);
  if (phase !== 'completed') {
    throw ApiError.forbidden(
      'NOT_ELIGIBLE',
      'Feedback can only be submitted after the event has completed'
    );
  }

  // Caller must have an attended registration
  const registration = await Registration.findOne({
    user: req.user._id,
    event: eventId
  });

  if (!registration || !registration.attended) {
    throw ApiError.forbidden(
      'NOT_ELIGIBLE',
      'Only attendees who actually attended this completed event can submit feedback'
    );
  }

  // One feedback per user per event
  const existingFeedback = await Feedback.findOne({
    user: req.user._id,
    event: eventId
  });

  if (existingFeedback) {
    throw ApiError.conflict('ALREADY_REVIEWED', 'You have already submitted feedback for this event');
  }

  const feedback = await Feedback.create({
    user: req.user._id,
    event: eventId,
    rating,
    comment: comment ? comment.trim() : undefined
  });

  await feedback.populate('user', 'name email');

  res.status(201).json({
    success: true,
    data: feedback,
    message: 'Feedback submitted successfully'
  });
}

export async function getEventFeedback(req, res) {
  const { id: eventId } = req.params;
  const { page, limit, skip } = getPaginationParams(req.query);

  const event = await Event.findById(eventId);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not have permission to view feedback for this event');
  }

  const total = await Feedback.countDocuments({ event: eventId });
  const items = await Feedback.find({ event: eventId })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: formatPaginatedResponse(items, total, page, limit)
  });
}
