/**
 * Unit tests for timer logic
 * Tests the actual timer utility functions
 */

const {
  shouldResetTimer,
  applyTimerSettingsChange,
  checkAndResetIfIntervalPassed,
  decrementTimer,
  parseURL,
  validateDomain,
  formatTime,
  formatTimeTracking
} = require('../src/timer-utils');

describe('Timer Logic', () => {
  describe('shouldResetTimer', () => {
    test('should return true when time setting changes', () => {
      const result = shouldResetTimer(300, 600, 300); // 5m -> 10m
      expect(result).toBe(true);
    });

    test('should return true when current time exceeds new limit', () => {
      const result = shouldResetTimer(600, 300, 450); // 10m -> 5m with 7.5m left
      expect(result).toBe(true);
    });

    test('should return false when nothing changes', () => {
      const result = shouldResetTimer(300, 300, 250); // Same time, less remaining
      expect(result).toBe(false);
    });

    test('should return true when timeLeft exceeds new originalTime', () => {
      const result = shouldResetTimer(300, 300, 400); // Edge case: timeLeft > originalTime
      expect(result).toBe(true);
    });
  });

  describe('applyTimerSettingsChange', () => {
    let mockTimer;

    beforeEach(() => {
      mockTimer = {
        originalTime: 600, // 10 minutes
        timeLeft: 450, // 7.5 minutes left
        resetInterval: 24,
        lastResetTimestamp: Date.now() - 1000,
        expiredMessageLogged: false
      };
    });

    test('should reset timer when changing to lower time', () => {
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 300, 24);
      
      expect(wasReset).toBe(true);
      expect(timerData.originalTime).toBe(300);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.expiredMessageLogged).toBe(false);
      expect(timerData.lastResetTimestamp).toBeGreaterThan(mockTimer.lastResetTimestamp);
    });

    // Bug fix: Timer with 9m left, change from 10m to 5m setting → should reset to 5m
    test('should reset timer with 9m left when changing from 10m to 5m setting', () => {
      const timer = {
        originalTime: 600, // 10 minutes setting
        timeLeft: 540,     // 9 minutes remaining  
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (60 * 1000), // 1 minute ago
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(timer, 300, 24); // Change to 5m

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300); // Should be 5m, not 9m
      expect(timerData.originalTime).toBe(300);
    });

    // Bug fix: Timer with 3m left, change from 5m to 1m setting → should reset to 1m
    test('should reset timer with 3m left when changing from 5m to 1m setting', () => {
      const timer = {
        originalTime: 300, // 5 minutes setting
        timeLeft: 180,     // 3 minutes remaining
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (120 * 1000), // 2 minutes ago  
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(timer, 60, 24); // Change to 1m

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(60); // Should be 1m, not 3m
    });

    test('should reset timer when changing to higher time', () => {
      mockTimer.originalTime = 300;
      mockTimer.timeLeft = 300;
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 600, 24);
      
      expect(wasReset).toBe(true);
      expect(timerData.originalTime).toBe(600);
      expect(timerData.timeLeft).toBe(600);
    });

    test('should not reset when time unchanged and timeLeft valid', () => {
      mockTimer.timeLeft = 300; // Valid time left
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 600, 24);
      
      expect(wasReset).toBe(false);
      expect(timerData.originalTime).toBe(600);
      expect(timerData.timeLeft).toBe(300); // Unchanged
      expect(timerData.lastResetTimestamp).toBe(mockTimer.lastResetTimestamp);
    });

    test('should reset expired timer', () => {
      mockTimer.timeLeft = 0;
      mockTimer.expiredMessageLogged = true;
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 300, 24);
      
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.expiredMessageLogged).toBe(false);
    });

    // Edge case: Handle corrupted timer state where timeLeft > originalTime
    test('should handle corrupted state where timeLeft exceeds originalTime', () => {
      const corruptedTimer = {
        originalTime: 300, // 5 minutes
        timeLeft: 600,     // 10 minutes (impossible state)
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Even with "no change" to originalTime, should reset due to invalid timeLeft
      const { timerData, wasReset } = applyTimerSettingsChange(corruptedTimer, 300, 24);

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300); // Fixed to match originalTime
    });
  });

  describe('checkAndResetIfIntervalPassed', () => {
    let mockTimer;
    const now = Date.now();

    beforeEach(() => {
      mockTimer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24, // 24 hours
        lastResetTimestamp: now - (25 * 60 * 60 * 1000), // 25 hours ago
        expiredMessageLogged: true
      };
    });

    // Bug fix: Timer should reset after reset interval passes
    test('should reset timer after interval passed', () => {
      const result = checkAndResetIfIntervalPassed(mockTimer, now);
      
      expect(result.timeLeft).toBe(300);
      expect(result.lastResetTimestamp).toBe(now);
      expect(result.expiredMessageLogged).toBe(false);
    });

    test('should not reset timer before interval passed', () => {
      mockTimer.lastResetTimestamp = now - (10 * 60 * 60 * 1000); // 10 hours ago
      
      const result = checkAndResetIfIntervalPassed(mockTimer, now);
      
      expect(result.timeLeft).toBe(0);
      expect(result.lastResetTimestamp).toBe(mockTimer.lastResetTimestamp);
      expect(result.expiredMessageLogged).toBe(true);
    });

    test('should handle exact reset time', () => {
      const exactResetTime = now;
      mockTimer.lastResetTimestamp = exactResetTime - (24 * 60 * 60 * 1000);
      
      const result = checkAndResetIfIntervalPassed(mockTimer, exactResetTime);
      
      expect(result.timeLeft).toBe(300);
    });
  });

  describe('decrementTimer', () => {
    let mockTimer;

    beforeEach(() => {
      mockTimer = {
        originalTime: 300,
        timeLeft: 100,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };
    });

    test('should decrement timer by 1 second', () => {
      const result = decrementTimer(mockTimer);
      expect(result.timeLeft).toBe(99);
      expect(result.expiredMessageLogged).toBe(false);
    });

    test('should not go below 0', () => {
      mockTimer.timeLeft = 0;
      const result = decrementTimer(mockTimer);
      expect(result.timeLeft).toBe(0);
    });

    test('should set expiredMessageLogged when reaching 0', () => {
      mockTimer.timeLeft = 1;
      const result = decrementTimer(mockTimer);
      expect(result.timeLeft).toBe(0);
      expect(result.expiredMessageLogged).toBe(true);
    });

    test('should not re-set expiredMessageLogged if already true', () => {
      mockTimer.timeLeft = 0;
      mockTimer.expiredMessageLogged = true;
      const result = decrementTimer(mockTimer);
      expect(result.expiredMessageLogged).toBe(true);
    });

    // Edge case: Handle negative timeLeft values
    test('should handle negative timeLeft values', () => {
      mockTimer.timeLeft = -5;
      const result = decrementTimer(mockTimer);
      expect(result.timeLeft).toBe(0); // Should clamp to 0
    });
  });

  describe('URL Parsing', () => {
    test('should parse simple domain', () => {
      const result = parseURL('example.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    test('should parse URL with protocol', () => {
      const result = parseURL('https://example.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    test('should preserve subdomains', () => {
      const result = parseURL('www.example.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('www.example.com');
    });

    test('should handle paths and query params', () => {
      const result = parseURL('example.com/path?query=value');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    test('should fail on empty input', () => {
      const result = parseURL('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('enter a URL');
    });

    test('should fail on invalid URL', () => {
      const result = parseURL('not a valid url');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });
  });

  describe('Domain Validation', () => {
    test('should accept valid domains', () => {
      expect(validateDomain('example.com').valid).toBe(true);
      expect(validateDomain('sub.example.com').valid).toBe(true);
      expect(validateDomain('my-site.com').valid).toBe(true);
      expect(validateDomain('site123.com').valid).toBe(true);
    });

    test('should reject IP addresses', () => {
      const result = validateDomain('192.168.1.1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('IP addresses');
    });

    test('should reject localhost', () => {
      const result = validateDomain('localhost');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Local domains');
    });

    test('should reject .local domains', () => {
      const result = validateDomain('mycomputer.local');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Local domains');
    });

    test('should reject invalid characters', () => {
      const result = validateDomain('exam ple.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid domain format');
    });
  });

  describe('Time Formatting', () => {
    describe('formatTime', () => {
      test('should format minutes and seconds correctly', () => {
        expect(formatTime(305)).toBe('5 min 5 sec');
        expect(formatTime(60)).toBe('1 min 0 sec');
        expect(formatTime(59)).toBe('0 min 59 sec');
        expect(formatTime(0)).toBe('0 min 0 sec');
      });

      test('should handle invalid input', () => {
        expect(formatTime(-1)).toBe('Invalid time');
        expect(formatTime(NaN)).toBe('Invalid time');
      });
    });

    describe('formatTimeTracking', () => {
      test('should format hours, minutes, seconds correctly', () => {
        expect(formatTimeTracking(3665)).toBe('1h 1m');
        expect(formatTimeTracking(3600)).toBe('1h');
        expect(formatTimeTracking(125)).toBe('2m 5s');
        expect(formatTimeTracking(60)).toBe('1m');
        expect(formatTimeTracking(45)).toBe('45s');
        expect(formatTimeTracking(0)).toBe('0s');
      });

      test('should handle large values', () => {
        expect(formatTimeTracking(7265)).toBe('2h 1m');
        expect(formatTimeTracking(86400)).toBe('24h');
      });

      test('should handle invalid input', () => {
        expect(formatTimeTracking(-1)).toBe('0s');
        expect(formatTimeTracking(NaN)).toBe('0s');
      });
    });
  });
});