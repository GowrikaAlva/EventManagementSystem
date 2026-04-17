// ─── Valora Content Script ────────────────────────────────────────────────────
// Load order: services/api.js → utils/redactor.js → detector.js → content.js
(function () {
  "use strict";

  if (window.location.protocol === "chrome:" || window.location.href.startsWith("chrome://")) {
    console.warn("[Valora] Skipping chrome internal page");
    return;
  }

  console.log("[Valora] Running on:", window.location.href);

  // ── Selectors ──────────────────────────────────────────────────────────────
  const INPUT_SELECTORS = [
    "#prompt-textarea",
    "div[contenteditable='true']",
    "textarea",
  ];
  const SEND_BUTTON_SELECTORS = [
    "button[data-testid='send-button']",
    "button[aria-label='Send message']",
    "button[aria-label='Send Message']",
    "button[aria-label='Submit message']",
    "button[type='submit']",
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let lastText       = "";
  let warningVisible = false;
  let currentMatches = [];        // ALL matches (company + general)
  let sendBlocked    = false;
  let toastShown     = false;     // show company toast only once per page load

  // ── Startup ────────────────────────────────────────────────────────────────
  (async function init() {
    const { valoraToken } = await new Promise((res) =>
      chrome.storage.local.get(["valoraToken"], res)
    );

    if (!valoraToken) {
      console.warn("[Valora] Not logged in — detection halted.");
      return;
    }

    // Load popup toggle settings
    chrome.storage.local.get(
      {
        enableEmailDetection:      true,
        enableApiKeyDetection:     true,
        enableCreditCardDetection: true,
        enablePhoneDetection:      true,
        enableSSNDetection:        true,
        companyDomains:            ["@company.com"],
      },
      (settings) => {
        applyStorageSettings(settings); // detector.js
        console.log("[Valora] Storage settings applied ✓");
      }
    );

    // Fetch company + general rules from backend via background.js
    chrome.runtime.sendMessage(
      { type: "FETCH_RULES", token: valoraToken },
      (response) => {
        if (response?.success) {
          // detector.js stores both buckets internally
          loadBackendRules({
            companyRules: response.companyRules,
            generalRules: response.generalRules,
          });
        } else {
          console.warn("[Valora] Could not load backend rules — using local fallback.");
        }
      }
    );

    // Start scan loop
    setInterval(scan, 500);
    document.addEventListener("input", scan, { passive: true });
    console.log("[Valora] v2 content script loaded ✓");
  })();

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function getInputBox() {
    for (const sel of INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getSendButton() {
    for (const sel of SEND_BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getText(el) {
    if (!el) return "";
    return el.value !== undefined && el.value !== null ? el.value : (el.innerText || "");
  }

  function setText(el, text) {
    if (!el) return;
    if (el.value !== undefined && el.value !== null) {
      const setter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,    "value")?.set;
      setter ? setter.call(el, text) : (el.value = text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  // ── Masking helper ─────────────────────────────────────────────────────────
  function maskValue(value) {
    if (!value || value.length <= 6) return "••••••";
    return value.slice(0, 3) + "•".repeat(Math.min(value.length - 6, 8)) + value.slice(-3);
  }

  function applyMaskInField(field, originalValue) {
    const current = getText(field);
    const masked  = originalValue.slice(0, 2) + "*".repeat(originalValue.length - 4) + originalValue.slice(-2);
    setText(field, current.split(originalValue).join(masked));
  }

  // ── Company toast (shows once per page session) ────────────────────────────
  function showCompanyToast() {
    if (toastShown) return;
    toastShown = true;

    const toast = document.createElement("div");
    toast.id = "valora-toast";
    Object.assign(toast.style, {
      position:     "fixed",
      bottom:       "24px",
      right:        "24px",
      background:   "#1a1a2e",
      color:        "#e0e0e0",
      padding:      "10px 18px",
      borderRadius: "8px",
      fontSize:     "13px",
      zIndex:       "2147483647",
      boxShadow:    "0 4px 20px rgba(0,0,0,0.45)",
      transition:   "opacity 0.4s ease",
      opacity:      "1",
      fontFamily:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      maxWidth:     "320px",
      lineHeight:   "1.4",
    });
    toast.textContent = "🔒 Masking sensitive info automatically (company policy)";
    document.body.appendChild(toast);

    setTimeout(() => { toast.style.opacity = "0"; }, 3000);
    setTimeout(() => { toast.remove(); },            3400);
  }

  // ── Send button blocking ───────────────────────────────────────────────────
  function blockSendButton() {
    if (sendBlocked) return;
    const btn = getSendButton();
    if (!btn) return;
    sendBlocked = true;
    btn.dataset.valoraBlocked    = "true";
    btn.dataset.valoraOrigTitle  = btn.title || "";
    btn.addEventListener("click", interceptSend, { capture: true });
    btn.style.opacity = "0.45";
    btn.style.cursor  = "not-allowed";
    btn.title = "Valora: sensitive data detected — review before sending";
  }

  function unblockSendButton() {
    if (!sendBlocked) return;
    const btn = getSendButton();
    if (!btn) { sendBlocked = false; return; }
    btn.removeEventListener("click", interceptSend, { capture: true });
    btn.style.opacity = "";
    btn.style.cursor  = "";
    btn.title = btn.dataset.valoraOrigTitle || "";
    delete btn.dataset.valoraBlocked;
    delete btn.dataset.valoraOrigTitle;
    sendBlocked = false;
  }

  function interceptSend(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    // Only pass general matches to the modal — company ones are already masked
    const generalMatches = currentMatches.filter((m) => m.source === "general");
    if (generalMatches.length > 0) {
      showModal(generalMatches);
    }
  }

  // ── Modal (general matches only — user decides) ────────────────────────────
  function showModal(matches) {
    const existing = document.getElementById("valora-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "valora-modal";
    modal.innerHTML = `
      <div id="valora-modal-box">
        <div id="valora-modal-title">⚠ Sensitive data detected</div>
        <div id="valora-modal-body">
          <p>Your message contains ${matches.length} sensitive item${matches.length > 1 ? "s" : ""}:</p>
          <ul id="valora-match-list">
            ${matches.map((m) => `<li><span class="valora-modal-tag">${m.type}</span> <code>${maskValue(m.value)}</code></li>`).join("")}
          </ul>
          <p class="valora-modal-note">
            <b>Send with [REDACTED]</b> replaces sensitive values before sending.
            Your original text is never stored.
          </p>
        </div>
        <div id="valora-modal-actions">
          <button id="valora-btn-redact">Send with [REDACTED]</button>
          <button id="valora-btn-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("valora-btn-cancel").addEventListener("click", () => modal.remove());

    document.getElementById("valora-btn-redact").addEventListener("click", async () => {
      const input = getInputBox();
      if (input) {
        const original = getText(input);
        const redacted = redactText(original, matches); // utils/redactor.js
        setText(input, redacted);
      }

      const { valoraToken } = await new Promise((res) =>
        chrome.storage.local.get(["valoraToken"], res)
      );
      await logViolation(matches, window.location.href); // services/api.js

      modal.remove();
      unblockSendButton();
      hideWarning();
      lastText       = "";
      currentMatches = [];

      setTimeout(() => {
        const btn = getSendButton();
        if (btn) btn.click();
      }, 80);
    });

    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  }

  // ── Warning banner ─────────────────────────────────────────────────────────
  function showWarning(matches) {
    let banner = document.getElementById("valora-warning");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "valora-warning";

      const closeBtn = document.createElement("button");
      closeBtn.id = "valora-close";
      closeBtn.innerHTML = "✕";
      closeBtn.title = "Dismiss";
      closeBtn.addEventListener("click", () => {
        banner.classList.remove("valora-visible");
        warningVisible = false;
      });

      const icon = document.createElement("span");
      icon.id = "valora-icon";
      icon.innerHTML = "⚠";

      const body = document.createElement("div");
      body.id = "valora-body";

      banner.appendChild(closeBtn);
      banner.appendChild(icon);
      banner.appendChild(body);
      document.body.appendChild(banner);
    }

    document.getElementById("valora-body").innerHTML = `
      <div class="valora-title">
        ${matches.length} sensitive item${matches.length > 1 ? "s" : ""} detected
      </div>
      <ul class="valora-list">
        ${matches.map((m) => `
          <li>
            <span class="valora-tag ${m.source === "company" ? "valora-tag-company" : ""}">${m.type}</span>
            <code>${maskValue(m.value)}</code>
            ${m.source === "company" ? '<span class="valora-auto-label">auto-masked</span>' : ""}
          </li>`).join("")}
      </ul>
    `;

    if (!warningVisible) {
      banner.classList.add("valora-visible");
      warningVisible = true;
    }
  }

  function hideWarning() {
    const banner = document.getElementById("valora-warning");
    if (banner && warningVisible) {
      banner.classList.remove("valora-visible");
      warningVisible = false;
    }
  }

  // ── Main scan loop ─────────────────────────────────────────────────────────
  function scan() {
    const input = getInputBox();
    if (!input) return;

    const text = getText(input);
    if (text === lastText) return;
    lastText = text;

    if (!text || !text.trim()) {
      hideWarning();
      unblockSendButton();
      currentMatches = [];
      return;
    }

    // detector.js — now returns [{ type, value, source }]
    const matches = detectSensitiveData(text);
    currentMatches = matches;

    if (!matches.length) {
      hideWarning();
      unblockSendButton();
      return;
    }

    const companyMatches = matches.filter((m) => m.source === "company");
    const generalMatches = matches.filter((m) => m.source === "general");

    // ── Company matches: auto-mask immediately + show toast ────────────────
    if (companyMatches.length) {
      companyMatches.forEach((m) => applyMaskInField(input, m.value));
      showCompanyToast();

      // After masking, remove company matches from currentMatches
      // so interceptSend only sees general ones
      currentMatches = generalMatches;
    }

    // ── General matches: show banner + block send for user review ──────────
    if (generalMatches.length) {
      showWarning(generalMatches);
      blockSendButton();
    } else {
      // No general matches left (only company, now auto-masked)
      hideWarning();
      unblockSendButton();
    }
  }
})();