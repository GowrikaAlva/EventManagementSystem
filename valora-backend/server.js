// ─── Valora Backend — Main Server ────────────────────────────────────────────
// Entry point. Run with:
//   node server.js          (production)
//   npm run dev             (development — auto-restarts via nodemon)
//
// File load order matters:
//   1. dotenv loads .env into process.env
//   2. connectDB() connects Mongoose to MongoDB
//   3. Express middleware (CORS, JSON body parser, request logger)
//   4. Routes mounted at /api/rules and /api/violations
//   5. 404 handler for unknown routes
//   6. Central error handler (must be last)
// ─────────────────────────────────────────────────────────────────────────────

require("dotenv").config(); // must be first — loads .env before anything else reads process.env

const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const connectDB  = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Create Express app ────────────────────────────────────────────────────────
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS — allow all origins in dev (Chrome extension doesn't need CORS, but a
// browser-based admin dashboard would). Restrict in production via CORS_ORIGIN env.
app.use(cors({
  origin: [
    "https://chatgpt.com",
    /^http:\/\/localhost:\d+$/,  // Allow any localhost port for dev (5173, 5174, 5175, etc.)
    /^http:\/\/127\.0\.0\.1:\d+$/  // Allow any 127.0.0.1 port for dev
  ],
  credentials: true
}));

// Parse JSON request bodies (content.js sends application/json)
app.use(express.json());

// HTTP request logger — "dev" format: METHOD /path STATUS ms
// Shows every request in the terminal so you can see extension calls in real time
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — GET / → "Valora API running"
// Also used by popup.js to check if the backend is online
app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    message: "Valora API running",
    version: "1.0.0",
  });
});

// Authentication logic
app.use("/api/auth", require("./routes/auth"));

// Admin Endpoints
app.use("/api/users", require("./routes/users"));
app.use("/api/analytics", require("./routes/analytics"));

// Detection rules (read by extension, managed by admin dashboard)
app.use("/api/rules", require("./routes/rules"));

// Violation log (written by extension, read by admin dashboard)
app.use("/api/violations", require("./routes/violations"));

// ── 404 handler — unknown routes ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Central error handler (must be after all routes) ─────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`  Valora API running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log("─────────────────────────────────────────");
  console.log("  Routes:");
  console.log(`  GET    /api/rules`);
  console.log(`  PUT    /api/rules`);
  console.log(`  POST   /api/rules/domain`);
  console.log(`  DELETE /api/rules/domain`);
  console.log(`  POST   /api/rules/keyword`);
  console.log(`  DELETE /api/rules/keyword`);
  console.log(`  POST   /api/rules/pattern`);
  console.log(`  DELETE /api/rules/pattern`);
  console.log(`  POST   /api/violations`);
  console.log(`  GET    /api/violations`);
  console.log(`  GET    /api/violations/stats`);
  console.log(`  DELETE /api/violations`);
  console.log("─────────────────────────────────────────");
});
