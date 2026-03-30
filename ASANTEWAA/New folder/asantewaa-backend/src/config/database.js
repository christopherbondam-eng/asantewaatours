'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || './data/asantewaa.db';

// Ensure data directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.resolve(DB_PATH), {
  verbose: process.env.NODE_ENV === 'development' ? (sql) => logger.debug(sql) : null,
});

// Performance pragmas (Meta/Google-style: WAL mode + foreign keys on)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -16000'); // 16 MB
db.pragma('temp_store = MEMORY');

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
  -- Tours catalogue
  CREATE TABLE IF NOT EXISTS tours (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    tagline     TEXT,
    description TEXT,
    duration    TEXT NOT NULL,
    price_usd   REAL NOT NULL,
    max_guests  INTEGER DEFAULT 12,
    highlights  TEXT,              -- JSON array
    inclusions  TEXT,              -- JSON array
    exclusions  TEXT,              -- JSON array
    images      TEXT DEFAULT '[]', -- JSON array of paths
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- Booking requests
  CREATE TABLE IF NOT EXISTS bookings (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
    reference       TEXT UNIQUE NOT NULL,
    tour_id         TEXT REFERENCES tours(id),
    tour_name       TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT,
    nationality     TEXT,
    travel_date     TEXT NOT NULL,
    travelers       INTEGER NOT NULL DEFAULT 1,
    special_request TEXT,
    price_quoted    REAL,
    currency        TEXT DEFAULT 'USD',
    status          TEXT DEFAULT 'pending'
                    CHECK(status IN ('pending','confirmed','cancelled','completed')),
    payment_status  TEXT DEFAULT 'unpaid'
                    CHECK(payment_status IN ('unpaid','partial','paid','refunded')),
    stripe_session  TEXT,
    notes           TEXT,          -- internal notes (JSON array)
    utm_source      TEXT,
    utm_medium      TEXT,
    ip_address      TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  -- Contact / enquiry messages
  CREATE TABLE IF NOT EXISTS enquiries (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    subject    TEXT,
    message    TEXT NOT NULL,
    replied    INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Newsletter subscribers
  CREATE TABLE IF NOT EXISTS subscribers (
    id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    email      TEXT UNIQUE NOT NULL,
    name       TEXT,
    confirmed  INTEGER DEFAULT 0,
    token      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Testimonials / reviews
  CREATE TABLE IF NOT EXISTS testimonials (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    booking_id  TEXT REFERENCES bookings(id),
    author_name TEXT NOT NULL,
    country     TEXT,
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    body        TEXT NOT NULL,
    photo_url   TEXT,
    is_featured INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Admin users
  CREATE TABLE IF NOT EXISTS admins (
    id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name         TEXT,
    role         TEXT DEFAULT 'admin' CHECK(role IN ('super','admin','viewer')),
    last_login   TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- Audit log
  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   TEXT,
    action     TEXT NOT NULL,
    entity     TEXT,
    entity_id  TEXT,
    payload    TEXT, -- JSON
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_bookings_email  ON bookings(email);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(travel_date);
  CREATE INDEX IF NOT EXISTS idx_bookings_ref    ON bookings(reference);
  CREATE INDEX IF NOT EXISTS idx_enquiries_email ON enquiries(email);
`;

db.exec(SCHEMA);
logger.info('✅ Database initialised');

module.exports = db;
