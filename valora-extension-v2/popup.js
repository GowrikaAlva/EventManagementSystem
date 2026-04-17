// ─── Valora Popup Script ──────────────────────────────────────────────────────
// Handles:
//   - Loading/saving toggle settings to chrome.storage
//   - Domain add/remove UI
//   - Backend health check (pings localhost:5000 to show online/offline status)
// ─────────────────────────────────────────────────────────────────────────────

const VALORA_API_BASE = "http://127.0.0.1:5000/api";

/* ── Auth Logic ── */
let isFirstLoginFlow = false;

function showView(view) {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById(view).classList.remove("hidden");
}

function showError(msg) {
  const err = document.getElementById("login-error");
  err.textContent = msg;
  err.style.display = "block";
}

async function checkAuth() {
  chrome.storage.local.get(["valoraToken"], (res) => {
    if (res.valoraToken) {
      showView("main-view");
      checkBackend();
    } else {
      showView("login-view");
    }
  });
}

// Check Email
document.getElementById("btn-login-next").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if(!email) return showError("Email required");
  
  try {
    const res = await fetch(`${VALORA_API_BASE}/auth/check-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if(res.ok && data.exists) {
      isFirstLoginFlow = data.isFirstLogin;
      document.getElementById("grp-password").classList.remove("hidden");
      document.getElementById("btn-login-next").classList.add("hidden");
      document.getElementById("btn-login-submit").classList.remove("hidden");
      document.getElementById("login-error").style.display = "none";
      if(isFirstLoginFlow) {
        document.querySelector("#grp-password label").textContent = "Set New Password";
      }
    } else {
      showError("Email not found");
    }
  } catch(e) {
    showError("Network error. Is backend running?");
  }
});

// Login or Set Password
document.getElementById("btn-login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if(!password) return showError("Password required");
  
  const endpoint = isFirstLoginFlow ? "/auth/set-password" : "/auth/login";
  const payload = isFirstLoginFlow ? { email, newPassword: password } : { email, password };
  
  try {
    const res = await fetch(`${VALORA_API_BASE}${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(res.ok && data.token) {
      chrome.storage.local.set({ valoraToken: data.token, valoraUser: data.user }, () => {
        showView("main-view");
        checkBackend();
      });
    } else {
      showError(data.error || "Login failed");
    }
  } catch(e) {
    showError("Network error");
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  chrome.storage.local.remove(["valoraToken", "valoraUser"], () => {
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("grp-password").classList.add("hidden");
    document.getElementById("btn-login-next").classList.remove("hidden");
    document.getElementById("btn-login-submit").classList.add("hidden");
    showView("login-view");
  });
});

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
    const tokenOptions = {};
    const stored = await new Promise((req) => chrome.storage.local.get(["valoraToken"], req));
    if (stored.valoraToken) tokenOptions.Authorization = `Bearer ${stored.valoraToken}`;

    const res = await fetch(`${VALORA_API_BASE}/rules`, {
      method: "GET",
      headers: { ...tokenOptions },
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

checkAuth();
