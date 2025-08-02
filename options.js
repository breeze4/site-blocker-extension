// This script handles the logic for the options page, allowing users to configure the site blocker.

// Add an event listener to the form for adding or updating a site timer.
document.getElementById('siteForm').addEventListener('submit', async (event) => {
  // Prevent the default form submission behavior.
  event.preventDefault();

  // Get the values from the form fields.
  const domain = document.getElementById('domainInput').value.trim();
  
  // Get selected radio button values
  const timeAllowedRadio = document.querySelector('input[name="timeAllowed"]:checked');
  const globalResetIntervalRadio = document.querySelector('input[name="globalResetInterval"]:checked');
  
  // Time is already in minutes from radio button values and converted to seconds for storage.
  const originalTimeInMinutes = timeAllowedRadio ? parseInt(timeAllowedRadio.value, 10) : null;
  const resetInterval = globalResetIntervalRadio ? parseInt(globalResetIntervalRadio.value, 10) : 24; // Default to 24 hours

  // Check if all the required fields have a value.
  if (domain && originalTimeInMinutes !== null) {
    const originalTimeInSeconds = originalTimeInMinutes * 60;
    
    try {
      // Get the current list of domain timers from storage.
      const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
      
      // Add or update the timer for the specified domain.
      // When adding a new timer, timeLeft is set to the originalTime.
      domainTimers[domain] = {
        originalTime: originalTimeInSeconds,
        timeLeft: originalTimeInSeconds, // Set timeLeft to originalTime
        resetInterval: resetInterval,
        lastResetTimestamp: Date.now()
      };

      // Save the updated timers back to storage.
      await StorageUtils.setToStorage({ domainTimers });
      
      // Re-render the list of domains to reflect the changes.
      renderDomainList();
      // Clear the form fields for the next entry.
      document.getElementById('domainInput').value = '';
      // Reset radio buttons to default selections
      document.getElementById('time5').checked = true;
    } catch (error) {
      console.error('Error updating domain timer:', error);
    }
  }
});

