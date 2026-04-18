// ─── Valora Detector ──────────────────────────────────────────────────────────
// Load order: services/api.js → utils/redactor.js → detector.js → content.js

const VALORA_CONFIG = {
  companyDomains: ["@company.com", "@myorg.com", "@gmail.com"],
  sensitiveKeywords: [],
  enableEmailDetection:      true,
  enableApiKeyDetection:     true,
  enableCreditCardDetection: true,
  enablePhoneDetection:      true,
  enableAadhaarDetection:    true,
  enablePanDetection:        true,
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
  if (typeof settings.enableAadhaarDetection    === "boolean") VALORA_CONFIG.enableAadhaarDetection    = settings.enableAadhaarDetection;
  if (typeof settings.enablePanDetection        === "boolean") VALORA_CONFIG.enablePanDetection        = settings.enablePanDetection;
  if (Array.isArray(settings.companyDomains) && settings.companyDomains.length > 0) {
    VALORA_CONFIG.companyDomains = settings.companyDomains;
  }
  if (Array.isArray(settings.sensitiveKeywords) && settings.sensitiveKeywords.length > 0) {
    VALORA_CONFIG.sensitiveKeywords = settings.sensitiveKeywords;
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
    regex: /(?:\+91[\s-]?)?[6-9]\d{4}\s?\d{5}\b/g,
    label: "Phone number",
    check: () => true,
  },
  aadhaar: {
    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    label: "Aadhaar Number",
    check: () => true,
  },
  pan: {
    regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    label: "PAN Number",
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
  const seen    = new Set();

  function push(type, value, source) {
    if (!seen.has(value)) {
      seen.add(value);
      results.push({ type, value, source });
    }
  }

  // ── PASS 1: Aadhaar detection (Highest Priority) ──────────────────────────
  if (VALORA_CONFIG.enableAadhaarDetection) {
    const aadhaarRegex = new RegExp(PATTERNS.aadhaar.regex.source, PATTERNS.aadhaar.regex.flags);
    let m;
    while ((m = aadhaarRegex.exec(text)) !== null) {
      // Logic: Ensure it's not preceded by +91 or +
      const pos = m.index;
      const lookback = text.slice(Math.max(0, pos - 4), pos);
      if (lookback.includes("+") || lookback.includes("+91")) {
        continue;
      }
      push(PATTERNS.aadhaar.label, m[0], "general");
    }
  }

  // ── PASS 2: All other patterns run on "cleaned" text ──────────────────────
  // We remove detected Aadhaar values from text so they don't trigger phone 
  // or other numeric detections incorrectly.
  let cleanText = text;
  results.forEach(res => {
    if (res.type === "Aadhaar Number") {
      const escaped = res.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Replace with spaces to preserve original string length and offsets
      cleanText = cleanText.replace(new RegExp(escaped, "g"), " ".repeat(res.value.length));
    }
  });

  // Helper to run patterns on cleanText
  function runOnClean(patternObj, source) {
    const regex = new RegExp(patternObj.regex.source, patternObj.regex.flags);
    let m;
    while ((m = regex.exec(cleanText)) !== null) {
      if (patternObj.check(m[0])) {
        push(patternObj.label, m[0], source);
      }
    }
  }

  // Company rules
  const cr = BACKEND_RULES.companyRules;
  cr.domains.forEach((domain) => {
    const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(`[A-Z0-9._%+\\-]+${escapedDomain}`, "gi");
    let m;
    while ((m = emailRegex.exec(cleanText)) !== null) {
      push("Company email", m[0], "company");
    }
  });

  cr.keywords.forEach((keyword) => {
    if (cleanText.toLowerCase().includes(keyword.toLowerCase())) {
        push("Keyword", keyword, "company");
    }
  });

  VALORA_CONFIG.sensitiveKeywords.forEach((keyword) => {
    if (cleanText.toLowerCase().includes(keyword.toLowerCase())) {
        push("Keyword", keyword, "company");
    }
  });

  cr.customPatterns.forEach(({ label, pattern }) => {
    if (!pattern) return;
    try {
      const regex = new RegExp(pattern, "gi");
      let m;
      while ((m = regex.exec(cleanText)) !== null) {
        push(label || "Custom pattern", m[0], "company");
      }
    } catch (e) {}
  });

  // Built-in patterns
  if (VALORA_CONFIG.enableEmailDetection) {
    VALORA_CONFIG.companyDomains.length > 0
      ? runOnClean(PATTERNS.companyEmail, "general")
      : runOnClean(PATTERNS.genericEmail, "general");
  }
  if (VALORA_CONFIG.enableApiKeyDetection)     runOnClean(PATTERNS.apiKey,      "general");
  if (VALORA_CONFIG.enableCreditCardDetection) runOnClean(PATTERNS.creditCard,  "general");
  if (VALORA_CONFIG.enablePhoneDetection)      runOnClean(PATTERNS.phone,       "general");
  if (VALORA_CONFIG.enablePanDetection)        runOnClean(PATTERNS.pan,         "general");

  // General custom patterns
  BACKEND_RULES.generalRules.customPatterns.forEach(({ label, pattern }) => {
    if (!pattern) return;
    try {
      const regex = new RegExp(pattern, "gi");
      let m;
      while ((m = regex.exec(cleanText)) !== null) {
        push(label || "Custom pattern", m[0], "general");
      }
    } catch (e) {}
  });

  return results;
}