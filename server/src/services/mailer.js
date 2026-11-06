import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    const fromAddress = env.MAIL_FROM || `"${env.APP_NAME}" <noreply@convene.com>`;

    if (!transporter) {
      if (env.NODE_ENV !== 'test') {
        console.log(`\n📧 [EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
        console.log(`Body (snippet): ${text || html?.replace(/<[^>]*>/g, '').slice(0, 150)}...\n`);
      }
      return { simulated: true, to, subject };
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html
    });

    return info;
  } catch (error) {
    console.error(`⚠️ Email sending failed to ${to}:`, error.message);
    // Never fail the API request
    return null;
  }
}

// Helper template generators
export async function sendRegistrationConfirmedEmail(user, event) {
  const subject = `Registration Confirmed: ${event.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>Your registration for <strong>${event.title}</strong> is confirmed!</p>
      <p><strong>Speaker:</strong> ${event.speakerName}</p>
      <p><strong>Date & Time:</strong> ${new Date(event.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p><strong>Mode:</strong> ${event.mode} ${event.venue ? `(${event.venue})` : ''}</p>
      <p>Access your check-in QR code on your dashboard at any time.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendWaitlistAddedEmail(user, event) {
  const subject = `Added to Waitlist: ${event.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>You have been added to the waitlist for <strong>${event.title}</strong>.</p>
      <p>If a seat becomes available or capacity is increased, you will be automatically promoted and notified immediately.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendWaitlistPromotedEmail(user, event) {
  const subject = `Great news! You are confirmed for ${event.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>A seat has opened up and you have been promoted from the waitlist to <strong>confirmed</strong> for <strong>${event.title}</strong>!</p>
      <p>Your check-in QR code is now available on your dashboard.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendRegistrationCancelledEmail(user, event) {
  const subject = `Registration Cancelled: ${event.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>Your registration for <strong>${event.title}</strong> has been cancelled.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendEventUpdatedEmail(user, event) {
  const subject = `Event Update: ${event.title}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>Important details for <strong>${event.title}</strong> have been updated:</p>
      <p><strong>Date & Time:</strong> ${new Date(event.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p><strong>Mode / Location:</strong> ${event.mode} ${event.venue ? `(${event.venue})` : ''} ${event.meetingLink ? `(${event.meetingLink})` : ''}</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendEventCancelledEmail(user, event) {
  const subject = `Notice: ${event.title} has been cancelled`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>We regret to inform you that <strong>${event.title}</strong> has been cancelled by the organizer.</p>
      <p>All active registrations and waitlists for this event have been closed.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}

export async function sendReminderEmail(user, event) {
  const subject = `Reminder: ${event.title} starts in 24 hours!`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Hello ${user.name},</h2>
      <p>This is a quick reminder that <strong>${event.title}</strong> starts in 24 hours!</p>
      <p><strong>Date & Time:</strong> ${new Date(event.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p><strong>Location:</strong> ${event.mode === 'online' ? event.meetingLink : event.venue}</p>
      <p>Don't forget to have your QR code ready for check-in.</p>
      <br/>
      <p>Best regards,<br/>The ${env.APP_NAME} Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
}
