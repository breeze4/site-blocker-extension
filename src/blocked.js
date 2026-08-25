// blocked.js — the block page logic for Site Timer Blocker.
// Loaded after storage-utils.js and timer-utils.js, which expose StorageUtils
// and TimerUtils.

/**
 * Read and validate the query parameters from the page URL.
 * Returns { domain: string|null, originUrl: string|null } — never throws.
 */
function readBlockParams() {
  const params = new URLSearchParams(window.location.search);
  let domain = params.get("domain");
  let originUrl = params.get("url");

  // Reject empty, whitespace-only, or absent values.
  if (!domain || !domain.trim()) {
    domain = null;
  } else {
    domain = domain.trim();
  }

  if (!originUrl || !originUrl.trim()) {
    originUrl = null;
  } else {
    try {
      // Validate it round-trips as a URL.
      new URL(originUrl.trim());
      originUrl = originUrl.trim();
    } catch (_) {
      originUrl = null;
    }
  }

  return { domain, originUrl };
}

/**
 * Format a duration in seconds into a human-readable string.
 * Returns "Xm Ys" for <1h, "Xh Ym" for >=1h.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "now";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }
  if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Estimate how many seconds until a domain reaches its re-entry floor.
 * The deficit is floor - current.timeLeft. At rechargeRate seconds per hour,
 * it takes deficit * 3600 / rechargeRate seconds to earn deficit seconds.
 * @param {number} originalTime
 * @param {number} timeLeft
 * @param {number} rechargeRate - seconds restored per hour away
 * @returns {number} seconds until re-entry floor is reached, or 0 if already there
 */
function estimateSecondsUntilReentry(originalTime, timeLeft, rechargeRate) {
  const floor =
    typeof TimerUtils !== "undefined" && TimerUtils.reEntryFloor
      ? TimerUtils.reEntryFloor(originalTime)
      : Math.ceil(originalTime * 0.1);
  const deficit = floor - timeLeft;
  if (deficit <= 0) {
    return 0;
  }
  const rate = Number.isFinite(rechargeRate) && rechargeRate > 0 ? rechargeRate : 30;
  return Math.ceil((deficit * 3600) / rate);
}

/**
 * Render the block page. Shows domain name and estimates time until the site is
 * usable again, or shows "already ready" if the floor has been reached.
 */
async function render() {
  const { domain, originUrl } = readBlockParams();

  const domainEl = document.getElementById("blockedDomain");
  if (domainEl) {
    domainEl.textContent = domain || "this site";
  }

  if (!domain) {
    return;
  }

  try {
    const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
    const timer = domainTimers[domain];

    if (!timer || !Number.isFinite(timer.originalTime) || timer.originalTime <= 0) {
      document.getElementById("reentryEstimate").textContent = "No timer data for this domain.";
      return;
    }

    const timeLeft = Number.isFinite(timer.timeLeft) ? timer.timeLeft : 0;
    const rate =
      Number.isFinite(timer.rechargeRate) && timer.rechargeRate > 0 ? timer.rechargeRate : 30;

    const secondsUntil = estimateSecondsUntilReentry(timer.originalTime, timeLeft, rate);

    if (secondsUntil <= 0) {
      document.getElementById("reentryEstimate").classList.add("hidden");
      document.getElementById("alreadyReady").classList.remove("hidden");
    } else {
      document.getElementById("reentryEstimate").textContent =
        "Available again in about " + formatDuration(secondsUntil) + ".";
    }
  } catch (_) {
    document.getElementById("reentryEstimate").textContent = "Unable to read timer data.";
  }
}

// Auto-run in extension page context (no CommonJS module).
if (typeof module === "undefined") {
  render();
}

// Export pure helpers for unit testing.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    readBlockParams,
    formatDuration,
    estimateSecondsUntilReentry,
    render,
  };
}
