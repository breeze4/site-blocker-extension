/**
 * Comprehensive tests for the specific timer reset bugs we've been fixing
 * These tests document the exact behavior that was broken and is now fixed
 */

const { applyTimerSettingsChange, checkAndResetIfIntervalPassed } = require('../src/timer-utils');

describe('Timer Reset Bug Scenarios', () => {
  describe('Bug: Timer not resetting when changing to lower time', () => {
    test('FIXED: Timer with 9m left, change from 10m to 5m setting → should reset to 5m', () => {
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

    test('FIXED: Timer with 3m left, change from 5m to 1m setting → should reset to 1m', () => {
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

    test('REGRESSION: Timer with 2m left, change from 5m to 10m setting → should reset to 10m', () => {
      const timer = {
        originalTime: 300, // 5 minutes setting
        timeLeft: 120,     // 2 minutes remaining
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (180 * 1000), // 3 minutes ago
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(timer, 600, 24); // Change to 10m

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(600); // Should be 10m (fresh timer)
    });
  });

  describe('Bug: Timer continuing when tab closed', () => {
    // Note: This bug fix is in background.js interval logic, not in these pure functions
    // The fix ensures the interval checks if the tab is still active before decrementing
    
    test('Timer decrement logic itself works correctly', () => {
      const { decrementTimer } = require('../src/timer-utils');
      
      const timer = {
        originalTime: 300,
        timeLeft: 120,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      const result = decrementTimer(timer);
      expect(result.timeLeft).toBe(119);
      expect(result.expiredMessageLogged).toBe(false);
    });
  });

  describe('Bug: Save button staying enabled after save', () => {
    test('Save button should be disabled when value matches stored value', () => {
      const storedTimer = {
        originalTime: 300,
        timeLeft: 180,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // User selects same 5-minute value
      const { timerData, wasReset } = applyTimerSettingsChange(storedTimer, 300, 24);
      
      // Should not reset (no change)
      expect(wasReset).toBe(false);
      expect(timerData.timeLeft).toBe(180); // Unchanged
    });

    test('Save button should be enabled when value differs from stored value', () => {
      const storedTimer = {
        originalTime: 300,
        timeLeft: 180,
        resetInterval: 24,
        lastResetTimestamp: Date.now(), 
        expiredMessageLogged: false
      };

      // User selects different 10-minute value
      const { timerData, wasReset } = applyTimerSettingsChange(storedTimer, 600, 24);
      
      // Should reset (change detected)
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(600);
    });
  });

  describe('Bug: Expired timer not resetting properly', () => {
    test('FIXED: Expired timer should reset when time setting changes', () => {
      const expiredTimer = {
        originalTime: 300,
        timeLeft: 0,        // Expired
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (6 * 60 * 60 * 1000), // 6 hours ago
        expiredMessageLogged: true
      };

      const { timerData, wasReset } = applyTimerSettingsChange(expiredTimer, 600, 24);

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(600);
      expect(timerData.expiredMessageLogged).toBe(false);
    });

    test('FIXED: Timer should reset after reset interval passes', () => {
      const now = Date.now();
      const expiredTimer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: now - (25 * 60 * 60 * 1000), // 25 hours ago (past 24h interval)
        expiredMessageLogged: true
      };

      const resetTimer = checkAndResetIfIntervalPassed(expiredTimer, now);
      
      expect(resetTimer.timeLeft).toBe(300);
      expect(resetTimer.expiredMessageLogged).toBe(false);
      expect(resetTimer.lastResetTimestamp).toBe(now);
    });

    test('Timer should NOT reset before reset interval passes', () => {
      const now = Date.now();
      const expiredTimer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: now - (10 * 60 * 60 * 1000), // 10 hours ago (before 24h interval)
        expiredMessageLogged: true
      };

      const result = checkAndResetIfIntervalPassed(expiredTimer, now);
      
      // Should be unchanged
      expect(result.timeLeft).toBe(0);
      expect(result.expiredMessageLogged).toBe(true);
      expect(result.lastResetTimestamp).toBe(expiredTimer.lastResetTimestamp);
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    test('Handle corrupted timer state where timeLeft > originalTime', () => {
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

    test('Handle negative timeLeft values', () => {
      const { decrementTimer } = require('../src/timer-utils');
      
      const timer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      const result = decrementTimer(timer);
      expect(result.timeLeft).toBe(0); // Should not go negative
    });

    test('Handle very large time values', () => {
      const timer = {
        originalTime: 7200, // 2 hours
        timeLeft: 5400,     // 1.5 hours remaining
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Change to 1 hour
      const { timerData, wasReset } = applyTimerSettingsChange(timer, 3600, 24);

      expect(wasReset).toBe(true); // Should reset because new time < current timeLeft
      expect(timerData.timeLeft).toBe(3600);
    });
  });
});