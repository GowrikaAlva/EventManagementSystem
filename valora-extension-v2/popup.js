// ─── Valora Popup Script ──────────────────────────────────────────────────────
// Handles:
//   - Loading/saving toggle settings to chrome.storage
//   - Domain add/remove UI
//   - Backend health check (pings localhost:5000 to show online/offline status)
// ─────────────────────────────────────────────────────────────────────────────

const VALORA_API_BASE = "http://127.0.0.1:5000/api";

/* ── Auth Logic ── */
let isFirstLoginFlow = false;

let viewHistory = [];
const ALL_VIEWS = ["login-view", "main-view", "entry-view", "register-view", "paywall-view", "org-role-view"];

function showView(viewId, isBack = false) {
  const currentView = ALL_VIEWS.find(id => !document.getElementById(id).classList.contains("hidden"));
  if (currentView && currentView !== viewId && !isBack) {
    viewHistory.push(currentView);
  }

  ALL_VIEWS.forEach(id => document.getElementById(id).classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
}

function goBack() {
  if (viewHistory.length === 0) return;
  const prevView = viewHistory.pop();
  showView(prevView, true);
}

function showError(msg) {
  const err = document.getElementById("login-error");
  err.textContent = msg;
  err.style.display = "block";
}

async function checkAuth() {
  chrome.storage.local.get([
    "valoraToken", 
    "valoraIndividualToken", 
    "valoraTrialExpiry", 
    "valoraScanCount"
  ], (res) => {
    if (res.valoraToken) {
      showView("main-view");
      checkBackend();
    } else if (res.valoraIndividualToken) {
      if (Date.now() > Date.parse(res.valoraTrialExpiry || 0) || (res.valoraScanCount || 0) >= 50) {
        showView("paywall-view");
      } else {
        showView("main-view");
        checkBackend();
      }
    } else {
      showView("entry-view");
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
  chrome.storage.local.clear(() => {
    location.reload();
  });
});

document.getElementById("btn-paywall-logout").addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    location.reload();
  });
});

// ── Entry View Handlers ──
document.getElementById("btn-entry-single").addEventListener("click", () => showView("register-view"));
document.getElementById("btn-entry-org").addEventListener("click", () => showView("org-role-view"));

// ── Org Role View Handlers ──
document.getElementById("btn-org-employee").addEventListener("click", () => showView("login-view"));
document.getElementById("btn-org-admin").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:5173/" });
});
// Attach back button events
document.querySelectorAll(".back-btn").forEach(btn => {
  btn.addEventListener("click", goBack);
});

// Register View Switch
document.getElementById("btn-switch-login").addEventListener("click", () => {
  showView("login-view"); // Usually single/org login might be separate, but per spec, org employee is existing login view
});

// ── Registration Handler ──
function showRegisterError(msg) {
  const err = document.getElementById("register-error");
  err.textContent = msg;
  err.style.display = "block";
}

document.getElementById("btn-register-submit").addEventListener("click", async () => {
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("register-confirm-password").value;
  
  if(!email || !password) return showRegisterError("Email and password required");
  if(password !== confirmPassword) return showRegisterError("Passwords do not match");

  try {
    const res = await fetch(`${VALORA_API_BASE}/auth/individual/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(res.ok && data.token) {
      chrome.storage.local.set({ 
        valoraIndividualToken: data.token, 
        valoraTrialExpiry: data.trialExpiresAt,
        valoraUserType: data.userType,
        valoraScanCount: 0
      }, () => {
        checkAuth();
      });
    } else {
      showRegisterError(data.error || "Registration failed");
    }
  } catch(e) {
    showRegisterError("Network error. Is backend running?");
  }
});

const DEFAULTS = {
  isProtectionEnabled:       true,
  enableEmailDetection:      true,
  enableApiKeyDetection:     true,
  enableCreditCardDetection: true,
  enablePhoneDetection:      true,
  enableAadhaarDetection:    true,
  enablePanDetection:        true,
  sensitiveKeywords: [],
};

// ── 1. Load settings on popup open ───────────────────────────────────────────
chrome.storage.local.get(DEFAULTS, (settings) => {
  document.getElementById("toggle-email").checked  = settings.enableEmailDetection;
  document.getElementById("toggle-apikey").checked = settings.enableApiKeyDetection;
  document.getElementById("toggle-cc").checked     = settings.enableCreditCardDetection;
  document.getElementById("toggle-phone").checked  = settings.enablePhoneDetection;
  document.getElementById("toggle-aadhaar").checked = settings.enableAadhaarDetection;
  document.getElementById("toggle-pan").checked     = settings.enablePanDetection;
  renderKeywords(settings.sensitiveKeywords || []);
});

// ── 2. Save toggle changes immediately ───────────────────────────────────────
const TOGGLE_MAP = {
  "toggle-email":   "enableEmailDetection",
  "toggle-apikey":  "enableApiKeyDetection",
  "toggle-cc":      "enableCreditCardDetection",
  "toggle-phone":   "enablePhoneDetection",
  "toggle-aadhaar": "enableAadhaarDetection",
  "toggle-pan":     "enablePanDetection",
};

Object.keys(TOGGLE_MAP).forEach((id) => {
  document.getElementById(id).addEventListener("change", function () {
    chrome.storage.local.set({ [TOGGLE_MAP[id]]: this.checked });
  });
});

// ── 3. Keyword management ──────────────────────────────────────────────────────

function renderKeywords(keywords) {
  const list = document.getElementById("keyword-list");
  list.innerHTML = "";

  if (!keywords || keywords.length === 0) return;

  keywords.forEach((keyword) => {
    const chip = document.createElement("span");
    chip.className = "domain-chip";
    chip.innerHTML = `${keyword} <button title="Remove" data-k="${keyword}">✕</button>`;
    list.appendChild(chip);
  });

  list.querySelectorAll("button[data-k]").forEach((btn) => {
    btn.addEventListener("click", () => removeKeyword(btn.dataset.k));
  });
}

function addKeyword() {
  const input = document.getElementById("keyword-input");
  let value = (input.value || "").trim().toLowerCase();
  if (!value) return;

  chrome.storage.local.get({ sensitiveKeywords: DEFAULTS.sensitiveKeywords }, (s) => {
    const current = s.sensitiveKeywords || [];
    if (current.includes(value)) {
      input.value = "";
      return;
    }
    const updated = [...current, value];
    chrome.storage.local.set({ sensitiveKeywords: updated }, () => {
      renderKeywords(updated);
      input.value = "";
    });
  });
}

function removeKeyword(keyword) {
  chrome.storage.local.get({ sensitiveKeywords: DEFAULTS.sensitiveKeywords }, (s) => {
    const updated = (s.sensitiveKeywords || []).filter((k) => k !== keyword);
    chrome.storage.local.set({ sensitiveKeywords: updated }, () => renderKeywords(updated));
  });
}

document.getElementById("add-keyword-btn").addEventListener("click", addKeyword);
document.getElementById("keyword-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addKeyword();
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

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