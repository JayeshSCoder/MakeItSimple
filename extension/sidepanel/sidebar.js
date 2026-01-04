// Handles side panel interactions and messaging.
(function () {
  const summarizeBtn = document.getElementById("summarize-btn");
  const explainBtn = document.getElementById("explain-btn");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const chatHistory = document.getElementById("chat-history");

  if (!summarizeBtn || !explainBtn || !chatInput || !sendBtn || !chatHistory) {
    console.error("Sidebar elements missing; aborting initialization.");
    return;
  }

  const appendMessage = (sender, text) => {
    const message = document.createElement("div");
    message.classList.add("message");
    message.classList.add(sender === "user" ? "user-message" : "bot-message");
    message.textContent = text;
    chatHistory.appendChild(message);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  };

  const truncateText = (text, limit = 100) => {
    const trimmed = (text || "").trim();
    if (trimmed.length <= limit) {
      return trimmed;
    }
    return `${trimmed.slice(0, limit).trim()}…`;
  };

  const withActiveTab = (callback) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to query tabs", chrome.runtime.lastError);
        appendMessage("bot", "Unable to communicate with the active tab.");
        return;
      }

      const activeTab = tabs && tabs[0];
      if (!activeTab || typeof activeTab.id !== "number") {
        appendMessage("bot", "No active tab available.");
        return;
      }

      callback(activeTab.id);
    });
  };

  const requestTabContent = (action, loadingMessage) => {
    withActiveTab((tabId) => {
      appendMessage("bot", loadingMessage);
      chrome.tabs.sendMessage(tabId, { action }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message failed", chrome.runtime.lastError);
          appendMessage("bot", "Could not retrieve content.");
          return;
        }

        const text = response && typeof response.text === "string" ? response.text : "";
        const preview = truncateText(text);
        appendMessage("bot", preview || "No content returned.");
      });
    });
  };

  summarizeBtn.addEventListener("click", () => {
    requestTabContent("getPageText", "Reading page content...");
  });

  explainBtn.addEventListener("click", () => {
    requestTabContent("getSelectionText", "Reading selected content...");
  });

  const handleSend = () => {
    const value = chatInput.value.trim();
    if (!value) {
      chatInput.focus();
      return;
    }
    appendMessage("user", value);
    chatInput.value = "";
  };

  sendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });
})();
