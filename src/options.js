// This script handles the logic for the options page, allowing users to configure the site blocker.

// URL parsing utility function for streamlined URL input
function parseURL(input) {
  // Normalize input
  let url = input.trim().toLowerCase();
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // Keep the full hostname to match background.js behavior
    // Don't remove www prefix or extract base domain - keep subdomains separate
    const domain = hostname;
    
    return {
      success: true,
      domain: domain,
      original: input
    };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid URL format',
      original: input
    };
  }
}

// Base domain extraction function for handling subdomains
function extractBaseDomain(hostname) {
  // Handle special cases like .co.uk, .com.au, etc.
  const parts = hostname.split('.');
  
  // For most domains, take last two parts (domain.tld)
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  
  return hostname;
}

// Domain validation utility function
function validateDomain(hostname) {
  // Reject IP addresses
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    return { valid: false, error: 'IP addresses are not supported. Please use domain names.' };
  }
  
  // Reject localhost and local domains
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    return { valid: false, error: 'Local domains cannot be tracked.' };
  }
  
  // Basic domain format validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(hostname)) {
    return { valid: false, error: 'Invalid domain format.' };
  }
  
  return { valid: true };
}

// Enhanced parseURL function with validation and better error messages
function parseURLWithValidation(input) {
  if (!input || !input.trim()) {
    return {
      success: false,
      error: 'Please enter a URL or domain name',
      original: input
    };
  }
  
  // Basic input sanitization - remove potentially dangerous characters
  const sanitizedInput = input.trim().replace(/[<>"']/g, '');
  
  const result = parseURL(sanitizedInput);
  
  if (!result.success) {
    // Check for common malformed URL issues
    if (input.includes(' ')) {
      return {
        success: false,
        error: 'URLs cannot contain spaces. Please check your input.',
        original: input
      };
    }
    
    if (input.includes('..')) {
      return {
        success: false,
        error: 'Invalid URL format. Please enter a valid domain.',
        original: input
      };
    }
    
    return {
      success: false,
      error: 'Invalid URL format. Try: example.com or https://example.com',
      original: input
    };
  }
  
  const validation = validateDomain(result.domain);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      original: input
    };
  }
  
  return result;
}

// Base domain extraction for sorting (reuse existing extractBaseDomain)
function getBaseDomainForSorting(domain) {
  return extractBaseDomain(domain);
}

// HTML escape function to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if domain already exists in storage
async function checkDomainExists(domain) {
  try {
    const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
    return domainTimers.hasOwnProperty(domain);
  } catch (error) {
    return false;
  }
}

// Real-time URL input parsing and preview
document.getElementById('urlInput').addEventListener('input', async (event) => {
  const input = event.target.value;
  const preview = document.getElementById('urlPreview');
  
  if (!input.trim()) {
    preview.innerHTML = '<span class="preview-placeholder">Enter a URL or domain to see what will be tracked</span>';
    return;
  }
  
  const result = parseURLWithValidation(input);
  
  if (result.success) {
    // Check if domain already exists
    const isDuplicate = await checkDomainExists(result.domain);
    
    if (isDuplicate) {
      preview.innerHTML = `
        <span class="preview-warning">WARNING: ${escapeHtml(result.domain)} is already tracked</span>
      `;
    } else {
      preview.innerHTML = `
        <span class="preview-success">Will track: <strong>${escapeHtml(result.domain)}</strong></span>
      `;
    }
  } else {
    preview.innerHTML = `
      <span class="preview-error">ERROR: ${escapeHtml(result.error)}</span>
    `;
  }
});

// Initialize preview on page load
document.addEventListener('DOMContentLoaded', () => {
  const preview = document.getElementById('urlPreview');
  preview.innerHTML = '<span class="preview-placeholder">Enter a URL or domain to see what will be tracked</span>';
});

