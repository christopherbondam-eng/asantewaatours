'use strict';

const rateLimit = require('express-rate-limit');

// ─── Standard API limiter ──────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1', // skip localhost
});

// ─── Strict limiter for booking/contact forms ─────────────────────────────────
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many form submissions from this IP. Please try again later.' },
});

// ─── Auth limiter ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

module.exports = { apiLimiter, formLimiter, authLimiter };
