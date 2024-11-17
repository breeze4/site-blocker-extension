// background.js
let domainTimers = {
  'www.reddit.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'old.reddit.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'www.twitter.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'www.x.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  }
};

// This only runs once, when the extension is first loaded or probably when the browser starts?
// Load existing timer data from storage

chrome.storage.local.get("domainTimers", (result) => {
  if (result.domainTimers) {
    domainTimers = result.domainTimers;
  }
});

// Helper function to reset timers if needed
function resetTimersIfNeeded() {
  const currentTime = Date.now();

  for (const [domain, timerData] of Object.entries(domainTimers)) {
    const nextResetTimestamp = timerData.resetInterval * 60 * 60 * 1000;
    if (currentTime - timerData.lastResetTimestamp >= nextResetTimestamp) {
      timerData.timeLeft = timerData.originalTime;
      timerData.lastResetTimestamp = currentTime;
      domainTimers[domain] = timerData;
    }
  }

  // Save updated timer data to storage
  chrome.storage.local.set({ domainTimers });
}

// Listener for navigation changes to keep track of time
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const url = new URL(tab.url);
    const domain = url.hostname;


    chrome.storage.local.get("domainTimers", (result) => {
      if (result.domainTimers) {
        domainTimers = result.domainTimers;

        resetTimersIfNeeded();

        if (domainTimers[domain]) {
          const timeLeft = domainTimers[domain].timeLeft;
          if (timeLeft > 0) {
            let timerId;

            const decrementTimer = () => {
              const endTime = Date.now();
              const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
              domainTimers[domain].timeLeft = Math.max(0, timeLeft - elapsedSeconds);
              console.log(`decreased time for ${domain} by ${elapsedSeconds} seconds`)

              chrome.storage.local.set({ domainTimers });
              if (domainTimers[domain].timeLeft <= 0) {
                console.log(`time has expired for ${domain}`)
                // chrome.tabs.remove(tabId);
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
          } else {
            // Time has expired, block navigation within the domain
            chrome.tabs.update(tabId, { url: "chrome://newtab" });
            console.log(`Time's up for ${domain}. Navigation is blocked.`);
          }
        }
      }
    });
  }
});

// Update domain timers to include lastResetTimestamp, originalTime, and resetInterval if not present
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("domainTimers", (result) => {
    domainTimers = result.domainTimers || {};
    const currentTime = Date.now();

    for (const domain in domainTimers) {
      if (!domainTimers[domain].lastResetTimestamp) {
        domainTimers[domain].lastResetTimestamp = currentTime;
      }
      if (!domainTimers[domain].originalTime) {
        domainTimers[domain].originalTime = domainTimers[domain].timeLeft;
      }
      if (!domainTimers[domain].resetInterval) {
        domainTimers[domain].resetInterval = 8 * 60 * 60 * 1000; // Default to 8 hours
      }
    }

    chrome.storage.local.set({ domainTimers });
  });
});
