/**
 * Integration tests simulating real usage scenarios
 */

const { applyTimerSettingsChange } = require('../src/timer-utils');

describe('Integration Tests', () => {
  describe('Real Timer Scenarios', () => {
    test('user changes from 10m to 5m with 7.5m remaining', () => {
      // Initial state: user set 10m timer, has been browsing for 2.5m
      const initialTimer = {
        originalTime: 600, // 10 minutes
        timeLeft: 450,     // 7.5 minutes left
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (150 * 1000), // 2.5 minutes ago
        expiredMessageLogged: false
      };

      // User changes setting to 5 minutes in options page
      const { timerData, wasReset } = applyTimerSettingsChange(initialTimer, 300, 24);

      // Should reset to fresh 5 minutes
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.originalTime).toBe(300);
    });

    test('user increases limit from 5m to 10m with 2m remaining', () => {
      // Initial state: user set 5m timer, has 2m left
      const initialTimer = {
        originalTime: 300, // 5 minutes
        timeLeft: 120,     // 2 minutes left
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (180 * 1000), // 3 minutes ago
        expiredMessageLogged: false
      };

      // User increases to 10 minutes
      const { timerData, wasReset } = applyTimerSettingsChange(initialTimer, 600, 24);

      // Should reset to fresh 10 minutes (not keep the 2m remaining)
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(600);
      expect(timerData.originalTime).toBe(600);
    });

    test('timer expiry and reset scenario', () => {
      // Timer has expired
      let timerData = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        expiredMessageLogged: true
      };

      // User changes timer to 10 minutes (should reset regardless)
      const result = applyTimerSettingsChange(timerData, 600, 24);

      expect(result.wasReset).toBe(true);
      expect(result.timerData.timeLeft).toBe(600);
      expect(result.timerData.expiredMessageLogged).toBe(false);
    });

    test('edge case: timeLeft somehow exceeds originalTime', () => {
      // Simulate corrupted state where timeLeft > originalTime
      const corruptedTimer = {
        originalTime: 300, // 5 minutes
        timeLeft: 600,     // 10 minutes (shouldn't happen but testing)
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // User "saves" same 5-minute setting
      const { timerData, wasReset } = applyTimerSettingsChange(corruptedTimer, 300, 24);

      // Should reset because timeLeft exceeds originalTime
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
    });

    test('no change scenario - save button should not trigger reset', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 180, // 3 minutes left
        resetInterval: 24,
        lastResetTimestamp: Date.now() - (120 * 1000), // 2 minutes ago
        expiredMessageLogged: false
      };

      // User clicks save without changing anything
      const { timerData, wasReset } = applyTimerSettingsChange(timer, 300, 24);

      // Should NOT reset
      expect(wasReset).toBe(false);
      expect(timerData.timeLeft).toBe(180); // Unchanged
      expect(timerData.lastResetTimestamp).toBe(timer.lastResetTimestamp);
    });
  });

  describe('Real Usage Flow Simulation', () => {
    test('complete user session with timer changes', () => {
      // User starts with default 5-minute timer
      let timer = {
        originalTime: 300,
        timeLeft: 300,
        resetInterval: 24,
        lastResetTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Simulate 2 minutes of browsing (timer ticks down)
      timer.timeLeft = 180; // 3 minutes left

      // User realizes they need more time, changes to 10 minutes
      const change1 = applyTimerSettingsChange(timer, 600, 24);
      expect(change1.wasReset).toBe(true);
      expect(change1.timerData.timeLeft).toBe(600);

      // Continue with new timer state
      timer = change1.timerData;

      // Simulate 8 minutes of browsing
      timer.timeLeft = 120; // 2 minutes left

      // User decides they want to limit themselves more, changes to 1 minute
      const change2 = applyTimerSettingsChange(timer, 60, 24);
      expect(change2.wasReset).toBe(true);
      expect(change2.timerData.timeLeft).toBe(60);
      
      // Timer should be reset to 1 minute, not keep the 2 minutes
    });

    test('daily reset cycle simulation', () => {
      const now = Date.now();
      
      // Timer expired yesterday
      let timer = {
        originalTime: 300,
        timeLeft: 0,
        resetInterval: 24,
        lastResetTimestamp: now - (25 * 60 * 60 * 1000), // 25 hours ago
        expiredMessageLogged: true
      };

      // Check if reset interval has passed (should reset)
      const { checkAndResetIfIntervalPassed } = require('../src/timer-utils');
      const resetTimer = checkAndResetIfIntervalPassed(timer, now);
      
      expect(resetTimer.timeLeft).toBe(300);
      expect(resetTimer.expiredMessageLogged).toBe(false);
      expect(resetTimer.lastResetTimestamp).toBe(now);
    });
  });
});