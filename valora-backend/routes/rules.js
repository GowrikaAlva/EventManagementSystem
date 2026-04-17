// ─── Valora — /api/rules Routes ───────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const Rule    = require("../models/Rule");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

async function getRules() {
  let rules = await Rule.findOne();
  if (!rules) {
    rules = await Rule.create({
      domains: ["@company.com"],
      keywords: ["Project Falcon", "confidential", "merger"],
      customPatterns: [
        { label: "Employee ID", pattern: "EMP-\\d{6}", source: "company" },
      ],
    });
    console.log("[Rules] Default rules document created in DB ✓");
  }
  return rules;
}

// ── GET /api/rules ─────────────────────────────────────────────────────────────
// Now returns { companyRules, generalRules } so content.js can route matches.
// companyRules  → auto-mask + toast (no popup)
// generalRules  → popup + user chooses
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rule = await Rule.findOne();

    if (!rule) {
      return res.json({
        companyRules: { domains: [], keywords: [], customPatterns: [] },
        generalRules: { domains: [], keywords: [], customPatterns: [] },
      });
    }

    // Split customPatterns by source field
    const companyPatterns = (rule.customPatterns || []).filter(p => p.source !== "general");
    const generalPatterns = (rule.customPatterns || []).filter(p => p.source === "general");

    return res.json({
      // Company rules: all domains + keywords are always company-level
      companyRules: {
        domains:        rule.domains        || [],
        keywords:       rule.keywords       || [],
        customPatterns: companyPatterns,
      },
      // General rules: only patterns explicitly marked as "general"
      generalRules: {
        domains:        [],
        keywords:       [],
        customPatterns: generalPatterns,
      },
    });
  })
);

// ── PUT /api/rules ─────────────────────────────────────────────────────────────
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

// ── POST /api/rules/domain ─────────────────────────────────────────────────────
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

// ── DELETE /api/rules/domain ───────────────────────────────────────────────────
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

// ── POST /api/rules/keyword ────────────────────────────────────────────────────
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
    const exists = rules.keywords.some((k) => k.toLowerCase() === clean.toLowerCase());
    if (exists) {
      return res.json({ success: true, message: "Keyword already exists", rules });
    }

    rules.keywords.push(clean);
    await rules.save();
    console.log(`[Rules] Keyword added: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ── DELETE /api/rules/keyword ──────────────────────────────────────────────────
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

// ── POST /api/rules/pattern ────────────────────────────────────────────────────
// Now accepts optional `source` field: "company" (default) | "general"
router.post(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label, pattern, source = "company" } = req.body;
    if (!label || !pattern) {
      return res.status(400).json({ success: false, error: "label and pattern are required" });
    }
    if (!["company", "general"].includes(source)) {
      return res.status(400).json({ success: false, error: "source must be 'company' or 'general'" });
    }

    try { new RegExp(pattern); }
    catch (e) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }

    const rules = await getRules();
    const exists = rules.customPatterns.some((p) => p.label === label.trim());
    if (exists) {
      return res.json({ success: true, message: "Pattern label already exists", rules });
    }

    rules.customPatterns.push({ label: label.trim(), pattern: pattern.trim(), source });
    await rules.save();
    console.log(`[Rules] Custom pattern added: ${label} → ${pattern} (${source})`);
    res.json({ success: true, rules });
  })
);

// ── DELETE /api/rules/pattern ──────────────────────────────────────────────────
router.delete(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label } = req.body;
    if (!label) {
      return res.status(400).json({ success: false, error: "label is required" });
    }

    const rules = await getRules();
    rules.customPatterns = rules.customPatterns.filter((p) => p.label !== label.trim());
    await rules.save();
    console.log(`[Rules] Custom pattern removed: ${label}`);
    res.json({ success: true, rules });
  })
);

module.exports = router;