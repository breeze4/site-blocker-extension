// background.js

// Default timers for commonly used websites. These are used to initialize the extension's storage when it's first installed.
let defaultDomainTimers = {
  'www.reddit.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
  'old.reddit.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
  'twitter.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
  'x.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
  'instagram.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
  'www.instagram.com': {
    originalTime: 60,
    timeLeft: 60,
    resetInterval: 24,
    lastResetTimestamp: Date.now()
  },
};

// This variable will hold the interval ID for the currently active timer. There should only be one timer running at any given time.
let activeTimerIntervalId = null;

// Import storage utilities (these are now defined in storage-utils.js)
// Note: In service workers, we'll need to import the utilities differently
// For now, we'll keep the local functions but could refactor to import later

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
    return domainTimers;
  } catch (error) {
  }
  return null;
}

// Asynchronously retrieves the time tracking data from storage. This function serves as a single point of access to the stored time tracking.
async function getTimeTracking() {
  try {
    const timeTracking = await getFromStorage("timeTracking");
    return timeTracking;
  } catch (error) {
  }
  return null;
}

// Asynchronously saves the domain timers to storage. This function is used whenever the timers are updated.
async function saveDomainTimers(domainTimers) {
  try {
    await setToStorage({ domainTimers });
  } catch (error) {
  }
}

// Asynchronously saves the time tracking data to storage. This function is used whenever the time tracking is updated.
async function saveTimeTracking(timeTracking) {
  try {
    await setToStorage({ timeTracking });
  } catch (error) {
  }
}

