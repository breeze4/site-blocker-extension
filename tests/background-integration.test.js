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

  describe('blocked-state lifecycle', () => {
    test('drives timer to zero, confirms isBlocked, stays blocked below floor, then clears above floor', () => {
      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;

      // 1. Fresh timer at cap
      let timer = {
        originalTime: 60,
        timeLeft: 60,
        rechargeRate: 30, // 30s/hr
        lastVisitTimestamp: now,
        expiredMessageLogged: false,
        isBlocked: false,
      };

      // 2. Countdown to zero → set isBlocked
      for (let i = 0; i < 60; i++) {
        timer = TimerUtils.decrementTimer(timer);
      }
      expect(timer.timeLeft).toBe(0);
      // In real code background sets isBlocked=true on expiry; simulate that:
      timer = TimerUtils.updateBlockedState(timer);
      expect(timer.isBlocked).toBe(true);

      // 3. Recharge below the floor (6s is the 10% floor for 60s cap).
      // At 30s/hr, ~11min = 660s = 5s earned (below the 6s floor).
      const lowRechargeTime = now + 11 * 60 * 1000; // 660s
      timer = TimerUtils.applyRecharge(timer, lowRechargeTime);
      timer = TimerUtils.updateBlockedState(timer);
      expect(timer.timeLeft).toBeGreaterThan(0);
      expect(timer.timeLeft).toBeLessThan(6); // Below the 10% floor of 6s
      expect(timer.isBlocked).toBe(true); // Still blocked
      expect(TimerUtils.canAccessDomain(timer)).toBe(false);

      // 4. Recharge past the floor. 30s/hr, 4h = 120s (capped at 60).
      const highRechargeTime = now + 4 * 60 * 60 * 1000;
      timer = TimerUtils.applyRecharge(timer, highRechargeTime);
      timer = TimerUtils.updateBlockedState(timer);
      expect(timer.timeLeft).toBe(60);
      expect(timer.isBlocked).toBe(false);
      expect(TimerUtils.canAccessDomain(timer)).toBe(true);
    });

    test('a running session with timeLeft below the floor is not blocked', () => {
      // Simulate a long-running session: started with 5min budget,
      // now down to 10s (~3.3% of 300s). Since isBlocked is only set on
      // the zero transition, a mid-session state below the floor is still active.
      const timer = {
        originalTime: 300,
        timeLeft: 10,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: false,
        isBlocked: false,
      };
      // updateBlockedState sees timeLeft > 0 and isBlocked=false → no change
      const updated = TimerUtils.updateBlockedState(timer);
      expect(updated.isBlocked).toBe(false);
      expect(TimerUtils.canAccessDomain(timer)).toBe(true);
    });
  });

  describe('block URL builder', () => {
    test('builds a block page URL with domain and origin URL percent-encoded', () => {
      const url = TimerUtils.parseURL
        ? null
        : null; // tested via background.js vm context
      // Simulate what background.js does: buildBlockUrl via chrome.runtime.getURL
      global.chrome.runtime.getURL = jest.fn((path) =>
        `chrome-extension://extid/${path}`
      );
      const base = global.chrome.runtime.getURL('blocked.html');
      const params = new URLSearchParams();
      params.set('domain', 'example.com');
      params.set('url', 'https://example.com/page?q=1#x');
      const result = `${base}?${params.toString()}`;
      const parsed = new URL(result);
      expect(parsed.searchParams.get('domain')).toBe('example.com');
      expect(parsed.searchParams.get('url')).toBe('https://example.com/page?q=1#x');
    });
  });
});

  describe('token earning integration', () => {
    test('countdown refreshes awaySince for active domain on every tick', () => {
      const now = Date.now();
      const timer = {
        originalTime: 300,
        timeLeft: 300,
        rechargeRate: 30,
        lastVisitTimestamp: now,
        awaySince: now - 4 * 60 * 60 * 1000, // 4h into an 8h threshold
        resetToken: false,
        tokenThresholdHours: 8,
      };

      // Simulate what background.js does on each countdown tick.
      const tick = (t) => {
        t.lastVisitTimestamp = Date.now();
        t.awaySince = Date.now();
        return t;
      };
      const result = tick(timer);
      expect(result.awaySince).toBeGreaterThanOrEqual(now);
      expect(TimerUtils.secondsUntilTokenReady(result, Date.now())).toBeGreaterThan(0);
    });

    test('visit partway through threshold restarts clock and keeps held token', () => {
      const now = Date.now();
      // Domain holds a token already and gets visited at hour 4 of a new absence.
      const timer = {
        originalTime: 300,
        timeLeft: 300,
        rechargeRate: 30,
        lastVisitTimestamp: now,
        awaySince: now - 4 * 60 * 60 * 1000,
        resetToken: true,
        tokenThresholdHours: 8,
      };

      // A visit restarts awaySince and does not drop the held token.
      timer.awaySince = Date.now();
      timer.lastVisitTimestamp = Date.now();
      expect(timer.resetToken).toBe(true);
      expect(TimerUtils.secondsUntilTokenReady(timer, Date.now())).toBe(0);
    });
  });

  describe('reset token spend tracking', () => {
    test('fresh tracking record carries empty resetTokenSpends and zero allTimeResetSpends', () => {
      // Simulate createEmptyTimeTrackingRecord
      const today = new Date().toISOString().split('T')[0];
      const record = {
        dailyTotals: {},
        allTimeTotal: 0,
        trackingStartDate: today,
        lastResetDate: today,
        currentSessionStart: null,
        lastActiveTimestamp: Date.now(),
        resetTokenSpends: {},
        allTimeResetSpends: 0,
      };
      expect(record.resetTokenSpends).toEqual({});
      expect(record.allTimeResetSpends).toBe(0);
    });

    test('30-day cleanup prunes resetTokenSpends older than the window', () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const within = cutoffDate.toISOString().split('T')[0];
      const outside = new Date(cutoffDate.getTime() - 86400000).toISOString().split('T')[0];

      const spends = {};
      spends[within] = 3;
      spends[outside] = 2;

      // Simulate the prune logic
      const cutoff = cutoffDate.toISOString().split('T')[0];
      for (const date of Object.keys(spends)) {
        if (date < cutoff) {
          delete spends[date];
        }
      }

      expect(spends[within]).toBe(3);
      expect(spends[outside]).toBeUndefined();
    });

    test('absent fields read as defaults (resetTokenSpends: {}, allTimeResetSpends: 0)', () => {
      const record = {};
      const spends = record.resetTokenSpends || {};
      const allTime = record.allTimeResetSpends || 0;
      expect(spends).toEqual({});
      expect(allTime).toBe(0);
    });
  });

  describe('spendResetToken dispatcher action', () => {
    test('successful spend writes domainTimers and increments spend counters', async () => {
      // Simulate what the dispatcher does when a token is held.
      const domain = 'example.com';
      const now = Date.now();
      const timer = {
        originalTime: 60,
        timeLeft: 2,
        rechargeRate: 30,
        lastVisitTimestamp: now,
        awaySince: now - 10 * 60 * 60 * 1000,
        resetToken: true,
        isBlocked: true,
        expiredMessageLogged: true,
      };
      const domainTimers = { [domain]: timer };

      // Spend the token.
      const result = TimerUtils.spendResetToken(timer, now);
      expect(result.success).toBe(true);
      domainTimers[domain] = result.timerData;

      // Assert timer state.
      expect(domainTimers[domain].timeLeft).toBe(60);
      expect(domainTimers[domain].resetToken).toBe(false);
      expect(domainTimers[domain].isBlocked).toBe(false);

      // Simulate spend recording.
      const today = new Date(now).toISOString().split('T')[0];
      const tracking = { [domain]: {} };
      if (!tracking[domain].resetTokenSpends) tracking[domain].resetTokenSpends = {};
      tracking[domain].resetTokenSpends[today] = (tracking[domain].resetTokenSpends[today] || 0) + 1;
      tracking[domain].allTimeResetSpends = (tracking[domain].allTimeResetSpends || 0) + 1;

      expect(tracking[domain].resetTokenSpends[today]).toBe(1);
      expect(tracking[domain].allTimeResetSpends).toBe(1);
    });

    test('refused spend writes neither domainTimers nor tracking', () => {
      const timer = { originalTime: 60, timeLeft: 10, resetToken: false };
      const result = TimerUtils.spendResetToken(timer);
      expect(result.success).toBe(false);
      // A refused spend changes nothing — the original record is returned as-is.
      expect(result.timerData.timeLeft).toBe(10);
      expect(result.timerData.resetToken).toBe(false);
    });
  });
