// ─── Valora Detector ─────────────────────────────────────────────────────────
// Single source of truth for ALL detection logic.
//
// Load order (from manifest.json):
//   services/api.js  →  utils/redactor.js  →  detector.js  →  content.js
//
// Public API used by content.js:
//   findSensitiveData(text)  → { type, value }[]
//   loadBackendRules(rules)  → void  (called once on startup)
// ─────────────────────────────────────────────────────────────────────────────

// ── Local hardcoded config ────────────────────────────────────────────────────
// These are the fallback rules used when the backend is unreachable.
// You can edit companyDomains here OR manage them through the popup UI.
const VALORA_CONFIG = {
  companyDomains: ["@company.com", "@myorg.com"],

  // Toggle each category on/off.
  // These are also controlled by the popup toggles (saved in chrome.storage).
  enableEmailDetection:      true,
  enableApiKeyDetection:     true,
  enableCreditCardDetection: true,
  enablePhoneDetection:      true,
  enableSSNDetection:        true,
};

// ── Backend-loaded rules ──────────────────────────────────────────────────────
// Populated at runtime by content.js calling loadBackendRules().
// Default to empty so the extension works offline with just VALORA_CONFIG.
let BACKEND_RULES = {
  domains:        [],  // extra email domains from DB
  keywords:       [],  // exact-phrase keywords from DB  e.g. "Project Falcon"
  customPatterns: [],  // regex patterns from DB  e.g. { label: "EmpID", pattern: "EMP-\\d{6}" }
};

/**
 * Called by content.js after fetchCompanyRules() returns.
 * Merges backend domains into VALORA_CONFIG so existing email detection
 * picks them up automatically.
 */
function loadBackendRules(rules) {
  if (!rules) return;

  BACKEND_RULES = {
    domains:        Array.isArray(rules.domains)        ? rules.domains        : [],
    keywords:       Array.isArray(rules.keywords)       ? rules.keywords       : [],
    customPatterns: Array.isArray(rules.customPatterns) ? rules.customPatterns : [],
  };

  // Merge backend domains with local domains (deduplicated, lowercased)
  if (BACKEND_RULES.domains.length > 0) {
    VALORA_CONFIG.companyDomains = [
      ...new Set([
        ...VALORA_CONFIG.companyDomains.map((d) => d.toLowerCase()),
        ...BACKEND_RULES.domains.map((d) => d.toLowerCase()),
      ]),
    ];
  }

  console.log(
    "[Valora] Backend rules merged into detector ✓",
    `| domains: ${VALORA_CONFIG.companyDomains}`,
    `| keywords: ${BACKEND_RULES.keywords}`,
    `| customPatterns: ${BACKEND_RULES.customPatterns.length}`
  );
}

// ── Apply popup settings from chrome.storage ──────────────────────────────────
// content.js calls this after reading chrome.storage on startup.
function applyStorageSettings(settings) {
  if (!settings) return;
  if (typeof settings.enableEmailDetection      === "boolean") VALORA_CONFIG.enableEmailDetection      = settings.enableEmailDetection;
  if (typeof settings.enableApiKeyDetection     === "boolean") VALORA_CONFIG.enableApiKeyDetection     = settings.enableApiKeyDetection;
  if (typeof settings.enableCreditCardDetection === "boolean") VALORA_CONFIG.enableCreditCardDetection = settings.enableCreditCardDetection;
  if (typeof settings.enablePhoneDetection      === "boolean") VALORA_CONFIG.enablePhoneDetection      = settings.enablePhoneDetection;
  if (typeof settings.enableSSNDetection        === "boolean") VALORA_CONFIG.enableSSNDetection        = settings.enableSSNDetection;
  if (Array.isArray(settings.companyDomains) && settings.companyDomains.length > 0) {
    VALORA_CONFIG.companyDomains = settings.companyDomains;
  }
}

