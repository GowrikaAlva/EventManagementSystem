// ─── Valora Detector ──────────────────────────────────────────────────────────
// Load order: services/api.js → utils/redactor.js → detector.js → content.js

const VALORA_CONFIG = {
  companyDomains: ["@company.com", "@myorg.com", "@gmail.com"],
  enableEmailDetection:      true,
  enableApiKeyDetection:     true,
  enableCreditCardDetection: true,
  enablePhoneDetection:      true,
  enableSSNDetection:        true,
};

// Populated by loadBackendRules() called from content.js after init
let BACKEND_RULES = {
  companyRules: { domains: [], keywords: [], customPatterns: [] },
  generalRules: { domains: [], keywords: [], customPatterns: [] },
};

/**
 * Called by content.js after FETCH_RULES resolves.
 * Stores both buckets and merges company domains into VALORA_CONFIG.
 */
function loadBackendRules({ companyRules = {}, generalRules = {} } = {}) {
  BACKEND_RULES.companyRules = {
    domains:        Array.isArray(companyRules.domains)        ? companyRules.domains        : [],
    keywords:       Array.isArray(companyRules.keywords)       ? companyRules.keywords       : [],
    customPatterns: Array.isArray(companyRules.customPatterns) ? companyRules.customPatterns : [],
  };
  BACKEND_RULES.generalRules = {
    domains:        Array.isArray(generalRules.domains)        ? generalRules.domains        : [],
    keywords:       Array.isArray(generalRules.keywords)       ? generalRules.keywords       : [],
    customPatterns: Array.isArray(generalRules.customPatterns) ? generalRules.customPatterns : [],
  };

  // Merge company domains so email detection uses them automatically
  if (BACKEND_RULES.companyRules.domains.length > 0) {
    VALORA_CONFIG.companyDomains = [
      ...new Set([
        ...VALORA_CONFIG.companyDomains.map((d) => d.toLowerCase()),
        ...BACKEND_RULES.companyRules.domains.map((d) => d.toLowerCase()),
      ]),
    ];
  }

  console.log(
    "[Valora] Backend rules loaded ✓",
    `| company domains: ${VALORA_CONFIG.companyDomains}`,
    `| company keywords: ${BACKEND_RULES.companyRules.keywords}`,
    `| general patterns: ${BACKEND_RULES.generalRules.customPatterns.length}`
  );
}

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

// ── Built-in patterns ─────────────────────────────────────────────────────────
const PATTERNS = {
  companyEmail: {
    regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    label: "Company email",
    check: (match) =>
      VALORA_CONFIG.companyDomains.some((d) =>
        match.toLowerCase().includes(d.toLowerCase())
      ),
  },
  genericEmail: {
    regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    label: "Email address",
    check: () => true,
  },
  apiKey: {
    regex: /\b(sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_\-]{35}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{36,})\b/g,
    label: "API key / secret",
    check: () => true,
  },
  creditCard: {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    label: "Credit card number",
    check: () => true,
  },
  phone: {
    regex: /(?:\+1\s?)?(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g,
    label: "Phone number",
    check: () => true,
  },
  ssn: {
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    label: "SSN",
    check: () => true,
  },
};

/**
 * Main detection function.
 *
 * Returns an array of match objects, each tagged with source:
 *   { type, value, source: "company" | "general" }
 *
 * company → content.js will auto-mask + show toast
 * general → content.js will show modal for user to decide
 */
function detectSensitiveData(text) {
  if (!text || typeof text !== "string") return [];

  const results = [];
  const seen    = new Set(); // prevent duplicate values in output

  // ── Helper: push a result if value not already seen ───────────────────────
  function push(type, value, source) {
    if (!seen.has(value)) {
      seen.add(value);
      results.push({ type, value, source });
    }
  }

  // ── Helper: run a regex pattern object ────────────────────────────────────
  function runPattern(patternObj, source) {
    const regex = new RegExp(patternObj.regex.source, patternObj.regex.flags);
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (patternObj.check(m[0])) {
        push(patternObj.label, m[0], source);
      }
    }
  }

  // ── 1. Company rules from backend (source = "company") ────────────────────
  const cr = BACKEND_RULES.companyRules;

  // ── FIX: Extract full emails containing the company domain ────────────────
  // Previously this pushed just "@company.com" as the value, so the general
  // email pass later found "john@company.com" (a different string) and also
  // fired. Now we extract the full email so `seen` blocks it correctly.
  cr.domains.forEach((domain) => {
    const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(
      `[A-Z0-9._%+\\-]+${escapedDomain}`,
      "gi"
    );
    let m;
    while ((m = emailRegex.exec(text)) !== null) {
      push("Company email", m[0], "company");
    }
  });

  // Keywords — case-insensitive substring match
  cr.keywords.forEach((keyword) => {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      push("Keyword", keyword, "company");
    }
  });

  // Custom patterns marked as company
  cr.customPatterns.forEach(({ label, pattern }) => {
    if (!pattern) return;
    try {
      const regex = new RegExp(pattern, "gi");
      let m;
      while ((m = regex.exec(text)) !== null) {
        push(label || "Custom pattern", m[0], "company");
      }
    } catch (e) {
      console.warn("[Valora] Skipping invalid company pattern:", pattern, e.message);
    }
  });

  // ── 2. Built-in patterns (source = "general") ─────────────────────────────
  // Because `seen` already contains any full emails matched as company above,
  // the email regex below will skip them automatically via push()'s seen check.
  if (VALORA_CONFIG.enableEmailDetection) {
    VALORA_CONFIG.companyDomains.length > 0
      ? runPattern(PATTERNS.companyEmail, "general")
      : runPattern(PATTERNS.genericEmail, "general");
  }
  if (VALORA_CONFIG.enableApiKeyDetection)     runPattern(PATTERNS.apiKey,      "general");
  if (VALORA_CONFIG.enableCreditCardDetection) runPattern(PATTERNS.creditCard,  "general");
  if (VALORA_CONFIG.enablePhoneDetection)      runPattern(PATTERNS.phone,       "general");
  if (VALORA_CONFIG.enableSSNDetection)        runPattern(PATTERNS.ssn,         "general");

  // ── 3. General custom patterns from backend (source = "general") ──────────
  BACKEND_RULES.generalRules.customPatterns.forEach(({ label, pattern }) => {
    if (!pattern) return;
    try {
      const regex = new RegExp(pattern, "gi");
      let m;
      while ((m = regex.exec(text)) !== null) {
        push(label || "Custom pattern", m[0], "general");
      }
    } catch (e) {
      console.warn("[Valora] Skipping invalid general pattern:", pattern, e.message);
    }
  });

  return results;
}