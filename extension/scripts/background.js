const CHAT_STORAGE_KEY = "makeItSimpleChatHistory";
// NOTE: For local PDFs (file:// URLs), users must enable "Allow access to file URLs" in chrome://extensions.
let activeTabId = null;

console.log("Service Worker Loaded");

chrome.runtime.onInstalled.addListener(() => {
	console.log("Configuring side panel behavior");

	if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
		console.warn("sidePanel API not available in this version of Chrome");
		return;
	}

	chrome.sidePanel
		.setPanelBehavior({ openPanelOnActionClick: true })
		.then(() => {
			console.log("Side panel configured to open on action click");
		})
		.catch((error) => {
			console.error("Failed to set side panel behavior", error);
		});

	chrome.contextMenus.create({
		id: "explain-text",
		title: "MakeItSimple: Explain this",
		contexts: ["selection"],
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (!info || info.menuItemId !== "explain-text" || !tab || typeof tab.id !== "number") {
		return;
	}

	const text = info.selectionText || "";
	if (!text.trim()) {
		return;
	}

	chrome.sidePanel
		.open({ tabId: tab.id })
		.then(() => {
			setTimeout(() => {
				chrome.runtime.sendMessage({ action: "triggerExplanation", text });
			}, 500);
		})
		.catch((error) => {
			console.error("Failed to open side panel", error);
		});
});

const openSidePanelForTab = (tabId) => {
	if (!chrome.sidePanel || typeof tabId !== "number") {
		return;
	}

	chrome.sidePanel
		.open({ tabId })
		.catch((error) => console.error("Failed to open side panel for tab", tabId, error));
};

const closeSidePanelForTab = (tabId) => {
	if (!chrome.sidePanel || typeof chrome.sidePanel.close !== "function" || typeof tabId !== "number") {
		return;
	}

	chrome.sidePanel
		.close({ tabId })
		.catch((error) => console.error("Failed to close side panel for tab", tabId, error));
};

chrome.tabs.onActivated.addListener(({ tabId }) => {
	if (typeof tabId !== "number") {
		return;
	}

	if (activeTabId && activeTabId !== tabId) {
		closeSidePanelForTab(activeTabId);
	}

	activeTabId = tabId;
	openSidePanelForTab(tabId);
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
	if (chrome.runtime.lastError) {
		console.warn("Unable to detect initial active tab", chrome.runtime.lastError);
		return;
	}

	const initialTab = tabs && tabs[0];
	if (initialTab && typeof initialTab.id === "number") {
		activeTabId = initialTab.id;
		openSidePanelForTab(activeTabId);
	}
});

chrome.webNavigation.onCommitted.addListener((details) => {
	if (details.transitionType !== "reload" || typeof details.tabId !== "number") {
		return;
	}

	const tabKey = details.tabId.toString();
	chrome.storage.local.remove(tabKey, () => {
		if (chrome.runtime.lastError) {
			console.warn("Failed to remove tab-specific chat key", chrome.runtime.lastError);
		}
	});

	chrome.storage.local.get([CHAT_STORAGE_KEY], (result) => {
		if (chrome.runtime.lastError) {
			console.warn("Failed to load chat history for cleanup", chrome.runtime.lastError);
			return;
		}

		const histories = result?.[CHAT_STORAGE_KEY];
		if (!histories || !histories[details.tabId]) {
			return;
		}

		delete histories[details.tabId];
		chrome.storage.local.set({ [CHAT_STORAGE_KEY]: histories }, () => {
			if (chrome.runtime.lastError) {
				console.warn("Failed to update chat history after cleanup", chrome.runtime.lastError);
			}
		});
	});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!message || message.action !== "openExtensionsPage") {
		return;
	}

	const extensionUrl = `chrome://extensions/?id=${chrome.runtime.id}`;
	chrome.tabs.create({ url: extensionUrl }, () => {
		if (chrome.runtime.lastError) {
			console.error("Failed to open extensions page", chrome.runtime.lastError);
		}
	});
	sendResponse({ opened: true });
	return true;
});
