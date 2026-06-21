// background.js

// Import storage utilities for use in service worker
importScripts("storage-utils.js", "timer-utils.js");

// Default timers for commonly used websites. These are used to initialize the extension's storage when it's first installed.
const defaultDomainTimers = {
  "www.reddit.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
  "old.reddit.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
  "twitter.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
  "x.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
  "instagram.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
  "www.instagram.com": {
    originalTime: 60,
    timeLeft: 60,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
  },
};

// This variable will hold the interval ID for the currently active timer. There should only be one timer running at any given time.
let activeTimerIntervalId = null;
let activeTimerTabId = null;
let activeTimerDomain = null;
let handlingTimerForTab = false; // Prevent concurrent handleTimerForTab calls
let pendingTimerTab = null;
let browserHasFocus = true;
// Cached pause state. When true, timers do not run and pages are not blocked.
// Kept in sync via storage change events and refreshed on each tab handling pass.
let blockingPaused = false;

// Asynchronously retrieves the domain timers from storage. This function serves as a single point of access to the stored timers.
async function getDomainTimers() {
  try {
    const domainTimers = await getFromStorage("domainTimers");
    debugLog("Retrieved domain timers:", domainTimers);
    return domainTimers;
  } catch (error) {
    debugLog("Error retrieving domain timers:", error);
  }
  return null;
}

// Asynchronously retrieves the global pause flag from storage. Defaults to false on any error.
async function getBlockingPaused() {
  try {
    const value = await getFromStorage("blockingPaused");
    return value === true;
  } catch (error) {
    return false;
  }
}

// Asynchronously retrieves the time tracking data from storage. This function serves as a single point of access to the stored time tracking.
async function getTimeTracking() {
  try {
    const timeTracking = await getFromStorage("timeTracking");
    return isTimeTrackingRecord(timeTracking) ? timeTracking : {};
  } catch (error) {}
  return null;
}

// Asynchronously saves the domain timers to storage. This function is used whenever the timers are updated.
async function saveDomainTimers(domainTimers) {
  try {
    await setToStorage({ domainTimers });
  } catch (error) {}
}

// Asynchronously saves the time tracking data to storage. This function is used whenever the time tracking is updated.
async function saveTimeTracking(timeTracking) {
  try {
    await setToStorage({ timeTracking });
  } catch (error) {}
}

function isTimeTrackingRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimerRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createEmptyTimeTrackingRecord(currentDate) {
  return {
    dailyTotals: {},
    allTimeTotal: 0,
    trackingStartDate: currentDate,
    lastResetDate: currentDate,
    currentSessionStart: null,
    lastActiveTimestamp: Date.now(),
  };
}

// Initialize time tracking data structure for a domain if it doesn't exist
async function initializeDomainTimeTracking(domain) {
  try {
    const storedTimeTracking = await getTimeTracking();
    const timeTracking = isTimeTrackingRecord(storedTimeTracking) ? storedTimeTracking : {};

    // Only initialize if domain doesn't already exist
    if (!isTimeTrackingRecord(timeTracking[domain])) {
      const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      timeTracking[domain] = createEmptyTimeTrackingRecord(currentDate);

      await saveTimeTracking(timeTracking);
    }
  } catch (error) {}
}

