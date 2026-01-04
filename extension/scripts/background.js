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
});
