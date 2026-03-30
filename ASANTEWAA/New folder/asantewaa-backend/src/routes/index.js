'use strict';

const router = require('express').Router();
const { requireAuth, requireSuper } = require('../middleware/auth.middleware');
const { validate, schemas }         = require('../middleware/validate.middleware');
const { formLimiter, authLimiter }  = require('../middleware/ratelimit.middleware');

const bookingsCtrl  = require('../controllers/bookings.controller');
const toursCtrl     = require('../controllers/tours.controller');
const authCtrl      = require('../controllers/auth.controller');
const miscCtrl      = require('../controllers/misc.controller');

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', (req, res) =>
  res.json({ status: 'ok', service: "Asantewaa's Tour API", ts: new Date().toISOString() }),
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login',    authLimiter, validate(schemas.login), authCtrl.login);
router.post('/auth/register', authCtrl.registerAdmin);   // protected by ADMIN_SECRET_KEY
router.get ('/auth/me',       requireAuth, authCtrl.me);

// ─── Tours (public) ───────────────────────────────────────────────────────────
router.get('/tours',      toursCtrl.listTours);
router.get('/tours/:slug', toursCtrl.getTour);

// ─── Tours (admin) ───────────────────────────────────────────────────────────
router.post  ('/admin/tours',      requireAuth, validate(schemas.tour), toursCtrl.createTour);
router.put   ('/admin/tours/:id',  requireAuth, toursCtrl.updateTour);
router.delete('/admin/tours/:id',  requireAuth, requireSuper, toursCtrl.deleteTour);

// ─── Bookings (public) ───────────────────────────────────────────────────────
router.post('/book',            formLimiter, validate(schemas.booking), bookingsCtrl.createBooking);
router.get ('/bookings/:id',    bookingsCtrl.getBooking);  // by id or reference (for customers to track)

// ─── Bookings (admin) ────────────────────────────────────────────────────────
router.get ('/admin/bookings',         requireAuth, bookingsCtrl.listBookings);
router.get ('/admin/bookings/:id',     requireAuth, bookingsCtrl.getBooking);
router.patch('/admin/bookings/:id',    requireAuth, bookingsCtrl.updateBookingStatus);

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/admin/dashboard', requireAuth, bookingsCtrl.getDashboardStats);

// ─── Enquiries ────────────────────────────────────────────────────────────────
router.post ('/contact',             formLimiter, validate(schemas.enquiry), miscCtrl.createEnquiry);
router.get  ('/admin/enquiries',     requireAuth, miscCtrl.listEnquiries);
router.patch('/admin/enquiries/:id', requireAuth, miscCtrl.markEnquiryReplied);

// ─── Newsletter ───────────────────────────────────────────────────────────────
router.post('/subscribe',            formLimiter, validate(schemas.subscribe), miscCtrl.subscribe);
router.get ('/admin/subscribers',    requireAuth, miscCtrl.listSubscribers);

// ─── Testimonials ─────────────────────────────────────────────────────────────
router.post ('/testimonials',              validate(schemas.testimonial), miscCtrl.submitTestimonial);
router.get  ('/testimonials',              miscCtrl.listTestimonials);
router.patch('/admin/testimonials/:id',    requireAuth, miscCtrl.approveTestimonial);

// ─── Payments (Stripe) ────────────────────────────────────────────────────────
const paymentService = require('../services/payment.service');
router.post('/admin/bookings/:booking_id/checkout', requireAuth, paymentService.createCheckoutSession);

module.exports = router;
