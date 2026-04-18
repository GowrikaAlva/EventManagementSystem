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
  let currentMatches = [];
  let sendBlocked    = false;
  let toastShown     = false;
  let isProtectionEnabled = true;

  // ── Settings defaults (kept in sync via storage listener) ─────────────────
  const SETTINGS_DEFAULTS = {
    enableEmailDetection:      true,
    enableApiKeyDetection:     true,
    enableCreditCardDetection: true,
    enablePhoneDetection:      true,
    enableSSNDetection:        true,
    sensitiveKeywords:         [],
  };

  // ── Startup ────────────────────────────────────────────────────────────────
  (async function init() {
    const { valoraToken, valoraIndividualToken } = await new Promise((res) =>
      chrome.storage.local.get(["valoraToken", "valoraIndividualToken"], res)
    );

    if (!valoraToken && !valoraIndividualToken) {
      console.warn("[Valora] Not logged in — detection halted.");
      return;
    }

    const { valoraUserType } = await new Promise((res) =>
      chrome.storage.local.get(["valoraUserType"], res)
    );

    // Load initial settings
    chrome.storage.local.get(["isProtectionEnabled"], (res) => {
      isProtectionEnabled = res.isProtectionEnabled ?? true;
    });

    chrome.storage.local.get(SETTINGS_DEFAULTS, (settings) => {
      applyStorageSettings(settings);
      console.log("[Valora] Storage settings applied ✓");
    });

    // ── KEY FIX: Listen for popup toggle changes in real time ────────────────
    // Whenever the user flips a toggle in the popup, chrome.storage.onChanged
    // fires here in the content script. We immediately re-apply settings AND
    // force a re-scan of whatever text is currently in the input box.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      if (changes.isProtectionEnabled) {
        isProtectionEnabled = changes.isProtectionEnabled.newValue;
        if (!isProtectionEnabled) {
          hideWarning();
          unblockSendButton();
          currentMatches = [];
          // Force re-scan to clear effects immediately
          lastText = "";
          scan();
          return;
        }
      }

      const relevantKeys = [
        "enableEmailDetection",
        "enableApiKeyDetection",
        "enableCreditCardDetection",
        "enablePhoneDetection",
        "enableSSNDetection",
        "sensitiveKeywords",
      ];

      const hasRelevantChange = relevantKeys.some((key) => key in changes);
      if (!hasRelevantChange) return;

      // Build an updated settings object from the change set
      const updated = {};
      relevantKeys.forEach((key) => {
        if (changes[key] !== undefined) {
          updated[key] = changes[key].newValue;
        }
      });

      applyStorageSettings(updated);
      console.log("[Valora] Settings updated from popup:", updated);

      // Force re-scan with new settings by resetting lastText
      lastText = "";
      scan();
    });

    if (valoraUserType !== "individual") {
      chrome.runtime.sendMessage(
        { type: "FETCH_RULES", token: valoraToken },
        (response) => {
          if (response?.success) {
            loadBackendRules({
              companyRules: response.companyRules,
              generalRules: response.generalRules,
            });
          } else {
            console.warn("[Valora] Could not load backend rules — using local fallback.");
          }
        }
      );
    }

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

  // ── Masking helpers ────────────────────────────────────────────────────────
  function maskValue(value) {
    if (!value || value.length <= 6) return "••••••";
    return value.slice(0, 3) + "•".repeat(Math.min(value.length - 6, 8)) + value.slice(-3);
  }

  function applyMaskInField(field, originalValue) {
    const current = getText(field);
    const masked  = originalValue.slice(0, 2) + "*".repeat(Math.max(originalValue.length - 4, 2)) + originalValue.slice(-2);
    setText(field, current.split(originalValue).join(masked));
  }

  // ── Company toast ──────────────────────────────────────────────────────────
  function showCompanyToast(count) {
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
    toast.textContent = `Masking ${count} sensitive item${count > 1 ? "s" : ""} per company policy`;
    document.body.appendChild(toast);

    setTimeout(() => { toast.style.opacity = "0"; }, 3000);
    setTimeout(() => { toast.remove(); toastShown = false; }, 3400);
  }

  // ── Enter key interceptor ──────────────────────────────────────────────────
  function interceptEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      const generalMatches = currentMatches.filter((m) => m.source === "general");
      if (generalMatches.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showModal(generalMatches);
      }
    }
  }

  // ── Send button blocking ───────────────────────────────────────────────────
  function blockSendButton() {
    if (sendBlocked) return;
    const btn = getSendButton();
    if (btn) {
      btn.dataset.valoraBlocked   = "true";
      btn.dataset.valoraOrigTitle = btn.title || "";
      btn.addEventListener("click", interceptSend, { capture: true });
      btn.style.opacity = "0.45";
      btn.style.cursor  = "not-allowed";
      btn.title = "Valora: sensitive data detected — review before sending";
    }

    // Also block Enter key on the input field
    const input = getInputBox();
    if (input) {
      input.addEventListener("keydown", interceptEnter, { capture: true });
    }

    sendBlocked = true;
  }

  function unblockSendButton() {
    if (!sendBlocked) return;
    const btn = getSendButton();
    if (btn) {
      btn.removeEventListener("click", interceptSend, { capture: true });
      btn.style.opacity = "";
      btn.style.cursor  = "";
      btn.title = btn.dataset.valoraOrigTitle || "";
      delete btn.dataset.valoraBlocked;
      delete btn.dataset.valoraOrigTitle;
    }

    // Also remove Enter key blocker
    const input = getInputBox();
    if (input) {
      input.removeEventListener("keydown", interceptEnter, { capture: true });
    }

    sendBlocked = false;
  }

  function interceptSend(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const generalMatches = currentMatches.filter((m) => m.source === "general");
    if (generalMatches.length > 0) {
      showModal(generalMatches);
    }
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  function showModal(matches) {
    const existing = document.getElementById("valora-modal");
    if (existing) existing.remove();

    const rows = matches.map((m, i) => `
      <li style="display:flex;align-items:center;gap:10px;padding:8px 0;
        border-bottom:0.5px solid #2a2a4a;">
        <input type="checkbox" id="valora-chk-${i}" data-index="${i}"
          style="width:15px;height:15px;accent-color:#7c6af7;cursor:pointer;flex-shrink:0;">
        <label for="valora-chk-${i}"
          style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0;">
          <span style="background:#2a1f6e;color:#a09af5;font-size:11px;font-weight:600;
            padding:2px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;">${m.type}</span>
          <code style="font-family:monospace;font-size:12px;color:#c8c8e0;
            word-break:break-all;">${maskValue(m.value)}</code>
        </label>
      </li>`).join("");

    const modal = document.createElement("div");
    modal.id = "valora-modal";
    Object.assign(modal.style, {
      position:        "fixed",
      inset:           "0",
      background:      "rgba(0,0,0,0.55)",
      zIndex:          "2147483647",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
    });

    modal.innerHTML = `
      <div id="valora-modal-box" style="background:#12122a;border:1px solid #2a2a4a;
        border-radius:12px;padding:22px 24px;width:400px;max-width:92vw;max-height:80vh;
        overflow-y:auto;color:#e0e0f0;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

        <div style="font-size:15px;font-weight:600;margin-bottom:4px;">
          Warning: Sensitive data detected
        </div>
        <div style="font-size:12px;color:#8888aa;margin-bottom:14px;">
          Select items to mask inline in your message, or redact all with [REDACTED].
        </div>

        <div style="font-size:12px;color:#8888aa;margin-bottom:6px;
          display:flex;justify-content:space-between;align-items:center;">
          <span>${matches.length} item${matches.length > 1 ? "s" : ""} found</span>
          <span id="valora-select-all"
            style="color:#7c6af7;cursor:pointer;text-decoration:underline;">
            Select all
          </span>
        </div>

        <ul id="valora-match-list" style="list-style:none;margin:0 0 14px;padding:0;">
          ${rows}
        </ul>

        <div style="font-size:11px;color:#666688;margin-bottom:16px;line-height:1.6;">
          <b style="color:#9090b8;">Mask selected</b> — replaces chosen values with
          <code style="font-size:11px;background:#1e1e3a;padding:1px 4px;
            border-radius:3px;">***</code> inline in your message.<br>
          <b style="color:#9090b8;">Send with [REDACTED]</b> — replaces all remaining
          items before sending.<br>
          <b style="color:#e05555;">Send anyway</b> — sends your message as-is without
          any masking (violation will be logged).
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="valora-btn-mask-selected"
            style="flex:1;min-width:120px;padding:8px 12px;background:#2a1f6e;
            color:#a09af5;border:1px solid #4a3fae;border-radius:7px;font-size:13px;
            cursor:pointer;font-weight:500;">
            Mask selected
          </button>
          <button id="valora-btn-redact"
            style="flex:1;min-width:120px;padding:8px 12px;background:#1e1e3a;
            color:#c0c0e0;border:1px solid #3a3a5a;border-radius:7px;font-size:13px;
            cursor:pointer;">
            Send with [REDACTED]
          </button>
          <button id="valora-btn-send-anyway"
            style="padding:8px 16px;background:transparent;color:#e05555;
            border:1px solid #5a2a2a;border-radius:7px;font-size:13px;cursor:pointer;"
            title="Send message without any masking or redaction">
            Send anyway
          </button>
          <button id="valora-btn-cancel"
            style="padding:8px 16px;background:transparent;color:#666688;
            border:1px solid #2a2a4a;border-radius:7px;font-size:13px;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let allSelected = false;
    document.getElementById("valora-select-all").addEventListener("click", () => {
      allSelected = !allSelected;
      modal.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.checked = allSelected;
      });
      document.getElementById("valora-select-all").textContent =
        allSelected ? "Deselect all" : "Select all";
      updateMaskBtnLabel();
    });

    function updateMaskBtnLabel() {
      const count = modal.querySelectorAll("input[type=checkbox]:checked").length;
      document.getElementById("valora-btn-mask-selected").textContent =
        count > 0 ? `Mask selected (${count})` : "Mask selected";
    }
    modal.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", updateMaskBtnLabel);
    });

    document.getElementById("valora-btn-mask-selected").addEventListener("click", () => {
      const input   = getInputBox();
      const checked = [...modal.querySelectorAll("input[type=checkbox]:checked")]
        .map((cb) => parseInt(cb.dataset.index));

      if (checked.length === 0) {
        const btn = document.getElementById("valora-btn-mask-selected");
        btn.textContent = "Select at least one";
        setTimeout(() => { btn.textContent = "Mask selected"; }, 1500);
        return;
      }

      checked.forEach((i) => {
        if (input) applyMaskInField(input, matches[i].value);
      });

      const remaining = matches.filter((_, i) => !checked.includes(i));

      if (remaining.length === 0) {
        modal.remove();
        unblockSendButton();
        hideWarning();
        currentMatches = [];
      } else {
        currentMatches = remaining;
        modal.remove();
        showModal(remaining);
      }
    });

    document.getElementById("valora-btn-redact").addEventListener("click", async () => {
      const input = getInputBox();
      if (input) {
        const original = getText(input);
        const redacted = redactText(original, matches);
        setText(input, redacted);
      }

      await logViolation(matches, window.location.href);

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

    document.getElementById("valora-btn-send-anyway").addEventListener("click", async () => {
      // Log the violation even though the user chose to send as-is
      await logViolation(matches, window.location.href);

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

    document.getElementById("valora-btn-cancel").addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
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
      icon.innerHTML = "!";

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
  // NOTE: scan() now includes an async trial check for individual users.
  // Settings keep live via the chrome.storage.onChanged listener above.
  async function scan() {
    if (!isProtectionEnabled) {
      hideWarning();
      unblockSendButton();
      currentMatches = [];
      return;
    }

    const input = getInputBox();
    if (!input) return;

    const text = getText(input);
    if (text === lastText) return;

    const { valoraUserType, valoraTrialExpiry, valoraScanCount } = await new Promise(res =>
      chrome.storage.local.get(["valoraUserType", "valoraTrialExpiry", "valoraScanCount"], res)
    );

    if (
      valoraUserType === "individual" &&
      (Date.now() > Date.parse(valoraTrialExpiry || 0) || (valoraScanCount || 0) >= 50)
    ) {
      // Stop detection completely
      return;
    }

    lastText = text;

    if (!text || !text.trim()) {
      hideWarning();
      unblockSendButton();
      currentMatches = [];
      return;
    }

    const matches = detectSensitiveData(text);
    currentMatches = matches;

    if (!matches.length) {
      hideWarning();
      unblockSendButton();
      return;
    }

    const companyMatches = matches.filter((m) => m.source === "company");

// Exclude any general match whose value is already covered by a company rule
const companyValues  = new Set(companyMatches.map((m) => m.value));
const generalMatches = matches.filter(
  (m) => m.source === "general" && !companyValues.has(m.value)
);
    if (companyMatches.length) {
      companyMatches.forEach((m) => applyMaskInField(input, m.value));
      showCompanyToast(companyMatches.length);
      currentMatches = generalMatches;
    }

    if (generalMatches.length) {
      showWarning(generalMatches);
      blockSendButton();
    } else {
      hideWarning();
      unblockSendButton();
    }
  }
})();