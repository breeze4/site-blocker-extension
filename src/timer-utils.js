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
  const needsReset = timeChanged || currentTimeLeft > newOriginalTime;
  return needsReset;
}

/**
 * Apply timer settings change and determine new state
 * @param {Object} timerData - Current timer data
 * @param {number} newOriginalTime - New time limit in seconds
 * @param {number} newResetInterval - New reset interval in hours
 * @returns {Object} Updated timer data
 */
function applyTimerSettingsChange(timerData, newOriginalTime, newResetInterval) {
  const result = { ...timerData };
  const needsReset = shouldResetTimer(timerData.originalTime, newOriginalTime, timerData.timeLeft);

  result.originalTime = newOriginalTime;
  result.resetInterval = newResetInterval;

  if (needsReset) {
    result.timeLeft = newOriginalTime;
    result.lastResetTimestamp = Date.now();
    result.expiredMessageLogged = false;
  }

  return {
    timerData: result,
    wasReset: needsReset,
  };
}

/**
 * Check if timer should be reset based on reset interval
 * @param {Object} timerData - Timer data with resetInterval and lastResetTimestamp
 * @param {number} currentTime - Current timestamp (for testing)
 * @returns {Object} Updated timer data if reset needed, original otherwise
 */
function checkAndResetIfIntervalPassed(timerData, currentTime = Date.now()) {
  const resetIntervalMs = timerData.resetInterval * 60 * 60 * 1000;
  const resetCanHappenAfterTimestamp = timerData.lastResetTimestamp + resetIntervalMs;

  if (currentTime >= resetCanHappenAfterTimestamp) {
    return {
      ...timerData,
      timeLeft: timerData.originalTime,
      lastResetTimestamp: currentTime,
      expiredMessageLogged: false,
    };
  }

  return timerData;
}

/**
 * Decrement timer by one second
 * @param {Object} timerData - Timer data
 * @returns {Object} Updated timer data
 */
function decrementTimer(timerData) {
  const newTimeLeft = Math.max(0, timerData.timeLeft - 1);
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
  if (isNaN(totalSeconds) || totalSeconds < 0) {
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
  if (isNaN(totalSeconds) || totalSeconds < 0) {
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

// Export for Node.js (testing) environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    shouldResetTimer,
    applyTimerSettingsChange,
    checkAndResetIfIntervalPassed,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
  };
} else if (typeof window !== "undefined") {
  // Browser environment - make functions globally available
  window.TimerUtils = {
    shouldResetTimer,
    applyTimerSettingsChange,
    checkAndResetIfIntervalPassed,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
  };
} else {
  // Service worker environment - make functions globally available
  globalThis.TimerUtils = {
    shouldResetTimer,
    applyTimerSettingsChange,
    checkAndResetIfIntervalPassed,
    decrementTimer,
    parseURL,
    validateDomain,
    formatTime,
    formatTimeTracking,
  };
}
