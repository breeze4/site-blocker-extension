/**
 * Integration tests for background.js using the actual timer functions
 */

// Mock the global TimerUtils as it would be available in background.js
const TimerUtils = require('../src/timer-utils');
global.TimerUtils = TimerUtils;

// Mock chrome APIs for background script
global.chrome = {
  ...global.chrome,
  tabs: {
    ...global.chrome.tabs,
    query: jest.fn(),
    update: jest.fn()
  }
};

// Mock the background script functions by requiring the utils and testing them
describe('Background.js Integration', () => {
  describe('resetTimersIfNeeded function logic', () => {
    test('should use TimerUtils.checkAndResetIfIntervalPassed when available', () => {
      const now = Date.now();
      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 0,
          resetInterval: 24,
          lastResetTimestamp: now - (25 * 60 * 60 * 1000), // 25 hours ago
          expiredMessageLogged: true
        }
      };

      // Test the actual TimerUtils function that background.js would call
      const result = TimerUtils.checkAndResetIfIntervalPassed(domainTimers['example.com'], now);
      
      expect(result.timeLeft).toBe(300); // Should be reset
      expect(result.expiredMessageLogged).toBe(false);
      expect(result.lastResetTimestamp).toBe(now);
    });

    test('should not reset timer before interval passes', () => {
      const now = Date.now();
      const domainTimers = {
        'example.com': {
          originalTime: 300,
          timeLeft: 0,
          resetInterval: 24,
          lastResetTimestamp: now - (10 * 60 * 60 * 1000), // 10 hours ago
          expiredMessageLogged: true
        }
      };

      const result = TimerUtils.checkAndResetIfIntervalPassed(domainTimers['example.com'], now);
      
      expect(result.timeLeft).toBe(0); // Should NOT be reset
      expect(result.expiredMessageLogged).toBe(true);
    });
  });

  describe('Timer decrement logic', () => {
    test('should use TimerUtils.decrementTimer for countdown', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 120,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Test the actual function that background.js interval would call
      const result = TimerUtils.decrementTimer(timer);
      
      expect(result.timeLeft).toBe(119);
      expect(result.expiredMessageLogged).toBe(false);
    });

    test('should handle timer expiry correctly', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 1, // About to expire
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      const result = TimerUtils.decrementTimer(timer);
      
      expect(result.timeLeft).toBe(0);
      expect(result.expiredMessageLogged).toBe(true); // Should be set
    });

    test('should not go below 0 and not re-set expiredMessageLogged', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: true
      };

      const result = TimerUtils.decrementTimer(timer);
      
      expect(result.timeLeft).toBe(0); // Should stay at 0
      expect(result.expiredMessageLogged).toBe(true); // Should stay true
    });
  });

  describe('Background timer workflow simulation', () => {
    test('complete timer lifecycle: start → countdown → expire → reset', () => {
      const now = Date.now();
      
      // 1. Fresh timer
      let timer = {
        originalTime: 60, // 1 minute for quick test
        timeLeft: 60,
        resetInterval: 24,
        lastResetTimestamp: now,
        expiredMessageLogged: false
      };

      // 2. Simulate 59 seconds of countdown
      for (let i = 0; i < 59; i++) {
        timer = TimerUtils.decrementTimer(timer);
        expect(timer.timeLeft).toBe(60 - (i + 1));
        expect(timer.expiredMessageLogged).toBe(false);
      }

      // 3. Final second - should expire
      timer = TimerUtils.decrementTimer(timer);
      expect(timer.timeLeft).toBe(0);
      expect(timer.expiredMessageLogged).toBe(true);

      // 4. Simulate 25 hours passing, then reset check
      const resetTime = now + (25 * 60 * 60 * 1000);
      timer = TimerUtils.checkAndResetIfIntervalPassed(timer, resetTime);
      expect(timer.timeLeft).toBe(60); // Reset to original
      expect(timer.expiredMessageLogged).toBe(false);
    });

    test('timer settings change during active countdown', () => {
      // Timer is counting down
      let timer = {
        originalTime: 300, // 5 minutes
        timeLeft: 180,     // 3 minutes left  
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (120 * 1000), // Started 2 minutes ago
        expiredMessageLogged: false
      };

      // User changes setting to 1 minute (less than current timeLeft)
      const settingsChange = TimerUtils.applyTimerSettingsChange(timer, 60, 24);
      
      expect(settingsChange.wasReset).toBe(true);
      expect(settingsChange.timerData.timeLeft).toBe(60); // Should reset to 1 minute, not keep 3
      expect(settingsChange.timerData.originalTime).toBe(60);

      // Continue with new timer
      timer = settingsChange.timerData;

      // Simulate countdown from new 1-minute limit
      timer = TimerUtils.decrementTimer(timer);
      expect(timer.timeLeft).toBe(59);
    });
  });

  describe('Edge cases that background.js needs to handle', () => {
    test('corrupted timer state recovery', () => {
      const corruptedTimer = {
        originalTime: 300,
        timeLeft: 1000, // Impossible: more time left than original
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Background script resetTimersIfNeeded would call this periodically
      const resetCheck = TimerUtils.checkAndResetIfIntervalPassed(corruptedTimer);
      
      // Since reset interval hasn't passed, timer state remains corrupted
      expect(resetCheck.timeLeft).toBe(1000);

      // But if options page saves same setting, it would fix it
      const fixed = TimerUtils.applyTimerSettingsChange(corruptedTimer, 300, 24);
      expect(fixed.wasReset).toBe(true);
      expect(fixed.timerData.timeLeft).toBe(300); // Fixed
    });

    test('timer with negative values', () => {
      // Simulate somehow getting negative timeLeft (shouldn't happen but test it)
      const timer = {
        originalTime: 300,
        timeLeft: -10, // Corrupted negative value
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // decrementTimer should handle this gracefully
      const result = TimerUtils.decrementTimer(timer);
      expect(result.timeLeft).toBe(0); // Should cap at 0, not -11
    });
  });
});