// Credits recharge earned while each domain was left alone. The budget refills
// based on `rechargeRate` (seconds restored per hour away) since the domain was
// last the active focused tab (`lastVisitTimestamp`), capped at `originalTime`.
// The active tab keeps its timestamp current each tick, so it never recharges
// while in use.
async function applyRechargeToAllTimers(domainTimers) {
  if (!isTimerRecord(domainTimers)) {
    return {};
  }

  const currentTime = Date.now();

  for (const [domain, timerData] of Object.entries(domainTimers)) {
    if (!isTimerRecord(timerData)) {
      continue;
    }

    // Use TimerUtils function if available (should be available after importScripts)
    if (typeof TimerUtils !== "undefined" && TimerUtils.applyRecharge) {
      domainTimers[domain] = TimerUtils.applyRecharge(timerData, currentTime);
    } else {
      // Fallback to inline recharge logic
      const originalTime =
        Number.isFinite(timerData.originalTime) && timerData.originalTime > 0
          ? timerData.originalTime
          : 0;
      const rechargeRate =
        Number.isFinite(timerData.rechargeRate) && timerData.rechargeRate > 0
          ? timerData.rechargeRate
          : 30;
      const lastVisitTimestamp = Number.isFinite(timerData.lastVisitTimestamp)
        ? timerData.lastVisitTimestamp
        : currentTime;
      const timeLeft =
        Number.isFinite(timerData.timeLeft) && timerData.timeLeft > 0 ? timerData.timeLeft : 0;

      if (timeLeft >= originalTime) {
        timerData.timeLeft = Math.min(timeLeft, originalTime);
        timerData.lastVisitTimestamp = currentTime;
      } else {
        const ratePerMs = rechargeRate / (60 * 60 * 1000);
        const earned = Math.floor((currentTime - lastVisitTimestamp) * ratePerMs);
        if (earned > 0) {
          const newTimeLeft = Math.min(originalTime, timeLeft + earned);
          const credited = newTimeLeft - timeLeft;
          timerData.timeLeft = newTimeLeft;
          timerData.lastVisitTimestamp = lastVisitTimestamp + credited / ratePerMs;
          timerData.expiredMessageLogged = newTimeLeft <= 0;
        }
      }
      domainTimers[domain] = timerData;
    }
  }
  return domainTimers;
}

