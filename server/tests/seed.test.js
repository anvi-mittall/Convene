import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { seedAdmin, seedDemoData } from '../src/scripts/seed.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Feedback } from '../src/models/Feedback.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Seed Script Acceptance & Idempotency', () => {
  it('seeds admin and demo data on empty database', async () => {
    const admin = await seedAdmin();
    expect(admin).toBeDefined();
    expect(admin.role).toBe('admin');

    await seedDemoData();

    // Verify Users
    const adminCount = await User.countDocuments({ role: 'admin' });
    const organizerCount = await User.countDocuments({ role: 'organizer' });
    const attendeeCount = await User.countDocuments({ role: 'attendee' });
    expect(adminCount).toBe(1);
    expect(organizerCount).toBe(1);
    expect(attendeeCount).toBe(5);

    // Verify Events
    const eventsCount = await Event.countDocuments();
    expect(eventsCount).toBe(4);

    // Verify Registrations & Feedback
    const registrationsCount = await Registration.countDocuments();
    expect(registrationsCount).toBeGreaterThan(0);

    const feedbackCount = await Feedback.countDocuments();
    expect(feedbackCount).toBeGreaterThan(0);
  });

  it('runs seedAdmin and seedDemoData a second time idempotently without duplicating', async () => {
    // Run second time
    await seedAdmin();
    await seedDemoData();

    // Verify exact same counts
    const adminCount = await User.countDocuments({ role: 'admin' });
    const organizerCount = await User.countDocuments({ role: 'organizer' });
    const attendeeCount = await User.countDocuments({ role: 'attendee' });
    expect(adminCount).toBe(1);
    expect(organizerCount).toBe(1);
    expect(attendeeCount).toBe(5);

    const eventsCount = await Event.countDocuments();
    expect(eventsCount).toBe(4);
  });
});
