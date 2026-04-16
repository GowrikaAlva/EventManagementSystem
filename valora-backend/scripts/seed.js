// ─── Valora — DB Seed Script ──────────────────────────────────────────────────
// Run once to populate MongoDB with example rules:
//   node scripts/seed.js
//
// Safe to run multiple times — it drops existing rules first, then re-inserts.
// Does NOT touch the violations collection.
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Rule     = require("../models/Rule");
const connectDB = require("../config/db");

const SEED_RULES = {
  domains: [
    "@company.com",
    "@myorg.com",
    "@confidential.org",
  ],
  keywords: [
    "Project Falcon",
    "merger",
    "acquisition",
    "Q4 salary",
    "board meeting",
    "confidential",
    "internal only",
  ],
  customPatterns: [
    { label: "Employee ID",    pattern: "EMP-\\d{6}" },
    { label: "Project code",   pattern: "PRJ-[A-Z]{3}-\\d{4}" },
    { label: "Internal ticket",pattern: "INT-\\d{5}" },
    { label: "SSN (dashed)",   pattern: "\\d{3}-\\d{2}-\\d{4}" },
  ],
};

(async function seed() {
  await connectDB();

  try {
    // Wipe existing rules (singleton — only one document)
    await Rule.deleteMany({});
    console.log("[Seed] Existing rules cleared");

    // Insert fresh seed data
    const rules = await Rule.create(SEED_RULES);
    console.log("[Seed] Rules inserted ✓");
    console.log("  domains:       ", rules.domains);
    console.log("  keywords:      ", rules.keywords);
    console.log("  customPatterns:", rules.customPatterns.map((p) => p.label));

  } catch (err) {
    console.error("[Seed] Failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("[Seed] Done — DB connection closed");
  }
})();
