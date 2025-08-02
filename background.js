// background.js

// Default timers for commonly used websites. These are used to initialize the extension's storage when it's first installed.
let defaultDomainTimers = {
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
  'twitter.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'x.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'instagram.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
  'www.instagram.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 8,
    lastResetTimestamp: Date.now()
  },
};

// This variable will hold the interval ID for the currently active timer. There should only be one timer running at any given time.
let activeTimerIntervalId = null;

// A Promise-based wrapper for chrome.storage.local.set to allow for async/await syntax. This makes the code cleaner and easier to read.
function setToStorage(keyValuePairs) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(keyValuePairs, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// A Promise-based wrapper for chrome.storage.local.get, similar to setToStorage, for cleaner asynchronous operations.
function getFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      console.debug('Getting the domain timers', JSON.stringify(result))
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

// Asynchronously retrieves the domain timers from storage. This function serves as a single point of access to the stored timers.
async function getDomainTimers() {
  try {
    const domainTimers = await getFromStorage("domainTimers");
    console.debug("Domain Timers:", domainTimers);
    return domainTimers;
  } catch (error) {
    console.error("Error retrieving domainTimers:", error);
  }
  return null;
}

// Asynchronously saves the domain timers to storage. This function is used whenever the timers are updated.
async function saveDomainTimers(domainTimers) {
  try {
    await setToStorage({ domainTimers });
    console.debug("Domain timers saved successfully.", domainTimers);
  } catch (error) {
    console.error("Error saving domain timers:", error);
  }
}

// This function checks if any of the timers have expired and need to be reset. This is based on the `resetInterval` set for each domain.
async function resetTimersIfNeeded(domainTimers) {
  const currentTime = Date.now();

  for (const [domain, timerData] of Object.entries(domainTimers)) {
    const resetIntervalMs = timerData.resetInterval * 60 * 60 * 1000;
    const resetCanHappenAfterTimestamp = timerData.lastResetTimestamp + resetIntervalMs;
    if (currentTime >= resetCanHappenAfterTimestamp) {
      timerData.timeLeft = timerData.originalTime;
      timerData.lastResetTimestamp = currentTime;
      domainTimers[domain] = timerData;
    }
  }
  return domainTimers;
}

// This function contains the core logic for starting and stopping timers based on the active tab.
async function handleTimerForTab(tab) {
  // Always clear the previous timer before starting a new one.
  if (activeTimerIntervalId) {
    clearInterval(activeTimerIntervalId);
    activeTimerIntervalId = null;
  }

  if (!tab || !tab.url) {
    return;
  }

  const url = new URL(tab.url);
  const domain = url.hostname;

  let domainTimers = await getDomainTimers();
  if (!domainTimers) {
    console.error('Domain timers not defined for an unexpected reason');
    return;
  }

  // Opportunistically reset timers.
  domainTimers = await resetTimersIfNeeded(domainTimers);
  await saveDomainTimers(domainTimers);

  const domainTimer = domainTimers[domain];
  if (!domainTimer) {
    console.debug(`Not a domain being tracked: ${domain}`);
    return;
  }

  if (domainTimer.timeLeft > 0) {
    const startTime = Date.now();
    activeTimerIntervalId = setInterval(async () => {
      const currentTime = Date.now();
      const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
      domainTimers[domain].timeLeft = Math.max(0, domainTimer.timeLeft - elapsedSeconds);
      await saveDomainTimers(domainTimers);

      console.debug(`Decreased time for ${domain} by ${elapsedSeconds} seconds`);

      if (domainTimers[domain].timeLeft <= 0) {
        clearInterval(activeTimerIntervalId);
        activeTimerIntervalId = null;
        console.debug(`Time's up for ${domain}. Navigation is blocked.`);
        // Block navigation on the next attempt.
      }
    }, 1000);
  } else {
    // If time has already expired, block navigation.
    chrome.tabs.update(tab.id, { url: "chrome://newtab" });
    console.debug(`Time's up for ${domain}. Navigation is blocked.`);
  }
}

// Listen for when the user switches to a different tab.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, async (tab) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }
    await handleTimerForTab(tab);
  });
});

// Listen for when a tab is updated, e.g., the user navigates to a new page.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // We only care about the active tab and when it's finished loading.
  if (tab.active && changeInfo.status === 'complete') {
    await handleTimerForTab(tab);
  }
});

// This function is called when the extension is first initialized.
async function initialize() {
  const timers = await getDomainTimers();
  if (!timers) {
    await setToStorage({ domainTimers: defaultDomainTimers });
  }
}

// This starts the extension.
initialize();