// Calculate time spent for a domain over a specific period (rolling window)
async function calculateTimeSpent(domain, period) {
  try {
    const timeTracking = (await getTimeTracking()) || {};
    const domainData = timeTracking[domain];

    if (!domainData) {
      return 0;
    }

    let totalSeconds = 0;

    // Add current session time if there's an active session
    if (domainData.currentSessionStart) {
      const currentSessionTime = Math.floor((Date.now() - domainData.currentSessionStart) / 1000);
      totalSeconds += Math.max(0, currentSessionTime);
    }

    // Handle all-time period
    if (period === "alltime") {
      const allTimeTotal =
        Number.isFinite(domainData.allTimeTotal) && domainData.allTimeTotal >= 0
          ? domainData.allTimeTotal
          : 0;
      return allTimeTotal + totalSeconds;
    }

    // Calculate rolling window periods
    const now = new Date();

    // Determine date range based on period
    let daysToCheck = 0;
    switch (period) {
      case "24h":
        daysToCheck = 1;
        break;
      case "7d":
        daysToCheck = 7;
        break;
      case "30d":
        daysToCheck = 30;
        break;
      default:
        return 0;
    }

    // Sum up daily totals for the specified period
    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0];

      const dailyTotal = domainData.dailyTotals && domainData.dailyTotals[dateString];
      if (Number.isFinite(dailyTotal) && dailyTotal >= 0) {
        totalSeconds += dailyTotal;
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
    const timeTracking = (await getTimeTracking()) || {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD format

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
  } catch (error) {}
}

function addSessionDurationToTracking(data, currentDate, sessionDuration) {
  if (!data.dailyTotals) {
    data.dailyTotals = {};
  }

  const dailyTotal = data.dailyTotals[currentDate];
  const safeDailyTotal = Number.isFinite(dailyTotal) && dailyTotal >= 0 ? dailyTotal : 0;
  data.dailyTotals[currentDate] = safeDailyTotal + sessionDuration;

  const allTimeTotal =
    Number.isFinite(data.allTimeTotal) && data.allTimeTotal >= 0 ? data.allTimeTotal : 0;
  data.allTimeTotal = allTimeTotal + sessionDuration;
}

// End idle sessions (sessions that have been inactive for more than 2 minutes)
async function endIdleSessions() {
  try {
    const timeTracking = (await getTimeTracking()) || {};
    const currentTime = Date.now();
    const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds
    const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    for (const [domain, data] of Object.entries(timeTracking)) {
      if (browserHasFocus && activeTimerIntervalId && activeTimerDomain === domain) {
        continue;
      }

      if (data.currentSessionStart && data.lastActiveTimestamp) {
        const timeSinceLastActive = currentTime - data.lastActiveTimestamp;

        if (timeSinceLastActive >= IDLE_TIMEOUT) {
          // Calculate session duration up to the idle point
          const sessionDuration = Math.max(
            0,
            Math.floor((data.lastActiveTimestamp - data.currentSessionStart) / 1000)
          );

          addSessionDurationToTracking(data, currentDate, sessionDuration);

          // Clear the active session
          data.currentSessionStart = null;
        }
      }
    }
    await saveTimeTracking(timeTracking);
  } catch (error) {}
}

// End any active time tracking session for all domains
async function endAllActiveSessions() {
  try {
    const timeTracking = (await getTimeTracking()) || {};
    const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    for (const [domain, data] of Object.entries(timeTracking)) {
      if (data.currentSessionStart) {
        // Calculate session duration
        const sessionDuration = Math.max(
          0,
          Math.floor((Date.now() - data.currentSessionStart) / 1000)
        );

        addSessionDurationToTracking(data, currentDate, sessionDuration);

        // Clear the active session
        data.currentSessionStart = null;
        data.lastActiveTimestamp = Date.now();
      }
    }
    await saveTimeTracking(timeTracking);
  } catch (error) {}
}

async function stopActiveTimerAndTracking(reason = "unspecified") {
  debugLog(
    "Stopping active timer and tracking. reason:",
    reason,
    "domain:",
    activeTimerDomain,
    "browserHasFocus:",
    browserHasFocus,
    "blockingPaused:",
    blockingPaused
  );
  if (activeTimerIntervalId) {
    clearInterval(activeTimerIntervalId);
    activeTimerIntervalId = null;
  }
  activeTimerTabId = null;
  activeTimerDomain = null;
  await endAllActiveSessions();
}

async function refreshActiveSessionTimestamp(domain) {
  try {
    const timeTracking = (await getTimeTracking()) || {};
    if (timeTracking[domain]?.currentSessionStart) {
      timeTracking[domain].lastActiveTimestamp = Date.now();
      await saveTimeTracking(timeTracking);
    }
  } catch (error) {}
}

// This function contains the core logic for starting and stopping timers based on the active tab.
async function handleTimerForTab(tab) {
  debugLog("Handling timer for tab:", tab?.url);

  // Prevent concurrent execution
  if (handlingTimerForTab) {
    debugLog("Skipping: already handling timer for another tab. Queued:", tab?.url);
    pendingTimerTab = tab;
    return;
  }
  handlingTimerForTab = true;

  try {
    if (!browserHasFocus) {
      debugLog("Bailing out of handleTimerForTab: browser does not have focus");
      pendingTimerTab = null;
      return;
    }

    // If blocking is paused, do not run any timers or block navigation.
    blockingPaused = await getBlockingPaused();
    if (blockingPaused) {
      debugLog("Bailing out of handleTimerForTab: blocking is paused");
      pendingTimerTab = null;
      if (activeTimerIntervalId) {
        clearInterval(activeTimerIntervalId);
        activeTimerIntervalId = null;
        activeTimerTabId = null;
        activeTimerDomain = null;
      }
      await endAllActiveSessions();
      return;
    }

    // End any active time tracking sessions before starting new one
    await endAllActiveSessions();

    // Always clear the previous timer before starting a new one.
    if (activeTimerIntervalId) {
      console.log("[TIMER DEBUG] Clearing existing interval:", activeTimerIntervalId);
      clearInterval(activeTimerIntervalId);
      activeTimerIntervalId = null;
      activeTimerTabId = null;
      activeTimerDomain = null;
      debugLog("Cleared previous timer");
    }

    if (!tab || !tab.url) {
      debugLog("No tab or URL, clearing timer");
      return;
    }

    const url = new URL(tab.url);
    const rawDomain = url.hostname;
    const domain = rawDomain; // Keep the full hostname to match storage keys exactly
    debugLog("Processing domain:", domain);

    let domainTimers = await getDomainTimers();
    if (!domainTimers) {
      return;
    }

    // Opportunistically credit recharge earned while domains were left alone,
    // before deciding whether this tab is blocked — a recharged domain that had
    // hit zero becomes usable again.
    domainTimers = await applyRechargeToAllTimers(domainTimers);
    await saveDomainTimers(domainTimers);

    const domainTimer = domainTimers[domain];
    if (!domainTimer) {
      debugLog("No timer configured for domain:", domain);
      return;
    }

    // Initialize expiredMessageLogged flag if it doesn't exist (for backward compatibility)
    if (domainTimer.expiredMessageLogged === undefined) {
      domainTimer.expiredMessageLogged = false;
      domainTimers[domain] = domainTimer;
      await saveDomainTimers(domainTimers);
    }

    debugLog("Found timer for domain:", domain, "Time left:", domainTimer.timeLeft);

    // Initialize time tracking for this domain and start session
    await initializeDomainTimeTracking(domain);

    if (!browserHasFocus) {
      debugLog("Bailing after tracking init: browser lost focus while handling", domain);
      pendingTimerTab = null;
      return;
    }

    if (Number.isFinite(domainTimer.timeLeft) && domainTimer.timeLeft > 0) {
      // Record session start timestamp for time tracking
      const timeTracking = (await getTimeTracking()) || {};
      if (timeTracking[domain]) {
        timeTracking[domain].currentSessionStart = Date.now();
        timeTracking[domain].lastActiveTimestamp = Date.now();
        await saveTimeTracking(timeTracking);
        debugLog("Started time tracking session for:", domain);
      }

      debugLog("Starting timer countdown for:", domain, "seconds remaining:", domainTimer.timeLeft);
      console.log(
        "[TIMER DEBUG] Starting new interval, previous intervalId:",
        activeTimerIntervalId
      );
      activeTimerIntervalId = setInterval(async () => {
        if (!browserHasFocus) {
          await stopActiveTimerAndTracking("tick: browser lost focus");
          return;
        }

        // If blocking was paused while a timer was running, stop immediately.
        if (blockingPaused) {
          await stopActiveTimerAndTracking("tick: blocking paused");
          return;
        }

        // Check if the current active tab is still on this domain
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!browserHasFocus) {
            await stopActiveTimerAndTracking("tick: browser lost focus during tab query");
            return;
          }

          if (tabs.length === 0 || !tabs[0].url) {
            // No active tab or no URL, stop the timer
            await stopActiveTimerAndTracking("tick: no active tab or url");
            return;
          }

          const activeUrl = new URL(tabs[0].url);
          const activeDomain = activeUrl.hostname;

          // If we've switched to a different domain, stop this timer
          if (activeDomain !== domain) {
            await stopActiveTimerAndTracking(
              `tick: active tab moved to ${activeDomain}, expected ${domain}`
            );
            return;
          }
        } catch (error) {
          // Error checking active tab, stop the timer
          await stopActiveTimerAndTracking("tick: error querying active tab");
          return;
        }

        // Re-read timers from storage to get any updates from options page
        const currentTimers = await getDomainTimers();
        if (!browserHasFocus) {
          await stopActiveTimerAndTracking("tick: browser lost focus after re-read");
          return;
        }

        if (!currentTimers || !currentTimers[domain]) {
          await stopActiveTimerAndTracking(`tick: timer for ${domain} no longer in storage`);
          return;
        }

        await refreshActiveSessionTimestamp(domain);

        // Use TimerUtils to decrement if available
        console.log(
          "[TIMER DEBUG] Decrementing timer for",
          domain,
          "from",
          currentTimers[domain].timeLeft,
          "at",
          new Date().toISOString()
        );
        if (typeof TimerUtils !== "undefined" && TimerUtils.decrementTimer) {
          currentTimers[domain] = TimerUtils.decrementTimer(currentTimers[domain]);
        } else {
          // Fallback to original logic
          currentTimers[domain].timeLeft = Math.max(0, currentTimers[domain].timeLeft - 1);
          if (currentTimers[domain].timeLeft <= 0 && !currentTimers[domain].expiredMessageLogged) {
            currentTimers[domain].expiredMessageLogged = true;
          }
        }

        // The active tab is being visited, not recharging: keep its recharge
        // clock current so no away-time accrues while it ticks down.
        currentTimers[domain].lastVisitTimestamp = Date.now();

        await saveDomainTimers(currentTimers);

        if (currentTimers[domain].timeLeft <= 0) {
          if (currentTimers[domain].expiredMessageLogged) {
            debugLog("Timer expired for domain:", domain);
          }
          await stopActiveTimerAndTracking();

          // Redirect the current active tab to new tab page when timer expires
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
              const activeTab = tabs[0];
              const activeUrl = new URL(activeTab.url);
              const activeDomain = activeUrl.hostname;

              // Only redirect if the active tab is on the expired domain
              if (activeDomain === domain) {
                chrome.tabs.update(activeTab.id, { url: "chrome://newtab" });
                debugLog("Redirected expired tab for domain:", domain);
              }
            }
          } catch (error) {
            debugLog("Error redirecting expired tab:", error);
          }
        }
      }, 1000);
      activeTimerTabId = tab.id;
      activeTimerDomain = domain;
    } else {
      if (!domainTimer.expiredMessageLogged) {
        debugLog("Timer already expired for domain:", domain, "blocking navigation");
        domainTimers[domain].expiredMessageLogged = true;
        await saveDomainTimers(domainTimers);
      }
      // If time has already expired, block navigation.
      chrome.tabs.update(tab.id, { url: "chrome://newtab" });
    }
  } finally {
    handlingTimerForTab = false;
    if (pendingTimerTab) {
      const nextTab = pendingTimerTab;
      pendingTimerTab = null;
      await handleTimerForTab(nextTab);
    }
  }
}

