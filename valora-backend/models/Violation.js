// ─── Valora — Violation Model ─────────────────────────────────────────────────
// Logs every event where a user clicked "Send with [REDACTED]".
//
// PRIVACY DESIGN: we store ONLY the type of match (e.g. "Company email"),
// NEVER the raw sensitive value. The extension enforces this in services/api.js.
//
// Document shape:
// {
//   url:       "https://chatgpt.com/",
//   matches:   [{ type: "Company email" }, { type: "API key / secret" }],
//   timestamp: ISODate("2025-04-16T10:23:00Z"),
//   createdAt: ISODate(...)
// }
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const MatchTypeSchema = new mongoose.Schema(
  {
    // Only the category label — never the raw value
    type: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ViolationSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // User who generated the violation
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Make it optional for fallback backwards compatibility if needed
    },

    // The AI site URL where the violation happened
    url: {
      type:    String,
      default: "unknown",
      trim:    true,
    },

    // Array of match types detected (no raw values)
    matches: {
      type:     [MatchTypeSchema],
      default:  [],
    },

    // Timestamp sent by the extension (client-side ISO string)
    // We store it separately from createdAt so it reflects when the
    // violation actually happened, not when it arrived at the server.
    timestamp: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt (server-side receipt time)
  }
);

// Index on timestamp so the dashboard can query "violations in the last 7 days" fast
ViolationSchema.index({ timestamp: -1 });

module.exports = mongoose.model("Violation", ViolationSchema);
