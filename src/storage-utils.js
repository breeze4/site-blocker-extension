// Shared storage utility functions for the Site Blocker extension

// Detect if running in unpacked (development) mode
// In unpacked mode, chrome.runtime.getManifest().update_url is undefined
const isDebugMode = !chrome.runtime.getManifest().update_url;

// Debug logging utility - only logs in unpacked mode
function debugLog(...args) {
  if (isDebugMode) {
    console.log("[SiteBlocker Debug]", ...args);
  }
}

// A Promise-based wrapper for chrome.storage.local.set to allow for async/await syntax
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

// A Promise-based wrapper for chrome.storage.local.get for cleaner asynchronous operations
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

// Export the functions for use in other modules
// Check if we're in a service worker environment (no window object)
if (typeof window !== "undefined") {
  // Content script environment
  window.StorageUtils = {
    setToStorage,
    getFromStorage,
    debugLog,
    isDebugMode,
  };
} else {
  // Service worker environment - functions are available globally
  // No need to export since importScripts() makes functions global
}
