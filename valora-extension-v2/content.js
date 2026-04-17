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

  // ── Company toast — mentions count and policy ──────────────────────────────
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
    toast.textContent = `🔒 Masking ${count} sensitive item${count > 1 ? "s" : ""} per company policy`;
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
    // Only pass general matches to modal — company ones are already auto-masked
    const generalMatches = currentMatches.filter((m) => m.source === "general");
    if (generalMatches.length > 0) {
      showModal(generalMatches);
    }
  }

  // ── Modal (general matches only — user selects what to mask) ──────────────
  function showModal(matches) {
    const existing = document.getElementById("valora-modal");
    if (existing) existing.remove();

    // Build checklist rows
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
          ⚠ Sensitive data detected
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
          items before sending.
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
          <button id="valora-btn-cancel"
            style="padding:8px 16px;background:transparent;color:#666688;
            border:1px solid #2a2a4a;border-radius:7px;font-size:13px;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // ── Select all / deselect all toggle ──────────────────────────────────
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

    // Update "Mask selected (N)" label as user checks/unchecks
    function updateMaskBtnLabel() {
      const count = modal.querySelectorAll("input[type=checkbox]:checked").length;
      document.getElementById("valora-btn-mask-selected").textContent =
        count > 0 ? `Mask selected (${count})` : "Mask selected";
    }
    modal.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", updateMaskBtnLabel);
    });

    // ── Mask selected ──────────────────────────────────────────────────────
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

      // Apply inline masking for each checked item
      checked.forEach((i) => {
        if (input) applyMaskInField(input, matches[i].value);
      });

      // Determine what remains unmasked
      const remaining = matches.filter((_, i) => !checked.includes(i));

      if (remaining.length === 0) {
        // Nothing left — close modal and unblock
        modal.remove();
        unblockSendButton();
        hideWarning();
        currentMatches = [];
      } else {
        // Rebuild modal with only remaining items so user can decide on them
        currentMatches = remaining;
        modal.remove();
        showModal(remaining);
      }
    });

    // ── Send with [REDACTED] — redact all remaining general matches ────────
    document.getElementById("valora-btn-redact").addEventListener("click", async () => {
      const input = getInputBox();
      if (input) {
        const original = getText(input);
        const redacted = redactText(original, matches); // utils/redactor.js
        setText(input, redacted);
      }

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

    // ── Cancel ─────────────────────────────────────────────────────────────
    document.getElementById("valora-btn-cancel").addEventListener("click", () => {
      modal.remove();
    });

    // Close on backdrop click
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

    // detector.js — returns [{ type, value, source }]
    const matches = detectSensitiveData(text);
    currentMatches = matches;

    if (!matches.length) {
      hideWarning();
      unblockSendButton();
      return;
    }

    const companyMatches = matches.filter((m) => m.source === "company");
    const generalMatches = matches.filter((m) => m.source === "general");

    // ── Company matches: auto-mask immediately + show toast with count ─────
    if (companyMatches.length) {
      companyMatches.forEach((m) => applyMaskInField(input, m.value));
      showCompanyToast(companyMatches.length);

      // Remove company matches from currentMatches so interceptSend only
      // sees general ones
      currentMatches = generalMatches;
    }

    // ── General matches: show banner + block send for user review ──────────
    if (generalMatches.length) {
      showWarning(generalMatches);
      blockSendButton();
    } else {
      // No general matches left — company ones are already auto-masked
      hideWarning();
      unblockSendButton();
    }
  }
})();