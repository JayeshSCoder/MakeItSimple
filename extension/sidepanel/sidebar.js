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

  const getActiveTabId = () => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const activeTab = tabs && tabs[0];
        if (!activeTab || typeof activeTab.id !== "number") {
          reject(new Error("No active tab available."));
          return;
        }

        resolve(activeTab.id);
      });
    });
  };

  const sendMessageToTab = (tabId, action) => {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const text = response && typeof response.text === "string" ? response.text : "";
        resolve(text);
      });
    });
  };

  const requestTabContent = async (action, loadingMessage) => {
    appendMessage("bot", loadingMessage);
    try {
      const tabId = await getActiveTabId();
      const text = await sendMessageToTab(tabId, action);
      const preview = truncateText(text);
      appendMessage("bot", preview || "No content returned.");
    } catch (error) {
      console.error("Failed to retrieve tab content", error);
      appendMessage("bot", "Could not retrieve content.");
    }
  };

  summarizeBtn.addEventListener("click", async () => {
    appendMessage("bot", "Reading page content...");
    try {
      const tabId = await getActiveTabId();
      const pageText = await sendMessageToTab(tabId, "getPageText");
      appendMessage("bot", "Analyzing...");

      const response = await fetch("http://localhost:3000/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: pageText }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      appendMessage("bot", data && data.summary ? data.summary : "No summary returned.");
    } catch (error) {
      console.error("Summarize request failed", error);
      appendMessage("bot", "Unable to summarize right now. Is the server running?");
    }
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
