chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Fetch rules — returns { companyRules, generalRules } ──────────────────
  if (message.type === "FETCH_RULES") {
    fetch("http://127.0.0.1:5000/api/rules", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: message.token ? `Bearer ${message.token}` : "",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        // Backend now returns { companyRules, generalRules }
        // Fall back gracefully if old shape arrives
        const companyRules = data.companyRules || data.data || data || {};
        const generalRules = data.generalRules || {};
        sendResponse({ success: true, companyRules, generalRules });
      })
      .catch((err) => {
        console.error("[Valora BG] Fetch rules error:", err);
        sendResponse({ success: false });
      });

    return true; // keep channel open for async response
  }

  // ── Audit logging ─────────────────────────────────────────────────────────
  if (message.type === "LOG_AUDIT") {
    fetch("http://127.0.0.1:5000/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
    .catch(async () => {
      const data = await chrome.storage.local.get(["valoraOfflineAuditLogs"]);
      const logs = data.valoraOfflineAuditLogs || [];
      logs.push(message.payload);
      await chrome.storage.local.set({ valoraOfflineAuditLogs: logs });
    });
  }

  // ── Log violation ─────────────────────────────────────────────────────────
  if (message.type === "LOG_VIOLATION") {
    fetch("http://127.0.0.1:5000/api/violations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: message.token ? `Bearer ${message.token}` : "",
      },
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => {
        console.error("[Valora BG] Log violation error:", err);
        sendResponse({ success: false });
      });

    return true;
  }

  // ── Heartbeat Ping ────────────────────────────────────────────────────────
  if (message.type === "PING_HEARTBEAT") {
    chrome.storage.local.get(["valoraLastHeartbeat"], (res) => {
      const now = Date.now();
      const last = res.valoraLastHeartbeat || 0;
      // Send once a day (24 hours)
      if (now - last > 24 * 60 * 60 * 1000) {
        fetch("http://127.0.0.1:5000/api/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: message.token ? `Bearer ${message.token}` : "",
          },
        })
          .then((res) => res.json())
          .then(() => chrome.storage.local.set({ valoraLastHeartbeat: now }))
          .catch((err) => console.error("[Valora BG] Heartbeat error:", err));
      }
    });
    return true;
  }
});