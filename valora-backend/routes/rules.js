// ─── Valora — /api/rules Routes ───────────────────────────────────────────────
//
// GET  /api/rules      → returns the single rules document (creates default if missing)
// PUT  /api/rules      → replaces the rules document (used by admin dashboard)
// POST /api/rules/domain        → add one domain
// DELETE /api/rules/domain      → remove one domain
// POST /api/rules/keyword       → add one keyword
// DELETE /api/rules/keyword     → remove one keyword
// POST /api/rules/pattern       → add one custom pattern
// DELETE /api/rules/pattern/:label → remove a custom pattern by label
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router  = express.Router();
const Rule    = require("../models/Rule");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// ── Helper: get or create the singleton rules document ───────────────────────
async function getRules() {
  let rules = await Rule.findOne();
  if (!rules) {
    // First run — seed with sensible defaults so the extension gets something
    rules = await Rule.create({
      domains: ["@company.com"],
      keywords: ["Project Falcon", "confidential", "merger"],
      customPatterns: [
        { label: "Employee ID", pattern: "EMP-\\d{6}" },
      ],
    });
    console.log("[Rules] Default rules document created in DB ✓");
  }
  return rules;
}

// ── GET /api/rules ────────────────────────────────────────────────────────────
// Called by the Chrome extension on every page load.
// Returns the full rules object; extension merges it with its local patterns.
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rule = await Rule.findOne();
    console.log("Rule from DB:", rule);

    if (!rule) {
      return res.json({
        domains: [],
        keywords: [],
        customPatterns: []
      });
    }

    return res.json({
      domains: rule.domains || [],
      keywords: rule.keywords || [],
      customPatterns: rule.customPatterns || []
    });
  })
);

// ── PUT /api/rules ────────────────────────────────────────────────────────────
// Full replace — used by the admin dashboard to push a new rules set.
// Body: { domains[], keywords[], customPatterns[] }
router.put(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domains, keywords, customPatterns } = req.body;

    const rules = await getRules();

    if (Array.isArray(domains))        rules.domains        = domains;
    if (Array.isArray(keywords))       rules.keywords       = keywords;
    if (Array.isArray(customPatterns)) rules.customPatterns = customPatterns;

    await rules.save();

    console.log("[Rules] Rules updated via PUT ✓");
    res.json({ success: true, rules });
  })
);

// ── POST /api/rules/domain ────────────────────────────────────────────────────
// Add a single domain. Body: { domain: "@newco.com" }
router.post(
  "/domain",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domain } = req.body;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ success: false, error: "domain is required" });
    }

    const clean = domain.toLowerCase().trim();
    const rules = await getRules();

    if (rules.domains.includes(clean)) {
      return res.json({ success: true, message: "Domain already exists", rules });
    }

    rules.domains.push(clean);
    await rules.save();

    console.log(`[Rules] Domain added: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ── DELETE /api/rules/domain ──────────────────────────────────────────────────
// Remove a single domain. Body: { domain: "@oldco.com" }
router.delete(
  "/domain",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is required" });
    }

    const clean = domain.toLowerCase().trim();
    const rules = await getRules();

    rules.domains = rules.domains.filter((d) => d !== clean);
    await rules.save();

    console.log(`[Rules] Domain removed: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ── POST /api/rules/keyword ───────────────────────────────────────────────────
// Add a keyword. Body: { keyword: "Project Falcon" }
router.post(
  "/keyword",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== "string") {
      return res.status(400).json({ success: false, error: "keyword is required" });
    }

    const clean = keyword.trim();
    const rules = await getRules();

    const exists = rules.keywords.some(
      (k) => k.toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      return res.json({ success: true, message: "Keyword already exists", rules });
    }

    rules.keywords.push(clean);
    await rules.save();

    console.log(`[Rules] Keyword added: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ── DELETE /api/rules/keyword ─────────────────────────────────────────────────
// Remove a keyword. Body: { keyword: "Project Falcon" }
router.delete(
  "/keyword",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ success: false, error: "keyword is required" });
    }

    const rules = await getRules();
    rules.keywords = rules.keywords.filter(
      (k) => k.toLowerCase() !== keyword.toLowerCase().trim()
    );
    await rules.save();

    console.log(`[Rules] Keyword removed: ${keyword}`);
    res.json({ success: true, rules });
  })
);

// ── POST /api/rules/pattern ───────────────────────────────────────────────────
// Add a custom regex pattern. Body: { label: "Employee ID", pattern: "EMP-\\d{6}" }
router.post(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label, pattern } = req.body;
    if (!label || !pattern) {
      return res.status(400).json({ success: false, error: "label and pattern are required" });
    }

    // Validate that the pattern is a valid regex before saving
    try {
      new RegExp(pattern);
    } catch (e) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }

    const rules = await getRules();

    const exists = rules.customPatterns.some((p) => p.label === label.trim());
    if (exists) {
      return res.json({ success: true, message: "Pattern label already exists", rules });
    }

    rules.customPatterns.push({ label: label.trim(), pattern: pattern.trim() });
    await rules.save();

    console.log(`[Rules] Custom pattern added: ${label} → ${pattern}`);
    res.json({ success: true, rules });
  })
);

// ── DELETE /api/rules/pattern ─────────────────────────────────────────────────
// Remove a custom pattern by label. Body: { label: "Employee ID" }
router.delete(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label } = req.body;
    if (!label) {
      return res.status(400).json({ success: false, error: "label is required" });
    }

    const rules = await getRules();
    rules.customPatterns = rules.customPatterns.filter(
      (p) => p.label !== label.trim()
    );
    await rules.save();

    console.log(`[Rules] Custom pattern removed: ${label}`);
    res.json({ success: true, rules });
  })
);

module.exports = router;
