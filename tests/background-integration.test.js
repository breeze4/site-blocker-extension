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
  describe('applyRechargeToAllTimers function logic', () => {
    test('should use TimerUtils.applyRecharge to credit time earned while away', () => {
      const now = Date.now();
      const timerData = {
        originalTime: 300,
        timeLeft: 0,
        rechargeRate: 30, // 30 sec/hr away
        lastVisitTimestamp: now - (2 * 60 * 60 * 1000), // 2 hours ago
        expiredMessageLogged: true
      };

      // At 30 sec/hr, 2 hours away earns 60 seconds
      const result = TimerUtils.applyRecharge(timerData, now);

      expect(result.timeLeft).toBe(60); // 60 seconds recharged
      expect(result.expiredMessageLogged).toBe(false);
    });

    test('should not recharge if no time has passed since last visit', () => {
      const now = Date.now();
      const timerData = {
        originalTime: 300,
        timeLeft: 0,
        rechargeRate: 30,
        lastVisitTimestamp: now, // visited just now
        expiredMessageLogged: true
      };

      const result = TimerUtils.applyRecharge(timerData, now);

      expect(result.timeLeft).toBe(0); // No recharge yet
      expect(result.expiredMessageLogged).toBe(true);
    });
  });

  describe('Timer decrement logic', () => {
    test('should use TimerUtils.decrementTimer for countdown', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 120,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
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
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
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
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: true
      };

      const result = TimerUtils.decrementTimer(timer);

      expect(result.timeLeft).toBe(0); // Should stay at 0
      expect(result.expiredMessageLogged).toBe(true); // Should stay true
    });
  });

  describe('Background timer workflow simulation', () => {
    test('complete timer lifecycle: start → countdown → expire → recharge', () => {
      const now = Date.now();

      // 1. Fresh timer
      let timer = {
        originalTime: 60, // 1 minute for quick test
        timeLeft: 60,
        rechargeRate: 30, // 30 sec/hr away
        lastVisitTimestamp: now,
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

      // 4. Simulate 2 hours away then apply recharge.
      // At 30 sec/hr, 2 hours = 60 seconds earned — fully recharges the 60s budget.
      // lastVisitTimestamp is still `now` (decrementTimer does not advance it;
      // background.js does that on each tick, but only for the active tab).
      const rechargeTime = now + (2 * 60 * 60 * 1000);
      timer = TimerUtils.applyRecharge(timer, rechargeTime);
      expect(timer.timeLeft).toBe(60); // Recharged to original
      expect(timer.expiredMessageLogged).toBe(false);
    });

    test('timer settings change during active countdown', () => {
      // Timer is counting down
      let timer = {
        originalTime: 300, // 5 minutes
        timeLeft: 180,     // 3 minutes left
        rechargeRate: 30,
        lastVisitTimestamp: Date.now() - (120 * 1000), // Started 2 minutes ago
        expiredMessageLogged: false
      };

      // User changes setting to 1 minute (less than current timeLeft)
      const settingsChange = TimerUtils.applyTimerSettingsChange(timer, 60, 30);

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
      const now = Date.now();
      const corruptedTimer = {
        originalTime: 300,
        timeLeft: 1000, // Impossible: more time left than original
        rechargeRate: 30,
        lastVisitTimestamp: now,
        expiredMessageLogged: false
      };

      // applyRecharge caps timeLeft to originalTime immediately — unlike the old reset
      // model which left corruption in place until the reset interval elapsed
      const rechargeCheck = TimerUtils.applyRecharge(corruptedTimer, now);
      expect(rechargeCheck.timeLeft).toBe(300); // Capped to originalTime

      // Settings save also corrects it
      const fixed = TimerUtils.applyTimerSettingsChange(corruptedTimer, 300, 30);
      expect(fixed.wasReset).toBe(true);
      expect(fixed.timerData.timeLeft).toBe(300); // Fixed
    });

    test('timer with negative values', () => {
      // Simulate somehow getting negative timeLeft (shouldn't happen but test it)
      const timer = {
        originalTime: 300,
        timeLeft: -10, // Corrupted negative value
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // decrementTimer should handle this gracefully
      const result = TimerUtils.decrementTimer(timer);
      expect(result.timeLeft).toBe(0); // Should cap at 0, not -11
    });
  });
});
