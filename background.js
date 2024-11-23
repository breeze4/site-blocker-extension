// background.js
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
let _domainTimers = {};
let activeTimers = {};  // to store timer IDs for each active domain tab

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

async function saveDomainTimers(domainTimers) {
  try {
    await setToStorage({ domainTimers });
    console.debug("Domain timers saved successfully.", domainTimers);
  } catch (error) {
    console.error("Error saving domain timers:", error);
  }
}

async function waitForTabUpdate() {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      resolve({ tabId, changeInfo, tab });
    });
  });
}

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

async function handleTabUpdates() {
  while (true) {
    const { tabId, changeInfo, tab } = await waitForTabUpdate();
    console.debug(`Tab ${tabId} updated:`, changeInfo, tab);

    // when the loading is complete
    if (changeInfo.status === 'complete' && tab.url) {
      console.debug(`Tab ${tabId} finished loading. URL: ${tab.url}`);

      const url = new URL(tab.url);
      const domain = url.hostname;

      let domainTimers = await getDomainTimers();
      if (!domainTimers) {
        console.error('Domain timers not defined for an unexpected reason');
      }
      // this is a hack - go through all the timers and look to see if any have expired and need to be reset
      // its a hack because a timer could expire and then you navigate to it and it doesnt let you, but this way if you are using the browser a lot
      // it will almost always find a good time to reset before you actually need it
      domainTimers = await resetTimersIfNeeded(domainTimers);
      await setToStorage({ domainTimers });

      const domainTimer = domainTimers[domain];
      if (!domainTimer) {
        console.debug(`Not a domain being tracked: ${domain}`);
        continue;
      }

      // If a timer is already running for this tab, clear it
      if (activeTimers[tabId]) {
        clearInterval(activeTimers[tabId]);
      }

      if (domainTimer.timeLeft > 0) {
        // Start decrementing the timer for the domain as long as the tab is active
        const startTime = Date.now();

        activeTimers[tabId] = setInterval(async () => {
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
          domainTimers[domain].timeLeft = Math.max(0, domainTimer.timeLeft - elapsedSeconds);
          await saveDomainTimers(domainTimers);

          console.debug(`Decreased time for ${domain} by ${elapsedSeconds} seconds`);

          // If time runs out, close the tab
          if (domainTimers[domain].timeLeft <= 0) {
            clearInterval(activeTimers[tabId]);
            delete activeTimers[tabId];
            // chrome.tabs.update(tabId, { url: "chrome://newtab" });
            console.debug(`Time's up for ${domain}. Navigation is blocked.`);
          }
        }, 3000);
      } else {
        // If time has already expired, block navigation
        chrome.tabs.update(tabId, { url: "chrome://newtab" });
        console.debug(`Time's up for ${domain}. Navigation is blocked.`);
      }
    }
  }
}

async function initializeTimers() {
  const { domainTimers } = await getDomainTimers();
  if (!domainTimers) {
    await setToStorage({ domainTimers: defaultDomainTimers });
    return defaultDomainTimers;
  }
  return domainTimers;
}

// This only runs once, when the extension is first loaded or probably when the browser starts?
async function onInitialize() {
  console.debug('Initializing storage and setting up tab update handler');
  // Load existing timer data from storage into global object memory and then set up tab update handler
  await initializeTimers();
  handleTabUpdates();
}

onInitialize()

