// This script handles the logic for the options page, allowing users to configure the site blocker.

// Add an event listener to the form for adding or updating a site timer.
document.getElementById('siteForm').addEventListener('submit', (event) => {
  // Prevent the default form submission behavior.
  event.preventDefault();

  // Get the values from the input fields.
  const domain = document.getElementById('domainInput').value.trim();
  const originalTime = parseInt(document.getElementById('originalTime').value.trim(), 10);
  const timeLeft = parseInt(document.getElementById('timeLeft').value.trim(), 10);
  const resetInterval = parseInt(document.getElementById('resetInterval').value.trim(), 10);

  // Check if all the required fields have a value.
  if (domain && originalTime && timeLeft && resetInterval) {
    // Get the current list of domain timers from storage.
    chrome.storage.local.get('domainTimers', (result) => {
      const domainTimers = result.domainTimers || {};
      // Add or update the timer for the specified domain.
      domainTimers[domain] = { originalTime, timeLeft, resetInterval, lastResetTimestamp: Date.now() };

      // Save the updated timers back to storage.
      chrome.storage.local.set({ domainTimers }, () => {
        // Re-render the list of domains to reflect the changes.
        renderDomainList();
      });
    });
  }
});

// This function renders the list of configured domains and their timers.
function renderDomainList() {
  // Get the domain timers from storage.
  chrome.storage.local.get('domainTimers', (result) => {
    const domainTimers = result.domainTimers || {};
    const domainList = document.getElementById('domainList');
    // Clear the existing list before rendering the updated list.
    domainList.innerHTML = '';

    // Iterate over the domain timers and create a list item for each one.
    for (const [domain, { originalTime, timeLeft, resetInterval, lastResetTimestamp }] of Object.entries(domainTimers)) {
      const listItem = document.createElement('li');
      listItem.textContent = `${domain} - ${originalTime} sec allowed: ${timeLeft} seconds remaining,` +
        ` resets every ${resetInterval} hours, last reset: ${new Date(lastResetTimestamp).toLocaleString()}|`;
      domainList.appendChild(listItem);
    }
  });
}

// Add an event listener to the "Reset Timers" button.
document.getElementById('resetTimersButton').addEventListener('click', (event) => {
  event.preventDefault();

  // This function resets the time left for all domains to their original time.
  function resetTimers(domainTimers) {
    const currentTime = Date.now();

    for (const [domain, timerData] of Object.entries(domainTimers)) {
      timerData.timeLeft = timerData.originalTime;
      timerData.lastResetTimestamp = currentTime;
      domainTimers[domain] = timerData;
    }
    return domainTimers;
  }

  // Get the current domain timers from storage.
  chrome.storage.local.get('domainTimers', (result) => {
    const domainTimers = result.domainTimers || {};
    // Reset the timers.
    const domainTimersReset = resetTimers(domainTimers);

    // Save the reset timers back to storage.
    chrome.storage.local.set({ domainTimers: domainTimersReset }, () => {
      // Re-render the domain list to show the updated timers.
      renderDomainList()
    });
  });

});

// Render the initial list of domains when the options page is loaded.
renderDomainList();
