/**
 * Unit tests for timer logic
 * Tests the actual timer utility functions
 */

const {
  shouldResetTimer,
  applyTimerSettingsChange,
  normalizeRechargeRate,
  applyRecharge,
  estimateSecondsUntilFull,
  decrementTimer,
  parseURL,
  validateDomain,
  formatTime,
  formatTimeTracking,
  reEntryFloor,
  updateBlockedState,
  canAccessDomain,
  normalizeTokenThresholdHours,
  grantResetTokenIfEarned,
  secondsUntilTokenReady,
  spendResetToken,
  shouldOfferOverlayReset,
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
        rechargeRate: 30,
        lastVisitTimestamp: Date.now() - 1000,
        expiredMessageLogged: false
      };
    });

    test('should reset timer when changing to lower time', () => {
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 300, 30);
      
      expect(wasReset).toBe(true);
      expect(timerData.originalTime).toBe(300);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.expiredMessageLogged).toBe(false);
      expect(timerData.lastVisitTimestamp).toBeGreaterThan(mockTimer.lastVisitTimestamp);
    });

    // Bug fix: Timer with 9m left, change from 10m to 5m setting → should reset to 5m
    test('should reset timer with 9m left when changing from 10m to 5m setting', () => {
      const timer = {
        originalTime: 600, // 10 minutes setting
        timeLeft: 540,     // 9 minutes remaining  
        rechargeRate: 30,
        lastVisitTimestamp: Date.now() - (60 * 1000), // 1 minute ago
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(timer, 300, 30); // Change to 5m

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300); // Should be 5m, not 9m
      expect(timerData.originalTime).toBe(300);
    });

    // Bug fix: Timer with 3m left, change from 5m to 1m setting → should reset to 1m
    test('should reset timer with 3m left when changing from 5m to 1m setting', () => {
      const timer = {
        originalTime: 300, // 5 minutes setting
        timeLeft: 180,     // 3 minutes remaining
        rechargeRate: 30,
        lastVisitTimestamp: Date.now() - (120 * 1000), // 2 minutes ago  
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(timer, 60, 30); // Change to 1m

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(60); // Should be 1m, not 3m
    });

    test('should reset timer when changing to higher time', () => {
      mockTimer.originalTime = 300;
      mockTimer.timeLeft = 300;
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 600, 30);
      
      expect(wasReset).toBe(true);
      expect(timerData.originalTime).toBe(600);
      expect(timerData.timeLeft).toBe(600);
    });

    test('should not reset when time unchanged and timeLeft valid', () => {
      mockTimer.timeLeft = 300; // Valid time left
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 600, 30);
      
      expect(wasReset).toBe(false);
      expect(timerData.originalTime).toBe(600);
      expect(timerData.timeLeft).toBe(300); // Unchanged
      expect(timerData.lastVisitTimestamp).toBe(mockTimer.lastVisitTimestamp);
    });

    test('should reset expired timer', () => {
      mockTimer.timeLeft = 0;
      mockTimer.expiredMessageLogged = true;
      
      const { timerData, wasReset } = applyTimerSettingsChange(mockTimer, 300, 30);
      
      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.expiredMessageLogged).toBe(false);
    });

    // Edge case: Handle corrupted timer state where timeLeft > originalTime
    test('should handle corrupted state where timeLeft exceeds originalTime', () => {
      const corruptedTimer = {
        originalTime: 300, // 5 minutes
        timeLeft: 600,     // 10 minutes (impossible state)
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      // Even with "no change" to originalTime, should reset due to invalid timeLeft
      const { timerData, wasReset } = applyTimerSettingsChange(corruptedTimer, 300, 30);

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300); // Fixed to match originalTime
    });

    test('should handle corrupted state where timeLeft is non-finite', () => {
      const corruptedTimer = {
        originalTime: 300,
        timeLeft: NaN,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: false
      };

      const { timerData, wasReset } = applyTimerSettingsChange(corruptedTimer, 300, 30);

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
    });

    test('should handle corrupted state where timeLeft is negative', () => {
      const corruptedTimer = {
        originalTime: 300,
        timeLeft: -10,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
        expiredMessageLogged: true
      };

      const { timerData, wasReset } = applyTimerSettingsChange(corruptedTimer, 300, 30);

      expect(wasReset).toBe(true);
      expect(timerData.timeLeft).toBe(300);
      expect(timerData.expiredMessageLogged).toBe(false);
    });
  });

  describe('normalizeRechargeRate', () => {
    test('keeps a valid positive rate', () => {
      expect(normalizeRechargeRate(300)).toBe(300);
    });

    test('falls back to 30 for missing or invalid rates', () => {
      expect(normalizeRechargeRate(undefined)).toBe(30);
      expect(normalizeRechargeRate(NaN)).toBe(30);
      expect(normalizeRechargeRate(0)).toBe(30);
      expect(normalizeRechargeRate(-5)).toBe(30);
    });
  });

  describe('applyRecharge', () => {
    const now = 1_700_000_000_000;
    const HOUR = 60 * 60 * 1000;

    test('credits earned seconds for time away (30s/hr)', () => {
      // Away 1 hour at 30s/hr → +30s
      const timer = {
        originalTime: 300,
        timeLeft: 0,
        rechargeRate: 30,
        lastVisitTimestamp: now - HOUR,
        expiredMessageLogged: true
      };

      const result = applyRecharge(timer, now);

      expect(result.timeLeft).toBe(30);
      // Restoring time above zero re-arms the post-expiry log
      expect(result.expiredMessageLogged).toBe(false);
    });

    test('never recharges past the cap', () => {
      const timer = {
        originalTime: 60,
        timeLeft: 50,
        rechargeRate: 900, // 15m/hr would earn 900s in an hour
        lastVisitTimestamp: now - HOUR,
        expiredMessageLogged: false
      };

      const result = applyRecharge(timer, now);

      expect(result.timeLeft).toBe(60); // clamped to cap, not 950
    });

    test('is a no-op when already full and refreshes the clock', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 300,
        rechargeRate: 30,
        lastVisitTimestamp: now - 10 * HOUR,
        expiredMessageLogged: false
      };

      const result = applyRecharge(timer, now);

      expect(result.timeLeft).toBe(300);
      expect(result.lastVisitTimestamp).toBe(now);
    });

    test('does not credit before a whole second has accrued', () => {
      // 30s/hr ⇒ 1s every 120s. After 60s away, nothing whole earned yet.
      const timer = {
        originalTime: 300,
        timeLeft: 100,
        rechargeRate: 30,
        lastVisitTimestamp: now - 60 * 1000,
        expiredMessageLogged: false
      };

      const result = applyRecharge(timer, now);

      expect(result.timeLeft).toBe(100);
      expect(result.lastVisitTimestamp).toBe(timer.lastVisitTimestamp);
    });

    test('carries the sub-second remainder forward across passes', () => {
      // 30s/hr ⇒ 1s per 120000ms. Away 180000ms = 1.5s ⇒ credit 1s and advance
      // the clock by only 120000ms, leaving 60000ms (0.5s) pending.
      const start = {
        originalTime: 300,
        timeLeft: 0,
        rechargeRate: 30,
        lastVisitTimestamp: now - 180000,
        expiredMessageLogged: true
      };

      const first = applyRecharge(start, now);
      expect(first.timeLeft).toBe(1);
      expect(first.lastVisitTimestamp).toBe(now - 180000 + 120000); // consumed only 1s worth

      // 60000ms more (total 120000ms past the advanced clock) ⇒ the next whole second
      const second = applyRecharge(first, now + 60000);
      expect(second.timeLeft).toBe(2);
    });

    test('defaults a missing recharge rate to 30s/hr', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 0,
        lastVisitTimestamp: now - HOUR,
        expiredMessageLogged: true
      };

      const result = applyRecharge(timer, now);

      expect(result.rechargeRate).toBe(30);
      expect(result.timeLeft).toBe(30);
    });

    test('does not credit negative time on a backwards clock jump', () => {
      const timer = {
        originalTime: 300,
        timeLeft: 100,
        rechargeRate: 300,
        lastVisitTimestamp: now + HOUR, // future timestamp ⇒ negative elapsed
        expiredMessageLogged: false
      };

      const result = applyRecharge(timer, now);

      expect(result.timeLeft).toBe(100); // unchanged, never decreases
    });

    test('clamps a non-finite original time to zero and stays expired', () => {
      const timer = {
        originalTime: Infinity,
        timeLeft: 0,
        rechargeRate: 30,
        lastVisitTimestamp: now - HOUR,
        expiredMessageLogged: true
      };

      const result = applyRecharge(timer, now);

      expect(result.originalTime).toBe(0);
      expect(result.timeLeft).toBe(0);
    });
  });

  describe('estimateSecondsUntilFull', () => {
    test('returns 0 when already full', () => {
      expect(
        estimateSecondsUntilFull({ originalTime: 300, timeLeft: 300, rechargeRate: 30 })
      ).toBe(0);
    });

    test('computes wall-clock seconds to refill the deficit', () => {
      // deficit 30s at 30s/hr ⇒ 1 hour = 3600 wall-clock seconds
      expect(
        estimateSecondsUntilFull({ originalTime: 60, timeLeft: 30, rechargeRate: 30 })
      ).toBe(3600);
    });

    test('scales with the recharge rate', () => {
      // deficit 60s at 15m/hr (900s/hr) ⇒ 60/900 * 3600 = 240s
      expect(
        estimateSecondsUntilFull({ originalTime: 60, timeLeft: 0, rechargeRate: 900 })
      ).toBe(240);
    });
  });

  describe('decrementTimer', () => {
    let mockTimer;

    beforeEach(() => {
      mockTimer = {
        originalTime: 300,
        timeLeft: 100,
        rechargeRate: 30,
        lastVisitTimestamp: Date.now(),
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

    test('should handle non-finite timeLeft values as expired', () => {
      mockTimer.timeLeft = Infinity;
      const result = decrementTimer(mockTimer);

      expect(result.timeLeft).toBe(0);
      expect(result.expiredMessageLogged).toBe(true);
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
        expect(formatTime(Infinity)).toBe('Invalid time');
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
        expect(formatTimeTracking(Infinity)).toBe('0s');
      });
    });
  });

  describe('reEntryFloor', () => {
    test('returns 10% of the cap for a 60-second cap', () => {
      expect(reEntryFloor(60)).toBe(6);
    });
    test('returns 10% of the cap for a 300-second cap (30)', () => {
      expect(reEntryFloor(300)).toBe(30);
    });
    test('returns 0 for 0, NaN, Infinity, and null', () => {
      expect(reEntryFloor(0)).toBe(0);
      expect(reEntryFloor(NaN)).toBe(0);
      expect(reEntryFloor(Infinity)).toBe(0);
      expect(reEntryFloor(null)).toBe(0);
      expect(reEntryFloor(undefined)).toBe(0);
    });
  });

  describe('updateBlockedState', () => {
    test('sets isBlocked when timeLeft is at or below zero', () => {
      const state = updateBlockedState({ originalTime: 300, timeLeft: 0, isBlocked: false });
      expect(state.isBlocked).toBe(true);
    });
    test('clears isBlocked when timeLeft reaches the floor', () => {
      const state = updateBlockedState({ originalTime: 300, timeLeft: 30, isBlocked: true });
      expect(state.isBlocked).toBe(false);
    });
    test('leaves isBlocked unchanged between zero and the floor (9% → 27s of 300)', () => {
      const state = updateBlockedState({ originalTime: 300, timeLeft: 27, isBlocked: true });
      expect(state.isBlocked).toBe(true);
    });
    test('leaves isBlocked unchanged when it was already false mid-band', () => {
      const state = updateBlockedState({ originalTime: 300, timeLeft: 15, isBlocked: false });
      expect(state.isBlocked).toBe(false);
    });
    test('returns a new object (does not mutate the input)', () => {
      const input = { originalTime: 300, timeLeft: 0, isBlocked: false };
      const state = updateBlockedState(input);
      expect(state).not.toBe(input);
      expect(state.isBlocked).toBe(true);
      expect(input.isBlocked).toBe(false);
    });
  });

  describe('canAccessDomain', () => {
    test('returns false when isBlocked is true even with positive timeLeft', () => {
      expect(canAccessDomain({ originalTime: 300, timeLeft: 15, isBlocked: true })).toBe(false);
    });
    test('returns false when timeLeft is zero or negative', () => {
      expect(canAccessDomain({ originalTime: 300, timeLeft: 0, isBlocked: false })).toBe(false);
      expect(canAccessDomain({ originalTime: 300, timeLeft: -5, isBlocked: false })).toBe(false);
    });
    test('returns false when the timer is nullish', () => {
      expect(canAccessDomain(null)).toBe(false);
      expect(canAccessDomain(undefined)).toBe(false);
    });
    test('derives isBlocked from timeLeft <= 0 when the field is absent', () => {
      expect(canAccessDomain({ originalTime: 300, timeLeft: 0 })).toBe(false);
      expect(canAccessDomain({ originalTime: 300, timeLeft: 30 })).toBe(true);
    });
    test('returns true for a normal accessible domain', () => {
      expect(canAccessDomain({ originalTime: 300, timeLeft: 150, isBlocked: false })).toBe(true);
    });
  });
});

