# Valora Backend

Express + MongoDB API that powers the Valora Chrome extension.

---

## Folder Structure

```
valora-backend/
│
├── server.js                  ← Entry point — start here
│
├── config/
│   └── db.js                  ← MongoDB connection (Mongoose)
│
├── models/
│   ├── Rule.js                ← Schema for detection rules
│   └── Violation.js           ← Schema for violation log
│
├── routes/
│   ├── rules.js               ← GET/PUT/POST/DELETE /api/rules
│   └── violations.js          ← POST/GET /api/violations
│
├── middleware/
│   └── errorHandler.js        ← asyncHandler + central error handler
│
├── scripts/
│   └── seed.js                ← Populate DB with example rules
│
├── package.json
├── .env                       ← Your local config (never commit this)
└── .gitignore
```

---

## Setup (first time)

```bash
# 1. Enter the backend folder
cd valora-backend

# 2. Install dependencies
npm install

# 3. Make sure MongoDB is running locally
# Mac:   brew services start mongodb-community
# Linux: sudo systemctl start mongod
# Windows: start MongoDB from Services or Compass

# 4. Create your .env (already provided — edit if needed)
# MONGO_URI=mongodb://127.0.0.1:27017/valora
# PORT=5000

# 5. Seed the database with example rules
node scripts/seed.js

# 6. Start the server
npm run dev        # development (auto-restarts on save)
node server.js     # production
```

You should see:
```
[DB] MongoDB connected ✓  →  mongodb://127.0.0.1:27017/valora
─────────────────────────────────────────
  Valora API running on port 5000
  http://localhost:5000
```

---

## API Reference

### Rules

| Method   | Path                   | Body / Params                              | Description                    |
|----------|------------------------|--------------------------------------------|--------------------------------|
| GET      | /api/rules             | —                                          | Get all rules (used by extension) |
| PUT      | /api/rules             | `{ domains[], keywords[], customPatterns[] }` | Replace all rules             |
| POST     | /api/rules/domain      | `{ domain: "@co.com" }`                    | Add one domain                 |
| DELETE   | /api/rules/domain      | `{ domain: "@co.com" }`                    | Remove one domain              |
| POST     | /api/rules/keyword     | `{ keyword: "Project Falcon" }`            | Add one keyword                |
| DELETE   | /api/rules/keyword     | `{ keyword: "Project Falcon" }`            | Remove one keyword             |
| POST     | /api/rules/pattern     | `{ label: "Emp ID", pattern: "EMP-\\d{6}" }` | Add custom regex pattern    |
| DELETE   | /api/rules/pattern     | `{ label: "Emp ID" }`                      | Remove pattern by label        |

### Violations

| Method   | Path                      | Params                          | Description                   |
|----------|---------------------------|---------------------------------|-------------------------------|
| POST     | /api/violations           | `{ url, matches[], timestamp }` | Log a violation (from extension) |
| GET      | /api/violations           | `?limit=50&page=1&from=&to=&type=` | List violations            |
| GET      | /api/violations/stats     | —                               | Count per match type          |
| DELETE   | /api/violations           | —                               | Wipe all violations           |

---

## Test with curl

```bash
# Check server is up
curl http://localhost:5000/

# Get rules (what the extension calls)
curl http://localhost:5000/api/rules

# Add a keyword
curl -X POST http://localhost:5000/api/rules/keyword \
  -H "Content-Type: application/json" \
  -d '{"keyword": "secret project"}'

# Add a custom pattern
curl -X POST http://localhost:5000/api/rules/pattern \
  -H "Content-Type: application/json" \
  -d '{"label": "Badge ID", "pattern": "BADGE-[A-Z]{2}\\d{4}"}'

# Simulate extension logging a violation
curl -X POST http://localhost:5000/api/violations \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://chatgpt.com/",
    "matches": [{"type": "Company email"}],
    "timestamp": "2025-04-16T10:00:00.000Z"
  }'

# View violations log
curl http://localhost:5000/api/violations

# View stats (for dashboard)
curl http://localhost:5000/api/violations/stats
```

---

## How it connects to the extension

The extension file `services/api.js` calls:
- `GET /api/rules` on every page load → gets domains, keywords, custom patterns
- `POST /api/violations` when user clicks "Send with [REDACTED]"

The extension works **offline** if the backend is down — it falls back to its
built-in local rules silently.

---

## MongoDB — verify data directly

```bash
mongosh

use valora

# See the rules document
db.rules.find().pretty()

# See violations
db.violations.find().pretty()

# Count violations per type
db.violations.aggregate([
  { $unwind: "$matches" },
  { $group: { _id: "$matches.type", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```
