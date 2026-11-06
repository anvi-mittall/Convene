import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';

export function formatDateKolkata(date) {
  // Formats date to 'DD MMM YYYY' in Asia/Kolkata timezone
  const d = new Date(date);
  const options = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  };
  // 'en-GB' yields '31 Oct 2026' style
  return new Intl.DateTimeFormat('en-GB', options).format(d);
}

export function generateCertificateStream(registration, res) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40
  });

  const pageWidth = 841.89;
  const pageHeight = 595.28;

  // Stream directly to HTTP response
  doc.pipe(res);

  // Outer decorative border
  doc
    .rect(25, 25, pageWidth - 50, pageHeight - 50)
    .lineWidth(3)
    .strokeColor('#4f46e5')
    .stroke();

  // Inner border
  doc
    .rect(32, 32, pageWidth - 64, pageHeight - 64)
    .lineWidth(1)
    .strokeColor('#94a3b8')
    .stroke();

  doc.moveDown(2);

  // APP_NAME header
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#6366f1')
    .text(env.APP_NAME.toUpperCase(), { align: 'center', characterSpacing: 2 });

  doc.moveDown(1.5);

  // Main Heading
  doc
    .font('Helvetica-Bold')
    .fontSize(32)
    .fillColor('#0f172a')
    .text('Certificate of Participation', { align: 'center' });

  doc.moveDown(1.2);

  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor('#64748b')
    .text('This is proudly presented to', { align: 'center' });

  doc.moveDown(0.8);

  // Attendee Name
  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor('#1e1b4b')
    .text(registration.user?.name || 'Attendee', { align: 'center' });

  doc.moveDown(0.8);

  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor('#64748b')
    .text('for actively participating in and successfully completing the event', {
      align: 'center'
    });

  doc.moveDown(0.8);

  // Event Title
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#4338ca')
    .text(registration.event?.title || 'Workshop', { align: 'center' });

  doc.moveDown(1);

  // Event Date
  const dateFormatted = formatDateKolkata(registration.event?.startTime);
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor('#334155')
    .text(`Conducted on ${dateFormatted}`, { align: 'center' });

  doc.moveDown(2.5);

  // Bottom footer: Certificate ID & Organization
  const bottomY = pageHeight - 80;
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#94a3b8')
    .text(`Certificate ID: ${registration._id}`, 50, bottomY, {
      align: 'left'
    });

  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#475569')
    .text(`Verified by ${env.APP_NAME}`, pageWidth - 250, bottomY, {
      align: 'right',
      width: 200
    });

  doc.end();
}
