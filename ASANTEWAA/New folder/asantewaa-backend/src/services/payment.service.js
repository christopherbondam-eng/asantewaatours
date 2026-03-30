'use strict';

/**
 * Stripe Payment Service
 * Optional — enables online deposits / full payments for bookings.
 * Requires: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
 */

const logger = require('../utils/logger');
const db     = require('../config/database');

let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    logger.info('✅ Stripe payment service ready');
  } else {
    logger.warn('⚠️  Stripe not configured — payments disabled');
  }
} catch (e) {
  logger.warn('Stripe SDK not installed. Run: npm install stripe');
}

// ─── Create checkout session ──────────────────────────────────────────────────

async function createCheckoutSession(req, res) {
  if (!stripe) return res.status(503).json({ success: false, message: 'Payments not configured.' });

  try {
    const { booking_id } = req.params;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (!booking.price_quoted) return res.status(400).json({ success: false, message: 'No price set for this booking.' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: (booking.currency || 'usd').toLowerCase(),
          unit_amount: Math.round(booking.price_quoted * 100), // cents
          product_data: {
            name: booking.tour_name,
            description: `Tour for ${booking.travelers} traveler(s) on ${booking.travel_date}`,
            images: [], // Add tour image URLs here
          },
        },
        quantity: 1,
      }],
      customer_email: booking.email,
      metadata: {
        booking_id: booking.id,
        booking_reference: booking.reference,
      },
      success_url: `${process.env.FRONTEND_URL}/booking-success?ref=${booking.reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/#book`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    });

    // Store session ID on booking
    db.prepare("UPDATE bookings SET stripe_session = ?, updated_at = datetime('now') WHERE id = ?")
      .run(session.id, booking.id);

    logger.info(`💳 Stripe session created: ${session.id} for booking ${booking.reference}`);

    return res.json({
      success: true,
      data: { session_id: session.id, url: session.url },
    });
  } catch (err) {
    logger.error('createCheckoutSession error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment session.' });
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  if (!stripe) return res.sendStatus(503);

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const emailService = require('./email.service');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) break;

      db.prepare(`
        UPDATE bookings
        SET payment_status = 'paid', status = 'confirmed', updated_at = datetime('now')
        WHERE id = ?
      `).run(bookingId);

      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
      if (booking) {
        emailService.sendStatusUpdate(
          { ...booking, status: 'confirmed' },
          `Great news! Your payment has been received and your tour "${booking.tour_name}" on ${booking.travel_date} is CONFIRMED. 🎉 See you in Ghana!`
        ).catch(() => {});
      }

      logger.info(`✅ Payment confirmed for booking: ${bookingId}`);
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        db.prepare("UPDATE bookings SET stripe_session = NULL, updated_at = datetime('now') WHERE id = ?").run(bookingId);
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      // Find booking by session or charge ID if needed
      logger.info(`💰 Refund processed: ${charge.id}`);
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event: ${event.type}`);
  }

  return res.json({ received: true });
}

module.exports = { createCheckoutSession, handleWebhook };
