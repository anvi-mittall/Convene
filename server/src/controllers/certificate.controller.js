import { Registration } from '../models/Registration.js';
import { ApiError } from '../utils/ApiError.js';
import { generateCertificateStream } from '../services/certificate.js';

export async function getCertificate(req, res) {
  const { id } = req.params;
  const now = new Date();

  const registration = await Registration.findById(id).populate(['user', 'event']);
  if (!registration) {
    throw ApiError.notFound('NOT_FOUND', 'Registration not found');
  }

  // Only the registration's owner can download the certificate
  if (registration.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw ApiError.forbidden('FORBIDDEN', 'You do not own this registration');
  }

  // Requires attended === true and now >= event.endTime
  if (!registration.attended || now < new Date(registration.event.endTime)) {
    throw ApiError.forbidden(
      'NOT_ELIGIBLE',
      'Certificate is only available after attending a completed event'
    );
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="certificate-${registration._id}.pdf"`
  );

  generateCertificateStream(registration, res);
}
