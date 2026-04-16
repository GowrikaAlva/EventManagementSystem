# Valora Extension v2 — Setup Guide

## Folder Structure

```
valora-extension/
│
├── manifest.json          ← Chrome config: permissions, site list, file load order
│
├── services/
│   └── api.js             ← Talks to your backend: fetches rules, logs violations
│
├── utils/
│   └── redactor.js        ← Replaces sensitive text with [REDACTED]
│
├── detector.js            ← All regex patterns + merges backend rules
├── content.js             ← Injected into AI sites: scanning, banner, modal, blocking
├── styles.css             ← Warning banner + send-block modal styles
├── popup.html             ← Toolbar popup UI
├── popup.js               ← Popup logic: toggles, domains, backend status
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Install in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `valora-extension/` folder
5. Pin from the puzzle-piece icon in the toolbar

After any code change: click the **refresh** icon on the extension card.

---

## How the Files Connect

```
manifest.json
  └─ injects into AI sites in this order:
       1. services/api.js     → defines fetchCompanyRules(), logViolation()
       2. utils/redactor.js   → defines redactText()
       3. detector.js         → defines findSensitiveData(), loadBackendRules()
       4. content.js          → calls all of the above, runs the UI
```

`content.js` calls functions defined in the other files because the browser
loads them all into the same page scope in order.

---

## Works With or Without Backend

| Backend running? | What happens                                           |
|------------------|--------------------------------------------------------|
| Yes              | Fetches DB rules (keywords, domains, custom patterns). Logs violations. |
| No               | Falls back to local hardcoded rules silently. Extension still works. |

The popup shows a green/red dot indicating backend status.

---

## Test It

### Without backend (local rules only)
Open [chatgpt.com](https://chatgpt.com) and type:
- `hr@company.com` → Company email warning
- `sk-abc123abc123abc123abc` → API key warning
- `4111111111111111` → Credit card warning
- `123-45-6789` → SSN warning

### With backend running
Type `Project Falcon` → Sensitive keyword warning (from DB)
Type `EMP-001234` → Employee ID warning (custom pattern from DB)

Click the send button → Modal appears → Click "Send with [REDACTED]"
→ Text is rewritten → Violation logged to DB

---

## Customise Detection

### Add company domains (popup)
Click the extension icon → type `@yourcompany.com` → Add

### Add company domains (code)
Edit `detector.js` → `VALORA_CONFIG.companyDomains`

### Add new regex patterns
Add to the `PATTERNS` object in `detector.js` and call `runPattern()` for it.

### Add more AI sites
Edit `manifest.json` → `content_scripts[0].matches`

---

## Backend API Expected

The backend (see `backend/` folder) must expose:

| Method | Path              | Returns / Accepts                              |
|--------|-------------------|------------------------------------------------|
| GET    | /api/rules        | `{ domains[], keywords[], customPatterns[] }`  |
| POST   | /api/violations   | `{ url, matches[{ type }], timestamp }`        |
