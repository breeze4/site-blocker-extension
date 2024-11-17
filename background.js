let domainTimers = {};

// This only runs once, when the extension is first loaded or probably when the browser starts?
// Load existing timer data from storage
chrome.storage.local.get("domainTimers", (result) => {
  if (result.domainTimers) {
    domainTimers = result.domainTimers;
  }
});

// Listener for navigation changes to keep track of time
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const url = new URL(tab.url);
    const domain = url.hostname;

    if (domainTimers[domain]) {
      const timeLeft = domainTimers[domain];
      if (timeLeft > 0) {
        let timerId;

        const decrementTimer = () => {
          const endTime = Date.now();
          const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
          domainTimers[domain] = Math.max(0, timeLeft - elapsedSeconds);

          chrome.storage.local.set({ domainTimers });
          if (domainTimers[domain] <= 0) {
            console.log(`time has expired for ${domain}`)
          }
        };

        const startTime = Date.now();
        timerId = setTimeout(() => {
          decrementTimer();
          clearTimeout(timerId);
        }, timeLeft * 1000);

        chrome.tabs.onRemoved.addListener((closedTabId) => {
          if (tabId === closedTabId) {
            decrementTimer();
            clearTimeout(timerId);
          }
        });
      }
    }
  }
});
