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
 * Compute the re-entry floor for a domain: the minimum timeLeft required
 * before a blocked domain is reachable again. Fixed at 10% of originalTime.
 * Returns 0 for a missing or non-finite cap.
 * @param {number} originalTime - The domain's budget cap in seconds
 * @returns {number} The floor value in seconds
 */
function reEntryFloor(originalTime) {
  if (!Number.isFinite(originalTime) || originalTime <= 0) {
    return 0;
  }
  return Math.ceil(originalTime * 0.1);
}

/**
 * Update the isBlocked flag on a timer record based on timeLeft and the
 * re-entry floor. Sets isBlocked when timeLeft is at or below zero, clears it
 * when timeLeft is at or above the floor, and leaves it unchanged in the
 * mid-band. Returns a new object rather than mutating.
 * @param {Object} timerData - Timer data with timeLeft, originalTime, isBlocked
 * @returns {Object} A new timer record with isBlocked updated
 */
function updateBlockedState(timerData) {
  const originalTime =
    Number.isFinite(timerData.originalTime) && timerData.originalTime > 0
      ? timerData.originalTime
      : 0;
  const timeLeft = Number.isFinite(timerData.timeLeft) ? timerData.timeLeft : 0;
  const floor = reEntryFloor(originalTime);
  const prev = timerData.isBlocked === true;

  let isBlocked = prev;
  if (timeLeft <= 0) {
    isBlocked = true;
  } else if (timeLeft >= floor) {
    isBlocked = false;
  }

  return { ...timerData, isBlocked };
}

/**
 * Decide whether a domain is currently reachable.
 * Returns false when isBlocked is true (even with positive timeLeft) or when
 * timeLeft is zero/negative. A missing isBlocked field is treated as if it were
 * derived from timeLeft <= 0.
 * @param {Object} timerData - Timer data with timeLeft, isBlocked
 * @returns {boolean}
 */
function canAccessDomain(timerData) {
  if (!timerData) {
    return false;
  }
  const timeLeft = Number.isFinite(timerData.timeLeft) ? timerData.timeLeft : 0;
  const isBlocked =
    timerData.isBlocked === true || (timerData.isBlocked === undefined && timeLeft <= 0);
  return timeLeft > 0 && !isBlocked;
}

/**
 * Normalize a token threshold in hours. The allowed ladder is 4/8/12/24;
 * anything missing, zero, negative, non-finite, or non-numeric defaults to 8.
 * @param {number} hours - Candidate threshold
 * @returns {number} A threshold on the ladder
 */
function normalizeTokenThresholdHours(hours) {
  const ladder = [4, 8, 12, 24];
  return ladder.includes(hours) ? hours : 8;
}

/**
 * Grant a reset token to a domain that has been left alone for the full
 * threshold. A domain that already holds a token returns unchanged, so tokens
 * never stack. Never mutates; returns a new record.
 * @param {Object} timerData - Timer data with awaySince, tokenThresholdHours, resetToken, lastVisitTimestamp
 * @param {number} currentTime - Injected timestamp (for testing)
 * @returns {Object} New timer record
 */
function grantResetTokenIfEarned(timerData, currentTime = Date.now()) {
  const thresholdHours = normalizeTokenThresholdHours(timerData.tokenThresholdHours);
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const awaySince =
    Number.isFinite(timerData.awaySince) && timerData.awaySince > 0
      ? timerData.awaySince
      : Number.isFinite(timerData.lastVisitTimestamp) && timerData.lastVisitTimestamp > 0
        ? timerData.lastVisitTimestamp
        : currentTime;
  const held = timerData.resetToken === true;
  const elapsed = currentTime - awaySince;

  if (!held && elapsed >= thresholdMs) {
    return { ...timerData, resetToken: true };
  }
  return { ...timerData };
}

/**
 * Whole seconds until the domain's next token is ready. 0 when a token is
 * already held, never negative.
 * @param {Object} timerData - Timer data
 * @param {number} currentTime - Injected timestamp
 * @returns {number}
 */
function secondsUntilTokenReady(timerData, currentTime = Date.now()) {
  if (!timerData) {
    return 0;
  }
  if (timerData.resetToken === true) {
    return 0;
  }
  const thresholdHours = normalizeTokenThresholdHours(timerData.tokenThresholdHours);
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const awaySince =
    Number.isFinite(timerData.awaySince) && timerData.awaySince > 0
      ? timerData.awaySince
      : Number.isFinite(timerData.lastVisitTimestamp) && timerData.lastVisitTimestamp > 0
        ? timerData.lastVisitTimestamp
        : currentTime;
  const remaining = thresholdMs - (currentTime - awaySince);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Spend a held reset token: refill the budget to its cap, clear the token and
 * blocked state, and stamp awaySince to now. Returns the updated record and a
 * success flag. Refuses when no token is held or when the budget is already at
 * or above the cap.
 * @param {Object} timerData
 * @param {number} currentTime
 * @returns {{ timerData: Object, success: boolean, reason: string }}
 */
function spendResetToken(timerData, currentTime = Date.now()) {
  const originalTime =
    Number.isFinite(timerData.originalTime) && timerData.originalTime > 0
      ? timerData.originalTime
      : 0;
  const timeLeft = Number.isFinite(timerData.timeLeft) ? timerData.timeLeft : 0;

  if (timerData.resetToken !== true) {
    return { timerData: { ...timerData }, success: false, reason: "no-token" };
  }
  if (timeLeft >= originalTime) {
    return { timerData: { ...timerData }, success: false, reason: "at-cap" };
  }

  return {
    timerData: {
      ...timerData,
      timeLeft: originalTime,
      resetToken: false,
      isBlocked: false,
      awaySince: currentTime,
      expiredMessageLogged: false,
      lastVisitTimestamp: currentTime,
    },
    success: true,
    reason: null,
  };
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
    reEntryFloor,
    updateBlockedState,
    canAccessDomain,
    normalizeTokenThresholdHours,
    grantResetTokenIfEarned,
    secondsUntilTokenReady,
    spendResetToken,
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
    reEntryFloor,
    updateBlockedState,
    canAccessDomain,
    normalizeTokenThresholdHours,
    grantResetTokenIfEarned,
    secondsUntilTokenReady,
    spendResetToken,
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
    reEntryFloor,
    updateBlockedState,
    canAccessDomain,
    normalizeTokenThresholdHours,
    grantResetTokenIfEarned,
    secondsUntilTokenReady,
    spendResetToken,
  };
}
