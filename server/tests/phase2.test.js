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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongod;
let attendeeToken;
let organizer1Token;
let organizer1Id;
let organizer2Token;
let adminToken;
let adminId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // 1. Create attendee
  const att = await User.create({
    name: 'Attendee User',
    email: 'att@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'attendee'
  });
  const attRes = await request(app).post('/api/auth/login').send({ email: 'att@test.com', password: 'pass12345' });
  attendeeToken = attRes.body.data.token;

  // 2. Create organizer 1
  const org1 = await User.create({
    name: 'Organizer One',
    email: 'org1@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  organizer1Id = org1._id.toString();
  const org1Res = await request(app).post('/api/auth/login').send({ email: 'org1@test.com', password: 'pass12345' });
  organizer1Token = org1Res.body.data.token;

  // 3. Create organizer 2
  await User.create({
    name: 'Organizer Two',
    email: 'org2@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  const org2Res = await request(app).post('/api/auth/login').send({ email: 'org2@test.com', password: 'pass12345' });
  organizer2Token = org2Res.body.data.token;

  // 4. Create admin
  const adm = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'admin'
  });
  adminId = adm._id.toString();
  const admRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'pass12345' });
  adminToken = admRes.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 2: Events Management, Search, and Promotion', () => {
  let createdEventId;

  it('rejects event creation from attendee with 403 FORBIDDEN', async () => {
    const startTime = new Date(Date.now() + 86400000).toISOString();
    const endTime = new Date(Date.now() + 90000000).toISOString();

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({
        title: 'Attendee Attempt',
        description: 'Should be rejected immediately',
        category: 'workshop',
        speakerName: 'Jane Doe',
        mode: 'online',
        meetingLink: 'https://meet.google.com/xyz',
        startTime,
        endTime,
        capacity: 50
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates event creation fields strictly (past date, end before start, missing venue)', async () => {
    const now = Date.now();
    const pastTime = new Date(now - 10000).toISOString();
    const futureTime = new Date(now + 86400000).toISOString();

    // 1. Past start time
    const res1 = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        title: 'Past Event',
        description: 'Should reject past start time',
        category: 'workshop',
        speakerName: 'Dr. Who',
        mode: 'online',
        meetingLink: 'https://meet.google.com/xyz',
        startTime: pastTime,
        endTime: futureTime,
        capacity: 20
      });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // 2. End time before start time
    const res2 = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        title: 'Invalid Times',
        description: 'Should reject endTime before startTime',
        category: 'workshop',
        speakerName: 'Dr. Who',
        mode: 'online',
        meetingLink: 'https://meet.google.com/xyz',
        startTime: new Date(now + 100000).toISOString(),
        endTime: new Date(now + 50000).toISOString(),
        capacity: 20
      });
    expect(res2.status).toBe(400);

    // 3. Offline without venue
    const res3 = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        title: 'Offline Event',
        description: 'Should reject missing venue for offline',
        category: 'seminar',
        speakerName: 'Dr. Who',
        mode: 'offline',
        startTime: new Date(now + 86400000).toISOString(),
        endTime: new Date(now + 90000000).toISOString(),
        capacity: 20
      });
    expect(res3.status).toBe(400);
  });

  it('allows organizer to create a valid event with poster upload', async () => {
    const dummyPoster = path.resolve(__dirname, 'test-poster.png');
    fs.writeFileSync(dummyPoster, Buffer.from('fake-png-content'));

    const startTime = new Date(Date.now() + 86400000).toISOString();
    const endTime = new Date(Date.now() + 90000000).toISOString();

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .field('title', 'Advanced Cloud Architectures')
      .field('description', 'Comprehensive guide to scaling cloud applications.')
      .field('category', 'workshop')
      .field('speakerName', 'Alice Cloud')
      .field('mode', 'offline')
      .field('venue', 'Hall 3, Tech Park')
      .field('startTime', startTime)
      .field('endTime', endTime)
      .field('capacity', '100')
      .attach('poster', dummyPoster);

    fs.unlinkSync(dummyPoster);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Advanced Cloud Architectures');
    expect(res.body.data.phase).toBe('upcoming');
    expect(res.body.data.seatsLeft).toBe(100);
    expect(res.body.data.posterUrl).toMatch(/^\/uploads\/posters\//);

    createdEventId = res.body.data._id;
  });

  it('serves poster statically with Cross-Origin-Resource-Policy header', async () => {
    const event = await Event.findById(createdEventId);
    expect(event.posterUrl).toBeDefined();

    const res = await request(app).get(event.posterUrl);
    expect(res.status).toBe(200);
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('prevents organizer 2 from editing organizer 1 event with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .put(`/api/events/${createdEventId}`)
      .set('Authorization', `Bearer ${organizer2Token}`)
      .send({
        title: 'Hacked Title'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows owner or admin to update the event', async () => {
    const res = await request(app)
      .put(`/api/events/${createdEventId}`)
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        title: 'Advanced Cloud Architectures & Kubernetes'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Advanced Cloud Architectures & Kubernetes');
  });

  it('filters, searches, and paginates published events', async () => {
    const res = await request(app)
      .get('/api/events')
      .query({ q: 'Kubernetes', category: 'workshop', phase: 'upcoming' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]._id).toBe(createdEventId);
  });

  it('promotes an attendee to organizer via admin endpoint', async () => {
    const att = await User.findOne({ email: 'att@test.com' });

    const res = await request(app)
      .patch(`/api/admin/users/${att._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'organizer' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('organizer');

    // Verify attendee can now create events
    const updatedAttToken = (await request(app).post('/api/auth/login').send({ email: 'att@test.com', password: 'pass12345' })).body.data.token;
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${updatedAttToken}`)
      .send({
        title: 'Newly Promoted Event',
        description: 'Created by newly promoted organizer.',
        category: 'seminar',
        speakerName: 'Jane Doe',
        mode: 'online',
        meetingLink: 'https://meet.google.com/abc',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        capacity: 30
      });

    expect(createRes.status).toBe(201);
  });
});