// ── Regex patterns ────────────────────────────────────────────────────────────
// Each pattern has:
//   regex  — must use /g or /gi flag (required for exec() loop)
//   label  — human-readable name shown in the warning banner
//   check  — function(matchedString) → bool, extra validation beyond regex
const PATTERNS = {

  // Fires only when the email domain is in VALORA_CONFIG.companyDomains
  companyEmail: {
    regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    label: "Company email",
    check: (match) =>
      VALORA_CONFIG.companyDomains.some((d) =>
        match.toLowerCase().includes(d.toLowerCase())
      ),
  },

  // Fires on ANY email address (used when no company domains are configured)
  genericEmail: {
    regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    label: "Email address",
    check: () => true,
  },

  // OpenAI sk- keys, Google AIza keys, AWS AKIA keys, GitHub tokens
  apiKey: {
    regex: /\b(sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_\-]{35}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{36,})\b/g,
    label: "API key / secret",
    check: () => true,
  },

  // Visa, Mastercard, Amex, Discover — standard 13-16 digit formats
  creditCard: {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    label: "Credit card number",
    check: () => true,
  },

  // US phone numbers: (555) 867-5309 / 555-867-5309 / +1 555 867 5309
  phone: {
    regex: /(?:\+1\s?)?(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g,
    label: "Phone number",
    check: () => true,
  },

  // US Social Security Number: 123-45-6789
  ssn: {
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    label: "SSN",
    check: () => true,
  },
};

// ── Main detection function ───────────────────────────────────────────────────
/**
 * Scan `text` for sensitive data using built-in patterns + backend rules.
 *
 * @param {string} text  - Raw text from the AI chat input box
 * @returns {{ type: string, value: string }[]}
 *   Array of matches. Empty array = nothing found = safe to send.
 *
 * Deduplication: the same value is only reported once even if it appears
 * multiple times or matches multiple patterns.
 */
function findSensitiveData(text) {
  if (!text || typeof text !== "string") return [];

  const results = [];
  const seen = new Set(); // deduplicate: same value won't appear twice in output

  // Helper: run one regex pattern against the text, collect non-duplicate matches
  function runPattern(patternObj) {
    // Rebuild with same flags to reset lastIndex — critical for reuse!
    const regex = new RegExp(patternObj.regex.source, patternObj.regex.flags);
    let m;
    while ((m = regex.exec(text)) !== null) {
      const value = m[0];
      if (!seen.has(value) && patternObj.check(value)) {
        seen.add(value);
        results.push({ type: patternObj.label, value });
      }
    }
  }

  // ── 1. Standard built-in patterns ────────────────────────────────────────
  if (VALORA_CONFIG.enableEmailDetection) {
    // Use companyEmail when domains are configured (more precise).
    // Fall back to genericEmail only when no domains are set.
    if (VALORA_CONFIG.companyDomains.length > 0) {
      runPattern(PATTERNS.companyEmail);
    } else {
      runPattern(PATTERNS.genericEmail);
    }
  }

  if (VALORA_CONFIG.enableApiKeyDetection)      runPattern(PATTERNS.apiKey);
  if (VALORA_CONFIG.enableCreditCardDetection)  runPattern(PATTERNS.creditCard);
  if (VALORA_CONFIG.enablePhoneDetection)       runPattern(PATTERNS.phone);
  if (VALORA_CONFIG.enableSSNDetection)         runPattern(PATTERNS.ssn);

  // ── 2. Backend keywords (exact phrase, case-insensitive) ─────────────────
  // These come from the DB: e.g. "Project Falcon", "Q4 salary", "merger"
  // If any keyword appears anywhere in the text → flag it.
  const lowerText = text.toLowerCase();
  BACKEND_RULES.keywords.forEach((keyword) => {
    if (!keyword || typeof keyword !== "string") return;
    const lowerKw = keyword.toLowerCase().trim();
    if (!lowerKw) return;
    if (lowerText.includes(lowerKw) && !seen.has(lowerKw)) {
      seen.add(lowerKw);
      results.push({ type: "Sensitive keyword", value: keyword });
    }
  });

  // ── 3. Backend custom regex patterns ─────────────────────────────────────
  // These come from the DB: e.g. { label: "Employee ID", pattern: "EMP-\\d{6}" }
  BACKEND_RULES.customPatterns.forEach(({ label, pattern }) => {
    if (!pattern) return;
    try {
      const regex = new RegExp(pattern, "gi");
      let m;
      while ((m = regex.exec(text)) !== null) {
        const value = m[0];
        if (!seen.has(value)) {
          seen.add(value);
          results.push({ type: label || "Custom pattern", value });
        }
      }
    } catch (e) {
      // Bad regex from DB — log and skip, don't crash the extension
      console.warn("[Valora] Skipping invalid custom pattern:", pattern, e.message);
    }
  });

  return results;
}
