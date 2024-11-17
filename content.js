chrome.storage.local.get("domainTimers", (result) => {
  const domainTimers = result.domainTimers || {};
  const url = new URL(window.location.href);
  const domain = url.hostname;

  if (domainTimers[domain] <= 0) {
    document.body.innerHTML = "<h1>Access Blocked</h1><p>Your time is up for this site.</p>";
  }
});
