// ─── Valora Content Script ───────────────────────────────────────────────────
// This file is injected into every matching AI site (ChatGPT, Gemini, etc.)
//
// What it does, in order:
//   1. Reads popup settings from chrome.storage
//   2. Fetches company rules from the backend (services/api.js)
//   3. Every 500ms: scans the chat input for sensitive data (detector.js)
//   4. If found: shows a red warning banner
//   5. If found: dims the send button and intercepts clicks
//   6. When send is clicked: shows a modal with "Send with [REDACTED]" / "Cancel"
//   7. If user clicks redact: rewrites input, logs violation to backend, sends
//
// Load order guaranteed by manifest.json:
//   services/api.js  →  utils/redactor.js  →  detector.js  →  content.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (window.location.protocol === "chrome:" || window.location.href.startsWith("chrome://")) {
    console.warn("Skipping Valora on chrome internal pages");
    return;
  }
  
  console.log("Running Valora on:", window.location.href);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. SELECTORS


  // Tried in order — first match wins.
  // We check the specific ChatGPT ID first, then generic contenteditable,
  // then fall back to textarea for older/simpler sites.
  // ─────────────────────────────────────────────────────────────────────────
  const INPUT_SELECTORS = [
    "#prompt-textarea",               // ChatGPT (primary, most reliable)
    "div[contenteditable='true']",    // Gemini, Claude, Copilot
    "textarea",                       // legacy fallback
  ];

  // Send button selectors for each AI site.
  // ChatGPT's button has a data-testid; others use aria-label or type=submit.
  const SEND_BUTTON_SELECTORS = [
    "button[data-testid='send-button']",        // ChatGPT
    "button[aria-label='Send message']",        // Gemini
    "button[aria-label='Send Message']",        // Claude
    "button[aria-label='Submit message']",      // Copilot
    "button[type='submit']",                    // generic fallback
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // 2. STATE
  // ─────────────────────────────────────────────────────────────────────────
  let lastText      = "";        // last scanned text — skip if unchanged
  let warningVisible = false;    // is the red banner visible?
  let currentMatches = [];       // last set of matches found by findSensitiveData
  let sendBlocked    = false;    // is the send button currently blocked?

  let localRules = {
    domains: [],
    keywords: [],
    customPatterns: []
  };

  let companyRules = {
    domains: [],
    keywords: [],
    customPatterns: []
  };

  async function initRules() {
    if (!window.location.href.startsWith("http")) {
      console.warn("Invalid page for API call");
      return;
    }

    const rules = await fetchCompanyRules();
    console.log("Fetched rules:", rules);

    // Fallback if backend empty
    if (!rules.domains.length && !rules.keywords.length && !rules.customPatterns.length) {
      console.warn("Using local fallback rules");
      return;
    }

    companyRules = rules;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. STARTUP — load settings + fetch backend rules
  // ─────────────────────────────────────────────────────────────────────────
  (async function init() {
    const { valoraToken } = await new Promise((req) => chrome.storage.local.get(["valoraToken"], req));
    if (!valoraToken) {
      console.warn("[Valora] User not logged in. Extension detection halted. Please login via the popup.");
      return;
    }

    // 3a. Load user's popup toggle settings from chrome.storage
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
        applyStorageSettings(settings); // defined in detector.js
        if (settings.companyDomains) {
          localRules.domains = settings.companyDomains;
        }
        console.log("[Valora] Storage settings applied ✓");
      }
    );

    // 3b. Fetch company-specific rules from the backend
    await initRules();
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DOM HELPERS
  // ─────────────────────────────────────────────────────────────────────────

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

  // Read text from any input type: <textarea> uses .value, contenteditable uses .innerText
  function getText(el) {
    if (!el) return "";
    return (el.value !== undefined && el.value !== null)
      ? el.value
      : (el.innerText || "");
  }

  // Write text back into any input type
  function setText(el, text) {
    if (!el) return;
    if (el.value !== undefined && el.value !== null) {
      // Native textarea / input — fire events so React picks up the change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable div — set innerText and fire input event
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SEND BUTTON BLOCKING
  // ─────────────────────────────────────────────────────────────────────────

  function blockSendButton() {
    if (sendBlocked) return;
    const btn = getSendButton();
    if (!btn) return;

    sendBlocked = true;
    btn.dataset.valoraBlocked = "true";
    btn.dataset.valoraOrigTitle = btn.title || "";

    // Intercept at capture phase so we run before ChatGPT's own handler
    btn.addEventListener("click", interceptSend, { capture: true });
    btn.style.opacity = "0.45";
    btn.style.cursor  = "not-allowed";
    btn.title = "Valora: sensitive data detected — review before sending";
  }

  function unblockSendButton() {
    if (!sendBlocked) return;
    const btn = getSendButton();
    if (!btn) {
      sendBlocked = false;
      return;
    }

    btn.removeEventListener("click", interceptSend, { capture: true });
    btn.style.opacity = "";
    btn.style.cursor  = "";
    btn.title = btn.dataset.valoraOrigTitle || "";
    delete btn.dataset.valoraBlocked;
    delete btn.dataset.valoraOrigTitle;
    sendBlocked = false;
  }

  // Called when user clicks the (blocked) send button
  function interceptSend(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    showModal(currentMatches);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MODAL — shown when send is intercepted
  // ─────────────────────────────────────────────────────────────────────────

  function showModal(matches) {
    // Remove existing modal if any
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
            ${matches
              .map((m) => `<li><span class="valora-modal-tag">${m.type}</span></li>`)
              .join("")}
          </ul>
          <p class="valora-modal-note">
            Choosing <b>Send with [REDACTED]</b> will replace the sensitive values
            before sending. The original text is never sent or stored.
          </p>
        </div>
        <div id="valora-modal-actions">
          <button id="valora-btn-redact">Send with [REDACTED]</button>
          <button id="valora-btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Cancel — close modal, leave input unchanged, keep send button blocked
    document.getElementById("valora-btn-cancel").addEventListener("click", () => {
      modal.remove();
    });

    // Redact — rewrite input, log violation, unblock send, close modal
    document.getElementById("valora-btn-redact").addEventListener("click", async () => {
      const input = getInputBox();
      if (input) {
        const original = getText(input);
        // redactText() is defined in utils/redactor.js
        const redacted = redactText(original, matches);
        setText(input, redacted);
      }

      // Log violation type (no raw values) to backend
      // logViolation() is defined in services/api.js
      await logViolation(matches, window.location.href);

      modal.remove();
      unblockSendButton();
      hideWarning();
      lastText = "";        // reset so scanner re-evaluates the redacted text
      currentMatches = [];

      // Small delay then simulate a click on send so the message actually sends
      setTimeout(() => {
        const btn = getSendButton();
        if (btn) btn.click();
      }, 80);
    });

    // Close modal when clicking the dark backdrop outside the box
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. WARNING BANNER
  // ─────────────────────────────────────────────────────────────────────────

  function showWarning(matches) {
    let banner = document.getElementById("valora-warning");

    // Create banner once
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

    // Update content
    const body = document.getElementById("valora-body");
    body.innerHTML = `
      <div class="valora-title">
        ${matches.length} sensitive item${matches.length > 1 ? "s" : ""} detected
      </div>
      <ul class="valora-list">
        ${matches
          .map(
            (m) =>
              `<li>
                <span class="valora-tag">${m.type}</span>
                <code>${maskValue(m.value)}</code>
              </li>`
          )
          .join("")}
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

  // Show only first 3 + dots + last 3 characters — never show full value in UI
  function maskValue(value) {
    if (!value || value.length <= 6) return "••••••";
    const head = value.slice(0, 3);
    const tail = value.slice(-3);
    const dots = "•".repeat(Math.min(value.length - 6, 8));
    return `${head}${dots}${tail}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. SCAN LOOP
  // ─────────────────────────────────────────────────────────────────────────

  function scan() {
    const input = getInputBox();
    if (!input) return;

    const text = getText(input);

    // Skip if nothing changed since last scan
    if (text === lastText) return;
    lastText = text;

    if (!text || !text.trim()) {
      hideWarning();
      unblockSendButton();
      currentMatches = [];
      return;
    }

    const finalRules = {
      domains: [...localRules.domains, ...companyRules.domains],
      keywords: [...localRules.keywords, ...companyRules.keywords],
      customPatterns: [...localRules.customPatterns, ...companyRules.customPatterns]
    };

    console.log("Final Rules:", finalRules);
    console.log("Text:", text);

    const matches = detectSensitiveData(text, finalRules);
    currentMatches = matches;

    if (matches.length > 0) {
      showWarning(matches);
      blockSendButton();
    } else {
      hideWarning();
      unblockSendButton();
    }
  }

  // Poll every 500ms (catches paste, voice input, etc.)
  setInterval(scan, 500);

  // Also fire instantly on keyboard input for zero-delay feedback
  document.addEventListener("input", scan, { passive: true });

  console.log("[Valora] v2 content script loaded ✓");
})();