// Re-derive whether the browser is focused from the source of truth (the
// window's actual `focused` state) rather than the cached `browserHasFocus`
// flag, which only recovers on `onFocusChanged`. Switching tabs within a window
// fires `onActivated` but NOT `onFocusChanged`, so without this a stale `false`
// (set when focus bounced to another app/window) would wedge the timer forever.
// Fails open: if the window can't be read, assume focus so we never get stuck.
async function isWindowFocused(windowId) {
  try {
    const win = await chrome.windows.get(windowId);
    return win.focused === true;
  } catch (error) {
    return true;
  }
}

// Listen for when the user switches to a different tab.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Activating a tab is direct interaction with its window — refresh the focus
  // flag so a stale `false` can't stop the timer from restarting.
  browserHasFocus = await isWindowFocused(activeInfo.windowId);
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
  if (tab.active && changeInfo.status === "complete") {
    browserHasFocus = await isWindowFocused(tab.windowId);
    await handleTimerForTab(tab);
  }
});

// Listen for window focus changes to handle cases where user switches to different browser window
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    browserHasFocus = false;
    pendingTimerTab = null;
    // Browser lost focus entirely, stop timer
    if (activeTimerIntervalId) {
      clearInterval(activeTimerIntervalId);
      activeTimerIntervalId = null;
      activeTimerTabId = null;
      activeTimerDomain = null;
    }
    await endAllActiveSessions();
  } else {
    browserHasFocus = true;
    // Browser gained focus, check current active tab
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        await handleTimerForTab(tabs[0]);
      }
    } catch (error) {
      // Ignore errors when querying tabs
    }
  }
});

