'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

// ─── Reference generator ──────────────────────────────────────────────────────

function generateReference() {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `AST-${year}-${rand}`;
}

// ─── Create booking ───────────────────────────────────────────────────────────

async function createBooking(req, res) {
  try {
    const {
      full_name, email, phone, nationality,
      tour_id, tour_name,
      travel_date, travelers, special_request,
    } = req.body;

    // Resolve price from tour catalogue
    let price_quoted = null;
    if (tour_id) {
      const tour = db.prepare('SELECT price_usd FROM tours WHERE id = ? AND is_active = 1').get(tour_id);
      if (tour) price_quoted = tour.price_usd * Number(travelers || 1);
    }

    const booking = {
      id: uuidv4(),
      reference: generateReference(),
      tour_id: tour_id || null,
      tour_name,
      full_name,
      email: email.toLowerCase().trim(),
      phone: phone || null,
      nationality: nationality || null,
      travel_date,
      travelers: Number(travelers) || 1,
      special_request: special_request || null,
      price_quoted,
      utm_source: req.body.utm_source || null,
      utm_medium: req.body.utm_medium || null,
      ip_address: req.ip,
    };

    db.prepare(`
      INSERT INTO bookings
        (id, reference, tour_id, tour_name, full_name, email, phone, nationality,
         travel_date, travelers, special_request, price_quoted, utm_source, utm_medium, ip_address)
      VALUES
        (@id, @reference, @tour_id, @tour_name, @full_name, @email, @phone, @nationality,
         @travel_date, @travelers, @special_request, @price_quoted, @utm_source, @utm_medium, @ip_address)
    `).run(booking);

    // Fire-and-forget emails (don't await — fast response to user)
    emailService.sendBookingConfirmation(booking).catch(() => {});
    emailService.sendOwnerAlert(booking).catch(() => {});

    logger.info(`📅 New booking: ${booking.reference} — ${full_name} for "${tour_name}"`);

    return res.status(201).json({
      success: true,
      message: 'Booking request received! Yaa will contact you within 24 hours.',
      data: {
        reference: booking.reference,
        status: 'pending',
        price_quoted: booking.price_quoted,
      },
    });
  } catch (err) {
    logger.error('createBooking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit booking. Please try again.' });
  }
}

// ─── Get all bookings (admin) ─────────────────────────────────────────────────

function listBookings(req, res) {
  try {
    const { status, page = 1, limit = 20, search, from, to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND b.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (b.full_name LIKE ? OR b.email LIKE ? OR b.reference LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (from) { where += ' AND b.travel_date >= ?'; params.push(from); }
    if (to)   { where += ' AND b.travel_date <= ?'; params.push(to); }

    const total = db.prepare(`SELECT COUNT(*) AS n FROM bookings b ${where}`).get(...params).n;

    const rows = db.prepare(`
      SELECT b.*, t.name AS tour_full_name, t.duration
      FROM bookings b
      LEFT JOIN tours t ON b.tour_id = t.id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    return res.json({
      success: true,
      data: rows,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    logger.error('listBookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings.' });
  }
}

// ─── Get single booking ───────────────────────────────────────────────────────

function getBooking(req, res) {
  const { id } = req.params;
  const booking = db.prepare(`
    SELECT b.*, t.name AS tour_full_name, t.duration, t.highlights
    FROM bookings b
    LEFT JOIN tours t ON b.tour_id = t.id
    WHERE b.id = ? OR b.reference = ?
  `).get(id, id.toUpperCase());

  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  return res.json({ success: true, data: booking });
}

// ─── Update booking status (admin) ───────────────────────────────────────────

async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, payment_status, notes } = req.body;

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const updates = { updated_at: new Date().toISOString() };
    const statusMessages = {
      confirmed: `Your tour "${booking.tour_name}" on ${booking.travel_date} has been CONFIRMED! Get ready for an unforgettable Ghanaian experience. 🇬🇭`,
      cancelled:  `We're sorry to inform you that your booking (${booking.reference}) has been cancelled. Please contact us if you have questions.`,
      completed:  `Thank you for choosing Asantewaa's Tour! We hope you had an amazing experience. We'd love to hear your feedback! ⭐`,
    };

    if (status) {
      updates.status = status;
      if (statusMessages[status]) {
        emailService.sendStatusUpdate({ ...booking, status }, statusMessages[status]).catch(() => {});
      }
    }
    if (payment_status) updates.payment_status = payment_status;
    if (notes) {
      const existing = booking.notes ? JSON.parse(booking.notes) : [];
      updates.notes = JSON.stringify([
        ...existing,
        { text: notes, admin_id: req.admin?.id, at: new Date().toISOString() },
      ]);
    }

    const fields = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE bookings SET ${fields} WHERE id = ?`).run({ ...updates }, id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_log (admin_id, action, entity, entity_id, payload, ip_address)
      VALUES (?, 'update_booking', 'booking', ?, ?, ?)
    `).run(req.admin?.id || 'system', id, JSON.stringify({ status, payment_status }), req.ip);

    return res.json({ success: true, message: 'Booking updated.' });
  } catch (err) {
    logger.error('updateBookingStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update booking.' });
  }
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

function getDashboardStats(req, res) {
  try {
    const stats = {
      bookings: {
        total:     db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n,
        pending:   db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'").get().n,
        confirmed: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed'").get().n,
        completed: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'completed'").get().n,
        this_month: db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").get().n,
      },
      revenue: {
        total_quoted: db.prepare("SELECT COALESCE(SUM(price_quoted),0) AS n FROM bookings WHERE status != 'cancelled'").get().n,
        paid:         db.prepare("SELECT COALESCE(SUM(price_quoted),0) AS n FROM bookings WHERE payment_status = 'paid'").get().n,
      },
      tours: {
        popular: db.prepare(`
          SELECT tour_name, COUNT(*) AS bookings_count
          FROM bookings
          GROUP BY tour_name
          ORDER BY bookings_count DESC
          LIMIT 5
        `).all(),
      },
      enquiries: {
        unread: db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE replied = 0").get().n,
      },
      subscribers: {
        total: db.prepare("SELECT COUNT(*) AS n FROM subscribers").get().n,
      },
      recent_bookings: db.prepare(`
        SELECT reference, full_name, tour_name, travel_date, status, created_at
        FROM bookings ORDER BY created_at DESC LIMIT 5
      `).all(),
    };

    return res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('getDashboardStats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
}

module.exports = { createBooking, listBookings, getBooking, updateBookingStatus, getDashboardStats };
