// This script handles the logic for the options page, allowing users to configure the site blocker.

// Add an event listener to the form for adding or updating a site timer.
document.getElementById('siteForm').addEventListener('submit', (event) => {
  // Prevent the default form submission behavior.
  event.preventDefault();

  // Get the values from the new input fields.
  const domain = document.getElementById('domainInput').value.trim();
  // Time is entered in minutes and converted to seconds for storage.
  const originalTimeInMinutes = parseInt(document.getElementById('originalTimeInput').value.trim(), 10);
  const resetInterval = parseInt(document.getElementById('resetIntervalInput').value.trim(), 10);

  // Check if all the required fields have a value.
  if (domain && !isNaN(originalTimeInMinutes) && !isNaN(resetInterval)) {
    const originalTimeInSeconds = originalTimeInMinutes * 60;
    // Get the current list of domain timers from storage.
    chrome.storage.local.get('domainTimers', (result) => {
      const domainTimers = result.domainTimers || {};
      // Add or update the timer for the specified domain.
      // When adding a new timer, timeLeft is set to the originalTime.
      domainTimers[domain] = {
        originalTime: originalTimeInSeconds,
        timeLeft: originalTimeInSeconds, // Set timeLeft to originalTime
        resetInterval: resetInterval,
        lastResetTimestamp: Date.now()
      };

      // Save the updated timers back to storage.
      chrome.storage.local.set({ domainTimers }, () => {
        // Re-render the list of domains to reflect the changes.
        renderDomainList();
        // Clear the form fields for the next entry.
        document.getElementById('domainInput').value = '';
        document.getElementById('originalTimeInput').value = '';
        document.getElementById('resetIntervalInput').value = '';
      });
    });
  }
});

// This function renders the list of configured domains and their timers into the table.
function renderDomainList() {
  // Helper function to convert seconds to a "X min Y sec" format.
  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return 'Invalid time';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${seconds} sec`;
  };

  // Get the domain timers from storage.
  chrome.storage.local.get('domainTimers', (result) => {
    const domainTimers = result.domainTimers || {};
    const domainListBody = document.getElementById('domainListBody');
    // Clear the existing table body before rendering the updated list.
    domainListBody.innerHTML = '';

    // Iterate over the domain timers and create a table row for each one.
    for (const [domain, { originalTime, timeLeft, resetInterval, lastResetTimestamp }] of Object.entries(domainTimers)) {
      const row = document.createElement('tr');

      // Time is displayed in minutes and seconds for readability.
      row.innerHTML = `
        <td>${domain}</td>
        <td class="editable" data-field="originalTime">${Math.floor(originalTime / 60)}</td>
        <td>${formatTime(timeLeft)}</td>
        <td class="editable" data-field="resetInterval">${resetInterval}</td>
        <td>${new Date(lastResetTimestamp).toLocaleString()}</td>
        <td>
          <button class="save-button" data-domain="${domain}" disabled>Save</button>
          <button class="delete-button" data-domain="${domain}">Delete</button>
        </td>
      `;

      domainListBody.appendChild(row);
    }
  });
}

// Use event delegation to handle clicks on the table body. This is more efficient than adding listeners to each button and cell.
document.getElementById('domainListBody').addEventListener('click', (event) => {
  const target = event.target;

  // Logic to make a cell editable when clicked.
  if (target.classList.contains('editable') && !target.querySelector('input')) {
    const currentValue = target.textContent;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentValue;
    target.innerHTML = '';
    target.appendChild(input);
    input.focus();

    // When the input value changes, enable the save button for that row.
    input.addEventListener('input', () => {
      const saveButton = target.closest('tr').querySelector('.save-button');
      saveButton.disabled = false;
    });

    // When the input loses focus, revert it back to a normal cell.
    // This provides a simple way to "cancel" an edit without saving.
    input.addEventListener('blur', () => {
      // A small delay is needed to allow the "save" button click to register before the input is removed.
      setTimeout(() => {
        const saveButton = target.closest('tr').querySelector('.save-button');
        if (document.activeElement !== saveButton) {
            // If the input still exists, replace the cell content.
            if (target.querySelector('input')) {
                target.innerHTML = input.value;
            }
        }
      }, 150);
    });
  }

  // Logic to handle the save button click.
  if (target.classList.contains('save-button')) {
    const domainToSave = target.dataset.domain;
    const row = target.closest('tr');
    const originalTimeInput = row.querySelector('[data-field="originalTime"] input');
    const resetIntervalInput = row.querySelector('[data-field="resetInterval"] input');

    // Check if the input fields exist before trying to read their values.
    if (originalTimeInput && resetIntervalInput) {
      const originalTimeInMinutes = parseInt(originalTimeInput.value, 10);
      const resetInterval = parseInt(resetIntervalInput.value, 10);

      if (!isNaN(originalTimeInMinutes) && !isNaN(resetInterval)) {
        const originalTimeInSeconds = originalTimeInMinutes * 60;

        chrome.storage.local.get('domainTimers', (result) => {
          const domainTimers = result.domainTimers || {};
          if (domainTimers[domainToSave]) {
            domainTimers[domainToSave].originalTime = originalTimeInSeconds;
            // Also update timeLeft if the originalTime is changed, to avoid confusion.
            domainTimers[domainToSave].timeLeft = originalTimeInSeconds;
            domainTimers[domainToSave].resetInterval = resetInterval;
          }
          chrome.storage.local.set({ domainTimers }, () => {
            renderDomainList();
          });
        });
      }
    }
  }

  // Logic to handle the delete button click.
  if (target.classList.contains('delete-button')) {
    const domainToDelete = target.dataset.domain;

    // Get the current list of domain timers from storage.
    chrome.storage.local.get('domainTimers', (result) => {
      const domainTimers = result.domainTimers || {};
      // Remove the domain from the object.
      delete domainTimers[domainToDelete];

      // Save the updated timers back to storage.
      chrome.storage.local.set({ domainTimers }, () => {
        // Re-render the list of domains to reflect the changes.
        renderDomainList();
      });
    });
  }
});

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

// Set an interval to refresh the list every second to keep the timers updated.
setInterval(renderDomainList, 1000);
