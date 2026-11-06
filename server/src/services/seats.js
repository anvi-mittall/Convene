import crypto from 'crypto';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { ApiError } from '../utils/ApiError.js';
import {
  sendRegistrationConfirmedEmail,
  sendWaitlistAddedEmail,
  sendWaitlistPromotedEmail,
  sendRegistrationCancelledEmail
} from './mailer.js';

export async function promoteWaitlist(eventId) {
  let promotedCount = 0;

  while (true) {
    const now = new Date();

    // 1. Atomically try to claim a seat on the event
    const event = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: 'published',
        startTime: { $gt: now },
        $expr: { $lt: ['$confirmedCount', '$capacity'] }
      },
      { $inc: { confirmedCount: 1 } },
      { new: true }
    );

    if (!event) {
      // No capacity available
      break;
    }

    // 2. Atomically claim the oldest waitlisted registration (FIFO order)
    const newQrToken = crypto.randomBytes(32).toString('hex');
    const registration = await Registration.findOneAndUpdate(
      { event: eventId, status: 'waitlisted' },
      {
        status: 'confirmed',
        qrToken: newQrToken,
        $unset: { queuedAt: 1 }
      },
      {
        sort: { queuedAt: 1 },
        new: true
      }
    ).populate('user');

    if (!registration) {
      // No waitlisted users found; compensate by releasing the claimed seat
      await Event.findByIdAndUpdate(eventId, { $inc: { confirmedCount: -1 } });
      break;
    }

    promotedCount++;
    // Send email to the promoted registrant
    if (registration.user) {
      sendWaitlistPromotedEmail(registration.user, event);
    }
  }

  return promotedCount;
}

export async function registerUserForEvent(userId, eventId) {
  const now = new Date();

  // 1. Load event & validate state
  const event = await Event.findById(eventId);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  if (event.status === 'cancelled') {
    throw ApiError.conflict('EVENT_CANCELLED', 'Cannot register for a cancelled event');
  }

  if (new Date(event.startTime) <= now) {
    throw ApiError.conflict('EVENT_STARTED', 'Cannot register for an event that has already started');
  }

  if (event.createdBy.toString() === userId.toString()) {
    throw ApiError.badRequest('OWN_EVENT', 'You cannot register for your own event');
  }

  // 2. Check existing registration
  const existingReg = await Registration.findOne({ user: userId, event: eventId });
  if (existingReg && (existingReg.status === 'confirmed' || existingReg.status === 'waitlisted')) {
    throw ApiError.conflict('ALREADY_REGISTERED', 'You are already registered for this event');
  }

  // 3. Atomically attempt to claim a seat
  const seatClaimed = await Event.findOneAndUpdate(
    {
      _id: eventId,
      status: 'published',
      startTime: { $gt: now },
      $expr: { $lt: ['$confirmedCount', '$capacity'] }
    },
    { $inc: { confirmedCount: 1 } },
    { new: true }
  );

  let status;
  let qrToken = undefined;
  let queuedAt = undefined;

  if (seatClaimed) {
    status = 'confirmed';
    qrToken = crypto.randomBytes(32).toString('hex');
  } else {
    status = 'waitlisted';
    queuedAt = now;
  }

  // 4. Create or reuse registration document
  let registration;
  try {
    if (existingReg) {
      existingReg.status = status;
      if (status === 'confirmed') {
        existingReg.qrToken = qrToken;
        existingReg.queuedAt = undefined;
      } else {
        existingReg.qrToken = undefined;
        existingReg.queuedAt = queuedAt;
      }
      existingReg.attended = false;
      existingReg.attendedAt = undefined;
      registration = await existingReg.save();
    } else {
      registration = await Registration.create({
        user: userId,
        event: eventId,
        status,
        ...(qrToken && { qrToken }),
        ...(queuedAt && { queuedAt })
      });
    }
  } catch (err) {
    // If saving fails after a seat was claimed, decrement confirmedCount (compensation)
    if (seatClaimed) {
      await Event.findByIdAndUpdate(eventId, { $inc: { confirmedCount: -1 } });
    }
    if (err.code === 11000) {
      throw ApiError.conflict('ALREADY_REGISTERED', 'You are already registered for this event');
    }
    throw err;
  }

  // Populate user and event for notifications and response
  await registration.populate(['user', 'event']);

  // 5. Send matching email
  if (status === 'confirmed') {
    sendRegistrationConfirmedEmail(registration.user, event);
  } else {
    sendWaitlistAddedEmail(registration.user, event);
  }

  return registration;
}

export async function cancelUserRegistration(userId, eventId) {
  const now = new Date();

  // 1. Find user's active registration
  const registration = await Registration.findOne({
    user: userId,
    event: eventId,
    status: { $in: ['confirmed', 'waitlisted'] }
  }).populate(['user', 'event']);

  if (!registration) {
    throw ApiError.notFound('NOT_FOUND', 'Active registration not found for this event');
  }

  // 2. Attendance & start checks
  if (registration.attended) {
    throw ApiError.conflict('ALREADY_ATTENDED', 'Cannot cancel a registration that has already attended');
  }

  if (new Date(registration.event.startTime) <= now) {
    throw ApiError.conflict('EVENT_STARTED', 'Cannot cancel a registration for an event that has already started');
  }

  const wasConfirmed = registration.status === 'confirmed';

  // 3. Set status cancelled, remove qrToken
  registration.status = 'cancelled';
  registration.qrToken = undefined;
  await registration.save();

  // 4. If was confirmed, decrement count and promote waitlist
  if (wasConfirmed) {
    await Event.findByIdAndUpdate(eventId, { $inc: { confirmedCount: -1 } });
    await promoteWaitlist(eventId);
  }

  // 5. Send cancellation email
  sendRegistrationCancelledEmail(registration.user, registration.event);

  return registration;
}
