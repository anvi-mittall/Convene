import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';

let mongod;
let organizerToken;
let organizerId;
let userTokens = [];
let userIds = [];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create organizer
  const org = await User.create({
    name: 'Event Host',
    email: 'host@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  organizerId = org._id.toString();
  const orgLogin = await request(app).post('/api/auth/login').send({ email: 'host@test.com', password: 'pass12345' });
  organizerToken = orgLogin.body.data.token;

  // Create 25 test users for concurrency and waitlist testing
  for (let i = 1; i <= 25; i++) {
    const u = await User.create({
      name: `User ${i}`,
      email: `user${i}@test.com`,
      passwordHash: await User.hashPassword('pass12345'),
      role: 'attendee'
    });
    userIds.push(u._id.toString());
    const loginRes = await request(app).post('/api/auth/login').send({ email: `user${i}@test.com`, password: 'pass12345' });
    userTokens.push(loginRes.body.data.token);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 3: Registration Engine, Atomic Capacity & Waitlist', () => {
  it('capacity 1 event: User A confirmed, User B waitlisted, A cancels -> B promoted automatically', async () => {
    // 1. Create event with capacity 1
    const event = await Event.create({
      title: 'Solo Workshop',
      description: 'Single seat workshop for testing',
      category: 'workshop',
      speakerName: 'Dr. Single',
      mode: 'online',
      meetingLink: 'https://meet.google.com/test',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      capacity: 1,
      confirmedCount: 0,
      status: 'published',
      createdBy: organizerId
    });

    // 2. User 0 registers -> should be confirmed
    const regA = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${userTokens[0]}`);

    expect(regA.status).toBe(201);
    expect(regA.body.data.status).toBe('confirmed');
    expect(regA.body.data.qrToken).toBeDefined();

    // 3. User 1 registers -> should be waitlisted
    const regB = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${userTokens[1]}`);

    expect(regB.status).toBe(201);
    expect(regB.body.data.status).toBe('waitlisted');
    expect(regB.body.data.qrToken).toBeUndefined();

    // Verify event confirmedCount is 1
    const evAfterB = await Event.findById(event._id);
    expect(evAfterB.confirmedCount).toBe(1);

    // 4. User 0 cancels registration
    const cancelRes = await request(app)
      .delete(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${userTokens[0]}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // 5. User 1 should now be automatically promoted to confirmed
    const updatedRegB = await Registration.findOne({ user: userIds[1], event: event._id });
    expect(updatedRegB.status).toBe('confirmed');
    expect(updatedRegB.qrToken).toBeDefined();

    const evAfterPromote = await Event.findById(event._id);
    expect(evAfterPromote.confirmedCount).toBe(1);
  });

  it('20 concurrent register calls against capacity 5 yield exactly 5 confirmed and 15 waitlisted', async () => {
    // Create event with capacity 5
    const event = await Event.create({
      title: 'Concurrency Crucible',
      description: 'Stress testing race conditions and seat capacity',
      category: 'workshop',
      speakerName: 'Dr. Concurrency',
      mode: 'online',
      meetingLink: 'https://meet.google.com/test',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      capacity: 5,
      confirmedCount: 0,
      status: 'published',
      createdBy: organizerId
    });

    // Fire 20 parallel requests with users 0 to 19
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(app)
          .post(`/api/events/${event._id}/register`)
          .set('Authorization', `Bearer ${userTokens[i]}`)
      );
    }

    const responses = await Promise.all(promises);

    let confirmedCount = 0;
    let waitlistedCount = 0;

    for (const res of responses) {
      expect(res.status).toBe(201);
      if (res.body.data.status === 'confirmed') confirmedCount++;
      if (res.body.data.status === 'waitlisted') waitlistedCount++;
    }

    expect(confirmedCount).toBe(5);
    expect(waitlistedCount).toBe(15);

    const ev = await Event.findById(event._id);
    expect(ev.confirmedCount).toBe(5);

    const totalRegs = await Registration.countDocuments({ event: event._id });
    expect(totalRegs).toBe(20);
  });

  it('rejects duplicate registration with 409 ALREADY_REGISTERED', async () => {
    const event = await Event.findOne({ title: 'Concurrency Crucible' });

    const dupRes = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set('Authorization', `Bearer ${userTokens[0]}`);

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('ALREADY_REGISTERED');
  });

  it('rejects registration for started and cancelled events', async () => {
    // 1. Started event
    const startedEvent = await Event.create({
      title: 'Already Started',
      description: 'Started event',
      category: 'seminar',
      speakerName: 'Time Traveler',
      mode: 'online',
      meetingLink: 'https://meet.google.com/test',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      capacity: 10,
      confirmedCount: 0,
      status: 'published',
      createdBy: organizerId
    });

    const resStarted = await request(app)
      .post(`/api/events/${startedEvent._id}/register`)
      .set('Authorization', `Bearer ${userTokens[0]}`);

    expect(resStarted.status).toBe(409);
    expect(resStarted.body.error.code).toBe('EVENT_STARTED');

    // 2. Cancelled event
    const cancelledEvent = await Event.create({
      title: 'Cancelled Seminar',
      description: 'Cancelled event',
      category: 'seminar',
      speakerName: 'Nobody',
      mode: 'online',
      meetingLink: 'https://meet.google.com/test',
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      capacity: 10,
      confirmedCount: 0,
      status: 'cancelled',
      createdBy: organizerId
    });

    const resCancelled = await request(app)
      .post(`/api/events/${cancelledEvent._id}/register`)
      .set('Authorization', `Bearer ${userTokens[0]}`);

    expect(resCancelled.status).toBe(409);
    expect(resCancelled.body.error.code).toBe('EVENT_CANCELLED');
  });

  it('organizer raising capacity promotes waitlisted attendees automatically', async () => {
    const event = await Event.findOne({ title: 'Concurrency Crucible' });
    expect(event.confirmedCount).toBe(5);

    // Increase capacity from 5 to 8
    const res = await request(app)
      .put(`/api/events/${event._id}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ capacity: 8 });

    expect(res.status).toBe(200);

    // 3 waitlisted users should have been promoted to confirmed
    const evUpdated = await Event.findById(event._id);
    expect(evUpdated.capacity).toBe(8);
    expect(evUpdated.confirmedCount).toBe(8);

    const confirmedRegs = await Registration.countDocuments({ event: event._id, status: 'confirmed' });
    expect(confirmedRegs).toBe(8);
  });

  it('cancelling an event cancels all registrations and invalidates tokens', async () => {
    const event = await Event.findOne({ title: 'Concurrency Crucible' });

    const cancelRes = await request(app)
      .post(`/api/events/${event._id}/cancel`)
      .set('Authorization', `Bearer ${organizerToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // All registrations should be cancelled and have no qrToken
    const activeRegs = await Registration.countDocuments({
      event: event._id,
      status: { $in: ['confirmed', 'waitlisted'] }
    });
    expect(activeRegs).toBe(0);

    const tokensRemaining = await Registration.countDocuments({
      event: event._id,
      qrToken: { $exists: true, $ne: null }
    });
    expect(tokensRemaining).toBe(0);
  });
});
