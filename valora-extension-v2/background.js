chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_RULES") {
    fetch("http://127.0.0.1:5000/api/rules", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: message.token ? `Bearer ${message.token}` : ""
      }
    })
    .then(res => res.json())
    .then(data => {
      // Safely grab rules from raw node response
      const rules = data.data || data;
      sendResponse({ success: true, rules });
    })
    .catch(err => {
      console.error("Background fetch error:", err);
      sendResponse({ success: false });
    });

    return true; // IMPORTANT (async response)
  }

  if (message.type === "LOG_VIOLATION") {
    fetch("http://127.0.0.1:5000/api/violations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: message.token ? `Bearer ${message.token}` : ""
      },
      body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(err => {
      console.error("Background log error:", err);
      sendResponse({ success: false });
    });

    return true;
  }
});
