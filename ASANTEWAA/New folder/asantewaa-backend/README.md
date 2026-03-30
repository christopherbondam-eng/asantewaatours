# 🇬🇭 Asantewaa's Tour — Backend API

Production-grade Node.js/Express backend for Asantewaa's Tour Ghana.
Built with patterns used at Google and Meta: layered architecture, structured logging,
schema validation, rate limiting, JWT auth, and a zero-dependency SQLite store.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | SQLite 3 (better-sqlite3, WAL mode) |
| Auth | JWT + bcryptjs |
| Validation | Joi |
| Email | Nodemailer (SMTP / Gmail) |
| Logging | Winston (JSON prod, colorized dev) |
| Security | Helmet, CORS, express-rate-limit |
| Tests | Jest + Supertest |

---

## Project Structure

```
asantewaa-backend/
├── src/
│   ├── server.js                    Express app + boot
│   ├── config/
│   │   └── database.js              SQLite schema + pragmas
│   ├── routes/
│   │   └── index.js                 All route declarations
│   ├── controllers/
│   │   ├── bookings.controller.js   Booking CRUD + dashboard stats
│   │   ├── tours.controller.js      Tour catalogue management
│   │   ├── auth.controller.js       Admin JWT authentication
│   │   └── misc.controller.js       Enquiries, subscribers, testimonials
│   ├── middleware/
│   │   ├── auth.middleware.js        JWT guard + role checks
│   │   ├── validate.middleware.js    Joi request validation
│   │   └── ratelimit.middleware.js   Tiered rate limiting
│   ├── services/
│   │   └── email.service.js         Nodemailer + HTML templates
│   └── utils/
│       ├── logger.js                Winston logger
│       └── seed.js                  DB seed (tours + admin)
├── tests/
│   └── api.test.js                  Jest integration tests
├── data/                            Auto-created — holds asantewaa.db
├── logs/                            Auto-created at runtime
├── uploads/                         Media uploads
├── nginx.conf                       Production Nginx config
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# At minimum set: JWT_SECRET, SMTP_USER, SMTP_PASS, EMAIL_TO_OWNER
```

### 3. Seed

```bash
npm run db:seed
```

Creates 3 tours, 3 testimonials, and a default admin:
- Email: `yaaasantewaa@gmail.com`
- Password: `ChangeMe!2024`

> Change this password immediately after first login.

### 4. Run

```bash
npm run dev    # development (hot-reload via nodemon)
npm start      # production
```

---

## API Reference

All endpoints prefixed with `/api`.

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/tours` | List all active tours |
| GET | `/tours/:slug` | Single tour + testimonials |
| POST | `/book` | Submit booking request |
| POST | `/contact` | Send enquiry |
| POST | `/subscribe` | Newsletter signup |
| GET | `/testimonials` | Approved reviews |
| POST | `/testimonials` | Submit review |

**Booking body:**
```json
{
  "full_name": "Kwame Asante",
  "email": "kwame@example.com",
  "phone": "+233200000001",
  "nationality": "Ghanaian",
  "tour_id": "tour_accra_03",
  "tour_name": "Accra City Experience",
  "travel_date": "2025-06-15",
  "travelers": 2,
  "special_request": "Vegetarian meals please"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "AST-25-K9XMR",
    "status": "pending",
    "price_quoted": 300
  }
}
```

---

### Admin (require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current admin info |
| GET | `/admin/dashboard` | Stats overview |
| GET | `/admin/bookings` | List bookings (filterable) |
| PATCH | `/admin/bookings/:id` | Update status / payment |
| POST | `/admin/tours` | Create tour |
| PUT | `/admin/tours/:id` | Edit tour |
| DELETE | `/admin/tours/:id` | Archive tour (super only) |
| GET | `/admin/enquiries` | List messages |
| PATCH | `/admin/enquiries/:id` | Mark replied |
| GET | `/admin/subscribers` | Newsletter list |
| PATCH | `/admin/testimonials/:id` | Approve review |

**Dashboard response:**
```json
{
  "bookings": { "total": 48, "pending": 5, "confirmed": 30, "completed": 13 },
  "revenue": { "total_quoted": 18450, "paid": 12300 },
  "tours": { "popular": [{ "tour_name": "...", "bookings_count": 20 }] },
  "recent_bookings": [...]
}
```

---

## Email System

Two emails fire automatically on every booking (non-blocking, never crashes the request):

- **Customer** — Beautiful HTML confirmation with reference, tour details, WhatsApp link
- **Owner (Yaa)** — Alert with full booking info + one-click reply buttons

Status-change emails fire when a booking moves to `confirmed`, `cancelled`, or `completed`.

**Gmail setup:**
1. Enable 2-Factor Authentication
2. Generate an App Password at `myaccount.google.com/apppasswords`
3. Use that as `SMTP_PASS` in `.env`

---

## Tests

```bash
npm test
```

Uses an in-memory SQLite DB — no setup needed. Covers all critical flows.

---

## Production Deployment

### PM2 on a VPS

```bash
npm install -g pm2
pm2 start src/server.js --name asantewaa-api --instances 2 --exec-mode cluster
pm2 save && pm2 startup
```

### Nginx

```bash
cp nginx.conf /etc/nginx/sites-available/asantewaa-tour
# Edit server_name to your domain
ln -s /etc/nginx/sites-available/asantewaa-tour /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Free SSL
certbot --nginx -d yourdomain.com
```

### One-click platforms

Works on **Railway**, **Render**, and **Fly.io** with no changes — just set `.env` vars.

---

## Frontend Integration

Update the booking form fetch call in `Asantewaa_Tour_Complete.html`:

```javascript
// In processBooking()
fetch('https://yourdomain.com/api/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    full_name:       formData.get('fullName'),
    email:           formData.get('email'),
    phone:           formData.get('phone'),
    tour_name:       formData.get('tourSelect'),
    travel_date:     formData.get('date'),
    travelers:       Number(formData.get('travelerCount')),
    special_request: formData.get('message'),
  }),
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    // Show success modal — data.data.reference has the booking ref
    document.getElementById('successModal').classList.remove('hidden');
  }
});
```

---

## Security Features

- Helmet HTTP security headers
- CORS origin allowlist
- Rate limiting: 100 req/15 min globally, 10 bookings/hr per IP, 10 logins/15 min
- JWT with expiry, issuer validation, and DB-level revocation
- bcrypt hashing (cost factor 12)
- Constant-time auth (prevents timing attacks)
- Joi validation with `stripUnknown` (no parameter pollution)
- Parameterised SQLite queries (no SQL injection)
- Audit log for all admin actions
- Soft deletes (no accidental data loss)

---

*Built with love for Ghana's Golden Legacy · Akwaaba!* 🇬🇭
