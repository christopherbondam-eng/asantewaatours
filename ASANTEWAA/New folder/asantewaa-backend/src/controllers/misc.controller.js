'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// ─── Enquiries ────────────────────────────────────────────────────────────────

async function createEnquiry(req, res) {
  try {
    const { name, email, subject, message } = req.body;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO enquiries (id, name, email, subject, message, ip_address)
      VALUES (@id, @name, @email, @subject, @message, @ip_address)
    `).run({ id, name, email: email.toLowerCase(), subject: subject || null, message, ip_address: req.ip });

    // Alert owner
    emailService.send({
      to: process.env.EMAIL_TO_OWNER,
      subject: `💬 New Enquiry from ${name}`,
      html: `<p><b>From:</b> ${name} (${email})</p><p><b>Subject:</b> ${subject || '—'}</p><p>${message}</p>`,
    }).catch(() => {});

    logger.info(`📩 New enquiry from ${name} <${email}>`);
    return res.status(201).json({ success: true, message: 'Message received! We\'ll reply within 24 hours.' });
  } catch (err) {
    logger.error('createEnquiry error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
}

function listEnquiries(req, res) {
  try {
    const { replied, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (replied !== undefined) { where += ' AND replied = ?'; params.push(Number(replied)); }

    const total = db.prepare(`SELECT COUNT(*) AS n FROM enquiries ${where}`).get(...params).n;
    const rows  = db.prepare(`SELECT * FROM enquiries ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);

    return res.json({ success: true, data: rows, meta: { total, page: Number(page) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch enquiries.' });
  }
}

function markEnquiryReplied(req, res) {
  db.prepare('UPDATE enquiries SET replied = 1 WHERE id = ?').run(req.params.id);
  return res.json({ success: true });
}

// ─── Subscribers ──────────────────────────────────────────────────────────────

async function subscribe(req, res) {
  try {
    const { email, name } = req.body;
    const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.json({ success: true, message: 'Already subscribed — stay tuned for updates!' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO subscribers (id, email, name, confirmed)
      VALUES (@id, @email, @name, 1)
    `).run({ id, email: email.toLowerCase(), name: name || null });

    emailService.sendNewsletterWelcome({ email, name }).catch(() => {});

    logger.info(`📬 New subscriber: ${email}`);
    return res.status(201).json({ success: true, message: 'Subscribed! Akwaaba to the family! 🇬🇭' });
  } catch (err) {
    logger.error('subscribe error:', err);
    return res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
}

function listSubscribers(req, res) {
  try {
    const rows = db.prepare('SELECT id, email, name, confirmed, created_at FROM subscribers ORDER BY created_at DESC').all();
    return res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch subscribers.' });
  }
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

async function submitTestimonial(req, res) {
  try {
    const { author_name, country, rating, body, booking_id } = req.body;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO testimonials (id, booking_id, author_name, country, rating, body)
      VALUES (@id, @booking_id, @author_name, @country, @rating, @body)
    `).run({ id, booking_id: booking_id || null, author_name, country: country || null, rating: Number(rating), body });

    return res.status(201).json({ success: true, message: 'Thank you for your review! It will be published after approval.' });
  } catch (err) {
    logger.error('submitTestimonial error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
}

function listTestimonials(req, res) {
  try {
    const { featured } = req.query;
    let where = 'WHERE is_approved = 1';
    if (featured === '1') where += ' AND is_featured = 1';

    const rows = db.prepare(`SELECT * FROM testimonials ${where} ORDER BY is_featured DESC, created_at DESC LIMIT 20`).all();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch testimonials.' });
  }
}

function approveTestimonial(req, res) {
  const { id } = req.params;
  const { featured } = req.body;
  db.prepare('UPDATE testimonials SET is_approved = 1, is_featured = ? WHERE id = ?').run(featured ? 1 : 0, id);
  return res.json({ success: true, message: 'Testimonial approved.' });
}

module.exports = {
  createEnquiry, listEnquiries, markEnquiryReplied,
  subscribe, listSubscribers,
  submitTestimonial, listTestimonials, approveTestimonial,
};
