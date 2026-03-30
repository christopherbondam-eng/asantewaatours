'use strict';

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const morgan     = require('morgan');
const path       = require('path');

const logger      = require('./utils/logger');
const routes      = require('./routes/index');
const { apiLimiter } = require('./middleware/ratelimit.middleware');

// Initialise DB (runs schema on boot)
require('./config/database');

// Start scheduled jobs
require('./services/cron.service');

// ─── App ──────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security headers ─────────────────────────────────────────────────────────

app.set('trust proxy', 1); // Trust first proxy (Nginx / Render / Railway)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  // Add production domains here
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser clients (curl, Postman) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Stripe webhook (must come before json middleware, needs raw body) ─────────

if (process.env.STRIPE_SECRET_KEY) {
  const { handleWebhook } = require('./services/payment.service');
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleWebhook);
}

// ─── Body parsing & compression ───────────────────────────────────────────────

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Request logging ──────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/api/health',
  }));
}

// ─── Static uploads ───────────────────────────────────────────────────────────

app.use('/uploads', express.static(path.resolve('./uploads'), {
  maxAge: '7d',
  etag: true,
}));

// ─── API ──────────────────────────────────────────────────────────────────────

app.use('/api', apiLimiter, routes);

// ─── Root ─────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.json({
  name: "Asantewaa's Tour API",
  version: '1.0.0',
  docs: '/api/health',
  🇬🇭: 'Akwaaba!',
}));

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found.` }),
);

// ─── Global error handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(err.stack || err.message);
  if (err.message?.startsWith('CORS')) return res.status(403).json({ success: false, message: err.message });
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error.'
    : (err.message || 'Internal server error.');
  return res.status(status).json({ success: false, message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════╗
║   🇬🇭  Asantewaa's Tour API               ║
║   Port:   ${String(PORT).padEnd(32)}║
║   Env:    ${String(process.env.NODE_ENV || 'development').padEnd(32)}║
╚═══════════════════════════════════════════╝`);
});

module.exports = app; // for tests