// Listen for when a tab is closed to end any active time tracking sessions
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    if (activeTimerTabId !== tabId) {
      return;
    }

    // Check if the closed tab was the active tab with a timer running
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    // If no active tabs left (e.g., the closed tab was the last/only active one)
    // or if we had a timer running, we should stop it
    if (activeTimerIntervalId) {
      // Get info about what domain the timer was for before clearing
      clearInterval(activeTimerIntervalId);
      activeTimerIntervalId = null;
      activeTimerTabId = null;
      activeTimerDomain = null;

      // End all active sessions when a tracked tab is closed
      await endAllActiveSessions();

      // Check if there's a new active tab to handle
      if (tabs.length > 0) {
        await handleTimerForTab(tabs[0]);
      }
    }
  } catch (error) {
    // If there's an error, ensure timer is stopped
    if (activeTimerIntervalId) {
      clearInterval(activeTimerIntervalId);
      activeTimerIntervalId = null;
      activeTimerTabId = null;
      activeTimerDomain = null;
    }
    await endAllActiveSessions();
  }
});

// React to pause state changes written by the popup. Keeps the cached flag in
// sync and either stops the active timer (paused) or re-evaluates the current
// tab (resumed) without requiring an explicit message round-trip.
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local" || !changes.blockingPaused) {
    return;
  }

  blockingPaused = changes.blockingPaused.newValue === true;

  if (blockingPaused) {
    await stopActiveTimerAndTracking();
    return;
  }

  // Resumed: re-evaluate the current active tab so timers pick back up.
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await handleTimerForTab(tabs[0]);
    }
  } catch (error) {
    debugLog("Error re-evaluating tab after resume:", error);
  }
});

