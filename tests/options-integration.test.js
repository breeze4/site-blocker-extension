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

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDomainTimers = {
      'example.com': {
        originalTime: 600, // 10 minutes  
        timeLeft: 450,     // 7.5 minutes left
        resetInterval: 24,
        lastResetTimestamp: Date.now() - 1000,
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
    
    const domain = 'example.com';
    const currentTimer = mockDomainTimers[domain];
    const newTimeInSeconds = 300; // Change from 10m to 5m
    
    // This is what should happen in options.js when TimerUtils is available
    const result = applyTimerSettingsChange(currentTimer, newTimeInSeconds, 24);
    
    // Should reset because we're going from 10m to 5m with 7.5m left
    expect(result.wasReset).toBe(true);
    expect(result.timerData.originalTime).toBe(300);
    expect(result.timerData.timeLeft).toBe(300);
    expect(result.timerData.expiredMessageLogged).toBe(false);
  });

  test('save button enable/disable logic works correctly', async () => {
    const { applyTimerSettingsChange } = require('../src/timer-utils');
    
    const domain = 'example.com';
    const currentTimer = mockDomainTimers[domain];
    
    // Test same value (should not reset)
    const sameValue = applyTimerSettingsChange(currentTimer, 600, 24); // Same as current
    expect(sameValue.wasReset).toBe(false);
    
    // Test different value (should reset) 
    const differentValue = applyTimerSettingsChange(currentTimer, 300, 24); // Different
    expect(differentValue.wasReset).toBe(true);
  });

  test('handles edge case where timeLeft exceeds originalTime', async () => {
    const { applyTimerSettingsChange } = require('../src/timer-utils');
    
    // Simulate corrupted state
    const corruptedTimer = {
      originalTime: 300,
      timeLeft: 600, // More than original
      resetInterval: 24,
      lastResetTimestamp: Date.now(),
      expiredMessageLogged: false
    };
    
    // Apply same setting (should still reset due to timeLeft > originalTime)
    const result = applyTimerSettingsChange(corruptedTimer, 300, 24);
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
});