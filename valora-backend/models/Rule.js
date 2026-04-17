// ─── Valora — Rule Model ──────────────────────────────────────────────────────
const mongoose = require("mongoose");

const CustomPatternSchema = new mongoose.Schema(
  {
    label:   { type: String, required: true, trim: true },
    pattern: { type: String, required: true, trim: true },
    source:  { type: String, enum: ["company", "general"], default: "company" }, // ← NEW
  },
  { _id: false }
);

const RuleSchema = new mongoose.Schema(
  {
    domains: {
      type:    [String],
      default: [],
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
  { timestamps: true }
);

module.exports = mongoose.model("Rule", RuleSchema);