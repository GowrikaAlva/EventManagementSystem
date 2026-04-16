// ─── Valora Popup Script ──────────────────────────────────────────────────────
// Handles:
//   - Loading/saving toggle settings to chrome.storage
//   - Domain add/remove UI
//   - Backend health check (pings localhost:5000 to show online/offline status)
// ─────────────────────────────────────────────────────────────────────────────

const VALORA_API_BASE = "http://localhost:5000/api";

const DEFAULTS = {
  enableEmailDetection:      true,
  enableApiKeyDetection:     true,
  enableCreditCardDetection: true,
  enablePhoneDetection:      true,
  enableSSNDetection:        true,
  companyDomains: ["@company.com"],
};

// ── 1. Load settings on popup open ───────────────────────────────────────────
chrome.storage.local.get(DEFAULTS, (settings) => {
  document.getElementById("toggle-email").checked  = settings.enableEmailDetection;
  document.getElementById("toggle-apikey").checked = settings.enableApiKeyDetection;
  document.getElementById("toggle-cc").checked     = settings.enableCreditCardDetection;
  document.getElementById("toggle-phone").checked  = settings.enablePhoneDetection;
  document.getElementById("toggle-ssn").checked    = settings.enableSSNDetection;
  renderDomains(settings.companyDomains || []);
});

// ── 2. Save toggle changes immediately ───────────────────────────────────────
const TOGGLE_MAP = {
  "toggle-email":  "enableEmailDetection",
  "toggle-apikey": "enableApiKeyDetection",
  "toggle-cc":     "enableCreditCardDetection",
  "toggle-phone":  "enablePhoneDetection",
  "toggle-ssn":    "enableSSNDetection",
};

Object.keys(TOGGLE_MAP).forEach((id) => {
  document.getElementById(id).addEventListener("change", function () {
    chrome.storage.local.set({ [TOGGLE_MAP[id]]: this.checked });
  });
});

// ── 3. Domain management ──────────────────────────────────────────────────────

function renderDomains(domains) {
  const list = document.getElementById("domain-list");
  list.innerHTML = "";

  if (!domains || domains.length === 0) return;

  domains.forEach((domain) => {
    const chip = document.createElement("span");
    chip.className = "domain-chip";
    chip.innerHTML = `${domain} <button title="Remove" data-d="${domain}">✕</button>`;
    list.appendChild(chip);
  });

  list.querySelectorAll("button[data-d]").forEach((btn) => {
    btn.addEventListener("click", () => removeDomain(btn.dataset.d));
  });
}

function addDomain() {
  const input = document.getElementById("domain-input");
  let value = (input.value || "").trim().toLowerCase();
  if (!value) return;

  // Auto-prefix @ if missing
  if (!value.startsWith("@")) value = "@" + value;

  chrome.storage.local.get({ companyDomains: DEFAULTS.companyDomains }, (s) => {
    const current = s.companyDomains || [];
    if (current.includes(value)) {
      input.value = "";
      return;
    }
    const updated = [...current, value];
    chrome.storage.local.set({ companyDomains: updated }, () => {
      renderDomains(updated);
      input.value = "";
    });
  });
}

function removeDomain(domain) {
  chrome.storage.local.get({ companyDomains: DEFAULTS.companyDomains }, (s) => {
    const updated = (s.companyDomains || []).filter((d) => d !== domain);
    chrome.storage.local.set({ companyDomains: updated }, () => renderDomains(updated));
  });
}

document.getElementById("add-domain-btn").addEventListener("click", addDomain);
document.getElementById("domain-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// ── 4. Backend health check ───────────────────────────────────────────────────
// Pings GET /api/rules with a short timeout.
// Shows green "Backend online" or red "Backend offline" in the header bar.

async function checkBackend() {
  const dot   = document.getElementById("backend-dot");
  const label = document.getElementById("backend-label");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${VALORA_API_BASE}/rules`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      dot.className   = "online";
      label.textContent = "Backend online — DB rules active";
      label.style.color = "#48bb78";
    } else {
      dot.className   = "offline";
      label.textContent = `Backend error (HTTP ${res.status}) — using local rules`;
      label.style.color = "#fc8181";
    }
  } catch (_) {
    dot.className   = "offline";
    label.textContent = "Backend offline — using local rules only";
    label.style.color = "#fc8181";
  }
}

checkBackend();
