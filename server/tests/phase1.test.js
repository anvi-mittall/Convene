import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { seedAdmin } from '../src/scripts/seed.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 1: Foundation and Auth', () => {
  it('registers a user successfully and ignores client-provided role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'admin' // Attempt to inject admin role
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('jane@example.com');
    expect(res.body.data.user.role).toBe('attendee'); // Forced to attendee
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409 EMAIL_TAKEN', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Clone',
        email: 'jane@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in registered user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('jane@example.com');
  });

  it('rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane@example.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('authenticates and fetches current user via /auth/me', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jane@example.com',
        password: 'password123'
      });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe('jane@example.com');
  });

  it('blocks unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('seeds admin idempotently', async () => {
    const admin = await seedAdmin();
    expect(admin.role).toBe('admin');
    expect(admin.email).toBe('admin@convene.com');

    // Run again to verify idempotency
    const reseed = await seedAdmin();
    expect(reseed.email).toBe(admin.email);
  });
});
