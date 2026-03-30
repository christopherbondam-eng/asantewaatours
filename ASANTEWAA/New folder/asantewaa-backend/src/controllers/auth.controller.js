'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET  = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());

    // Constant-time check even when admin not found (prevent timing attacks)
    const hash = admin?.password_hash ?? '$2a$10$placeholder_hash_to_prevent_timing';
    const valid = await bcrypt.compare(password, hash);

    if (!admin || !valid) {
      logger.warn(`Failed login attempt: ${email} from ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES, issuer: "asantewaa-tour" },
    );

    // Update last login
    db.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").run(admin.id);

    logger.info(`🔐 Admin login: ${admin.email}`);

    return res.json({
      success: true,
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    logger.error('login error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
}

// ─── Register first admin (setup only, requires ADMIN_SECRET_KEY) ─────────────

async function registerAdmin(req, res) {
  try {
    const { name, email, password, secret } = req.body;

    if (secret !== process.env.ADMIN_SECRET_KEY)
      return res.status(403).json({ success: false, message: 'Invalid setup key.' });

    const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ success: false, message: 'Admin already exists.' });

    const password_hash = await bcrypt.hash(password, 12);
    const id = require('crypto').randomBytes(8).toString('hex');

    db.prepare(`
      INSERT INTO admins (id, name, email, password_hash, role)
      VALUES (@id, @name, @email, @password_hash, 'super')
    `).run({ id, name, email: email.toLowerCase(), password_hash });

    logger.info(`👤 Admin registered: ${email}`);
    return res.status(201).json({ success: true, message: 'Admin created. You can now log in.' });
  } catch (err) {
    logger.error('registerAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
}

// ─── Me ───────────────────────────────────────────────────────────────────────

function me(req, res) {
  return res.json({ success: true, admin: req.admin });
}

module.exports = { login, registerAdmin, me };