// Add an event listener to the form for adding or updating a site timer.
document.getElementById('siteForm').addEventListener('submit', async (event) => {
  // Prevent the default form submission behavior.
  event.preventDefault();

  // Get the values from the form fields.
  const input = document.getElementById('urlInput').value.trim();
  
  // Parse and validate the URL input
  const parseResult = parseURLWithValidation(input);
  
  if (!parseResult.success) {
    alert(`Error: ${parseResult.error}`);
    return;
  }
  
  const domain = parseResult.domain;
  
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
      
      // Check for duplicates
      if (domainTimers[domain]) {
        alert(`${domain} is already being tracked`);
        return;
      }
      
      // Add or update the timer for the specified domain.
      // When adding a new timer, timeLeft is set to the originalTime.
      domainTimers[domain] = {
        originalTime: originalTimeInSeconds,
        timeLeft: originalTimeInSeconds, // Set timeLeft to originalTime
        resetInterval: resetInterval,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Save the updated timers back to storage.
      await StorageUtils.setToStorage({ domainTimers });
      
      // Re-render the list of domains to reflect the changes.
      renderDomainList();
      // Clear the form fields for the next entry.
      document.getElementById('urlInput').value = '';
      // Clear the preview
      document.getElementById('urlPreview').innerHTML = '<span class="preview-placeholder">Enter a URL or domain to see what will be tracked</span>';
      // Reset radio buttons to default selections
      document.getElementById('time5').checked = true;
    } catch (error) {
    }
  }
});

// Calculate time spent for a domain over a specific period (rolling window) - options.js version
async function calculateTimeSpentInOptions(domain, period) {
  try {
    const timeTracking = await StorageUtils.getFromStorage('timeTracking') || {};
    const domainData = timeTracking[domain];
    
    if (!domainData) {
      return 0;
    }
    
    // Handle all-time period
    if (period === 'alltime') {
      return domainData.allTimeTotal || 0;
    }
    
    // Calculate rolling window periods
    const now = new Date();
    let totalSeconds = 0;
    
    // Add current session time if there's an active session
    if (domainData.currentSessionStart) {
      const currentSessionTime = Math.floor((Date.now() - domainData.currentSessionStart) / 1000);
      totalSeconds += currentSessionTime;
    }
    
    // Determine date range based on period
    let daysToCheck = 0;
    switch (period) {
      case '24h':
        daysToCheck = 1;
        break;
      case '7d':
        daysToCheck = 7;
        break;
      case '30d':
        daysToCheck = 30;
        break;
      default:
        return 0;
    }
    
    // Sum up daily totals for the specified period
    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      if (domainData.dailyTotals && domainData.dailyTotals[dateString]) {
        totalSeconds += domainData.dailyTotals[dateString];
      }
    }
    
    return totalSeconds;
  } catch (error) {
    return 0;
  }
}

