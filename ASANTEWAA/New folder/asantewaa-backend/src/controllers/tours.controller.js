'use strict';

const db = require('../config/database');
const logger = require('../utils/logger');
const slugify = require('slugify');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseJSON = (v, fallback = []) => {
  try { return typeof v === 'string' ? JSON.parse(v) : v ?? fallback; }
  catch { return fallback; }
};

const hydrateTour = (row) => row ? ({
  ...row,
  highlights: parseJSON(row.highlights),
  inclusions: parseJSON(row.inclusions),
  exclusions: parseJSON(row.exclusions),
  images:     parseJSON(row.images),
  is_active:  Boolean(row.is_active),
}) : null;

// ─── Public: list all active tours ───────────────────────────────────────────

function listTours(req, res) {
  try {
    const rows = db.prepare('SELECT * FROM tours WHERE is_active = 1 ORDER BY price_usd ASC').all();
    return res.json({ success: true, data: rows.map(hydrateTour) });
  } catch (err) {
    logger.error('listTours error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tours.' });
  }
}

// ─── Public: single tour by slug or id ───────────────────────────────────────

function getTour(req, res) {
  try {
    const { slug } = req.params;
    const row = db.prepare('SELECT * FROM tours WHERE (slug = ? OR id = ?) AND is_active = 1').get(slug, slug);
    if (!row) return res.status(404).json({ success: false, message: 'Tour not found.' });

    // Also include reviews for this tour
    const testimonials = db.prepare(`
      SELECT author_name, country, rating, body, photo_url
      FROM testimonials
      WHERE is_approved = 1
      ORDER BY is_featured DESC, created_at DESC
      LIMIT 10
    `).all();

    return res.json({ success: true, data: { ...hydrateTour(row), testimonials } });
  } catch (err) {
    logger.error('getTour error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tour.' });
  }
}

// ─── Admin: create tour ───────────────────────────────────────────────────────

function createTour(req, res) {
  try {
    const {
      name, tagline, description, duration, price_usd, max_guests = 12,
      highlights = [], inclusions = [], exclusions = [], images = [],
    } = req.body;

    const slug = slugify(name, { lower: true, strict: true });
    const existing = db.prepare('SELECT id FROM tours WHERE slug = ?').get(slug);
    if (existing) return res.status(409).json({ success: false, message: 'Tour with this name already exists.' });

    const id = require('crypto').randomBytes(8).toString('hex');

    db.prepare(`
      INSERT INTO tours (id, slug, name, tagline, description, duration, price_usd, max_guests, highlights, inclusions, exclusions, images)
      VALUES (@id, @slug, @name, @tagline, @description, @duration, @price_usd, @max_guests, @highlights, @inclusions, @exclusions, @images)
    `).run({
      id, slug, name, tagline, description, duration,
      price_usd: Number(price_usd),
      max_guests: Number(max_guests),
      highlights: JSON.stringify(highlights),
      inclusions: JSON.stringify(inclusions),
      exclusions: JSON.stringify(exclusions),
      images:     JSON.stringify(images),
    });

    logger.info(`🗺️  Tour created: "${name}" (${id})`);
    return res.status(201).json({ success: true, data: { id, slug } });
  } catch (err) {
    logger.error('createTour error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create tour.' });
  }
}

// ─── Admin: update tour ───────────────────────────────────────────────────────

function updateTour(req, res) {
  try {
    const { id } = req.params;
    const tour = db.prepare('SELECT * FROM tours WHERE id = ?').get(id);
    if (!tour) return res.status(404).json({ success: false, message: 'Tour not found.' });

    const allowed = ['name','tagline','description','duration','price_usd','max_guests','highlights','inclusions','exclusions','images','is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = Array.isArray(req.body[key]) ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    updates.updated_at = new Date().toISOString();
    if (updates.name) updates.slug = slugify(updates.name, { lower: true, strict: true });

    const fields = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE tours SET ${fields} WHERE id = @id`).run({ ...updates, id });

    return res.json({ success: true, message: 'Tour updated.' });
  } catch (err) {
    logger.error('updateTour error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tour.' });
  }
}

// ─── Admin: delete tour (soft) ────────────────────────────────────────────────

function deleteTour(req, res) {
  try {
    const { id } = req.params;
    db.prepare("UPDATE tours SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    logger.info(`🗑️  Tour soft-deleted: ${id}`);
    return res.json({ success: true, message: 'Tour archived.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete tour.' });
  }
}

module.exports = { listTours, getTour, createTour, updateTour, deleteTour };
