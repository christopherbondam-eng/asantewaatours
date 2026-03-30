'use strict';

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

/**
 * Verifies Bearer JWT and attaches req.admin
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token)
    return res.status(401).json({ success: false, message: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'asantewaa-tour' });

    // Verify admin still exists in DB (handles revocation via DB deletion)
    const admin = db.prepare('SELECT id, name, email, role FROM admins WHERE id = ?').get(payload.id);
    if (!admin) return res.status(401).json({ success: false, message: 'Account not found.' });

    req.admin = admin;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }
}

/**
 * Requires super role for sensitive operations
 */
function requireSuper(req, res, next) {
  if (req.admin?.role !== 'super')
    return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
  next();
}

module.exports = { requireAuth, requireSuper };
