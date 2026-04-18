// ─── Valora API Service ───────────────────────────────────────────────────────
// Purpose : Talk to the Chrome Background script to bypass CORS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCompanyRules() {
  const stored = await new Promise((res) =>
    chrome.storage.local.get(["valoraToken"], res)
  );

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "FETCH_RULES",
        token: stored.valoraToken
      },
      (response) => {
        if (response && response.success && response.rules) {
          console.log("Rules from background:", response.rules);
          resolve({
            domains: response.rules.domains || [],
            keywords: response.rules.keywords || [],
            customPatterns: response.rules.customPatterns || []
          });
        } else {
          console.warn("Using fallback rules");
          resolve({ domains: [], keywords: [], customPatterns: [] });
        }
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function logViolation(matches, pageUrl) {
  if (!matches || matches.length === 0) return;

  const stored = await new Promise((res) =>
    chrome.storage.local.get(["valoraToken", "valoraUserType", "valoraScanCount"], res)
  );

  if (stored.valoraUserType === "individual") {
    const newCount = (stored.valoraScanCount || 0) + 1;

    await new Promise(res =>
      chrome.storage.local.set({ valoraScanCount: newCount }, res)
    );
  }

  const payload = {
    url: pageUrl || window.location.href,
    matches: matches.map((m) => ({ type: m.type })),
    timestamp: new Date().toISOString(),
  };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "LOG_VIOLATION",
        token: stored.valoraToken,
        payload
      },
      (response) => {
        if (response && response.success) {
          console.log("[Valora] Violation logged via background ✓", payload);
        } else {
          console.warn("[Valora] Log failed via background");
        }
        resolve();
      }
    );
  });
}