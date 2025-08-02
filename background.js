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

// In-memory cache for the domain timers to reduce storage access.
let _domainTimers = {};
// This object holds the interval IDs for each tab that has an active timer. This is necessary to stop the timers when the user navigates away from the page.
let activeTimers = {};  // to store timer IDs for each active domain tab

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

// This function wraps the chrome.tabs.onUpdated event in a Promise. This allows the script to wait for a tab update event in an async/await loop.
async function waitForTabUpdate() {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      resolve({ tabId, changeInfo, tab });
    });
  });
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

// This is the main loop of the background script. It continuously waits for tab updates and then handles the timer logic for the updated tab.
async function handleTabUpdates() {
  while (true) {
    const { tabId, changeInfo, tab } = await waitForTabUpdate();
    console.debug(`Tab ${tabId} updated:`, changeInfo, tab);

    // The 'complete' status indicates that the page has fully loaded.
    if (changeInfo.status === 'complete' && tab.url) {
      console.debug(`Tab ${tabId} finished loading. URL: ${tab.url}`);

      const url = new URL(tab.url);
      const domain = url.hostname;

      let domainTimers = await getDomainTimers();
      if (!domainTimers) {
        console.error('Domain timers not defined for an unexpected reason');
      }
      // This is a opportunistic check to see if any timers need to be reset. It's not guaranteed to run at the exact moment a timer expires, but it runs frequently enough to be effective.
      domainTimers = await resetTimersIfNeeded(domainTimers);
      await setToStorage({ domainTimers });

      const domainTimer = domainTimers[domain];
      // If the domain is not in our list of tracked domains, we don't need to do anything.
      if (!domainTimer) {
        console.debug(`Not a domain being tracked: ${domain}`);
        continue;
      }

      // If there's already a timer running for this tab, we clear it before starting a new one. This handles cases where the user navigates within the same domain.
      if (activeTimers[tabId]) {
        clearInterval(activeTimers[tabId]);
      }

      if (domainTimer.timeLeft > 0) {
        // If there is time left, we start a new timer that decrements the time remaining every 3 seconds.
        const startTime = Date.now();

        activeTimers[tabId] = setInterval(async () => {
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
          domainTimers[domain].timeLeft = Math.max(0, domainTimer.timeLeft - elapsedSeconds);
          await saveDomainTimers(domainTimers);

          console.debug(`Decreased time for ${domain} by ${elapsedSeconds} seconds`);

          // If the time runs out while the user is on the page, we clear the interval and log a message. The user will be blocked on the next navigation attempt.
          if (domainTimers[domain].timeLeft <= 0) {
            clearInterval(activeTimers[tabId]);
            delete activeTimers[tabId];
            // chrome.tabs.update(tabId, { url: "chrome://newtab" });
            console.debug(`Time's up for ${domain}. Navigation is blocked.`);
          }
        }, 3000);
      } else {
        // If the time has already expired, we block navigation by redirecting the user to the new tab page.
        chrome.tabs.update(tabId, { url: "chrome://newtab" });
        console.debug(`Time's up for ${domain}. Navigation is blocked.`);
      }
    }
  }
}

// This function is called when the extension is first initialized. It checks if there are any timers in storage, and if not, it initializes storage with the default timers.
async function initializeTimers() {
  const { domainTimers } = await getDomainTimers();
  if (!domainTimers) {
    await setToStorage({ domainTimers: defaultDomainTimers });
    return defaultDomainTimers;
  }
  return domainTimers;
}

// This is the entry point for the background script. It initializes the timers and then starts the main loop for handling tab updates.
async function onInitialize() {
  console.debug('Initializing storage and setting up tab update handler');
  // Load existing timer data from storage into global object memory and then set up tab update handler
  await initializeTimers();
  handleTabUpdates();
}

// This starts the extension.
onInitialize()

