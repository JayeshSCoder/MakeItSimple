chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const sendPayload = (payload) => {
    try {
      sendResponse(payload);
    } catch (error) {
      console.error("Failed to send response", error);
    }
  };

  if (!request || !request.action) {
    sendPayload({ error: "No action specified" });
    return true;
  }

  if (request.action === "getPageText") {
    const rawText = document.body ? document.body.innerText : "";
    const cleanText = rawText.replace(/\s+/g, " ").trim();
    sendPayload({ text: cleanText });
    return true;
  }

  if (request.action === "getSelectionText") {
    const selection = window.getSelection();
    sendPayload({ text: selection ? selection.toString() : "" });
    return true;
  }

  sendPayload({ error: `Unknown action: ${request.action}` });
  return true;
});
