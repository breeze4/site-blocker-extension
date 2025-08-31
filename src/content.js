// This script is injected into every page to check if the domain is blocked.

async function checkDomainBlocked() {
  try {
    // Retrieve the domain timers from local storage.
    const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
    // Get the current page's URL and extract the hostname.
    const url = new URL(window.location.href);
    const domain = url.hostname;

    // Check if the time left for the current domain is zero or less.
    if (domainTimers[domain] && domainTimers[domain].timeLeft <= 0) {
      // If the time is up, replace the page's content with a "blocked" message.
      document.body.innerHTML = "<h1>Access Blocked</h1><p>Your time is up for this site.</p>";
    }
  } catch (error) {}
}

// Check domain status on page load
checkDomainBlocked();
