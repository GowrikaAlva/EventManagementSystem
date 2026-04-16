// ─── Valora — /api/violations Routes ─────────────────────────────────────────
//
// POST /api/violations          → log a new violation (called by extension)
// GET  /api/violations          → list violations (used by admin dashboard)
//   query params:
//     ?limit=50                 (default 50, max 200)
//     ?page=1                   (pagination)
//     ?from=2025-01-01          (ISO date — violations after this date)
//     ?to=2025-12-31            (ISO date — violations before this date)
//     ?type=Company+email       (filter by match type)
// GET  /api/violations/stats    → summary counts per match type
// DELETE /api/violations        → delete all violations (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const express   = require("express");
const router    = express.Router();
const Violation = require("../models/Violation");
const { asyncHandler } = require("../middleware/errorHandler");

// ── POST /api/violations ──────────────────────────────────────────────────────
// Called by the Chrome extension whenever a user clicks "Send with [REDACTED]".
//
// Expected body:
// {
//   url:       "https://chatgpt.com/",
//   matches:   [{ type: "Company email" }, { type: "API key / secret" }],
//   timestamp: "2025-04-16T10:23:00.000Z"
// }
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { url, matches, timestamp } = req.body;

    // Basic validation
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        success: false,
        error: "matches must be a non-empty array",
      });
    }

    // Sanitise: keep only { type } on each match — strip anything else
    // (extra safety in case extension sends more than intended)
    const cleanMatches = matches
      .filter((m) => m && typeof m.type === "string")
      .map((m) => ({ type: m.type.trim() }));

    const violation = await Violation.create({
      url:       (url || "unknown").trim(),
      matches:   cleanMatches,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    console.log(
      `[Violations] Logged — ${cleanMatches.map((m) => m.type).join(", ")} @ ${violation.url}`
    );

    res.status(201).json({ success: true, id: violation._id });
  })
);

// ── GET /api/violations ───────────────────────────────────────────────────────
// Returns paginated violation log for the admin dashboard.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const skip  = (page - 1) * limit;

    // Build optional filter
    const filter = {};

    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to)   filter.timestamp.$lte = new Date(req.query.to);
    }

    if (req.query.type) {
      // Filter: violation contains at least one match of this type
      filter["matches.type"] = req.query.type;
    }

    const [violations, total] = await Promise.all([
      Violation.find(filter)
        .sort({ timestamp: -1 })   // newest first
        .skip(skip)
        .limit(limit)
        .lean(),                   // plain JS objects — faster than Mongoose docs
      Violation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page,
      pages:      Math.ceil(total / limit),
      violations,
    });
  })
);

// ── GET /api/violations/stats ─────────────────────────────────────────────────
// Returns count of violations per match type (for dashboard charts).
// Example response:
// {
//   "Company email":   12,
//   "API key / secret": 4,
//   "SSN":              1,
//   total:             17
// }
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const pipeline = [
      // Unwind the matches array so each type becomes its own document
      { $unwind: "$matches" },
      // Group by type, count occurrences
      {
        $group: {
          _id:   "$matches.type",
          count: { $sum: 1 },
        },
      },
      // Sort by count descending
      { $sort: { count: -1 } },
    ];

    const results = await Violation.aggregate(pipeline);

    // Convert array to flat object: { "Company email": 12, ... }
    const stats = {};
    let total = 0;
    results.forEach(({ _id, count }) => {
      stats[_id] = count;
      total += count;
    });
    stats.total = total;

    // Also return total violation events (not total matches)
    stats.totalEvents = await Violation.countDocuments();

    res.json({ success: true, stats });
  })
);

// ── DELETE /api/violations ────────────────────────────────────────────────────
// Wipes all violations — useful during development / testing.
// In production you'd want to protect this with an auth middleware.
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const { deletedCount } = await Violation.deleteMany({});
    console.log(`[Violations] Deleted all — ${deletedCount} records removed`);
    res.json({ success: true, deleted: deletedCount });
  })
);

module.exports = router;