// Handle onboarding for new users
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // First time installation - show onboarding
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html?onboarding=true") });
  }
});

// Listen for messages from options page to restart timer when settings change
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "timerSettingsChanged") {
    debugLog("Timer settings changed, restarting timer for current tab");

    // Get the current active tab and restart its timer
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await handleTimerForTab(tabs[0]);
      }
    } catch (error) {
      debugLog("Error restarting timer after settings change:", error);
    }

    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

// This function is called when the extension is first initialized.
async function initialize() {
  debugLog("Initializing Site Blocker extension", "Debug mode:", isDebugMode);

  const timers = await getDomainTimers();
  if (!isTimerRecord(timers)) {
    debugLog("No existing timers found, initializing with defaults");
    await setToStorage({ domainTimers: defaultDomainTimers });
  }

  // Initialize time tracking storage if it doesn't exist
  const timeTracking = await getFromStorage("timeTracking");
  if (!isTimeTrackingRecord(timeTracking)) {
    debugLog("Initializing time tracking storage");
    await setToStorage({ timeTracking: {} });
  }

  // Initialize the pause flag and load it into the cache.
  const storedBlockingPaused = await getFromStorage("blockingPaused");
  if (typeof storedBlockingPaused !== "boolean") {
    await setToStorage({ blockingPaused: false });
    blockingPaused = false;
  } else {
    blockingPaused = storedBlockingPaused;
  }

  // Initialize the pause password if missing. Required to pause from the popup.
  const storedPausePassword = await getFromStorage("pausePassword");
  const canGeneratePassword =
    typeof TimerUtils !== "undefined" && typeof TimerUtils.generatePausePassword === "function";
  if ((typeof storedPausePassword !== "string" || !storedPausePassword) && canGeneratePassword) {
    await setToStorage({ pausePassword: TimerUtils.generatePausePassword() });
  }

  // Clean up old time tracking data on startup
  await cleanupOldTimeTrackingData();

  // Set up idle detection - check every 30 seconds for sessions idle longer than 2 minutes
  setInterval(endIdleSessions, 30 * 1000);
  debugLog("Extension initialization complete");
}

// This starts the extension.
initialize();
