// ─── Valora — Central Error Handler ──────────────────────────────────────────
// Express calls this automatically when any route calls next(err) or throws
// inside an async handler wrapped with asyncHandler (see routes).
//
// Usage in routes:
//   router.get("/", asyncHandler(async (req, res) => { ... }));
//
// Any uncaught error inside that handler is forwarded here automatically.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps an async route handler so errors are forwarded to next() automatically.
 * Without this, an unhandled promise rejection in a route just hangs.
 *
 * @param {Function} fn  async (req, res, next) => {}
 * @returns Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Express error-handling middleware (4 arguments = Express treats it as error handler).
 * Registered LAST in server.js after all routes.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Log full stack in development, just the message in production
  if (process.env.NODE_ENV !== "production") {
    console.error("[Error]", err.stack || err);
  } else {
    console.error(`[Error] ${status} — ${message}`);
  }

  res.status(status).json({
    success: false,
    error:   message,
  });
}

module.exports = { asyncHandler, errorHandler };