describe('token earning helpers', () => {
  test('normalizeTokenThresholdHours defaults to 8 for bad input', () => {
    expect(normalizeTokenThresholdHours(undefined)).toBe(8);
    expect(normalizeTokenThresholdHours(null)).toBe(8);
    expect(normalizeTokenThresholdHours(0)).toBe(8);
    expect(normalizeTokenThresholdHours(-4)).toBe(8);
    expect(normalizeTokenThresholdHours(NaN)).toBe(8);
    expect(normalizeTokenThresholdHours('8')).toBe(8);
  });

  test('normalizeTokenThresholdHours passes the ladder through', () => {
    expect(normalizeTokenThresholdHours(4)).toBe(4);
    expect(normalizeTokenThresholdHours(8)).toBe(8);
    expect(normalizeTokenThresholdHours(12)).toBe(12);
    expect(normalizeTokenThresholdHours(24)).toBe(24);
  });

  test('grantResetTokenIfEarned grants at exactly the threshold', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 8 * 60 * 60 * 1000,
      tokenThresholdHours: 8,
      resetToken: false,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(true);
  });

  test('grantResetTokenIfEarned does not grant one ms before threshold', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - (8 * 60 * 60 * 1000 - 1),
      tokenThresholdHours: 8,
      resetToken: false,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(false);
  });

  test('grantResetTokenIfEarned does not grant twice', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 20 * 60 * 60 * 1000,
      tokenThresholdHours: 8,
      resetToken: true,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(true);
    expect(result).toEqual(timer);
  });

  test('grant happens with a full budget (timeLeft equals originalTime)', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 8 * 60 * 60 * 1000,
      tokenThresholdHours: 8,
      resetToken: false,
      timeLeft: 300,
      originalTime: 300,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(true);
  });

  test('backwards clock jump never grants a token', () => {
    const now = Date.now();
    const timer = {
      awaySince: now, // clock jumped backwards: awaySince is in the "future"
      tokenThresholdHours: 8,
      resetToken: false,
    };
    const result = grantResetTokenIfEarned(timer, now - 1000);
    expect(result.resetToken).toBe(false);
  });

  test('forgiving reads: absent resetToken reads false', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 8 * 60 * 60 * 1000,
      tokenThresholdHours: 8,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(true);
  });

  test('forgiving reads: absent tokenThresholdHours reads 8', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 8 * 60 * 60 * 1000,
      resetToken: false,
    };
    const result = grantResetTokenIfEarned(timer, now);
    expect(result.resetToken).toBe(true);
  });

  test('forgiving reads: absent awaySince falls back to lastVisitTimestamp then current time', () => {
    const now = Date.now();
    const withLastVisit = {
      lastVisitTimestamp: now - 8 * 60 * 60 * 1000,
      resetToken: false,
    };
    expect(grantResetTokenIfEarned(withLastVisit, now).resetToken).toBe(true);

    const withNothing = { resetToken: false };
    expect(grantResetTokenIfEarned(withNothing, now).resetToken).toBe(false);
  });

  test('secondsUntilTokenReady returns 0 when token held', () => {
    expect(secondsUntilTokenReady({ resetToken: true })).toBe(0);
  });

  test('secondsUntilTokenReady returns whole seconds remaining, never negative', () => {
    const now = Date.now();
    const timer = {
      awaySince: now - 2 * 60 * 60 * 1000, // 2h into an 8h threshold
      tokenThresholdHours: 8,
      resetToken: false,
    };
    const seconds = secondsUntilTokenReady(timer, now);
    expect(seconds).toBe(6 * 60 * 60);
    expect(seconds).toBeGreaterThan(0);

    const ready = { awaySince: now - 10 * 60 * 60 * 1000, tokenThresholdHours: 8, resetToken: false };
    expect(secondsUntilTokenReady(ready, now)).toBe(0);
  });
});

