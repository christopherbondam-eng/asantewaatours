'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_PATH  = ':memory:'; // in-memory DB for tests
process.env.JWT_SECRET = 'test_secret_key_for_tests_only_64chars_long_yes';

const request = require('supertest');
const app     = require('../src/server');

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── Tours ────────────────────────────────────────────────────────────────────

describe('GET /api/tours', () => {
  it('returns array of tours', async () => {
    const res = await request(app).get('/api/tours');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

describe('POST /api/book', () => {
  it('creates a booking with valid data', async () => {
    const res = await request(app)
      .post('/api/book')
      .send({
        full_name:   'Kwame Asante',
        email:       'kwame@example.com',
        phone:       '+233200000001',
        tour_name:   'Accra City Experience',
        travel_date: '2025-06-15',
        travelers:   2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toMatch(/^AST-/);
  });

  it('rejects booking with missing required fields', async () => {
    const res = await request(app)
      .post('/api/book')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('rejects booking with invalid email', async () => {
    const res = await request(app)
      .post('/api/book')
      .send({
        full_name: 'Test User',
        email: 'not-an-email',
        tour_name: 'Test Tour',
        travel_date: '2025-07-01',
        travelers: 1,
      });
    expect(res.status).toBe(422);
  });
});

// ─── Contact ──────────────────────────────────────────────────────────────────

describe('POST /api/contact', () => {
  it('accepts a valid enquiry', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Ama Serwaa',
        email: 'ama@example.com',
        subject: 'Tour question',
        message: 'Do you offer private tours for families?',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── Newsletter ───────────────────────────────────────────────────────────────

describe('POST /api/subscribe', () => {
  it('subscribes a new email', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .send({ email: 'subscriber@example.com', name: 'New Fan' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('handles duplicate subscription gracefully', async () => {
    await request(app).post('/api/subscribe').send({ email: 'dup@example.com' });
    const res = await request(app).post('/api/subscribe').send({ email: 'dup@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/admin/bookings (protected)', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/bookings');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/dashboard (protected)', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
