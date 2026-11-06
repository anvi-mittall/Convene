import cron from 'node-cron';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { sendReminderEmail } from './mailer.js';

export async function processUpcomingEventReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find published events with reminderSent = false starting in the next 24 hours
  const upcomingEvents = await Event.find({
    status: 'published',
    reminderSent: false,
    startTime: { $gte: now, $lte: in24Hours }
  });

  let emailsSent = 0;

  for (const event of upcomingEvents) {
    const confirmedRegistrations = await Registration.find({
      event: event._id,
      status: 'confirmed'
    }).populate('user');

    for (const reg of confirmedRegistrations) {
      if (reg.user) {
        await sendReminderEmail(reg.user, event);
        emailsSent++;
      }
    }

    event.reminderSent = true;
    await event.save();
  }

  return { eventsProcessed: upcomingEvents.length, emailsSent };
}

export function startReminderCron() {
  // Runs every hour at minute 0
  return cron.schedule('0 * * * *', async () => {
    try {
      await processUpcomingEventReminders();
    } catch (err) {
      console.error('Reminder cron error:', err);
    }
  });
}