// Initialize time tracking data structure for a domain if it doesn't exist
async function initializeDomainTimeTracking(domain) {
  try {
    const timeTracking = await getTimeTracking() || {};
    
    // Only initialize if domain doesn't already exist
    if (!timeTracking[domain]) {
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      timeTracking[domain] = {
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: currentDate,
        lastResetDate: currentDate,
        currentSessionStart: null,
        lastActiveTimestamp: Date.now()
      };
      
      await saveTimeTracking(timeTracking);
    }
  } catch (error) {
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

// Calculate time spent for a domain over a specific period (rolling window)
async function calculateTimeSpent(domain, period) {
  try {
    const timeTracking = await getTimeTracking() || {};
    const domainData = timeTracking[domain];
    
    if (!domainData) {
      return 0;
    }
    
    // Handle all-time period
    if (period === 'alltime') {
      return domainData.allTimeTotal || 0;
    }
    
    // Calculate rolling window periods
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    let totalSeconds = 0;
    
    // Add current session time if there's an active session
    if (domainData.currentSessionStart) {
      const currentSessionTime = Math.floor((Date.now() - domainData.currentSessionStart) / 1000);
      totalSeconds += currentSessionTime;
    }
    
    // Determine date range based on period
    let daysToCheck = 0;
    switch (period) {
      case '24h':
        daysToCheck = 1;
        break;
      case '7d':
        daysToCheck = 7;
        break;
      case '30d':
        daysToCheck = 30;
        break;
      default:
        return 0;
    }
    
    // Sum up daily totals for the specified period
    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      if (domainData.dailyTotals && domainData.dailyTotals[dateString]) {
        totalSeconds += domainData.dailyTotals[dateString];
      }
    }
    
    return totalSeconds;
  } catch (error) {
    return 0;
  }
}

// Clean up daily tracking data older than 30 days to keep storage efficient
async function cleanupOldTimeTrackingData() {
  try {
    const timeTracking = await getTimeTracking() || {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    let dataChanged = false;
    
    for (const [domain, data] of Object.entries(timeTracking)) {
      if (data.dailyTotals) {
        const originalCount = Object.keys(data.dailyTotals).length;
        
        // Remove daily entries older than 30 days
        for (const dateString of Object.keys(data.dailyTotals)) {
          if (dateString < cutoffDate) {
            delete data.dailyTotals[dateString];
            dataChanged = true;
          }
        }
        
        const newCount = Object.keys(data.dailyTotals).length;
        if (originalCount !== newCount) {
        }
      }
    }
    
    if (dataChanged) {
      await saveTimeTracking(timeTracking);
    }
  } catch (error) {
  }
}

// End idle sessions (sessions that have been inactive for more than 2 minutes)
async function endIdleSessions() {
  try {
    const timeTracking = await getTimeTracking() || {};
    const currentTime = Date.now();
    const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    for (const [domain, data] of Object.entries(timeTracking)) {
      if (data.currentSessionStart && data.lastActiveTimestamp) {
        const timeSinceLastActive = currentTime - data.lastActiveTimestamp;
        
        if (timeSinceLastActive >= IDLE_TIMEOUT) {
          // Calculate session duration up to the idle point
          const sessionDuration = Math.floor((data.lastActiveTimestamp - data.currentSessionStart) / 1000);
          
          // Save session duration to daily totals
          if (!data.dailyTotals) {
            data.dailyTotals = {};
          }
          data.dailyTotals[currentDate] = (data.dailyTotals[currentDate] || 0) + sessionDuration;
          
          // Update all-time total
          data.allTimeTotal = (data.allTimeTotal || 0) + sessionDuration;
          
          // Clear the active session
          data.currentSessionStart = null;
          
        }
      }
    }
    await saveTimeTracking(timeTracking);
  } catch (error) {
  }
}

// End any active time tracking session for all domains
async function endAllActiveSessions() {
  try {
    const timeTracking = await getTimeTracking() || {};
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    for (const [domain, data] of Object.entries(timeTracking)) {
      if (data.currentSessionStart) {
        // Calculate session duration
        const sessionDuration = Math.floor((Date.now() - data.currentSessionStart) / 1000);
        
        // Save session duration to daily totals
        if (!data.dailyTotals) {
          data.dailyTotals = {};
        }
        data.dailyTotals[currentDate] = (data.dailyTotals[currentDate] || 0) + sessionDuration;
        
        // Update all-time total
        data.allTimeTotal = (data.allTimeTotal || 0) + sessionDuration;
        
        // Clear the active session
        data.currentSessionStart = null;
        data.lastActiveTimestamp = Date.now();
        
      }
    }
    await saveTimeTracking(timeTracking);
  } catch (error) {
  }
}

// This function contains the core logic for starting and stopping timers based on the active tab.
async function handleTimerForTab(tab) {
  // End any active time tracking sessions before starting new one
  await endAllActiveSessions();
  
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
    return;
  }

  // Opportunistically reset timers.
  domainTimers = await resetTimersIfNeeded(domainTimers);
  await saveDomainTimers(domainTimers);

  const domainTimer = domainTimers[domain];
  if (!domainTimer) {
    return;
  }

  // Initialize time tracking for this domain and start session
  await initializeDomainTimeTracking(domain);
  
  // Record session start timestamp for time tracking
  const timeTracking = await getTimeTracking() || {};
  if (timeTracking[domain]) {
    timeTracking[domain].currentSessionStart = Date.now();
    timeTracking[domain].lastActiveTimestamp = Date.now();
    await saveTimeTracking(timeTracking);
  }

  if (domainTimer.timeLeft > 0) {
    const startTime = Date.now();
    activeTimerIntervalId = setInterval(async () => {
      const currentTime = Date.now();
      const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
      domainTimers[domain].timeLeft = Math.max(0, domainTimer.timeLeft - elapsedSeconds);
      await saveDomainTimers(domainTimers);


      if (domainTimers[domain].timeLeft <= 0) {
        clearInterval(activeTimerIntervalId);
        activeTimerIntervalId = null;
        // Block navigation on the next attempt.
      }
    }, 1000);
  } else {
    // If time has already expired, block navigation.
    chrome.tabs.update(tab.id, { url: "chrome://newtab" });
  }
}

// Listen for when the user switches to a different tab.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, async (tab) => {
    if (chrome.runtime.lastError) {
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

// Listen for when a tab is closed to end any active time tracking sessions
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // End all active sessions when any tab is closed
  // This ensures sessions don't remain "active" after tab closure
  await endAllActiveSessions();
});

// Handle onboarding for new users
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First time installation - show onboarding
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?onboarding=true') });
  }
});

// This function is called when the extension is first initialized.
async function initialize() {
  const timers = await getDomainTimers();
  if (!timers) {
    await setToStorage({ domainTimers: defaultDomainTimers });
  }
  
  // Initialize time tracking storage if it doesn't exist
  const timeTracking = await getFromStorage("timeTracking");
  if (!timeTracking) {
    await setToStorage({ timeTracking: {} });
  }
  
  // Clean up old time tracking data on startup
  await cleanupOldTimeTrackingData();
  
  // Set up idle detection - check every 30 seconds for sessions idle longer than 2 minutes
  setInterval(endIdleSessions, 30 * 1000);
}

// This starts the extension.
initialize();

