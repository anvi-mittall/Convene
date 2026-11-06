import qrcode from 'qrcode';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { ApiError } from '../utils/ApiError.js';

function isWithinAttendanceWindow(event, now = new Date()) {
  const windowStart = new Date(new Date(event.startTime).getTime() - 60 * 60 * 1000); // startTime - 60 min
  const windowEnd = new Date(new Date(event.endTime).getTime() + 120 * 60 * 1000);   // endTime + 120 min
  return now >= windowStart && now <= windowEnd;
}

export async function getRegistrationQr(req, res) {
  const { id } = req.params;

  const registration = await Registration.findById(id).populate('event');
  if (!registration) {
    throw ApiError.notFound('NOT_FOUND', 'Registration not found');
  }

  // Only owner can view their QR
  if (registration.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw ApiError.forbidden('FORBIDDEN', 'You do not own this registration');
  }

  if (registration.status !== 'confirmed' || !registration.qrToken) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'QR code is only available for confirmed registrations');
  }

  // Generate QR encoding only the qrToken
  const qrDataUrl = await qrcode.toDataURL(registration.qrToken, {
    width: 300,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  res.json({
    success: true,
    data: { qrDataUrl }
  });
}

export async function scanAttendance(req, res) {
  const { eventId, qrToken } = req.body;
  const now = new Date();

  // 1. Check event exists and caller owns it
  const event = await Event.findById(eventId);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not own this event');
  }

  // 2. Check registration with that token exists
  const registration = await Registration.findOne({ qrToken }).populate('user');
  if (!registration) {
    throw ApiError.notFound('INVALID_QR', 'Invalid QR code token');
  }

  // 3. Check registration belongs to eventId
  if (registration.event.toString() !== eventId) {
    throw ApiError.badRequest('WRONG_EVENT', 'This ticket is for a different event');
  }

  // 4. Check status is confirmed
  if (registration.status !== 'confirmed') {
    throw ApiError.badRequest('INVALID_QR', 'Registration is not confirmed');
  }

  // 5. Check not already attended
  if (registration.attended) {
    throw ApiError.conflict('ALREADY_ATTENDED', 'Attendee has already been checked in', {
      attendedAt: registration.attendedAt
    });
  }

  // 6. Check time is within attendance window [startTime - 60 min, endTime + 120 min]
  if (!isWithinAttendanceWindow(event, now)) {
    throw ApiError.conflict(
      'OUTSIDE_ATTENDANCE_WINDOW',
      'Check-in is only allowed between 60 minutes before start and 120 minutes after end time'
    );
  }

  // On success mark attended
  registration.attended = true;
  registration.attendedAt = now;
  await registration.save();

  res.json({
    success: true,
    data: {
      user: {
        _id: registration.user._id,
        name: registration.user.name,
        email: registration.user.email
      },
      attendedAt: registration.attendedAt
    },
    message: 'Check-in successful'
  });
}

export async function updateAttendanceManual(req, res) {
  const { id: eventId, regId } = req.params;
  const { attended } = req.body;
  const now = new Date();

  const event = await Event.findById(eventId);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not own this event');
  }

  const registration = await Registration.findOne({ _id: regId, event: eventId }).populate('user');
  if (!registration) {
    throw ApiError.notFound('NOT_FOUND', 'Registration not found for this event');
  }

  if (registration.status !== 'confirmed') {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Attendance can only be set for confirmed registrations');
  }

  if (!isWithinAttendanceWindow(event, now)) {
    throw ApiError.conflict(
      'OUTSIDE_ATTENDANCE_WINDOW',
      'Attendance updates are only allowed between 60 minutes before start and 120 minutes after end time'
    );
  }

  registration.attended = Boolean(attended);
  registration.attendedAt = Boolean(attended) ? now : undefined;
  await registration.save();

  res.json({
    success: true,
    data: registration,
    message: `Attendance marked as ${registration.attended ? 'attended' : 'unattended'}`
  });
}
