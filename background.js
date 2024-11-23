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
    console.log("Domain Timers:", domainTimers);
  } catch (error) {
    console.error("Error retrieving domainTimers:", error);
  }
}

async function saveDomainTimers(domainTimers) {
  try {
    await setToStorage({ domainTimers });
    console.log("Domain timers saved successfully.", domainTimers);
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
    console.log(`Tab ${tabId} updated:`, changeInfo, tab);

    // when the loading is complete
    if (changeInfo.status === 'complete' && tab.url) {
      console.log(`Tab ${tabId} finished loading. URL: ${tab.url}`);

      const url = new URL(tab.url);
      const domain = url.hostname;

      let { domainTimers } = await getDomainTimers();
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
        console.log(`Not a domain being tracked: ${domain}`);
      }

      const currentTimeLeft = domainTimer.timeLeft;
      // TODO: fix this logic
      // the timer is not decrement when the page navigates, it only does it when you close the page
      // so if you are on reddit and go to a link, it doesn't decrement the timer - that's wrong!
      // this is more complex because if I am on multiple tabs - which one is the one to decrement time? hmmm need to think about it
      // if (currentTimeLeft > 0) {
      //   let timerId;

      //   const decrementTimer = () => {
      //     const endTime = Date.now();
      //     const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
      //     domainTimers[domain].timeLeft = Math.max(0, currentTimeLeft - elapsedSeconds);
      //     console.log(`decreased time for ${domain} by ${elapsedSeconds} seconds`)

      //     chrome.storage.local.set({ domainTimers });
      //     if (domainTimers[domain].timeLeft <= 0) {
      //       console.log(`time has expired for ${domain}`)
      //       // chrome.tabs.remove(tabId);
      //     }
      //   };

      //   const startTime = Date.now();
      //   timerId = setTimeout(() => {
      //     decrementTimer();
      //     clearTimeout(timerId);
      //   }, timeLeft * 1000);

      //   chrome.tabs.onRemoved.addListener((closedTabId) => {
      //     if (tabId === closedTabId) {
      //       decrementTimer();
      //       clearTimeout(timerId);
      //     }
      //   });
      // } else {
      //   // Time has expired, block navigation within the domain
      //   chrome.tabs.update(tabId, { url: "chrome://newtab" });
      //   console.log(`Time's up for ${domain}. Navigation is blocked.`);
      // }
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
  console.log('Initializing storage and setting up tab update handler');
  // Load existing timer data from storage into global object memory and then set up tab update handler
  await initializeTimers();
  handleTabUpdates();
}

onInitialize()

