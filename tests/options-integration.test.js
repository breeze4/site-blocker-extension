/**
 * Integration tests for options.js using the actual code
 * This tests the real save logic that runs in the browser
 */

// Mock StorageUtils for the options.js import
global.StorageUtils = {
  getFromStorage: jest.fn(),
  setToStorage: jest.fn()
};

// Mock chrome runtime for options.js
global.chrome.runtime.sendMessage = jest.fn(() => Promise.resolve());

// Import the actual options.js functions by requiring and executing the file
// We need to extract the save logic into a testable function
describe('Options.js Integration', () => {
  let mockDomainTimers;
  const exampleDomain = 'example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    mockDomainTimers = {
      [exampleDomain]: {
        originalTime: 600, // 10 minutes
        timeLeft: 450,     // 7.5 minutes left
        rechargeRate: 30,
        lastVisitTimestamp: Date.now() - 1000,
        expiredMessageLogged: false
      }
    };

    global.StorageUtils.getFromStorage.mockResolvedValue({ domainTimers: mockDomainTimers });
    global.StorageUtils.setToStorage.mockResolvedValue();
  });

  // Since options.js doesn't export functions, let's test the extracted timer utils
  // being used by the options code
  test('timer settings change uses correct logic in test environment', async () => {
    const { applyTimerSettingsChange } = require('../src/timer-utils');

    const currentTimer = mockDomainTimers[exampleDomain];
    const newTimeInSeconds = 300; // Change from 10m to 5m

    // This is what should happen in options.js when TimerUtils is available
    const result = applyTimerSettingsChange(currentTimer, newTimeInSeconds, 30);

    // Should reset because we're going from 10m to 5m with 7.5m left
    expect(result.wasReset).toBe(true);
    expect(result.timerData.originalTime).toBe(300);
    expect(result.timerData.timeLeft).toBe(300);
    expect(result.timerData.expiredMessageLogged).toBe(false);
  });

  test('save button enable/disable logic works correctly', async () => {
    const { applyTimerSettingsChange } = require('../src/timer-utils');

    const currentTimer = mockDomainTimers[exampleDomain];

    // Test same value (should not reset)
    const sameValue = applyTimerSettingsChange(currentTimer, 600, 30); // Same as current
    expect(sameValue.wasReset).toBe(false);

    // Test different value (should reset)
    const differentValue = applyTimerSettingsChange(currentTimer, 300, 30); // Different
    expect(differentValue.wasReset).toBe(true);
  });

  test('handles edge case where timeLeft exceeds originalTime', async () => {
    const { applyTimerSettingsChange } = require('../src/timer-utils');

    // Simulate corrupted state
    const corruptedTimer = {
      originalTime: 300,
      timeLeft: 600, // More than original
      rechargeRate: 30,
      lastVisitTimestamp: Date.now(),
      expiredMessageLogged: false
    };

    // Apply same setting (should still reset due to timeLeft > originalTime)
    const result = applyTimerSettingsChange(corruptedTimer, 300, 30);
    expect(result.wasReset).toBe(true);
    expect(result.timerData.timeLeft).toBe(300);
  });

  describe('URL and Domain Processing', () => {
    const { parseURL, validateDomain } = require('../src/timer-utils');

    test('complete URL processing flow', () => {
      const testCases = [
        { input: 'example.com', expectDomain: 'example.com', expectValid: true },
        { input: 'https://www.example.com/path', expectDomain: 'www.example.com', expectValid: true },
        { input: 'blog.example.com', expectDomain: 'blog.example.com', expectValid: true },
        { input: '192.168.1.1', expectDomain: '192.168.1.1', expectValid: false },
        { input: 'localhost', expectDomain: 'localhost', expectValid: false },
        { input: '', expectDomain: null, expectValid: false }
      ];

      testCases.forEach(testCase => {
        const parseResult = parseURL(testCase.input);

        if (testCase.expectDomain === null) {
          expect(parseResult.success).toBe(false);
        } else {
          expect(parseResult.success).toBe(true);
          expect(parseResult.domain).toBe(testCase.expectDomain);

          const validationResult = validateDomain(parseResult.domain);
          expect(validationResult.valid).toBe(testCase.expectValid);
        }
      });
    });
  });

  describe('Time Formatting Functions', () => {
    const { formatTime, formatTimeTracking } = require('../src/timer-utils');

    test('formatTime matches expected output for UI', () => {
      // Test values that would appear in the timer display
      expect(formatTime(300)).toBe('5 min 0 sec');
      expect(formatTime(305)).toBe('5 min 5 sec');
      expect(formatTime(65)).toBe('1 min 5 sec');
      expect(formatTime(0)).toBe('0 min 0 sec');
    });

    test('formatTimeTracking matches expected output for stats', () => {
      // Test values for time tracking display
      expect(formatTimeTracking(3665)).toBe('1h 1m'); // 1 hour 1 minute 5 seconds
      expect(formatTimeTracking(300)).toBe('5m');
      expect(formatTimeTracking(45)).toBe('45s');
    });
  });

  describe('options page rendering', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.useFakeTimers();

      document.body.innerHTML = `
        <div id="onboarding" style="display: none;">
          <button id="dismissOnboarding">Dismiss</button>
        </div>
        <div id="globalRechargeRateGroup">
          <input type="radio" id="globalRecharge30" name="globalRechargeRate" value="30" checked>
          <input type="radio" id="globalRecharge60" name="globalRechargeRate" value="60">
          <input type="radio" id="globalRecharge900" name="globalRechargeRate" value="900">
        </div>
        <form id="siteForm">
          <input id="urlInput">
          <div id="urlPreview"></div>
          <input type="radio" id="time5" name="timeAllowed" value="5" checked>
        </form>
        <table>
          <tbody id="domainListBody"></tbody>
        </table>
        <button id="resetTimersButton"></button>
        <button id="resetAllTrackingButton"></button>
      `;
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.resetModules();
    });

    test('renders stored domain action buttons without interpreting the domain as markup', async () => {
      const storedDomain = 'example.com" autofocus onfocus="window.__xss = true';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const deleteButton = document.querySelector('.delete-button');
      const resetTrackingButton = document.querySelector('.reset-tracking-button');

      expect(deleteButton).not.toBeNull();
      expect(resetTrackingButton).not.toBeNull();
      expect(deleteButton.dataset.domain).toBe(storedDomain);
      expect(resetTrackingButton.dataset.domain).toBe(storedDomain);
      expect(deleteButton.getAttribute('onfocus')).toBeNull();
      expect(resetTrackingButton.getAttribute('onfocus')).toBeNull();
      expect(document.querySelector('[autofocus]')).toBeNull();
    });

    test('delete repairs malformed top-level timer storage at click time', async () => {
      const storedDomain = 'example.com';
      let domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      domainTimers = 'corrupt';
      global.StorageUtils.setToStorage.mockClear();
      document.querySelector('.delete-button').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const deleteWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(deleteWrite).toBeDefined();
      expect(deleteWrite[0].domainTimers).toEqual({});
    });

    test('updates time tracking cells for stored domains that contain selector metacharacters', async () => {
      const storedDomain = 'example.com" [data-period="alltime';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const timeTrackingCells = Array.from(document.querySelectorAll('.time-tracking-cell'));

      expect(timeTrackingCells).toHaveLength(4);
      expect(timeTrackingCells.map((cell) => cell.textContent)).toEqual(['0s', '0s', '0s', '0s']);
    });

    test('renders valid timer rows when another stored timer record is malformed', async () => {
      const domainTimers = {
        'broken.example.com': null,
        'example.com': {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const rows = Array.from(document.querySelectorAll('#domainListBody tr'));

      expect(rows).toHaveLength(1);
      expect(rows[0].cells[0].textContent).toBe('example.com');
      expect(rows[0].cells[2].textContent).toBe('2 min 0 sec');
    });

    test('includes the active session in the all time usage cell', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {},
          allTimeTotal: 60,
          trackingStartDate: '2026-06-05',
          lastResetDate: '2026-06-05',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const allTimeCell = document.querySelector('.time-tracking-cell[data-period="alltime"]');

      expect(allTimeCell).not.toBeNull();
      expect(allTimeCell.textContent).toBe('1m 5s');
    });

    test('rolling usage cells keep active session time when stored daily totals are non-finite', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {
            '2026-06-05': Infinity
          },
          allTimeTotal: 0,
          trackingStartDate: '2026-06-05',
          lastResetDate: '2026-06-05',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const last24hCell = document.querySelector('.time-tracking-cell[data-period="24h"]');

      expect(last24hCell).not.toBeNull();
      expect(last24hCell.textContent).toBe('5s');
    });

    test('usage cells keep active session time when stored tracking totals are negative', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {
            '2026-06-05': -10
          },
          allTimeTotal: -10,
          trackingStartDate: '2026-06-05',
          lastResetDate: '2026-06-05',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const last24hCell = document.querySelector('.time-tracking-cell[data-period="24h"]');
      const allTimeCell = document.querySelector('.time-tracking-cell[data-period="alltime"]');

      expect(last24hCell).not.toBeNull();
      expect(allTimeCell).not.toBeNull();
      expect(last24hCell.textContent).toBe('5s');
      expect(allTimeCell.textContent).toBe('5s');
    });

    test('does not subtract usage when an active session timestamp is in the future', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {},
          allTimeTotal: 60,
          trackingStartDate: '2026-06-05',
          lastResetDate: '2026-06-05',
          currentSessionStart: Date.now() + 5000,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const allTimeCell = document.querySelector('.time-tracking-cell[data-period="alltime"]');

      expect(allTimeCell).not.toBeNull();
      expect(allTimeCell.textContent).toBe('1m');
    });

    test('reset all timers clears expired message state for reset timers', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 0,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now() - 1000,
          expiredMessageLogged: true
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      document.getElementById('resetTimersButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].domainTimers[storedDomain]).toMatchObject({
        timeLeft: 300,
        expiredMessageLogged: false
      });
    });

    test('reset all timers skips malformed timer records instead of aborting the reset', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 0,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now() - 5000,
          expiredMessageLogged: true
        },
        'broken.example.com': null
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('resetTimersButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].domainTimers['example.com']).toMatchObject({
        originalTime: 300,
        timeLeft: 300,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: false
      });
      expect(resetWrite[0].domainTimers['broken.example.com']).toBeNull();
    });

    test('reset all timers repairs malformed top-level timer storage', async () => {
      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve('corrupt');
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('resetTimersButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].domainTimers).toEqual({});
    });

    test('individual tracking reset preserves the original tracking start date', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {
            '2026-06-04': 120
          },
          allTimeTotal: 120,
          trackingStartDate: '2026-01-15',
          lastResetDate: '2026-01-15',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      document.querySelector('.reset-tracking-button').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.timeTracking
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].timeTracking[storedDomain]).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-01-15',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
    });

    test('individual tracking reset repairs malformed top-level tracking storage', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve('corrupt');
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.querySelector('.reset-tracking-button').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.timeTracking
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].timeTracking[storedDomain]).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-06-05',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
    });

    test('global tracking reset preserves each domain tracking start date', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        },
        'another.example.com': {
          originalTime: 600,
          timeLeft: 240,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        'example.com': {
          dailyTotals: {
            '2026-06-04': 120
          },
          allTimeTotal: 120,
          trackingStartDate: '2026-01-15',
          lastResetDate: '2026-01-15',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        },
        'another.example.com': {
          dailyTotals: {
            '2026-06-03': 240
          },
          allTimeTotal: 240,
          trackingStartDate: '2026-02-20',
          lastResetDate: '2026-02-20',
          currentSessionStart: null,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      document.getElementById('resetAllTrackingButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.timeTracking
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].timeTracking['example.com']).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-01-15',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
      expect(resetWrite[0].timeTracking['another.example.com']).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-02-20',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
    });

    test('global tracking reset repairs malformed domain tracking records', async () => {
      jest.setSystemTime(new Date('2026-06-05T12:00:05.000Z'));

      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        },
        'broken.example.com': {
          originalTime: 600,
          timeLeft: 240,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        'example.com': {
          dailyTotals: {
            '2026-06-04': 120
          },
          allTimeTotal: 120,
          trackingStartDate: '2026-01-15',
          lastResetDate: '2026-01-15',
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now()
        },
        'broken.example.com': null
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('resetAllTrackingButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.timeTracking
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].timeTracking['example.com']).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-01-15',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
      expect(resetWrite[0].timeTracking['broken.example.com']).toMatchObject({
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: '2026-06-05',
        lastResetDate: '2026-06-05',
        currentSessionStart: null
      });
    });

    test('global tracking reset repairs malformed top-level tracking storage', async () => {
      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve({});
        }
        if (key === 'timeTracking') {
          return Promise.resolve('corrupt');
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('resetAllTrackingButton').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const resetWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.timeTracking
      );

      expect(resetWrite).toBeDefined();
      expect(resetWrite[0].timeTracking).toEqual({});
    });

    test('renders non-finite time left values as zero time', async () => {
      // applyRecharge normalises non-finite timeLeft to 0 before display,
      // so the cell shows "0 min 0 sec" rather than "Invalid time".
      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: Infinity,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const timeLeftCell = document.querySelector('#domainListBody tr').cells[2];

      expect(timeLeftCell.textContent).toBe('0 min 0 sec');
    });

    test('renders non-finite time tracking totals as zero seconds', async () => {
      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };
      const timeTracking = {
        [storedDomain]: {
          dailyTotals: {},
          allTimeTotal: Infinity,
          trackingStartDate: '2026-06-05',
          lastResetDate: '2026-06-05',
          currentSessionStart: null,
          lastActiveTimestamp: Date.now()
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve(timeTracking);
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const allTimeCell = document.querySelector('.time-tracking-cell[data-period="alltime"]');

      expect(allTimeCell.textContent).toBe('0s');
    });

    test('does not write malformed global recharge rates into stored timers', async () => {
      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('globalRecharge30').value = 'not-a-number';
      document
        .getElementById('globalRechargeRateGroup')
        .dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(global.StorageUtils.setToStorage).not.toHaveBeenCalled();
      expect(domainTimers[storedDomain].rechargeRate).toBe(30);
    });

    test('global recharge rate skips malformed timer records instead of aborting the update', async () => {
      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        },
        'broken.example.com': null
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('globalRecharge60').checked = true;
      document
        .getElementById('globalRechargeRateGroup')
        .dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const intervalWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(intervalWrite).toBeDefined();
      expect(intervalWrite[0].domainTimers['example.com']).toMatchObject({
        originalTime: 300,
        timeLeft: 120,
        rechargeRate: 60,
        expiredMessageLogged: false
      });
      expect(intervalWrite[0].domainTimers['broken.example.com']).toBeNull();
    });

    test('global recharge rate repairs malformed top-level timer storage', async () => {
      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve('corrupt');
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('globalRecharge60').checked = true;
      document
        .getElementById('globalRechargeRateGroup')
        .dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const intervalWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(intervalWrite).toBeDefined();
      expect(intervalWrite[0].domainTimers).toEqual({});
    });

    test('does not add a timer when selected time allowance is partially numeric', async () => {
      const domainTimers = {};

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('urlInput').value = 'example.com';
      document.getElementById('time5').value = '5abc';
      document
        .getElementById('siteForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(global.StorageUtils.setToStorage).not.toHaveBeenCalled();
      expect(domainTimers).toEqual({});
    });

    test('adds a timer when top-level domain timer storage is malformed', async () => {
      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve('corrupt');
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      global.StorageUtils.setToStorage.mockClear();
      document.getElementById('urlInput').value = 'example.com';
      document
        .getElementById('siteForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const addWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(addWrite).toBeDefined();
      expect(addWrite[0].domainTimers).toEqual({
        'example.com': {
          originalTime: 300,
          timeLeft: 300,
          rechargeRate: 30,
          lastVisitTimestamp: expect.any(Number),
          expiredMessageLogged: false
        }
      });
    });

    test('does not save inline timer settings when selected time allowance is partially numeric', async () => {
      const storedDomain = 'example.com';
      const domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const selectedTimeRadio = document.querySelector(
        '[data-field="originalTime"] input[type="radio"]:checked'
      );
      selectedTimeRadio.value = '10abc';

      global.StorageUtils.setToStorage.mockClear();
      document.querySelector('.save-button-inline').click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(global.StorageUtils.setToStorage).not.toHaveBeenCalled();
      expect(domainTimers[storedDomain]).toMatchObject({
        originalTime: 300,
        timeLeft: 120,
        rechargeRate: 30
      });
    });

    test('inline save repairs malformed top-level timer storage at click time', async () => {
      const storedDomain = 'example.com';
      let domainTimers = {
        [storedDomain]: {
          originalTime: 300,
          timeLeft: 120,
          rechargeRate: 30,
          lastVisitTimestamp: Date.now(),
          expiredMessageLogged: false
        }
      };

      global.StorageUtils.getFromStorage = jest.fn((key) => {
        if (key === 'domainTimers') {
          return Promise.resolve(domainTimers);
        }
        if (key === 'timeTracking') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });
      global.StorageUtils.setToStorage = jest.fn(() => Promise.resolve());

      require('../src/options.js');
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const saveButton = document.querySelector('.save-button-inline');
      saveButton.disabled = false;

      domainTimers = 'corrupt';
      global.StorageUtils.setToStorage.mockClear();
      saveButton.click();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      const saveWrite = global.StorageUtils.setToStorage.mock.calls.find(
        ([value]) => value.domainTimers
      );

      expect(saveWrite).toBeDefined();
      expect(saveWrite[0].domainTimers).toEqual({});
    });
  });
});
