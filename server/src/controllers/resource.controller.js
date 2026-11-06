import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Resource } from '../models/Resource.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { ApiError } from '../utils/ApiError.js';
import { deleteFileIfExists } from '../middleware/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resourcesDir = path.resolve(__dirname, '../../uploads/resources');

async function checkAccessToEventResources(eventId, user) {
  if (user.role === 'admin') return true;

  const event = await Event.findById(eventId);
  if (!event) throw ApiError.notFound('NOT_FOUND', 'Event not found');

  if (event.createdBy.toString() === user._id.toString()) {
    return true;
  }

  // Check if confirmed registrant
  const registration = await Registration.findOne({
    user: user._id,
    event: eventId,
    status: 'confirmed'
  });

  if (!registration) {
    throw ApiError.forbidden(
      'FORBIDDEN',
      'Only the organizer or confirmed attendees can access workshop materials'
    );
  }

  return true;
}

export async function uploadEventResource(req, res) {
  const { id: eventId } = req.params;
  const { title } = req.body;

  if (!req.file) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'A document file is required');
  }

  const event = await Event.findById(eventId);
  if (!event) {
    deleteFileIfExists(`/uploads/resources/${req.file.filename}`);
    throw ApiError.notFound('NOT_FOUND', 'Event not found');
  }

  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    deleteFileIfExists(`/uploads/resources/${req.file.filename}`);
    throw ApiError.forbidden('FORBIDDEN', 'You do not have permission to upload materials to this event');
  }

  const resource = await Resource.create({
    event: eventId,
    title: title.trim(),
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    data: resource,
    message: 'Resource uploaded successfully'
  });
}

export async function getEventResources(req, res) {
  const { id: eventId } = req.params;

  await checkAccessToEventResources(eventId, req.user);

  const resources = await Resource.find({ event: eventId })
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: resources
  });
}

export async function downloadResource(req, res) {
  const { resourceId } = req.params;

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw ApiError.notFound('NOT_FOUND', 'Resource not found');
  }

  await checkAccessToEventResources(resource.event, req.user);

  const filePath = path.join(resourcesDir, resource.storedName);
  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('NOT_FOUND', 'Physical file not found on disk');
  }

  res.download(filePath, resource.originalName);
}

export async function deleteResourceById(req, res) {
  const { resourceId } = req.params;

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw ApiError.notFound('NOT_FOUND', 'Resource not found');
  }

  const event = await Event.findById(resource.event);
  if (!event) {
    throw ApiError.notFound('NOT_FOUND', 'Associated event not found');
  }

  if (req.user.role !== 'admin' && event.createdBy.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('FORBIDDEN', 'You do not have permission to delete this resource');
  }

  deleteFileIfExists(`/uploads/resources/${resource.storedName}`);
  await resource.deleteOne();

  res.json({
    success: true,
    data: { _id: resourceId },
    message: 'Resource deleted successfully'
  });
}
