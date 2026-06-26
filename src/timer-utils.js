/**
 * Timer utility functions extracted for testing
 */

/**
 * Determines if a timer needs to be reset based on settings change
 * @param {number} oldOriginalTime - Previous time limit in seconds
 * @param {number} newOriginalTime - New time limit in seconds
 * @param {number} currentTimeLeft - Current time remaining in seconds
 * @returns {boolean} Whether the timer should be reset
 */
function shouldResetTimer(oldOriginalTime, newOriginalTime, currentTimeLeft) {
  const timeChanged = oldOriginalTime !== newOriginalTime;
  const needsReset =
    timeChanged ||
    !Number.isFinite(currentTimeLeft) ||
    currentTimeLeft < 0 ||
    currentTimeLeft > newOriginalTime;
  return needsReset;
}

/**
 * Apply timer settings change and determine new state
 * @param {Object} timerData - Current timer data
 * @param {number} newOriginalTime - New time limit in seconds
 * @param {number} newRechargeRate - New recharge rate in seconds restored per hour away
 * @returns {Object} Updated timer data
 */
function applyTimerSettingsChange(timerData, newOriginalTime, newRechargeRate) {
  const result = { ...timerData };
  const needsReset = shouldResetTimer(timerData.originalTime, newOriginalTime, timerData.timeLeft);

  result.originalTime = newOriginalTime;
  result.rechargeRate = newRechargeRate;

  if (needsReset) {
    result.timeLeft = newOriginalTime;
    result.lastVisitTimestamp = Date.now();
    result.expiredMessageLogged = false;
  }

  return {
    timerData: result,
    wasReset: needsReset,
  };
}

/**
 * Normalize a recharge rate to a sane positive value (seconds restored per hour
 * away). Falls back to the 30s/hr default for missing or invalid input.
 * @param {number} rate - Candidate recharge rate
 * @returns {number} A finite, positive recharge rate
 */
function normalizeRechargeRate(rate) {
  return Number.isFinite(rate) && rate > 0 ? rate : 30;
}

/**
 * Credit recharge earned while a domain was left alone.
 *
 * The budget refills continuously based on wall-clock time away, so this is
 * computed lazily: it credits `floor(elapsed * rate)` whole seconds since
 * `lastVisitTimestamp`, clamped to `originalTime`, and advances the timestamp
 * only by the time those credited seconds consumed — carrying the sub-second
 * remainder forward so nothing is lost across passes. It never exceeds the cap
 * and never credits negative time (e.g. a backwards system-clock jump).
 *
 * @param {Object} timerData - Timer data with timeLeft, originalTime, rechargeRate, lastVisitTimestamp
 * @param {number} currentTime - Current timestamp (for testing)
 * @returns {Object} Updated timer data (always normalized; a copy when anything changed)
 */
function applyRecharge(timerData, currentTime = Date.now()) {
  const originalTime =
    Number.isFinite(timerData.originalTime) && timerData.originalTime > 0
      ? timerData.originalTime
      : 0;
  const rechargeRate = normalizeRechargeRate(timerData.rechargeRate);
  const lastVisitTimestamp = Number.isFinite(timerData.lastVisitTimestamp)
    ? timerData.lastVisitTimestamp
    : currentTime;
  const timeLeft =
    Number.isFinite(timerData.timeLeft) && timerData.timeLeft > 0 ? timerData.timeLeft : 0;

  // Already at (or above) the cap: nothing to credit. Refresh the clock so the
  // away-window starts fresh from now.
  if (timeLeft >= originalTime) {
    return {
      ...timerData,
      originalTime,
      rechargeRate,
      timeLeft: Math.min(timeLeft, originalTime),
      lastVisitTimestamp: currentTime,
    };
  }

  const ratePerMs = rechargeRate / (60 * 60 * 1000); // seconds earned per ms away
  const earned = Math.floor((currentTime - lastVisitTimestamp) * ratePerMs);

  if (earned <= 0) {
    return {
      ...timerData,
      originalTime,
      rechargeRate,
      timeLeft,
      lastVisitTimestamp,
    };
  }

  const newTimeLeft = Math.min(originalTime, timeLeft + earned);
  const credited = newTimeLeft - timeLeft;
  // Advance the clock only by the wall-clock time the credited whole seconds
  // consumed, leaving any sub-second remainder to accrue next pass.
  const consumedMs = credited / ratePerMs;

  return {
    ...timerData,
    originalTime,
    rechargeRate,
    timeLeft: newTimeLeft,
    lastVisitTimestamp: lastVisitTimestamp + consumedMs,
    // Restoring time above zero re-arms the post-expiry debug log.
    expiredMessageLogged: newTimeLeft <= 0,
  };
}

/**
 * Estimate the wall-clock seconds until a timer recharges back to its cap.
 * Returns 0 when the budget is already full.
 * @param {Object} timerData - Timer data with timeLeft, originalTime, rechargeRate
 * @returns {number} Whole seconds until full (0 if already full)
 */
