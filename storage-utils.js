// Shared storage utility functions for the Site Blocker extension

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
window.StorageUtils = {
  setToStorage,
  getFromStorage
};