// ─── Valora API Service ───────────────────────────────────────────────────────
// Purpose : Talk to the Node/Express backend running at localhost:5000
//
// Two jobs:
//   1. fetchCompanyRules()  — pull domains, keywords, customPatterns from DB
//   2. logViolation()       — POST a violation record (no raw text ever sent)
//
// OFFLINE SAFE: if the backend is down, both functions fail silently and the
// extension keeps working with its built-in local rules.
// ─────────────────────────────────────────────────────────────────────────────

const VALORA_API_BASE = "http://localhost:5000/api";

// ── How long to wait for the backend before giving up (ms) ───────────────────
const FETCH_TIMEOUT_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// fetchCompanyRules()
//
// Returns an object shaped like:
// {
//   domains:        string[]   e.g. ["@tatagroup.com", "@secret.org"]
//   keywords:       string[]   e.g. ["Project Falcon", "merger", "Q4 salary"]
//   customPatterns: { label: string, pattern: string }[]
// }
//
// On any error (network down, 4xx, 5xx, JSON parse fail) → returns empty arrays
// so the extension works offline with just the local hardcoded rules.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCompanyRules() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(`${VALORA_API_BASE}/rules`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}`);
    }

    const data = await res.json();

    // Validate shape — protect against malformed backend responses
    const rules = {
      domains:        Array.isArray(data.domains)        ? data.domains        : [],
      keywords:       Array.isArray(data.keywords)       ? data.keywords       : [],
      customPatterns: Array.isArray(data.customPatterns) ? data.customPatterns : [],
    };

    console.log(
      `[Valora] Rules loaded from backend ✓ — ` +
      `${rules.domains.length} domains, ` +
      `${rules.keywords.length} keywords, ` +
      `${rules.customPatterns.length} custom patterns`
    );

    return rules;

  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[Valora] Backend timed out — using local rules only");
    } else {
      console.warn("[Valora] Backend unreachable — using local rules only:", err.message);
    }
    // Always return a valid shape so callers never need to null-check
    return { domains: [], keywords: [], customPatterns: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// logViolation(matches, pageUrl)
//
// Sends a violation event to the backend for audit logging.
//
// IMPORTANT PRIVACY RULE: we send only the *type* of match (e.g. "Company email"),
// NEVER the raw value (the actual email address / API key / etc.).
// This means the backend log shows that a violation happened, not what the data was.
//
// Payload shape sent to POST /api/violations:
// {
//   url:       string          (the AI site URL, e.g. "https://chatgpt.com/")
//   matches:   { type: string }[]
//   timestamp: ISO string
// }
// ─────────────────────────────────────────────────────────────────────────────
async function logViolation(matches, pageUrl) {
  if (!matches || matches.length === 0) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const payload = {
      url:       pageUrl || window.location.href,
      matches:   matches.map((m) => ({ type: m.type })), // ← strip raw value intentionally
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(`${VALORA_API_BASE}/violations`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}`);
    }

    console.log("[Valora] Violation logged to backend ✓", payload);

  } catch (err) {
    // Logging failure must never affect the UX — swallow silently
    if (err.name === "AbortError") {
      console.warn("[Valora] Violation log timed out");
    } else {
      console.warn("[Valora] Could not log violation:", err.message);
    }
  }
}