function estimateSecondsUntilFull(timerData) {
  const originalTime = Number.isFinite(timerData.originalTime) ? timerData.originalTime : 0;
  const rechargeRate = normalizeRechargeRate(timerData.rechargeRate);
  const timeLeft = Number.isFinite(timerData.timeLeft) ? timerData.timeLeft : 0;
  const deficit = originalTime - timeLeft;
  if (deficit <= 0) {
    return 0;
  }
  // rechargeRate budget-seconds restored per 3600 wall-clock seconds.
  return Math.ceil((deficit / rechargeRate) * 3600);
}

/**
 * Decrement timer by one second
 * @param {Object} timerData - Timer data
 * @returns {Object} Updated timer data
 */
function decrementTimer(timerData) {
  const newTimeLeft = Number.isFinite(timerData.timeLeft) ? Math.max(0, timerData.timeLeft - 1) : 0;
  const result = {
    ...timerData,
    timeLeft: newTimeLeft,
  };

  if (newTimeLeft <= 0 && !timerData.expiredMessageLogged) {
    result.expiredMessageLogged = true;
  }

  return result;
}

/**
 * Parse URL and extract domain
 * @param {string} input - URL or domain input
 * @returns {Object} Parse result with success, domain, and error
 */
function parseURL(input) {
  let url = input.trim().toLowerCase();

  if (!url) {
    return {
      success: false,
      error: "Please enter a URL or domain name",
      original: input,
    };
  }

  // Add protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    return {
      success: true,
      domain: domain,
      original: input,
    };
  } catch (error) {
    return {
      success: false,
      error: "Invalid URL format",
      original: input,
    };
  }
}

/**
 * Validate domain format and restrictions
 * @param {string} hostname - Domain to validate
 * @returns {Object} Validation result
 */
function validateDomain(hostname) {
  // Reject IP addresses
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    return { valid: false, error: "IP addresses are not supported. Please use domain names." };
  }

  // Reject localhost and local domains
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".localhost")) {
    return { valid: false, error: "Local domains cannot be tracked." };
  }

  // Basic domain format validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(hostname)) {
    return { valid: false, error: "Invalid domain format." };
  }

  return { valid: true };
}

/**
 * Format seconds into "X min Y sec" format
 * @param {number} totalSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "Invalid time";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} sec`;
}

/**
 * Format seconds into human-readable time tracking format
 * @param {number} totalSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeTracking(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0s";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${hours}h`;
    }
  } else if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m`;
    }
  } else {
    return `${seconds}s`;
  }
}

/**
 * Generate a readable random pause password (e.g. "abcd-efgh-jkmn").
 * Uses crypto.getRandomValues for quality randomness. The charset omits
 * visually ambiguous characters (0/o/1/l/i) to keep it easy to copy.
 * @returns {string} A grouped lowercase code
 */
function generatePausePassword() {
  const charset = "abcdefghjkmnpqrstuvwxyz23456789";
  const groupCount = 3;
  const groupLength = 4;
  const cryptoObj = typeof crypto !== "undefined" ? crypto : globalThis.crypto;
  const bytes = new Uint8Array(groupCount * groupLength);
  cryptoObj.getRandomValues(bytes);

  const groups = [];
  for (let g = 0; g < groupCount; g++) {
    let group = "";
    for (let i = 0; i < groupLength; i++) {
      const byte = bytes[g * groupLength + i];
      group += charset[byte % charset.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/**
 * Normalize a pause password for comparison (trim + lowercase).
 * @param {string} value - Raw password value
 * @returns {string} Normalized value, or "" for non-strings
 */
function normalizePausePassword(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Check whether an entered password matches the stored one.
 * An empty/missing stored password never matches.
 * @param {string} input - Password the user typed
 * @param {string} stored - Currently stored pause password
 * @returns {boolean} Whether the entry is correct
 */
function checkPausePassword(input, stored) {
  const normalizedStored = normalizePausePassword(stored);
  if (!normalizedStored) {
    return false;
  }
  return normalizePausePassword(input) === normalizedStored;
}

// Export for Node.js (testing) environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    shouldResetTimer,
    applyTimerSettingsChange,
    normalizeRechargeRate,
    applyRecharge,
    estimateSecondsUntilFull,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
    generatePausePassword,
    normalizePausePassword,
    checkPausePassword,
  };
} else if (typeof window !== "undefined") {
  // Browser environment - make functions globally available
  window.TimerUtils = {
    shouldResetTimer,
    applyTimerSettingsChange,
    normalizeRechargeRate,
    applyRecharge,
    estimateSecondsUntilFull,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
    generatePausePassword,
    normalizePausePassword,
    checkPausePassword,
  };
} else {
  // Service worker environment - make functions globally available
  globalThis.TimerUtils = {
    shouldResetTimer,
    applyTimerSettingsChange,
    normalizeRechargeRate,
    applyRecharge,
    estimateSecondsUntilFull,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
    generatePausePassword,
    normalizePausePassword,
    checkPausePassword,
  };
}