describe('spendResetToken', () => {
  test('refills budget to cap, clears token, isBlocked, and stamps awaySince', () => {
    const now = Date.now();
    const timer = {
      originalTime: 60,
      timeLeft: 2,
      rechargeRate: 30,
      lastVisitTimestamp: now - 3600000,
      awaySince: now - 3600000,
      resetToken: true,
      isBlocked: true,
      expiredMessageLogged: true,
    };
    const { timerData, success } = spendResetToken(timer, now);
    expect(success).toBe(true);
    expect(timerData.timeLeft).toBe(60);
    expect(timerData.resetToken).toBe(false);
    expect(timerData.isBlocked).toBe(false);
    expect(timerData.awaySince).toBe(now);
    expect(timerData.expiredMessageLogged).toBe(false);
    expect(timerData.lastVisitTimestamp).toBe(now);
  });

  test('refuses when no token is held, returns unchanged field by field', () => {
    const timer = { originalTime: 60, timeLeft: 10, resetToken: false };
    const { timerData, success, reason } = spendResetToken(timer);
    expect(success).toBe(false);
    expect(reason).toBe('no-token');
    expect(timerData.timeLeft).toBe(10);
    expect(timerData.resetToken).toBe(false);
  });

  test('refuses when budget at cap, returns unchanged', () => {
    const timer = { originalTime: 60, timeLeft: 60, resetToken: true };
    const { timerData, success, reason } = spendResetToken(timer);
    expect(success).toBe(false);
    expect(reason).toBe('at-cap');
    expect(timerData.timeLeft).toBe(60);
    expect(timerData.resetToken).toBe(true);
  });

  test('refuses when budget above cap (corrupted)', () => {
    const timer = { originalTime: 60, timeLeft: 120, resetToken: true };
    const { success, reason } = spendResetToken(timer);
    expect(success).toBe(false);
    expect(reason).toBe('at-cap');
  });
});

