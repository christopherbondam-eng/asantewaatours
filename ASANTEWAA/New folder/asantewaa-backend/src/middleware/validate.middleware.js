'use strict';

const Joi = require('joi');

const validate = (schema, property = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
  if (!error) return next();

  const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/['"]/g, '') }));
  return res.status(422).json({ success: false, message: 'Validation failed.', errors });
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const schemas = {
  booking: Joi.object({
    full_name:       Joi.string().min(2).max(120).required(),
    email:           Joi.string().email().required(),
    phone:           Joi.string().max(30).allow('', null),
    nationality:     Joi.string().max(80).allow('', null),
    tour_id:         Joi.string().max(50).allow('', null),
    tour_name:       Joi.string().min(2).max(200).required(),
    travel_date:     Joi.string().isoDate().required(),
    travelers:       Joi.number().integer().min(1).max(50).default(1),
    special_request: Joi.string().max(1000).allow('', null),
    utm_source:      Joi.string().max(50).allow('', null),
    utm_medium:      Joi.string().max(50).allow('', null),
  }),

  enquiry: Joi.object({
    name:    Joi.string().min(2).max(120).required(),
    email:   Joi.string().email().required(),
    subject: Joi.string().max(200).allow('', null),
    message: Joi.string().min(10).max(2000).required(),
  }),

  subscribe: Joi.object({
    email: Joi.string().email().required(),
    name:  Joi.string().max(120).allow('', null),
  }),

  login: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  tour: Joi.object({
    name:        Joi.string().min(2).max(200).required(),
    tagline:     Joi.string().max(300).allow('', null),
    description: Joi.string().max(5000).allow('', null),
    duration:    Joi.string().max(100).required(),
    price_usd:   Joi.number().positive().required(),
    max_guests:  Joi.number().integer().min(1).max(100).default(12),
    highlights:  Joi.array().items(Joi.string()).default([]),
    inclusions:  Joi.array().items(Joi.string()).default([]),
    exclusions:  Joi.array().items(Joi.string()).default([]),
    images:      Joi.array().items(Joi.string()).default([]),
  }),

  testimonial: Joi.object({
    author_name: Joi.string().min(2).max(120).required(),
    country:     Joi.string().max(80).allow('', null),
    rating:      Joi.number().integer().min(1).max(5).required(),
    body:        Joi.string().min(10).max(1500).required(),
    booking_id:  Joi.string().allow('', null),
  }),
};

module.exports = { validate, schemas };
