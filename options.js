// This script handles the logic for the options page, allowing users to configure the site blocker.

// Add an event listener to the form for adding or updating a site timer.
document.getElementById('siteForm').addEventListener('submit', (event) => {
  // Prevent the default form submission behavior.
  event.preventDefault();

  // Get the values from the form fields.
  const domain = document.getElementById('domainInput').value.trim();
  
  // Get selected radio button values
  const timeAllowedRadio = document.querySelector('input[name="timeAllowed"]:checked');
  const resetIntervalRadio = document.querySelector('input[name="resetInterval"]:checked');
  
  // Time is already in minutes from radio button values and converted to seconds for storage.
  const originalTimeInMinutes = timeAllowedRadio ? parseInt(timeAllowedRadio.value, 10) : null;
  const resetInterval = resetIntervalRadio ? parseInt(resetIntervalRadio.value, 10) : null;

  // Check if all the required fields have a value.
  if (domain && originalTimeInMinutes !== null && resetInterval !== null) {
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
        // Reset radio buttons to default selections
        document.getElementById('time5').checked = true;
        document.getElementById('reset8').checked = true;
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
    
    // Store current radio button selections and save button states to preserve during re-render
    const currentSelections = {};
    const saveButtonStates = {};
    
    // Collect current state before clearing
    const existingRows = domainListBody.querySelectorAll('tr');
    existingRows.forEach(row => {
      const domain = row.querySelector('.save-button-inline')?.dataset.domain;
      if (domain) {
        const timeRadio = row.querySelector('[data-field="originalTime"] input[type="radio"]:checked');
        const resetRadio = row.querySelector('[data-field="resetInterval"] input[type="radio"]:checked');
        const saveButton = row.querySelector('.save-button-inline');
        
        currentSelections[domain] = {
          timeValue: timeRadio ? timeRadio.value : null,
          resetValue: resetRadio ? resetRadio.value : null
        };
        
        saveButtonStates[domain] = saveButton ? !saveButton.disabled : false;
      }
    });
    
    // Clear the existing table body before rendering the updated list.
    domainListBody.innerHTML = '';

    // Iterate over the domain timers and create a table row for each one.
    for (const [domain, { originalTime, timeLeft, resetInterval, lastResetTimestamp }] of Object.entries(domainTimers)) {
      const row = document.createElement('tr');
      
      // Create cells
      const domainCell = document.createElement('td');
      domainCell.textContent = domain;
      
      // Time Allowed cell with radio buttons and save button
      const timeAllowedCell = document.createElement('td');
      timeAllowedCell.className = 'radio-cell';
      timeAllowedCell.setAttribute('data-field', 'originalTime');
      
      const cellContent = document.createElement('div');
      cellContent.className = 'radio-cell-content';
      
      const timeRadioGroup = document.createElement('div');
      timeRadioGroup.className = 'table-radio-group';
      const timeRadioName = `time_${domain}_${Date.now()}`;
      const timeOptions = [1, 5, 10, 15, 30, 60, 120];
      const currentTimeMinutes = Math.floor(originalTime / 60);
      
      // Determine which option should be selected
      let selectedTimeOption;
      if (currentSelections[domain] && currentSelections[domain].timeValue) {
        // Use preserved selection if available
        selectedTimeOption = parseInt(currentSelections[domain].timeValue);
      } else {
        // Find closest option to stored value
        selectedTimeOption = timeOptions[0];
        let closestTimeDiff = Math.abs(currentTimeMinutes - selectedTimeOption);
        timeOptions.forEach(minutes => {
          const diff = Math.abs(currentTimeMinutes - minutes);
          if (diff < closestTimeDiff) {
            closestTimeDiff = diff;
            selectedTimeOption = minutes;
          }
        });
      }
      
      timeOptions.forEach(minutes => {
        const radioOption = document.createElement('div');
        radioOption.className = 'table-radio-option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = timeRadioName;
        radio.value = minutes;
        radio.id = `${timeRadioName}_${minutes}`;
        if (minutes === selectedTimeOption) radio.checked = true;
        
        const label = document.createElement('label');
        label.htmlFor = radio.id;
        label.textContent = minutes >= 60 ? `${minutes/60} hr` : `${minutes} min`;
        
        radioOption.appendChild(radio);
        radioOption.appendChild(label);
        timeRadioGroup.appendChild(radioOption);
      });
      
      // Add save button to this column
      const saveButton = document.createElement('button');
      saveButton.className = 'save-button-inline';
      saveButton.setAttribute('data-domain', domain);
      saveButton.textContent = 'Save';
      saveButton.disabled = true;
      
      cellContent.appendChild(timeRadioGroup);
      cellContent.appendChild(saveButton);
      timeAllowedCell.appendChild(cellContent);
      
      // Time Left cell (display only)
      const timeLeftCell = document.createElement('td');
      timeLeftCell.textContent = formatTime(timeLeft);
      
      // Reset Interval cell with radio buttons
      const resetIntervalCell = document.createElement('td');
      resetIntervalCell.className = 'radio-cell';
      resetIntervalCell.setAttribute('data-field', 'resetInterval');
      
      const resetRadioGroup = document.createElement('div');
      resetRadioGroup.className = 'table-radio-group';
      const resetRadioName = `reset_${domain}_${Date.now()}`;
      const intervalOptions = [1, 2, 4, 8, 12, 24];
      
      // Determine which option should be selected
      let selectedResetOption;
      if (currentSelections[domain] && currentSelections[domain].resetValue) {
        // Use preserved selection if available
        selectedResetOption = parseInt(currentSelections[domain].resetValue);
      } else {
        // Find closest option to stored value
        selectedResetOption = intervalOptions[0];
        let closestResetDiff = Math.abs(resetInterval - selectedResetOption);
        intervalOptions.forEach(hours => {
          const diff = Math.abs(resetInterval - hours);
          if (diff < closestResetDiff) {
            closestResetDiff = diff;
            selectedResetOption = hours;
          }
        });
      }
      
      intervalOptions.forEach(hours => {
        const radioOption = document.createElement('div');
        radioOption.className = 'table-radio-option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = resetRadioName;
        radio.value = hours;
        radio.id = `${resetRadioName}_${hours}`;
        if (hours === selectedResetOption) radio.checked = true;
        
        const label = document.createElement('label');
        label.htmlFor = radio.id;
        label.textContent = `${hours} hr`;
        
        radioOption.appendChild(radio);
        radioOption.appendChild(label);
        resetRadioGroup.appendChild(radioOption);
      });
      
      resetIntervalCell.appendChild(resetRadioGroup);
      
      // Last Reset cell
      const lastResetCell = document.createElement('td');
      lastResetCell.textContent = new Date(lastResetTimestamp).toLocaleString();
      
      // Actions cell (only delete button now)
      const actionsCell = document.createElement('td');
      actionsCell.innerHTML = `
        <button class="delete-button" data-domain="${domain}">Delete</button>
      `;
      
      // Append all cells to row
      row.appendChild(domainCell);
      row.appendChild(timeAllowedCell);
      row.appendChild(timeLeftCell);
      row.appendChild(resetIntervalCell);
      row.appendChild(lastResetCell);
      row.appendChild(actionsCell);
      
      // Restore save button state if it was previously enabled
      if (saveButtonStates[domain]) {
        saveButton.disabled = false;
      }
      
      // Add change event listeners to radio buttons
      timeRadioGroup.addEventListener('change', () => {
        saveButton.disabled = false;
      });
      
      resetRadioGroup.addEventListener('change', () => {
        saveButton.disabled = false;
      });

      domainListBody.appendChild(row);
    }
  });
}

// Use event delegation to handle clicks on the table body. This is more efficient than adding listeners to each button and cell.
document.getElementById('domainListBody').addEventListener('click', (event) => {
  const target = event.target;

  // Skip click-to-edit for radio button columns (originalTime and resetInterval)
  // Radio buttons are now always visible in these columns

  // Logic to handle the save button click.
  if (target.classList.contains('save-button-inline')) {
    const domainToSave = target.dataset.domain;
    const row = target.closest('tr');
    
    // Get values from always-visible radio buttons
    const originalTimeRadio = row.querySelector('[data-field="originalTime"] input[type="radio"]:checked');
    const resetIntervalRadio = row.querySelector('[data-field="resetInterval"] input[type="radio"]:checked');

    if (originalTimeRadio && resetIntervalRadio) {
      const originalTimeInMinutes = parseInt(originalTimeRadio.value, 10);
      const resetInterval = parseInt(resetIntervalRadio.value, 10);

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