// Helper function to format time tracking data for display
function formatTimeTracking(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '0s';
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Format as "Xh Ym" for hours/minutes, "Xm Ys" for minutes/seconds
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${hours}h`;
    }
  } else if (minutes > 0) {
    if (seconds > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m`;
    }
  } else {
    return `${seconds}s`;
  }
}

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

    // Sort domains by base domain first, then by subdomain
    const sortedDomains = Object.entries(domainTimers).sort((a, b) => {
      const [domainA] = a;
      const [domainB] = b;
      
      const baseDomainA = getBaseDomainForSorting(domainA);
      const baseDomainB = getBaseDomainForSorting(domainB);
      
      // First sort by base domain
      if (baseDomainA !== baseDomainB) {
        return baseDomainA.localeCompare(baseDomainB);
      }
      
      // If base domains are the same, sort by full domain (subdomain)
      return domainA.localeCompare(domainB);
    });

    // Iterate over the sorted domain timers and create a table row for each one.
    for (const [domain, { originalTime, timeLeft, resetInterval, lastResetTimestamp }] of sortedDomains) {
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
      const timeOptions = [1, 5, 10, 30, 60];
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
      
      // Time tracking cells (Last 24h, Last 7d, Last 30d, All Time)
      const last24hCell = document.createElement('td');
      last24hCell.textContent = 'Loading...';
      last24hCell.className = 'time-tracking-cell';
      last24hCell.setAttribute('data-domain', domain);
      last24hCell.setAttribute('data-period', '24h');
      
      const last7dCell = document.createElement('td');
      last7dCell.textContent = 'Loading...';
      last7dCell.className = 'time-tracking-cell';
      last7dCell.setAttribute('data-domain', domain);
      last7dCell.setAttribute('data-period', '7d');
      
      const last30dCell = document.createElement('td');
      last30dCell.textContent = 'Loading...';
      last30dCell.className = 'time-tracking-cell';
      last30dCell.setAttribute('data-domain', domain);
      last30dCell.setAttribute('data-period', '30d');
      
      const allTimeCell = document.createElement('td');
      allTimeCell.textContent = 'Loading...';
      allTimeCell.className = 'time-tracking-cell';
      allTimeCell.setAttribute('data-domain', domain);
      allTimeCell.setAttribute('data-period', 'alltime');
      
      // Last Reset cell
      const lastResetCell = document.createElement('td');
      lastResetCell.textContent = new Date(lastResetTimestamp).toLocaleString();
      
      // Actions cell (delete and reset tracking buttons)
      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions-cell';
      actionsCell.innerHTML = `
        <div class="actions-buttons">
          <button class="delete-button" data-domain="${domain}">Delete</button>
          <button class="reset-tracking-button" data-domain="${domain}">Reset Tracking</button>
        </div>
      `;
      
      // Append all cells to row
      row.appendChild(domainCell);
      row.appendChild(timeAllowedCell);
      row.appendChild(timeLeftCell);
      row.appendChild(last24hCell);
      row.appendChild(last7dCell);
      row.appendChild(last30dCell);
      row.appendChild(allTimeCell);
      row.appendChild(lastResetCell);
      row.appendChild(actionsCell);
      
      // Restore save button state if it was previously enabled
      if (saveButtonStates[domain]) {
        saveButton.disabled = false;
      }
      
      // Add change event listeners to radio buttons
      timeRadioGroup.addEventListener('change', async () => {
        // Check if the selected value is different from the stored value
        const selectedRadio = timeRadioGroup.querySelector('input[type="radio"]:checked');
        if (selectedRadio) {
          const selectedMinutes = parseInt(selectedRadio.value, 10);
          const selectedSeconds = selectedMinutes * 60;
          
          // Get current stored value
          const domainTimers = await StorageUtils.getFromStorage('domainTimers') || {};
          const storedSeconds = domainTimers[domain]?.originalTime || 0;
          
          // Only enable save button if value actually changed
          saveButton.disabled = (selectedSeconds === storedSeconds);
        }
      });

      domainListBody.appendChild(row);
      
      // Populate time tracking data for this domain (async)
      updateTimeTrackingCells(domain);
    }
  } catch (error) {
  }
}

