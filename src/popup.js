// popup.js — toolbar popup logic for Site Timer Blocker.
// Loaded after storage-utils.js and timer-utils.js, which expose StorageUtils and TimerUtils.

const DEFAULT_BLOCK_MINUTES = 5;
const DEFAULT_RESET_INTERVAL_HOURS = 24;

let currentDomain = null;
let currentTrackable = false;

function $(id) {
  return document.getElementById(id);
}

function show(id) {
  $(id)?.classList.remove("hidden");
}

function hide(id) {
  $(id)?.classList.add("hidden");
}

// A page is trackable only if it's a normal web page (http/https), not a
// browser page like chrome:// or an extension page.
function isTrackableUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }
  try {
    const protocol = new URL(rawUrl).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch (error) {
    return false;
  }
}

function getDomainFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch (error) {
    return null;
  }
}

async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    return null;
  }
}

// Inherit the reset interval used by existing domains (it's a global setting),
// falling back to the default when no domains are configured yet.
function getInheritedResetInterval(domainTimers) {
  const domains = Object.keys(domainTimers || {});
  for (const domain of domains) {
    const interval = domainTimers[domain]?.resetInterval;
    if (Number.isFinite(interval) && interval > 0) {
      return interval;
    }
  }
  return DEFAULT_RESET_INTERVAL_HOURS;
}

function getProgressPercent(timeLeft, originalTime) {
  if (!Number.isFinite(timeLeft) || !Number.isFinite(originalTime) || originalTime <= 0) {
    return 0;
  }
  const pct = (timeLeft / originalTime) * 100;
  return Math.max(0, Math.min(100, pct));
}

async function renderSiteStatus() {
  const domainNameEl = $("domainName");

  if (!currentTrackable || !currentDomain) {
    domainNameEl.textContent = "Current page";
    hide("timerSection");
    hide("notTrackedSection");
    show("notTrackableSection");
    return;
  }

  domainNameEl.textContent = currentDomain;
  hide("notTrackableSection");

  const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
  const timer = domainTimers[currentDomain];

  if (!timer) {
    hide("timerSection");
    show("notTrackedSection");
    return;
  }

  hide("notTrackedSection");
  show("timerSection");

  const timeLeft = Number.isFinite(timer.timeLeft) ? timer.timeLeft : 0;
  const originalTime = Number.isFinite(timer.originalTime) ? timer.originalTime : 0;

  const timeLeftEl = $("timeLeft");
  if (timeLeft > 0) {
    timeLeftEl.textContent = `${TimerUtils.formatTime(timeLeft)} left`;
  } else {
    timeLeftEl.textContent = "Time's up for this site.";
  }

  $("progressFill").style.width = `${getProgressPercent(timeLeft, originalTime)}%`;
}

async function renderPauseSection() {
  const paused = (await StorageUtils.getFromStorage("blockingPaused")) === true;

  if (paused) {
    show("pausedNotice");
    hide("pauseControls");
    show("resumeControls");
  } else {
    hide("pausedNotice");
    show("pauseControls");
    hide("resumeControls");
    $("pauseError").textContent = "";
  }
}

async function handleBlockSite() {
  if (!currentTrackable || !currentDomain) {
    return;
  }

  const validation = TimerUtils.validateDomain(currentDomain);
  if (!validation.valid) {
    return;
  }

  const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
  if (domainTimers[currentDomain]) {
    await renderSiteStatus();
    return;
  }

  const resetInterval = getInheritedResetInterval(domainTimers);
  const originalTimeSeconds = DEFAULT_BLOCK_MINUTES * 60;

  domainTimers[currentDomain] = {
    originalTime: originalTimeSeconds,
    timeLeft: originalTimeSeconds,
    resetInterval,
    lastResetTimestamp: Date.now(),
    expiredMessageLogged: false,
  };

  await StorageUtils.setToStorage({ domainTimers });
  await renderSiteStatus();
}

async function handlePause() {
  const input = $("pausePasswordInput");
  const errorEl = $("pauseError");
  const entered = input ? input.value : "";

  const stored = await StorageUtils.getFromStorage("pausePassword");

  if (!TimerUtils.checkPausePassword(entered, stored)) {
    errorEl.textContent = "Incorrect password. Copy it from the Options page.";
    return;
  }

  // Correct entry: pause blocking and rotate the password so the next pause
  // requires a fresh trip to the Options page.
  const newPassword = TimerUtils.generatePausePassword();
  await StorageUtils.setToStorage({ blockingPaused: true, pausePassword: newPassword });

  if (input) {
    input.value = "";
  }
  errorEl.textContent = "";
  await renderPauseSection();
}

async function handleResume() {
  await StorageUtils.setToStorage({ blockingPaused: false });
  await renderPauseSection();
}

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
  window.close();
}

async function init() {
  const tab = await getActiveTab();
  currentTrackable = tab ? isTrackableUrl(tab.url) : false;
  currentDomain = currentTrackable ? getDomainFromUrl(tab.url) : null;

  $("blockSiteButton")?.addEventListener("click", handleBlockSite);
  $("pauseButton")?.addEventListener("click", handlePause);
  $("resumeButton")?.addEventListener("click", handleResume);
  $("optionsButton")?.addEventListener("click", openOptions);
  $("pausePasswordInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handlePause();
    }
  });

  await renderSiteStatus();
  await renderPauseSection();

  // Live-refresh the timer display while the popup is open. The background
  // service worker is the single writer that decrements the stored time.
  setInterval(renderSiteStatus, 1000);
}

// Auto-run only in the extension page (no CommonJS module present). Under Node
// (tests), this is skipped so the pure helpers can be required without side effects.
if (typeof module === "undefined") {
  init();
}

// Export pure helpers for unit testing (no-op in the browser/extension runtime).
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isTrackableUrl,
    getDomainFromUrl,
    getInheritedResetInterval,
    getProgressPercent,
    DEFAULT_BLOCK_MINUTES,
    DEFAULT_RESET_INTERVAL_HOURS,
  };
}
