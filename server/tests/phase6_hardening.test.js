import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Feedback } from '../src/models/Feedback.js';

let mongod;
let adminToken;
let organizerAToken, organizerAId;
let organizerBToken, organizerBId;
let attendeeTokens = [];
let attendeeIds = [];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // 1. Create Admin
  const admin = await User.create({
    name: 'Platform Admin',
    email: 'admin6@convene.com',
    passwordHash: await User.hashPassword('Pass12345!'),
    role: 'admin'
  });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin6@convene.com', password: 'Pass12345!' });
  adminToken = adminLogin.body.data.token;

  // 2. Create Organizer A
  const orgA = await User.create({
    name: 'Organizer A',
    email: 'orga@convene.com',
    passwordHash: await User.hashPassword('Pass12345!'),
    role: 'organizer'
  });
  organizerAId = orgA._id.toString();
  const orgALogin = await request(app).post('/api/auth/login').send({ email: 'orga@convene.com', password: 'Pass12345!' });
  organizerAToken = orgALogin.body.data.token;

  // 3. Create Organizer B
  const orgB = await User.create({
    name: 'Organizer B',
    email: 'orgb@convene.com',
    passwordHash: await User.hashPassword('Pass12345!'),
    role: 'organizer'
  });
  organizerBId = orgB._id.toString();
  const orgBLogin = await request(app).post('/api/auth/login').send({ email: 'orgb@convene.com', password: 'Pass12345!' });
  organizerBToken = orgBLogin.body.data.token;

  // 4. Create 25 attendees for concurrency and waitlist testing
  for (let i = 1; i <= 25; i++) {
    const att = await User.create({
      name: `Attendee ${i}`,
      email: `att6_${i}@convene.com`,
      passwordHash: await User.hashPassword('Pass12345!'),
      role: 'attendee'
    });
    attendeeIds.push(att._id.toString());
    const attLogin = await request(app).post('/api/auth/login').send({ email: `att6_${i}@convene.com`, password: 'Pass12345!' });
    attendeeTokens.push(attLogin.body.data.token);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 6 Hardening: Consolidated Section 12 Acceptance Suite', () => {
  // -------------------------------------------------------------
  // (a) Concurrency cap test (20 concurrent calls against capacity 5)
  // -------------------------------------------------------------
  it('(a) Concurrency cap test: 20 concurrent register calls against capacity 5 yield exactly 5 confirmed and 15 waitlisted', async () => {
    const event = await Event.create({
      title: 'High Concurrency Load Test',
      description: 'Stress testing atomic reservation under concurrency',
      category: 'workshop',
      speakerName: 'Dr. Scale',
      mode: 'online',
      meetingLink: 'https://meet.google.com/scale-test',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 7200000),
      capacity: 5,
      confirmedCount: 0,
      status: 'published',
      createdBy: organizerAId
    });

    const calls = attendeeTokens.slice(0, 20).map((token) =>
      request(app)
        .post(`/api/events/${event._id}/register`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
    );

    const responses = await Promise.all(calls);

    const confirmed = responses.filter((r) => r.status === 201 && r.body.data.status === 'confirmed');
    const waitlisted = responses.filter((r) => r.status === 201 && r.body.data.status === 'waitlisted');

    expect(confirmed.length).toBe(5);
    expect(waitlisted.length).toBe(15);

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.confirmedCount).toBe(5);

    const dbConfirmed = await Registration.countDocuments({ event: event._id, status: 'confirmed' });
    const dbWaitlisted = await Registration.countDocuments({ event: event._id, status: 'waitlisted' });
    expect(dbConfirmed).toBe(5);
    expect(dbWaitlisted).toBe(15);
  });

  // -------------------------------------------------------------
  // (b) Waitlist FIFO promotion order
  // -------------------------------------------------------------
  it('(b) Waitlist FIFO promotion order: earlier queued registrant is promoted before later queued registrant', async () => {
    const event = await Event.create({
      title: 'FIFO Order Verification',
      description: 'Verifying strict FIFO promotion ordering',
      category: 'seminar',
      speakerName: 'Prof. Queue',
      mode: 'offline',
      venue: 'Room 101',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 7200000),
      capacity: 1,
      confirmedCount: 0,
      status: 'published',
      createdBy: organizerAId
    });

    // Attendee 20 registers -> gets confirmed
    const resA = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${attendeeTokens[20]}`)
      .send({});
    expect(resA.status).toBe(201);
    expect(resA.body.data.status).toBe('confirmed');

    // Attendee 21 registers -> waitlisted first (FIFO head)
    const resB = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${attendeeTokens[21]}`)
      .send({});
    expect(resB.status).toBe(201);
    expect(resB.body.data.status).toBe('waitlisted');

    // Attendee 22 registers -> waitlisted second
    const resC = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${attendeeTokens[22]}`)
      .send({});
    expect(resC.status).toBe(201);
    expect(resC.body.data.status).toBe('waitlisted');

    // Attendee 20 cancels -> Attendee 21 MUST be promoted to confirmed, Attendee 22 remains waitlisted
    const cancelRes = await request(app)
      .delete(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${attendeeTokens[20]}`);
    expect(cancelRes.status).toBe(200);

    const regB = await Registration.findOne({ event: event._id, user: attendeeIds[21] });
    expect(regB.status).toBe('confirmed');
    expect(regB.qrToken).toBeDefined();

    const regC = await Registration.findOne({ event: event._id, user: attendeeIds[22] });
    expect(regC.status).toBe('waitlisted');
    expect(regC.qrToken).toBeUndefined();
  });

  // -------------------------------------------------------------
  // (c) Role / ownership permission matrix for events
  // -------------------------------------------------------------
  it('(c) Role / ownership permission matrix: Guest (401), Attendee (403), Non-Owner Org (403), Owner Org (200), Admin (200)', async () => {
    // 1. Guest cannot create event
    const guestCreate = await request(app).post('/api/events').send({
      title: 'Guest Event',
      description: 'Should fail',
      category: 'workshop',
      speakerName: 'Guest',
      mode: 'online',
      meetingLink: 'https://meet.google.com/guest',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      capacity: 10
    });
    expect(guestCreate.status).toBe(401);

    // 2. Attendee cannot create event
    const attCreate = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${attendeeTokens[0]}`)
      .send({
        title: 'Attendee Event',
        description: 'Should fail',
        category: 'workshop',
        speakerName: 'Attendee',
        mode: 'online',
        meetingLink: 'https://meet.google.com/att',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        capacity: 10
      });
    expect(attCreate.status).toBe(403);

    // 3. Organizer A creates event
    const orgACreate = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({
        title: 'Organizer A Event',
        description: 'Owner is Org A',
        category: 'workshop',
        speakerName: 'Speaker A',
        mode: 'online',
        meetingLink: 'https://meet.google.com/orga',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        capacity: 10
      });
    expect(orgACreate.status).toBe(201);
    const eventId = orgACreate.body.data._id;

    // 4. Organizer B cannot edit Organizer A's event
    const orgBEdit = await request(app)
      .put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${organizerBToken}`)
      .send({ title: 'Hacked by Org B' });
    expect(orgBEdit.status).toBe(403);

    // 5. Organizer B cannot delete Organizer A's event
    const orgBDelete = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${organizerBToken}`);
    expect(orgBDelete.status).toBe(403);

    // 6. Organizer A can update their own event
    const orgAEdit = await request(app)
      .put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({ title: 'Organizer A Event (Updated)' });
    expect(orgAEdit.status).toBe(200);
    expect(orgAEdit.body.data.title).toBe('Organizer A Event (Updated)');

    // 7. Admin can update any event
    const adminEdit = await request(app)
      .put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Modified Event' });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.title).toBe('Admin Modified Event');

    // 8. Admin can delete any event
    const adminDelete = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDelete.status).toBe(200);
  });

  // -------------------------------------------------------------
  // (d) QR attendance rules
  // -------------------------------------------------------------
  it('(d) QR attendance rules: window enforcement, non-owner rejection, invalid token, valid scan, and duplicate scan 409', async () => {
    const now = Date.now();

    // Event 1: Currently within attendance window [startTime - 60m, endTime + 120m]
    const liveEvent = await Event.create({
      title: 'Live QR Event',
      description: 'Active event for scanner testing',
      category: 'workshop',
      speakerName: 'Dr. Live',
      mode: 'offline',
      venue: 'Main Hall',
      startTime: new Date(now - 10 * 60000), // started 10m ago
      endTime: new Date(now + 50 * 60000), // ends in 50m
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizerAId
    });

    const regLive = await Registration.create({
      user: attendeeIds[0],
      event: liveEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: 'valid-live-token-123456789012345678901234567890123456789012345678'
    });

    // Event 2: Outside window (starts tomorrow)
    const futureEvent = await Event.create({
      title: 'Future Event',
      description: 'Too early for check in',
      category: 'workshop',
      speakerName: 'Dr. Future',
      mode: 'offline',
      venue: 'Room 202',
      startTime: new Date(now + 24 * 3600000), // tomorrow
      endTime: new Date(now + 26 * 3600000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizerAId
    });

    const regFuture = await Registration.create({
      user: attendeeIds[1],
      event: futureEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: 'future-event-token-12345678901234567890123456789012345678901234'
    });

    // Check 1: Non-owner organizer (Org B) cannot scan Org A's event
    const nonOwnerScan = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizerBToken}`)
      .send({ eventId: liveEvent._id.toString(), qrToken: regLive.qrToken });
    expect(nonOwnerScan.status).toBe(403);

    // Check 2: Token for a different event gives 400
    const wrongEventScan = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({ eventId: liveEvent._id.toString(), qrToken: regFuture.qrToken });
    expect(wrongEventScan.status).toBe(400);

    // Check 3: Scan outside the attendance window gives 409 OUTSIDE_ATTENDANCE_WINDOW
    const outsideWindowScan = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({ eventId: futureEvent._id.toString(), qrToken: regFuture.qrToken });
    expect(outsideWindowScan.status).toBe(409);
    expect(outsideWindowScan.body.error.code).toBe('OUTSIDE_ATTENDANCE_WINDOW');

    // Check 4: Valid scan marks attended once
    const validScan = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({ eventId: liveEvent._id.toString(), qrToken: regLive.qrToken });
    expect(validScan.status).toBe(200);
    expect(validScan.body.data.attendedAt).toBeDefined();
    const updatedLiveReg = await Registration.findById(regLive._id);
    expect(updatedLiveReg.attended).toBe(true);

    // Check 5: Second scan gives 409 ALREADY_ATTENDED
    const dupScan = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({ eventId: liveEvent._id.toString(), qrToken: regLive.qrToken });
    expect(dupScan.status).toBe(409);
    expect(dupScan.body.error.code).toBe('ALREADY_ATTENDED');
  });

  // -------------------------------------------------------------
  // (e) Feedback and certificate eligibility
  // -------------------------------------------------------------
  it('(e) Feedback and certificate eligibility: requires attended + completed event, blocks unattended/early, enforces single feedback', async () => {
    const now = Date.now();

    // Event A: Completed event (ended 2 hours ago)
    const completedEvent = await Event.create({
      title: 'Completed Workshop',
      description: 'Event has ended',
      category: 'workshop',
      speakerName: 'Dr. Past',
      mode: 'online',
      meetingLink: 'https://meet.google.com/past',
      startTime: new Date(now - 4 * 3600000),
      endTime: new Date(now - 2 * 3600000),
      capacity: 10,
      confirmedCount: 2,
      status: 'published',
      createdBy: organizerAId
    });

    // Attendee 0: attended completed event
    const regAttended = await Registration.create({
      user: attendeeIds[0],
      event: completedEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 3 * 3600000),
      qrToken: 'comp-attended-token-11111111111111111111111111111111111111111111'
    });

    // Attendee 1: registered but did NOT attend completed event
    const regUnattended = await Registration.create({
      user: attendeeIds[1],
      event: completedEvent._id,
      status: 'confirmed',
      attended: false,
      qrToken: 'comp-unattended-token-22222222222222222222222222222222222222222222'
    });

    // Event B: Ongoing event (not ended yet)
    const ongoingEvent = await Event.create({
      title: 'Ongoing Workshop',
      description: 'Event currently in session',
      category: 'workshop',
      speakerName: 'Dr. Ongoing',
      mode: 'online',
      meetingLink: 'https://meet.google.com/ongoing',
      startTime: new Date(now - 1 * 3600000),
      endTime: new Date(now + 1 * 3600000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizerAId
    });

    // Attendee 0 attended ongoing event
    const regOngoing = await Registration.create({
      user: attendeeIds[0],
      event: ongoingEvent._id,
      status: 'confirmed',
      attended: true,
      attendedAt: new Date(now - 30 * 60000),
      qrToken: 'ong-attended-token-33333333333333333333333333333333333333333333'
    });

    // Certificate Check 1: Early certificate request before event endTime returns 403 NOT_ELIGIBLE
    const earlyCert = await request(app)
      .get(`/api/registrations/${regOngoing._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeTokens[0]}`);
    expect(earlyCert.status).toBe(403);
    expect(earlyCert.body.error.code).toBe('NOT_ELIGIBLE');

    // Certificate Check 2: Unattended registrant on completed event returns 403 NOT_ELIGIBLE
    const unattendedCert = await request(app)
      .get(`/api/registrations/${regUnattended._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeTokens[1]}`);
    expect(unattendedCert.status).toBe(403);
    expect(unattendedCert.body.error.code).toBe('NOT_ELIGIBLE');

    // Certificate Check 3: Attended registrant on completed event returns 200 PDF
    const validCert = await request(app)
      .get(`/api/registrations/${regAttended._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeTokens[0]}`);
    expect(validCert.status).toBe(200);
    expect(validCert.headers['content-type']).toContain('application/pdf');

    // Feedback Check 1: Unattended registrant cannot submit feedback (403)
    const unattendedFeedback = await request(app)
      .post(`/api/events/${completedEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendeeTokens[1]}`)
      .send({ rating: 5, comment: 'Did not attend but want to rate' });
    expect(unattendedFeedback.status).toBe(403);

    // Feedback Check 2: Attended registrant on ongoing event cannot submit feedback yet (400/403)
    const earlyFeedback = await request(app)
      .post(`/api/events/${ongoingEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendeeTokens[0]}`)
      .send({ rating: 5, comment: 'Premature rating' });
    expect([400, 403]).toContain(earlyFeedback.status);

    // Feedback Check 3: Attended registrant on completed event succeeds (201)
    const validFeedback = await request(app)
      .post(`/api/events/${completedEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendeeTokens[0]}`)
      .send({ rating: 5, comment: 'Superb seminar with actionable insights!' });
    expect(validFeedback.status).toBe(201);
    expect(validFeedback.body.data.rating).toBe(5);

    // Feedback Check 4: Duplicate feedback from same user returns 409
    const dupFeedback = await request(app)
      .post(`/api/events/${completedEvent._id}/feedback`)
      .set('Authorization', `Bearer ${attendeeTokens[0]}`)
      .send({ rating: 4, comment: 'Second review' });
    expect(dupFeedback.status).toBe(409);
    expect(dupFeedback.body.error.code).toBe('ALREADY_REVIEWED');
  });

  // -------------------------------------------------------------
  // (f) Validation error envelope shape
  // -------------------------------------------------------------
  it('(f) Validation error envelope shape: returns { success: false, error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }', async () => {
    // Submit invalid event with invalid capacity (-5), endTime < startTime, missing category
    const badEventRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerAToken}`)
      .send({
        title: 'B', // too short (min 3)
        description: 'Short',
        capacity: -5,
        startTime: 'not-a-date',
        endTime: 'not-a-date'
      });

    expect(badEventRes.status).toBe(400);
    expect(badEventRes.body.success).toBe(false);
    expect(badEventRes.body.error).toBeDefined();
    expect(badEventRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof badEventRes.body.error.message).toBe('string');
    expect(Array.isArray(badEventRes.body.error.details)).toBe(true);
    expect(badEventRes.body.error.details.length).toBeGreaterThan(0);

    // Verify detail elements have path and message
    const firstIssue = badEventRes.body.error.details[0];
    expect(firstIssue).toHaveProperty('message');
  });
});
