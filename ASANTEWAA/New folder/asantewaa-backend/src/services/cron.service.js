'use strict';

/**
 * Scheduled jobs — run on server boot alongside Express.
 * Handles: booking reminders, stale booking cleanup, daily digest.
 */

const cron         = require('node-cron');
const db           = require('../config/database');
const emailService = require('./email.service');
const logger       = require('../utils/logger');

// ─── Job: Send travel reminder 48h before tour ────────────────────────────────

cron.schedule('0 8 * * *', async () => {
  logger.info('⏰ CRON: Checking for upcoming tour reminders...');

  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const targetDate = twoDaysFromNow.toISOString().split('T')[0];

  const upcoming = db.prepare(`
    SELECT * FROM bookings
    WHERE travel_date = ?
      AND status = 'confirmed'
      AND payment_status IN ('paid', 'partial')
  `).all(targetDate);

  for (const booking of upcoming) {
    await emailService.send({
      to: booking.email,
      subject: `🌍 Your Ghana adventure starts in 2 days! — ${booking.reference}`,
      html: emailService.templates.bookingConfirmation({
        ...booking,
        // Reuse template but override message emphasis
      }).html.replace(
        'Thank you for choosing',
        '🎒 Pack your bags! Your tour starts in 48 hours. Thank you for choosing'
      ),
    }).catch(() => {});

    logger.info(`📧 48h reminder sent → ${booking.email} (${booking.reference})`);
  }
}, { timezone: 'Africa/Accra' });

// ─── Job: Flag stale pending bookings (7+ days old) ──────────────────────────

cron.schedule('0 9 * * 1', () => {
  // Every Monday at 9am Ghana time
  const stale = db.prepare(`
    SELECT COUNT(*) AS n FROM bookings
    WHERE status = 'pending'
      AND datetime(created_at) < datetime('now', '-7 days')
  `).get();

  if (stale.n > 0) {
    logger.warn(`⚠️  ${stale.n} pending bookings older than 7 days — follow up needed`);

    emailService.send({
      to: process.env.EMAIL_TO_OWNER,
      subject: `⚠️ ${stale.n} stale booking(s) need follow-up`,
      html: `
        <p>Hi Yaa,</p>
        <p>You have <strong>${stale.n}</strong> booking request(s) that have been pending for over 7 days without confirmation.</p>
        <p>Please log into your admin panel to review and follow up.</p>
        <p>– Asantewaa Tour System</p>
      `,
    }).catch(() => {});
  }
}, { timezone: 'Africa/Accra' });

// ─── Job: Daily digest to owner ───────────────────────────────────────────────

cron.schedule('0 7 * * *', () => {
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    new_bookings:   db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE date(created_at) = date('now', 'localtime')").get().n,
    pending_total:  db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'").get().n,
    todays_tours:   db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE travel_date = ? AND status = 'confirmed'").get(today).n,
    new_enquiries:  db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE date(created_at) = date('now', 'localtime')").get().n,
    new_subscribers:db.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE date(created_at) = date('now', 'localtime')").get().n,
  };

  if (stats.new_bookings === 0 && stats.new_enquiries === 0) return; // Nothing to report

  emailService.send({
    to: process.env.EMAIL_TO_OWNER,
    subject: `📊 Daily Summary — ${today}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#D4AF37">Daily Summary 🇬🇭</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #eee">New bookings today</td><td style="font-weight:bold;text-align:right">${stats.new_bookings}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Total pending bookings</td><td style="font-weight:bold;text-align:right;color:${stats.pending_total > 5 ? '#e53e3e' : '#333'}">${stats.pending_total}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Tours happening today</td><td style="font-weight:bold;text-align:right">${stats.todays_tours}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">New enquiries</td><td style="font-weight:bold;text-align:right">${stats.new_enquiries}</td></tr>
          <tr><td style="padding:8px">New subscribers</td><td style="font-weight:bold;text-align:right">${stats.new_subscribers}</td></tr>
        </table>
        <p style="margin-top:16px;color:#888;font-size:12px">Asantewaa's Tour System — ${new Date().toLocaleString('en-GH', { timeZone: 'Africa/Accra' })}</p>
      </div>
    `,
  }).catch(() => {});

  logger.info('📊 Daily digest sent to owner');
}, { timezone: 'Africa/Accra' });

logger.info('⏰ Cron jobs scheduled (timezone: Africa/Accra)');

module.exports = {}; // just importing this file activates the jobs
