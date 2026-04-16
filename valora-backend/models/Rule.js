// ─── Valora — Rule Model ──────────────────────────────────────────────────────
// Stores the company's detection rules in MongoDB.
//
// There is intentionally ONE document in this collection (singleton pattern).
// The extension fetches GET /api/rules which returns that single document.
// The admin dashboard (Person 4) can update it via PUT /api/rules.
//
// Document shape:
// {
//   domains:        ["@tatagroup.com", "@confidential.org"],
//   keywords:       ["Project Falcon", "merger", "Q4 salary"],
//   customPatterns: [
//     { label: "Employee ID", pattern: "EMP-\\d{6}" },
//     { label: "Project code", pattern: "PRJ-[A-Z]{3}-\\d{4}" }
//   ],
//   updatedAt: Date
// }
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const CustomPatternSchema = new mongoose.Schema(
  {
    label:   { type: String, required: true, trim: true },
    // pattern is stored as a raw string — the extension turns it into new RegExp(pattern)
    pattern: { type: String, required: true, trim: true },
  },
  { _id: false } // no separate _id per sub-document
);

const RuleSchema = new mongoose.Schema(
  {
    domains: {
      type:    [String],
      default: [],
      // Lowercase all domains before saving so matching is consistent
      set: (arr) => arr.map((d) => d.toLowerCase().trim()),
    },
    keywords: {
      type:    [String],
      default: [],
      set: (arr) => arr.map((k) => k.trim()),
    },
    customPatterns: {
      type:    [CustomPatternSchema],
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

module.exports = mongoose.model("Rule", RuleSchema);
