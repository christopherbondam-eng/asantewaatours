'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// ─── Transport ────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});

// Verify on startup (graceful — won't crash if SMTP not configured)
transporter.verify().then(() => logger.info('✅ Email transport ready')).catch((e) => logger.warn('⚠️  Email transport not configured:', e.message));

// ─── Base layout ──────────────────────────────────────────────────────────────

const baseLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Asantewaa's Tour</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#f5f1e8;color:#1a1a1a}
    .wrapper{max-width:600px;margin:0 auto;padding:24px 16px}
    .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1a1a1a 0%,#006B3F 100%);padding:40px 32px;text-align:center}
    .header h1{font-family:'Playfair Display',serif;color:#fff;font-size:28px;margin-bottom:6px}
    .header p{color:#FCD116;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
    .badge{display:inline-block;background:#FCD116;color:#1a1a1a;padding:4px 16px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-top:12px}
    .body{padding:36px 32px}
    .greeting{font-family:'Playfair Display',serif;font-size:22px;color:#1a1a1a;margin-bottom:16px}
    .text{font-size:15px;line-height:1.7;color:#444;margin-bottom:16px}
    .info-box{background:#f5f1e8;border-left:4px solid #D4AF37;border-radius:8px;padding:20px 24px;margin:24px 0}
    .info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e8e4d8;font-size:14px}
    .info-row:last-child{border-bottom:none;padding-bottom:0}
    .info-label{color:#888;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
    .info-value{color:#1a1a1a;font-weight:600}
    .price-row{margin-top:16px;padding:16px;background:#1a1a1a;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
    .price-label{color:#D4AF37;font-size:12px;text-transform:uppercase;letter-spacing:.1em}
    .price-value{color:#FCD116;font-size:24px;font-weight:700;font-family:'Playfair Display',serif}
    .cta{display:block;text-align:center;background:linear-gradient(135deg,#D4AF37 0%,#F4E5C2 50%,#D4AF37 100%);color:#1a1a1a;text-decoration:none;padding:14px 32px;border-radius:100px;font-weight:700;font-size:15px;margin:28px auto;max-width:260px}
    .whatsapp{display:block;text-align:center;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:600;font-size:14px;margin:12px auto;max-width:260px}
    .divider{height:1px;background:#f0ece2;margin:24px 0}
    .footer{background:#1a1a1a;padding:24px 32px;text-align:center}
    .footer p{color:#888;font-size:12px;line-height:1.6}
    .footer a{color:#D4AF37;text-decoration:none}
    .flag{font-size:24px;display:block;margin-bottom:8px}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <span class="flag">🇬🇭</span>
        <h1>Asantewaa's Tour</h1>
        <p>Experience Ghana's Golden Legacy</p>
      </div>
      ${content}
      <div class="footer">
        <p>
          Asantewaa's Tour · Accra, Ghana<br>
          <a href="tel:+233243954716">+233 243 954716</a> ·
          <a href="mailto:${process.env.EMAIL_TO_OWNER}">yaaasantewaa@gmail.com</a>
        </p>
        <p style="margin-top:8px;color:#555">© ${new Date().getFullYear()} Asantewaa's Tour. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ─── Templates ────────────────────────────────────────────────────────────────

const templates = {

  /**
   * Sent to customer after booking request
   */
  bookingConfirmation: (booking) => ({
    subject: `✅ Booking Request Received — ${booking.reference}`,
    html: baseLayout(`
      <div class="body">
        <p class="greeting">Akwaaba, ${booking.full_name.split(' ')[0]}! 🌟</p>
        <p class="text">
          Thank you for choosing Asantewaa's Tour! We've received your booking request and 
          Yaa Asantewaa will personally reach out to you within <strong>24 hours</strong> to 
          confirm your adventure.
        </p>

        <div class="badge">Booking Reference: ${booking.reference}</div>

        <div class="info-box" style="margin-top:24px">
          <div class="info-row">
            <span class="info-label">Tour</span>
            <span class="info-value">${booking.tour_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Travel Date</span>
            <span class="info-value">${booking.travel_date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Travelers</span>
            <span class="info-value">${booking.travelers} ${booking.travelers === 1 ? 'person' : 'people'}</span>
          </div>
          ${booking.phone ? `
          <div class="info-row">
            <span class="info-label">Phone</span>
            <span class="info-value">${booking.phone}</span>
          </div>` : ''}
          ${booking.price_quoted ? `
          <div class="price-row">
            <span class="price-label">Estimated Total</span>
            <span class="price-value">$${booking.price_quoted.toLocaleString()}</span>
          </div>` : ''}
        </div>

        <p class="text">
          While you wait, feel free to message Yaa directly on WhatsApp for any questions.
        </p>

        <a href="https://wa.me/233243954716?text=Hi%20Yaa!%20I%20just%20booked%20tour%20${booking.reference}" 
           class="whatsapp">💬 Chat on WhatsApp</a>

        <div class="divider"></div>

        <p class="text" style="font-size:13px;color:#888">
          If you didn't make this request, please ignore this email or contact us immediately.
          Your reference number is <strong>${booking.reference}</strong>.
        </p>
      </div>
    `),
  }),

  /**
   * Sent to owner when new booking arrives
   */
  newBookingAlert: (booking) => ({
    subject: `🔔 New Booking — ${booking.full_name} | ${booking.tour_name}`,
    html: baseLayout(`
      <div class="body">
        <p class="greeting">New Booking Request 🎉</p>
        <p class="text">You have a new tour booking request. Details below:</p>

        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Reference</span>
            <span class="info-value" style="color:#D4AF37;font-size:16px">${booking.reference}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Name</span>
            <span class="info-value">${booking.full_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value"><a href="mailto:${booking.email}">${booking.email}</a></span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone</span>
            <span class="info-value">${booking.phone || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Nationality</span>
            <span class="info-value">${booking.nationality || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tour</span>
            <span class="info-value">${booking.tour_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${booking.travel_date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Travelers</span>
            <span class="info-value">${booking.travelers}</span>
          </div>
          ${booking.special_request ? `
          <div class="info-row" style="flex-direction:column;align-items:flex-start;gap:4px">
            <span class="info-label">Special Request</span>
            <span class="info-value" style="font-weight:400;color:#555">${booking.special_request}</span>
          </div>` : ''}
          ${booking.price_quoted ? `
          <div class="price-row">
            <span class="price-label">Quoted Total</span>
            <span class="price-value">$${booking.price_quoted.toLocaleString()}</span>
          </div>` : ''}
        </div>

        <a href="https://wa.me/${(booking.phone || '').replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(booking.full_name.split(' ')[0])}!%20This%20is%20Yaa%20from%20Asantewaa's%20Tour.%20I'm%20reaching%20out%20about%20your%20booking%20(${booking.reference})" 
           class="whatsapp">💬 Reply via WhatsApp</a>
        <a href="mailto:${booking.email}?subject=Your%20Booking%20${booking.reference}%20-%20Asantewaa's%20Tour" 
           class="cta">📧 Reply via Email</a>
      </div>
    `),
  }),

  /**
   * Booking status update to customer
   */
  bookingStatusUpdate: (booking, message) => ({
    subject: `📋 Booking Update — ${booking.reference}`,
    html: baseLayout(`
      <div class="body">
        <p class="greeting">Update on your booking 📋</p>
        <p class="text">${message}</p>
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Reference</span>
            <span class="info-value">${booking.reference}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value" style="text-transform:capitalize">${booking.status}</span>
          </div>
        </div>
        <a href="https://wa.me/233243954716" class="whatsapp">💬 Questions? Chat with Yaa</a>
      </div>
    `),
  }),

  /**
   * Newsletter welcome
   */
  newsletterWelcome: (subscriber) => ({
    subject: `🌍 Akwaaba to Asantewaa's Newsletter!`,
    html: baseLayout(`
      <div class="body">
        <p class="greeting">Akwaaba, ${subscriber.name || 'Explorer'}! 🌟</p>
        <p class="text">
          You're now part of the Asantewaa family! You'll be the first to know about:
        </p>
        <ul style="padding-left:20px;margin:16px 0;color:#444;line-height:2">
          <li>🏰 New tour packages & experiences</li>
          <li>🎉 Exclusive early-bird discounts</li>
          <li>🌿 Hidden gems across Ghana</li>
          <li>📸 Stories from the road</li>
        </ul>
        <a href="https://wa.me/233243954716" class="whatsapp">💬 Say hi on WhatsApp</a>
      </div>
    `),
  }),

};

// ─── Send helper ──────────────────────────────────────────────────────────────

async function send({ to, ...template }) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email skipped — SMTP not configured');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Asantewaa's Tour" <${process.env.SMTP_USER}>`,
      to,
      ...template,
    });
    logger.info(`📧 Email sent → ${to} (${info.messageId})`);
    return info;
  } catch (err) {
    logger.error('Email send failed:', err.message);
    // Never throw — email failure shouldn't break the booking flow
  }
}

module.exports = {
  send,
  templates,
  // Convenience shortcuts
  sendBookingConfirmation: (booking) => send({ to: booking.email, ...templates.bookingConfirmation(booking) }),
  sendOwnerAlert:          (booking) => send({ to: process.env.EMAIL_TO_OWNER, ...templates.newBookingAlert(booking) }),
  sendStatusUpdate:        (booking, msg) => send({ to: booking.email, ...templates.bookingStatusUpdate(booking, msg) }),
  sendNewsletterWelcome:   (subscriber) => send({ to: subscriber.email, ...templates.newsletterWelcome(subscriber) }),
};
