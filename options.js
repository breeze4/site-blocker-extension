document.getElementById('siteForm').addEventListener('submit', (event) => {
  debugger;
  event.preventDefault();

  const domain = document.getElementById('domainInput').value.trim();
  const timer = parseInt(document.getElementById('timerInput').value.trim(), 10);

  if (domain && timer) {
    chrome.storage.local.get('domainTimers', (result) => {
      const domainTimers = result.domainTimers || {};
      domainTimers[domain] = timer;

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

    for (const [domain, time] of Object.entries(domainTimers)) {
      const listItem = document.createElement('li');
      listItem.textContent = `${domain}: ${time} seconds remaining`;
      domainList.appendChild(listItem);
    }
  });
}

// Initial render
renderDomainList();
