document.getElementById('siteForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const domain = document.getElementById('domainInput').value.trim();
  const originalTime = parseInt(document.getElementById('originalTime').value.trim(), 10);
  const timeLeft = parseInt(document.getElementById('timeLeft').value.trim(), 10);
  const resetInterval = parseInt(document.getElementById('resetInterval').value.trim(), 10);

  if (domain && originalTime && timeLeft && resetInterval) {
    chrome.storage.local.get('domainTimers', (result) => {
      const domainTimers = result.domainTimers || {};
      domainTimers[domain] = { originalTime, timeLeft, resetInterval, lastResetTimestamp: Date.now() };

      chrome.storage.local.set({ domainTimers }, () => {
        renderDomainList();
      });
    });
  }
});

function renderDomainList() {
  chrome.storage.local.get('domainTimers', (result) => {
    const domainTimers = result.domainTimers || {};
    const domainList = document.getElementById('domainList');
    domainList.innerHTML = '';

    for (const [domain, { originalTime, timeLeft, resetInterval, lastResetTimestamp }] of Object.entries(domainTimers)) {
      const listItem = document.createElement('li');
      listItem.textContent = `${domain} - ${originalTime} sec allowed: ${timeLeft} seconds remaining,` +
        ` resets every ${resetInterval} hours, last reset: ${new Date(lastResetTimestamp).toLocaleString()}|`;
      domainList.appendChild(listItem);
    }
  });
}

// Initial render
renderDomainList();
