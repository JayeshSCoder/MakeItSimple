// If you are using the client-side Google SDK, import it here. Otherwise we fetch via the local proxy.
// import { getGenerativeModel } from '../scripts/google-generative-ai.js';

const API_URL = 'http://localhost:3000/api';

const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const summarizeBtn = document.getElementById('summarize-btn');
const explainBtn = document.getElementById('explain-btn');
const clearBtn = document.getElementById('clear-btn');

let currentTabId = null;

if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../scripts/pdf.worker.min.js';
}

const isPdfUrl = (url = '') => url.trim().toLowerCase().endsWith('.pdf');

const extractTextFromPDF = async (url) => {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js is not available');
  }

  const loadingTask = window.pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  let text = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || '').join(' ');
    text += `${pageText}\n`;
  }

  return text.trim();
};

const scrollToBottom = () => {
  chatHistory.scrollTop = chatHistory.scrollHeight;
};

const appendMessage = (sender, text, save = true) => {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.classList.add(sender === 'User' ? 'user-message' : sender === 'System' ? 'system-message' : 'bot-message');

  if (sender === 'AI' && window.marked) {
    msgDiv.innerHTML = marked.parse(text);
  } else if (sender === 'System') {
    msgDiv.innerHTML = text;
  } else {
    msgDiv.textContent = text;
  }

  chatHistory.appendChild(msgDiv);
  scrollToBottom();

  if (save && currentTabId) {
    saveMessage(currentTabId, { sender, text });
  }
};

const showLoader = () => {
  const loader = document.createElement('div');
  loader.id = 'loader-bubble';
  loader.classList.add('message', 'bot-message');
  loader.textContent = 'Thinking...';
  chatHistory.appendChild(loader);
  scrollToBottom();
  return loader;
};

const removeLoader = () => {
  const loader = document.getElementById('loader-bubble');
  if (loader) {
    loader.remove();
  }
};

const saveMessage = (tabId, msg) => {
  chrome.storage.local.get([tabId.toString()], (result) => {
    const history = result[tabId.toString()] || [];
    history.push(msg);
    chrome.storage.local.set({ [tabId.toString()]: history });
  });
};

const loadChatHistory = (tabId) => {
  chrome.storage.local.get([tabId.toString()], (result) => {
    const history = result[tabId.toString()] || [];
    chatHistory.innerHTML = '';
    history.forEach((msg) => appendMessage(msg.sender, msg.text, false));
  });
};

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      loadChatHistory(currentTabId);
    }
  });
});

const getPageContext = () => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        resolve('');
        return;
      }

      currentTabId = tab.id;

      if (isPdfUrl(tab.url)) {
        try {
          const pdfText = await extractTextFromPDF(tab.url);
          resolve(pdfText);
        } catch (error) {
          console.error('PDF extraction failed', error);
          resolve('');
        }
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'getPageText' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve('');
          return;
        }
        resolve(response ? response.text : '');
      });
    });
  });
};

const handleChat = async () => {
  const question = chatInput.value.trim();
  if (!question) return;

  appendMessage('User', question);
  chatInput.value = '';
  showLoader();

  try {
    const context = await getPageContext();
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context })
    });
    const data = await res.json();
    removeLoader();
    appendMessage('AI', data.answer || 'No response returned.');
  } catch (err) {
    removeLoader();
    appendMessage('AI', `Error: ${err.message}`);
  }
};

const handleSummarize = async () => {
  appendMessage('User', 'Summarize this page');
  showLoader();

  try {
    const context = await getPageContext();
    const res = await fetch(`${API_URL}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: context })
    });
    const data = await res.json();
    removeLoader();
    appendMessage('AI', data.summary || 'No summary available.');
  } catch (err) {
    removeLoader();
    appendMessage('AI', `Error: ${err.message}`);
  }
};

const handleExplain = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => window.getSelection().toString()
      });
      const selection = result[0].result;

      if (!selection) {
        alert('Please highlight some text on the page first!');
        return;
      }

      appendMessage('User', `Explain: ${selection}`);
      showLoader();
      const res = await fetch(`${API_URL}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selection })
      });
      const data = await res.json();
      removeLoader();
      appendMessage('AI', data.explanation || 'No explanation available.');
    } catch (err) {
      removeLoader();
      appendMessage('AI', 'Error getting selection.');
    }
  });
};

sendBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleChat();
});
summarizeBtn.addEventListener('click', handleSummarize);
explainBtn.addEventListener('click', handleExplain);
clearBtn.addEventListener('click', () => {
  chatHistory.innerHTML = '';
  if (currentTabId) {
    chrome.storage.local.remove(currentTabId.toString());
  }
});// Handles side panel interactions and messaging.
(function () {
  const STORAGE_KEY = "makeItSimpleChatHistory";
  let currentTabId = null;

  const summarizeBtn = document.getElementById("summarize-btn");
  const explainBtn = document.getElementById("explain-btn");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const chatHistory = document.getElementById("chat-history");
  const clearBtn = document.getElementById("clear-chat");

  if (!summarizeBtn || !explainBtn || !chatInput || !sendBtn || !chatHistory || !clearBtn) {
    console.error("Sidebar elements missing; aborting initialization.");
    return;
  }

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "../scripts/pdf.worker.min.js";
  } else {
    console.warn("PDF.js library not available; PDF extraction disabled.");
  }

  const isPdfUrl = (url = "") => typeof url === "string" && url.trim().toLowerCase().endsWith(".pdf");

  const extractTextFromPDF = async (url) => {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js is not loaded");
    }

    const loadingTask = window.pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = (content?.items || [])
        .map((item) => (item && typeof item.str === "string" ? item.str : ""))
        .join(" ");
      fullText += `${pageText}\n`;
    }

    return fullText.trim();
  };

  const handlePdfExtraction = async (tab, actionLabel) => {
    try {
      return await extractTextFromPDF(tab.url);
    } catch (error) {
      console.error(`${actionLabel} failed`, error);
      if (tab?.url?.startsWith("file://")) {
        appendMessage(
          "System",
          'To read local PDFs, you must enable "Allow access to file URLs" in the extension details page. <button type="button" class="link-button" data-open-settings="true">Open Settings</button>',
          false
        );
        const latestMessage = chatHistory.lastElementChild;
        const settingsButton = latestMessage?.querySelector('[data-open-settings="true"]');
        if (settingsButton) {
          settingsButton.addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "openExtensionsPage" });
          });
        }
      } else {
        appendMessage("bot", "Unable to read the PDF content.", true);
      }
      throw error;
    }
  };

  const scrollToBottom = () => {
    chatHistory.scrollTop = chatHistory.scrollHeight;
  };

  const saveMessage = (sender, text) => {
    if (!currentTabId) {
      return;
    }

    const normalizedSender = sender || "bot";
    const normalizedText = text != null ? String(text) : "";

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to read chat history", chrome.runtime.lastError);
        return;
      }

      const histories = result?.[STORAGE_KEY] || {};
      const conversation = histories[currentTabId] || [];
      conversation.push({ sender: normalizedSender, text: normalizedText });
      histories[currentTabId] = conversation;

      chrome.storage.local.set({ [STORAGE_KEY]: histories }, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to persist chat history", chrome.runtime.lastError);
        }
      });
    });
  };

  const appendMessage = (sender, text, shouldSave = false) => {
    const message = document.createElement("div");
    message.classList.add("message");
    const safeSender = (sender || "").toLowerCase();
    const safeText = text ?? "";
    if (safeSender === "system") {
      message.classList.add("system-message");
    } else {
      message.classList.add(safeSender === "user" ? "user-message" : "bot-message");
    }
    if (safeSender === "system") {
      message.innerHTML = safeText;
    } else {
      // NOTE: marked.parse outputs HTML; in production we should sanitize to avoid XSS.
      message.innerHTML = window.marked ? window.marked.parse(safeText) : safeText;
    }
    chatHistory.appendChild(message);
    if (shouldSave) {
      saveMessage(sender, safeText);
    }
    scrollToBottom();
  };

  const loadChatHistory = (tabId) => {
    if (!tabId) {
      return;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to load chat history", chrome.runtime.lastError);
        return;
      }

      const histories = result?.[STORAGE_KEY] || {};
      const conversation = histories[tabId] || [];
      chatHistory.innerHTML = "";
      conversation.forEach((entry) => {
        if (!entry) {
          return;
        }
        appendMessage(entry.sender, entry.text, false);
      });
    });
  };

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("Unable to detect active tab", chrome.runtime.lastError);
      return;
    }

    const activeTab = tabs && tabs[0];
    if (activeTab && typeof activeTab.id === "number") {
      currentTabId = activeTab.id;
      loadChatHistory(currentTabId);
    }
  });

  const showLoader = () => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message", "bot-message", "loader-wrapper");
    const loader = document.createElement("div");
    loader.classList.add("loader");
    wrapper.appendChild(loader);
    chatHistory.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  };

  const removeLoader = (loaderEl) => {
    if (loaderEl && typeof loaderEl.remove === "function") {
      loaderEl.remove();
    }
  };

  const getActiveTabDetails = () => {
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

        currentTabId = activeTab.id;
        resolve(activeTab);
      });
    });
  };

  const getActiveTabId = () => {
    if (currentTabId) {
      return Promise.resolve(currentTabId);
    }
    return getActiveTabDetails().then((tab) => tab.id);
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

  clearBtn.addEventListener("click", () => {
    chatHistory.innerHTML = "";
    if (!currentTabId) {
      return;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to read chat history for clearing", chrome.runtime.lastError);
        return;
      }

      const histories = result?.[STORAGE_KEY] || {};
      histories[currentTabId] = [];
      chrome.storage.local.set({ [STORAGE_KEY]: histories }, () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to clear chat history", chrome.runtime.lastError);
        }
      });
    });
  });

  summarizeBtn.addEventListener("click", async () => {
    let loader;
    try {
      const tab = await getActiveTabDetails();
      const pdfMode = isPdfUrl(tab.url);
      appendMessage("bot", pdfMode ? "Reading PDF..." : "Reading page content...", false);

      const pageText = pdfMode
        ? await handlePdfExtraction(tab, "PDF summarize")
        : await sendMessageToTab(tab.id, "getPageText");

      loader = showLoader();

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
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", data && data.summary ? data.summary : "No summary returned.", true);
    } catch (error) {
      console.error("Summarize request failed", error);
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", "Unable to summarize right now. Is the server running?", true);
    }
  });

  explainBtn.addEventListener("click", async () => {
    let loader;
    try {
      const tab = await getActiveTabDetails();
      const pdfMode = isPdfUrl(tab.url);
      let textToExplain = "";

      if (pdfMode) {
        appendMessage("User", "Explain this PDF", true);
        loader = showLoader();
        textToExplain = await handlePdfExtraction(tab, "PDF explain");
      } else {
        const selectionText = await sendMessageToTab(tab.id, "getSelectionText");
        const trimmedSelection = (selectionText || "").trim();

        if (!trimmedSelection) {
          alert("Please highlight some text first.");
          return;
        }

        appendMessage("User", `Explain this: ${trimmedSelection}`, true);
        loader = showLoader();
        textToExplain = trimmedSelection;
      }

      const response = await fetch("http://localhost:3000/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: textToExplain }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", data && data.explanation ? data.explanation : "No explanation returned.", true);
    } catch (error) {
      console.error("Explain request failed", error);
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", "Unable to explain right now. Is the server running?", true);
    }
  });

  const handleSend = async () => {
    const question = chatInput.value.trim();
    if (!question) {
      chatInput.focus();
      return;
    }

    appendMessage("User", question, true);
    chatInput.value = "";

    let loader;
    try {
      const tab = await getActiveTabDetails();
      const pdfMode = isPdfUrl(tab.url);
      if (pdfMode) {
        appendMessage("bot", "Reading PDF for context...", false);
      }
      const pageText = pdfMode
        ? await handlePdfExtraction(tab, "PDF chat")
        : await sendMessageToTab(tab.id, "getPageText");

      loader = showLoader();

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, context: pageText }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", data && data.answer ? data.answer : "No answer returned.", true);
    } catch (error) {
      console.error("Chat request failed", error);
      removeLoader(loader);
      scrollToBottom();
      appendMessage("bot", "Unable to answer right now. Is the server running?", true);
    }
  };

  sendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.action !== "triggerExplanation") {
      return;
    }

    const text = (message.text || "").trim();
    if (!text) {
      appendMessage("bot", "No text provided for explanation.");
      return;
    }

    appendMessage("User", `Explain: ${text}`, true);

    (async () => {
      let loader;
      try {
        loader = showLoader();
        const response = await fetch("http://localhost:3000/api/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        removeLoader(loader);
        scrollToBottom();
        appendMessage("bot", data && data.explanation ? data.explanation : "No explanation returned.", true);
      } catch (error) {
        console.error("Trigger explanation failed", error);
        removeLoader(loader);
        scrollToBottom();
        appendMessage("bot", "Unable to explain right now. Is the server running?", true);
      }
    })();
  });
})();
