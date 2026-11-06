import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';

let mongod;
let attendeeUser, attendeeToken;
let organizer1User, organizer1Token;
let organizer2User, organizer2Token;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Attendee
  attendeeUser = await User.create({
    name: 'Diligent Student',
    email: 'student@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'attendee'
  });
  const attRes = await request(app).post('/api/auth/login').send({ email: 'student@test.com', password: 'pass12345' });
  attendeeToken = attRes.body.data.token;

  // Organizer 1 (owner)
  organizer1User = await User.create({
    name: 'Organizer Alpha',
    email: 'alpha@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  const org1Res = await request(app).post('/api/auth/login').send({ email: 'alpha@test.com', password: 'pass12345' });
  organizer1Token = org1Res.body.data.token;

  // Organizer 2 (non-owner)
  organizer2User = await User.create({
    name: 'Organizer Beta',
    email: 'beta@test.com',
    passwordHash: await User.hashPassword('pass12345'),
    role: 'organizer'
  });
  const org2Res = await request(app).post('/api/auth/login').send({ email: 'beta@test.com', password: 'pass12345' });
  organizer2Token = org2Res.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 4: QR Attendance and Certificates', () => {
  let liveEvent, completedEvent, outsideWindowEvent;
  let liveReg, outsideWindowReg, otherEvent, otherReg;

  beforeAll(async () => {
    const now = Date.now();

    // 1. Live event (currently in progress: started 10 mins ago, ends in 50 mins)
    liveEvent = await Event.create({
      title: 'Realtime Distributed Systems',
      description: 'Hands-on session on distributed streaming.',
      category: 'workshop',
      speakerName: 'Prof. Distributed',
      mode: 'online',
      meetingLink: 'https://meet.google.com/live',
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 50 * 60 * 1000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizer1User._id
    });

    // Confirmed registration for live event
    liveReg = await Registration.create({
      user: attendeeUser._id,
      event: liveEvent._id,
      status: 'confirmed',
      qrToken: '1111111111111111111111111111111111111111111111111111111111111111',
      attended: false
    });

    // 2. Event far in future (outside check-in window: starts in 3 days)
    outsideWindowEvent = await Event.create({
      title: 'Future Quantum Computing',
      description: 'Quantum circuits deep dive.',
      category: 'conference',
      speakerName: 'Dr. Quantum',
      mode: 'online',
      meetingLink: 'https://meet.google.com/future',
      startTime: new Date(now + 3 * 86400000),
      endTime: new Date(now + 3 * 86400000 + 3600000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizer1User._id
    });

    outsideWindowReg = await Registration.create({
      user: attendeeUser._id,
      event: outsideWindowEvent._id,
      status: 'confirmed',
      qrToken: '2222222222222222222222222222222222222222222222222222222222222222',
      attended: false
    });

    // 3. Different event (to test WRONG_EVENT)
    otherEvent = await Event.create({
      title: 'Unrelated Seminar',
      description: 'Unrelated topics.',
      category: 'seminar',
      speakerName: 'Dr. Other',
      mode: 'online',
      meetingLink: 'https://meet.google.com/other',
      startTime: new Date(now - 10 * 60 * 1000),
      endTime: new Date(now + 50 * 60 * 1000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizer1User._id
    });

    otherReg = await Registration.create({
      user: attendeeUser._id,
      event: otherEvent._id,
      status: 'confirmed',
      qrToken: '3333333333333333333333333333333333333333333333333333333333333333',
      attended: false
    });

    // 4. Completed event (ended yesterday)
    completedEvent = await Event.create({
      title: 'Past Completed Workshop',
      description: 'Already finished event.',
      category: 'workshop',
      speakerName: 'Prof. History',
      mode: 'online',
      meetingLink: 'https://meet.google.com/past',
      startTime: new Date(now - 86400000),
      endTime: new Date(now - 82800000),
      capacity: 10,
      confirmedCount: 1,
      status: 'published',
      createdBy: organizer1User._id
    });
  });

  it('generates QR code data URL for confirmed registration', async () => {
    const res = await request(app)
      .get(`/api/registrations/${liveReg._id}/qr`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects scan from non-owner organizer with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizer2Token}`)
      .send({
        eventId: liveEvent._id.toString(),
        qrToken: liveReg.qrToken
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects scan with wrong event token with 400 WRONG_EVENT', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        eventId: liveEvent._id.toString(),
        qrToken: otherReg.qrToken // Token belongs to otherEvent!
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_EVENT');
  });

  it('rejects scan outside attendance window with 409 OUTSIDE_ATTENDANCE_WINDOW', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        eventId: outsideWindowEvent._id.toString(),
        qrToken: outsideWindowReg.qrToken
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUTSIDE_ATTENDANCE_WINDOW');
  });

  it('successfully scans valid token within window and marks attended', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        eventId: liveEvent._id.toString(),
        qrToken: liveReg.qrToken
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe(attendeeUser.name);
    expect(res.body.data.attendedAt).toBeDefined();

    const reg = await Registration.findById(liveReg._id);
    expect(reg.attended).toBe(true);
  });

  it('rejects repeated scan with 409 ALREADY_ATTENDED', async () => {
    const res = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${organizer1Token}`)
      .send({
        eventId: liveEvent._id.toString(),
        qrToken: liveReg.qrToken
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ATTENDED');
  });

  it('rejects certificate request when event is not yet completed or not attended with 403 NOT_ELIGIBLE', async () => {
    // 1. liveReg is attended, but event has not ended yet
    const res1 = await request(app)
      .get(`/api/registrations/${liveReg._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(res1.status).toBe(403);
    expect(res1.body.error.code).toBe('NOT_ELIGIBLE');

    // 2. Unattended completed event
    const completedUnattendedReg = await Registration.create({
      user: attendeeUser._id,
      event: completedEvent._id,
      status: 'confirmed',
      attended: false
    });

    const res2 = await request(app)
      .get(`/api/registrations/${completedUnattendedReg._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(res2.status).toBe(403);
    expect(res2.body.error.code).toBe('NOT_ELIGIBLE');
  });

  it('streams valid landscape A4 PDF certificate when eligible', async () => {
    // Find the completed registration from previous test and mark attended
    const reg = await Registration.findOne({
      user: attendeeUser._id,
      event: completedEvent._id
    });
    reg.attended = true;
    reg.attendedAt = new Date(Date.now() - 83000000);
    await reg.save();

    const res = await request(app)
      .get(`/api/registrations/${reg._id}/certificate`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(`certificate-${reg._id}.pdf`);
    expect(res.body).toBeInstanceOf(Buffer);
    // PDF Magic bytes check (%PDF-)
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