// Update time tracking cells for a specific domain
async function updateTimeTrackingCells(domain) {
  try {
    // Calculate time spent for each period
    const last24h = await calculateTimeSpentInOptions(domain, '24h');
    const last7d = await calculateTimeSpentInOptions(domain, '7d');
    const last30d = await calculateTimeSpentInOptions(domain, '30d');
    const allTime = await calculateTimeSpentInOptions(domain, 'alltime');
    
    // Update the corresponding cells
    const cells = document.querySelectorAll(`.time-tracking-cell[data-domain="${domain}"]`);
    cells.forEach(cell => {
      const period = cell.getAttribute('data-period');
      let timeSeconds = 0;
      
      switch (period) {
        case '24h':
          timeSeconds = last24h;
          break;
        case '7d':
          timeSeconds = last7d;
          break;
        case '30d':
          timeSeconds = last30d;
          break;
        case 'alltime':
          timeSeconds = allTime;
          break;
      }
      
      cell.textContent = formatTimeTracking(timeSeconds);
    });
  } catch (error) {
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
          let timeChanged = false;
          
          if (domainTimers[domainToSave]) {
            // Check if the time setting actually changed
            const oldOriginalTime = domainTimers[domainToSave].originalTime;
            const currentTimeLeft = domainTimers[domainToSave].timeLeft;
            timeChanged = oldOriginalTime !== originalTimeInSeconds;
            
            // Determine if we need to reset the timer
            // Reset if: 
            // 1. The originalTime setting changed (user selected different time)
            // 2. Current timeLeft is greater than the new originalTime (need to cap it)
            const needsReset = timeChanged || currentTimeLeft > originalTimeInSeconds;
            
            domainTimers[domainToSave].originalTime = originalTimeInSeconds;
            domainTimers[domainToSave].resetInterval = resetInterval;
            
            // Reset timer when needed
            if (needsReset) {
              domainTimers[domainToSave].timeLeft = originalTimeInSeconds;
              domainTimers[domainToSave].lastResetTimestamp = Date.now();
              domainTimers[domainToSave].expiredMessageLogged = false;
              // Update timeChanged to reflect that we did reset (for background notification)
              timeChanged = true;
            }
          }
          
          await StorageUtils.setToStorage({ domainTimers });
          
          // Notify background script to restart timer if settings changed
          if (timeChanged) {
            try {
              await chrome.runtime.sendMessage({ action: 'timerSettingsChanged' });
            } catch (error) {
              console.error('Error notifying background script:', error);
            }
          }
          
          // Disable the save button after successful save
          target.disabled = true;
          
          // Update only the time displays without re-rendering the whole list
          await updateTimeDisplays();
        } catch (error) {
          console.error('Error saving timer settings:', error);
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
    }
  }

  // Logic to handle the reset tracking button click.
  if (target.classList.contains('reset-tracking-button')) {
    const domainToReset = target.dataset.domain;

    try {
      // Get the current time tracking data from storage.
      const timeTracking = await StorageUtils.getFromStorage('timeTracking') || {};
      
      if (timeTracking[domainToReset]) {
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Clear domain's time tracking data while preserving timer settings
        timeTracking[domainToReset] = {
          dailyTotals: {},
          allTimeTotal: 0,
          trackingStartDate: currentDate,
          lastResetDate: currentDate,
          currentSessionStart: null,
          lastActiveTimestamp: Date.now()
        };

        // Save the updated time tracking back to storage.
        await StorageUtils.setToStorage({ timeTracking });
        
        // Update the time tracking display for this domain
        updateTimeTrackingCells(domainToReset);
        
      }
    } catch (error) {
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
  }

});

// Add an event listener to the "Reset All Tracking" button.
document.getElementById('resetAllTrackingButton').addEventListener('click', async (event) => {
  event.preventDefault();

  try {
    // Get the current time tracking data from storage.
    const timeTracking = await StorageUtils.getFromStorage('timeTracking') || {};
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Reset tracking data for all domains while preserving structure
    for (const [domain, data] of Object.entries(timeTracking)) {
      timeTracking[domain] = {
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: currentDate,
        lastResetDate: currentDate,
        currentSessionStart: null,
        lastActiveTimestamp: Date.now()
      };
    }

    // Save the reset tracking data back to storage.
    await StorageUtils.setToStorage({ timeTracking });
    
    // Re-render the domain list to show the updated tracking data.
    renderDomainList();
    
  } catch (error) {
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
  }
}

// Handle onboarding flow
function handleOnboarding() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOnboarding = urlParams.get('onboarding') === 'true';
  
  if (isOnboarding) {
    const onboardingDiv = document.getElementById('onboarding');
    onboardingDiv.style.display = 'block';
    
    // Scroll to top to ensure onboarding is visible
    window.scrollTo(0, 0);
    
    // Handle dismiss button
    document.getElementById('dismissOnboarding').addEventListener('click', () => {
      onboardingDiv.style.display = 'none';
      // Remove onboarding parameter from URL
      const url = new URL(window.location);
      url.searchParams.delete('onboarding');
      window.history.replaceState({}, document.title, url.pathname);
    });
  }
}

// Initialize when page loads
initializeGlobalResetInterval();
handleOnboarding();

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
        
        // Update last reset (8th column) - corrected column index
        const lastResetCell = row.cells[7];
        if (lastResetCell) {
          lastResetCell.textContent = new Date(lastResetTimestamp).toLocaleString();
        }
        
        // Update time tracking columns (4th-7th columns) to include current session time
        updateTimeTrackingCells(domain);
      }
    });
  } catch (error) {
  }
}

// Set an interval to update only time displays every second
setInterval(updateTimeDisplays, 1000);