describe('shouldOfferOverlayReset', () => {
  test('returns false when no token is held', () => {
    expect(shouldOfferOverlayReset({ originalTime: 60, timeLeft: 5, resetToken: false })).toBe(false);
  });

  test('returns true at the bound: 60s cap, 30s left', () => {
    expect(shouldOfferOverlayReset({ originalTime: 60, timeLeft: 30, resetToken: true })).toBe(true);
  });

  test('returns false one second above the bound: 60s cap, 31s left', () => {
    expect(shouldOfferOverlayReset({ originalTime: 60, timeLeft: 31, resetToken: true })).toBe(false);
  });

  test('returns true for 300s cap, 75s left (bound is 75)', () => {
    expect(shouldOfferOverlayReset({ originalTime: 300, timeLeft: 75, resetToken: true })).toBe(true);
  });

  test('returns false for 300s cap, 76s left', () => {
    expect(shouldOfferOverlayReset({ originalTime: 300, timeLeft: 76, resetToken: true })).toBe(false);
  });

  test('returns false when token held but budget full', () => {
    expect(shouldOfferOverlayReset({ originalTime: 60, timeLeft: 60, resetToken: true })).toBe(false);
  });

  test('returns false when timerData is null/undefined', () => {
    expect(shouldOfferOverlayReset(null)).toBe(false);
    expect(shouldOfferOverlayReset(undefined)).toBe(false);
  });
});
