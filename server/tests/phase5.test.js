import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Resource } from '../src/models/Resource.js';
import { Feedback } from '../src/models/Feedback.js';
import { processUpcomingEventReminders } from '../src/services/reminders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongod;
let attendee1User, attendee1Token;
let attendee2User, attendee2Token;
let organizerUser, organizerToken;
let adminUser, adminToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Attendee 1
  attendee1User = await User.create({
    name: 'Attendee One',
    email: 'att1@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'attendee'
  });
  const a1 = await request(app).post('/api/auth/login').send({ email: 'att1@test.com', password: 'pass12345' });
  attendee1Token = a1.body.data.token;

  // Attendee 2 (unregistered for materials test)
  attendee2User = await User.create({
    name: 'Attendee Two',
    email: 'att2@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'attendee'
  });
  const a2 = await request(app).post('/api/auth/login').send({ email: 'att2@test.com', password: 'pass12345' });
  attendee2Token = a2.body.data.token;

  // Organizer
  organizerUser = await User.create({
    name: 'Organizer Pro',
    email: 'orgpro@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  const o = await request(app).post('/api/auth/login').send({ email: 'orgpro@test.com', password: 'pass12345' });
  organizerToken = o.body.data.token;

  // Admin
  adminUser = await User.create({
    name: 'Super Admin',
    email: 'adminpro@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'admin'
  });
  const adm = await request(app).post('/api/auth/login').send({ email: 'adminpro@test.com', password: 'pass12345' });
  adminToken = adm.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 5: Feedback, Resources, Reminders, and Analytics', () => {
  let completedEvent, upcomingEvent, uploadedResourceId;

  beforeAll(async () => {
    const now = Date.now();

    // Completed event
    completedEvent = await Event.create({
      title: 'Completed Web Security Seminar',
      description: 'Defensive web security techniques.',
      category: 'seminar',
      speakerName: 'Dr. Cyberspace',
      mode: 'online',
      meetingLink: 'https://meet.google.com/sec',
      startTime: new Date(now - 86400000),
      endTime: new Date(now - 82800000),
      capacity: 50,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizerUser._id
    });

    // Registration for attendee 1 on completed event (marked attended)
    await Registration.create({
      user: attendee1User._id,
      event: completedEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 85000000)
    });

    // Upcoming event for materials and reminders (starts in 12 hours)
    upcomingEvent = await Event.create({
      title: 'Next-Gen Microservices',
      description: 'Event starting in 12 hours.',
      category: 'workshop',
      speakerName: 'Prof. Scaler',
      mode: 'online',
      meetingLink: 'https://meet.google.com/scale',
      startTime: new Date(now + 12 * 3600000),
      endTime: new Date(now + 15 * 3600000),
      capacity: 50,
      confirmedCount: 1,
      reminderSent: false,
      status: 'published',
      createdBy: organizerUser._id
    });

    // Attendee 1 is confirmed for upcoming event
    await Registration.create({
      user: attendee1User._id,
      event: upcomingEvent._id,
      status: 'confirmed',
      attended: false
    });
  });

  // 1. Feedback Tests
  it('allows attended attendee to submit feedback on a completed event', async () => {
    const res = await request(app)
      .post(`/api/events/${completedEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendee1Token}`)
      .send({
        rating: 5,
        comment: 'Outstanding workshop, learned practical defense tactics!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rating).toBe(5);
  });

  it('rejects duplicate feedback from same user with 409 ALREADY_REVIEWED', async () => {
    const res = await request(app)
      .post(`/api/events/${completedEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendee1Token}`)
      .send({
        rating: 4,
        comment: 'Trying to review again'
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REVIEWED');
  });

  it('rejects feedback on an upcoming event with 403 NOT_ELIGIBLE', async () => {
    const res = await request(app)
      .post(`/api/events/${upcomingEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendee1Token}`)
      .send({
        rating: 5
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ELIGIBLE');
  });

  // 2. Resource Upload & Access Tests
  it('rejects disallowed file types for resources with 400 FILE_TYPE_NOT_ALLOWED', async () => {
    const fakeExe = path.resolve(__dirname, 'malicious.exe');
    fs.writeFileSync(fakeExe, Buffer.from('fake-exe'));

    const res = await request(app)
      .post(`/api/events/${upcomingEvent._id}/resources`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .field('title', 'Executable Test')
      .attach('file', fakeExe);

    fs.unlinkSync(fakeExe);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('allows organizer to upload valid PDF resource', async () => {
    const samplePdf = path.resolve(__dirname, 'architecture.pdf');
    fs.writeFileSync(samplePdf, Buffer.from('%PDF-1.4 sample content'));

    const res = await request(app)
      .post(`/api/events/${upcomingEvent._id}/resources`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .field('title', 'Architecture Slides')
      .attach('file', samplePdf);

    fs.unlinkSync(samplePdf);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Architecture Slides');
    expect(res.body.data.originalName).toBe('architecture.pdf');

    uploadedResourceId = res.body.data._id;
  });

  it('allows confirmed registrant to download resource file', async () => {
    const res = await request(app)
      .get(`/api/resources/${uploadedResourceId}/download`)
      .set('Authorization', `Bearer ${attendee1Token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('architecture.pdf');
  });

  it('blocks unconfirmed/non-registrant user from downloading resource with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/resources/${uploadedResourceId}/download`)
      .set('Authorization', `Bearer ${attendee2Token}`); // Attendee 2 has no registration

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 3. Reminders Job Test
  it('processUpcomingEventReminders sends emails to confirmed registrants and sets reminderSent flag', async () => {
    const beforeEv = await Event.findById(upcomingEvent._id);
    expect(beforeEv.reminderSent).toBe(false);

    const result = await processUpcomingEventReminders();
    expect(result.eventsProcessed).toBeGreaterThanOrEqual(1);
    expect(result.emailsSent).toBeGreaterThanOrEqual(1);

    const afterEv = await Event.findById(upcomingEvent._id);
    expect(afterEv.reminderSent).toBe(true);

    // Running second time should process 0 upcoming events
    const secondResult = await processUpcomingEventReminders();
    expect(secondResult.eventsProcessed).toBe(0);
  });

  // 4. Admin Stats Tests
  it('GET /admin/stats returns accurate statistics matching raw DB counts', async () => {
    const rawUsersCount = await User.countDocuments({});
    const rawEventsCount = await Event.countDocuments({});
    const rawConfirmedCount = await Registration.countDocuments({ status: 'confirmed' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalUsers).toBe(rawUsersCount);
    expect(res.body.data.totalEvents).toBe(rawEventsCount);
    expect(res.body.data.totalConfirmedRegistrations).toBe(rawConfirmedCount);
    expect(res.body.data.registrationsLast30Days).toHaveLength(30);
    expect(res.body.data.eventsByCategory.length).toBeGreaterThan(0);
  });
});
