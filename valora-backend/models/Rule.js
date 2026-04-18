// ─── Valora — Rule Model ──────────────────────────────────────────────────────
const mongoose = require("mongoose");

const CustomPatternSchema = new mongoose.Schema(
  {
    label:   { type: String, required: true, trim: true },
    pattern: { type: String, required: true, trim: true },
    source:  { type: String, enum: ["company", "general"], default: "company" },
  },
  { _id: false }
);

// API keys — encrypted at rest
const ApiKeySchema = new mongoose.Schema(
  {
    label:          { type: String, required: true, trim: true },  // e.g. "Stripe Live Key"
    encryptedValue: { type: String, required: true },              // "iv:authTag:ciphertext"
    hint:           { type: String, required: true },              // last 4 chars, stored plain for display
  },
  { _id: true }
);

// Contact / account numbers — encrypted at rest
const SensitiveNumberSchema = new mongoose.Schema(
  {
    label:          { type: String, required: true, trim: true },  // e.g. "Support Hotline"
    type:           { type: String, enum: ["phone", "account_number", "tax_id", "other"], required: true },
    encryptedValue: { type: String, required: true },
    hint:           { type: String, required: true },              // last 4 chars
  },
  { _id: true }
);

const RuleSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    domains: {
      type:    [String],
      default: [],
      set:     (arr) => arr.map((d) => d.toLowerCase().trim()),
    },
    keywords: {
      type:    [String],
      default: [],
      set:     (arr) => arr.map((k) => k.trim()),
    },
    customPatterns:   { type: [CustomPatternSchema],     default: [] },
    apiKeys:          { type: [ApiKeySchema],            default: [] },  // ← NEW
    sensitiveNumbers: { type: [SensitiveNumberSchema],   default: [] },  // ← NEW
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rule", RuleSchema);