'use strict';

require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

logger.info('🌱 Seeding database...');

// ─── Tours ────────────────────────────────────────────────────────────────────

const tours = [
  {
    id: 'tour_eastern_01',
    slug: 'eastern-experience',
    name: 'Eastern Experience',
    tagline: 'Beads, Mountains & Cultural Immersion',
    description: 'Discover the soul of the Volta Region. From bead-makers to misty mountains, this journey takes you deep into Ghanaian heritage. Visit Krobo bead artisans, hike the Akuapem Hills, and witness traditions unchanged for centuries.',
    duration: '2 days / 1 night',
    price_usd: 300,
    max_guests: 10,
    highlights: JSON.stringify(['Krobo bead-making village', 'Akuapem Hills scenic views', 'Traditional Kente weaving', 'Local market visits', 'Home-cooked Ghanaian meals']),
    inclusions: JSON.stringify(['Transportation from Accra', 'Accommodation (1 night)', 'All meals on tour', 'Experienced local guide', 'Entrance fees']),
    exclusions: JSON.stringify(['International flights', 'Travel insurance', 'Personal expenses', 'Tips (optional)']),
    images: JSON.stringify([]),
    is_active: 1,
  },
  {
    id: 'tour_heritage_02',
    slug: 'heritage-canopy',
    name: 'Heritage & Canopy',
    tagline: 'Cape Coast, Kakum & the Living Roots',
    description: 'Walk across the legendary canopy walkway of Kakum, then descend into the sobering depths of Cape Coast Castle — a UNESCO World Heritage Site. Experience the full spectrum of Ghana\'s history, from its natural wonders to its colonial legacy.',
    duration: '3 days / 2 nights',
    price_usd: 450,
    max_guests: 12,
    highlights: JSON.stringify(['Cape Coast Castle UNESCO tour', 'Kakum National Park canopy walk', 'Elmina fishing village', 'Assin Manso ancestral shrine', 'Sunset boat ride']),
    inclusions: JSON.stringify(['Round-trip transport from Accra', 'Accommodation (2 nights)', 'Breakfast & dinner daily', 'All entrance fees & guides', 'Bottled water']),
    exclusions: JSON.stringify(['Lunches', 'Travel insurance', 'Personal shopping', 'Tips']),
    images: JSON.stringify([]),
    is_active: 1,
  },
  {
    id: 'tour_accra_03',
    slug: 'accra-city-experience',
    name: 'Accra City Experience',
    tagline: 'The Heartbeat of Ghana in One Day',
    description: 'An immersive full-day tour of Ghana\'s vibrant capital. Explore the National Museum, wander the eclectic Jamestown district, haggle at Makola Market, visit Kwame Nkrumah Mausoleum, and end at a rooftop bar with views of the Atlantic.',
    duration: '1 day',
    price_usd: 150,
    max_guests: 8,
    highlights: JSON.stringify(['National Museum of Ghana', 'Jamestown Lighthouse', 'Makola Market', 'Kwame Nkrumah Mausoleum & Park', 'Arts Centre craft shopping', 'Local street food tasting']),
    inclusions: JSON.stringify(['AC vehicle & driver all day', 'Experienced city guide', 'Street food tasting', 'Entrance fees', 'Bottled water']),
    exclusions: JSON.stringify(['Accommodation', 'Lunch & dinner', 'Personal shopping']),
    images: JSON.stringify([]),
    is_active: 1,
  },
];

const insertTour = db.prepare(`
  INSERT OR IGNORE INTO tours (id, slug, name, tagline, description, duration, price_usd, max_guests, highlights, inclusions, exclusions, images, is_active)
  VALUES (@id, @slug, @name, @tagline, @description, @duration, @price_usd, @max_guests, @highlights, @inclusions, @exclusions, @images, @is_active)
`);

const tourTx = db.transaction(() => {
  for (const tour of tours) insertTour.run(tour);
});
tourTx();
logger.info(`✅ ${tours.length} tours seeded`);

// ─── Sample testimonials ──────────────────────────────────────────────────────

const testimonials = [
  { id: 't1', author_name: 'Amelia Thompson', country: 'United Kingdom', rating: 5, body: "Yaa made our trip to Ghana absolutely unforgettable. Her knowledge of local culture and warm personality made us feel completely at home. The Cape Coast tour was deeply moving.", is_featured: 1, is_approved: 1 },
  { id: 't2', author_name: 'Marcus Williams', country: 'United States', rating: 5, body: "As part of the diaspora, this trip was life-changing. Yaa created a space that was both educational and healing. I'll be back — and bringing my whole family next time!", is_featured: 1, is_approved: 1 },
  { id: 't3', author_name: 'Kofi Mensah', country: 'Ghana', rating: 5, body: "Even as a Ghanaian I learned so much! Yaa has an incredible depth of knowledge about our country's heritage. The Eastern Experience tour was breathtaking.", is_featured: 0, is_approved: 1 },
];

const insertTestimonial = db.prepare(`
  INSERT OR IGNORE INTO testimonials (id, author_name, country, rating, body, is_featured, is_approved)
  VALUES (@id, @author_name, @country, @rating, @body, @is_featured, @is_approved)
`);
const testTx = db.transaction(() => { for (const t of testimonials) insertTestimonial.run(t); });
testTx();
logger.info(`✅ ${testimonials.length} testimonials seeded`);

// ─── Default super admin ──────────────────────────────────────────────────────

async function seedAdmin() {
  const existing = db.prepare("SELECT id FROM admins WHERE role = 'super'").get();
  if (existing) {
    logger.info('⏭️  Admin already exists, skipping');
    return;
  }
  const password_hash = await bcrypt.hash('ChangeMe!2024', 12);
  db.prepare(`
    INSERT INTO admins (id, name, email, password_hash, role)
    VALUES ('admin_seed_01', 'Yaa Asantewaa', 'yaaasantewaa@gmail.com', @password_hash, 'super')
  `).run({ password_hash });
  logger.info('✅ Default admin created: yaaasantewaa@gmail.com / ChangeMe!2024');
  logger.warn('⚠️  CHANGE THE DEFAULT ADMIN PASSWORD IMMEDIATELY after first login!');
}

seedAdmin().then(() => {
  logger.info('🌱 Seeding complete!');
  process.exit(0);
}).catch((err) => {
  logger.error('Seeding failed:', err);
  process.exit(1);
});