// This function renders the list of configured domains and their timers into the table.
async function renderDomainList() {
  // Helper function to convert seconds to a "X min Y sec" format.
  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return 'Invalid time';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${seconds} sec`;
  };

  try {
    // Get the domain timers from storage.
    const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
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
        const saveButton = row.querySelector('.save-button-inline');
        
        currentSelections[domain] = {
          timeValue: timeRadio ? timeRadio.value : null
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

      domainListBody.appendChild(row);
    }
  } catch (error) {
    console.error('Error rendering domain list:', error);
  }
}

// Use event delegation to handle clicks on the table body. This is more efficient than adding listeners to each button and cell.
document.getElementById('domainListBody').addEventListener('click', async (event) => {
  const target = event.target;

  // Skip click-to-edit for radio button columns (originalTime and resetInterval)
  // Radio buttons are now always visible in these columns

  // Logic to handle the save button click.
  if (target.classList.contains('save-button-inline')) {
    const domainToSave = target.dataset.domain;
    const row = target.closest('tr');
    
    // Get values from always-visible radio buttons
    const originalTimeRadio = row.querySelector('[data-field="originalTime"] input[type="radio"]:checked');
    const globalResetIntervalRadio = document.querySelector('input[name="globalResetInterval"]:checked');

    if (originalTimeRadio) {
      const originalTimeInMinutes = parseInt(originalTimeRadio.value, 10);
      const resetInterval = globalResetIntervalRadio ? parseInt(globalResetIntervalRadio.value, 10) : 24;

      if (!isNaN(originalTimeInMinutes) && !isNaN(resetInterval)) {
        const originalTimeInSeconds = originalTimeInMinutes * 60;

        try {
          const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
          if (domainTimers[domainToSave]) {
            domainTimers[domainToSave].originalTime = originalTimeInSeconds;
            // Also update timeLeft if the originalTime is changed, to avoid confusion.
            domainTimers[domainToSave].timeLeft = originalTimeInSeconds;
            domainTimers[domainToSave].resetInterval = resetInterval;
          }
          
          await StorageUtils.setToStorage({ domainTimers });
          
          // Disable the save button after successful save
          const saveButton = target;
          saveButton.disabled = true;
          renderDomainList();
        } catch (error) {
          console.error('Error saving domain timer:', error);
        }
      }
    }
  }

  // Logic to handle the delete button click.
  if (target.classList.contains('delete-button')) {
    const domainToDelete = target.dataset.domain;

    try {
      // Get the current list of domain timers from storage.
      const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
      // Remove the domain from the object.
      delete domainTimers[domainToDelete];

      // Save the updated timers back to storage.
      await StorageUtils.setToStorage({ domainTimers });
      
      // Re-render the list of domains to reflect the changes.
      renderDomainList();
    } catch (error) {
      console.error('Error deleting domain timer:', error);
    }
  }
});

// Add an event listener to the "Reset Timers" button.
document.getElementById('resetTimersButton').addEventListener('click', async (event) => {
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

  try {
    // Get the current domain timers from storage.
    const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
    // Reset the timers.
    const domainTimersReset = resetTimers(domainTimers);

    // Save the reset timers back to storage.
    await StorageUtils.setToStorage({ domainTimers: domainTimersReset });
    
    // Re-render the domain list to show the updated timers.
    renderDomainList();
  } catch (error) {
    console.error('Error resetting timers:', error);
  }

});

// Add event listener for global reset interval changes
document.getElementById('globalResetIntervalGroup').addEventListener('change', async () => {
  const globalResetIntervalRadio = document.querySelector('input[name="globalResetInterval"]:checked');
  if (globalResetIntervalRadio) {
    const newResetInterval = parseInt(globalResetIntervalRadio.value, 10);
    
    try {
      // Update all existing domains with the new reset interval
      const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
      
      // Update reset interval for all domains
      for (const domain in domainTimers) {
        domainTimers[domain].resetInterval = newResetInterval;
      }
      
      await StorageUtils.setToStorage({ domainTimers });
      renderDomainList();
    } catch (error) {
      console.error('Error updating global reset interval:', error);
    }
  }
});

// Load and set the current global reset interval when page loads
async function initializeGlobalResetInterval() {
  try {
    const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
    const domains = Object.keys(domainTimers);
    
    if (domains.length > 0) {
      // Use the reset interval from the first domain (they should all be the same now)
      const currentResetInterval = domainTimers[domains[0]].resetInterval || 24;
      const radioToSelect = document.getElementById(`globalReset${currentResetInterval}`);
      if (radioToSelect) {
        radioToSelect.checked = true;
      }
    }
  } catch (error) {
    console.error('Error initializing global reset interval:', error);
  }
}

// Initialize when page loads
initializeGlobalResetInterval();

// Render the initial list of domains when the options page is loaded.
renderDomainList();

// Function to update only time left and last reset columns without full re-render
async function updateTimeDisplays() {
  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return 'Invalid time';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${seconds} sec`;
  };

  try {
    const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
    const domainListBody = document.getElementById('domainListBody');
    const rows = domainListBody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const saveButton = row.querySelector('.save-button-inline');
      const domain = saveButton?.dataset.domain;
      
      if (domain && domainTimers[domain]) {
        const { timeLeft, lastResetTimestamp } = domainTimers[domain];
        
        // Update time left (3rd column)
        const timeLeftCell = row.cells[2];
        if (timeLeftCell) {
          timeLeftCell.textContent = formatTime(timeLeft);
        }
        
        // Update last reset (4th column)
        const lastResetCell = row.cells[3];
        if (lastResetCell) {
          lastResetCell.textContent = new Date(lastResetTimestamp).toLocaleString();
        }
      }
    });
  } catch (error) {
    console.error('Error updating time displays:', error);
  }
}

// Set an interval to update only time displays every second
setInterval(updateTimeDisplays, 1000);
