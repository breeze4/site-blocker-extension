/**
 * Unit tests for the pause feature: password generation/validation (timer-utils)
 * and the popup's pure helper functions.
 */

// jsdom does not provide WebCrypto by default; back it with Node's implementation.
if (!global.crypto || typeof global.crypto.getRandomValues !== "function") {
  global.crypto = require("crypto").webcrypto;
}

const {
  generatePausePassword,
  normalizePausePassword,
  checkPausePassword,
} = require("../src/timer-utils");

const {
  isTrackableUrl,
  getDomainFromUrl,
  getInheritedResetInterval,
  getProgressPercent,
  DEFAULT_BLOCK_MINUTES,
  DEFAULT_RESET_INTERVAL_HOURS,
} = require("../src/popup");

describe("pause password helpers", () => {
  describe("generatePausePassword", () => {
    test("produces three groups of four allowed characters", () => {
      const password = generatePausePassword();
      expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/);
    });

    test("omits visually ambiguous characters (0, o, 1, l, i)", () => {
      for (let i = 0; i < 50; i++) {
        const password = generatePausePassword();
        expect(password).not.toMatch(/[01loi]/);
      }
    });

    test("returns different values across calls", () => {
      const values = new Set();
      for (let i = 0; i < 20; i++) {
        values.add(generatePausePassword());
      }
      // Collisions are astronomically unlikely; expect mostly unique values.
      expect(values.size).toBeGreaterThan(15);
    });
  });

  describe("normalizePausePassword", () => {
    test("trims and lowercases strings", () => {
      expect(normalizePausePassword("  ABcd-EFgh  ")).toBe("abcd-efgh");
    });

    test("returns empty string for non-string input", () => {
      expect(normalizePausePassword(null)).toBe("");
      expect(normalizePausePassword(undefined)).toBe("");
      expect(normalizePausePassword(42)).toBe("");
    });
  });

  describe("checkPausePassword", () => {
    test("matches case-insensitively and ignores surrounding whitespace", () => {
      expect(checkPausePassword("  ABCD-efgh-jkmn ", "abcd-efgh-jkmn")).toBe(true);
    });

    test("rejects an incorrect entry", () => {
      expect(checkPausePassword("wrong-code-here", "abcd-efgh-jkmn")).toBe(false);
    });

    test("never matches when no password is stored", () => {
      expect(checkPausePassword("", "")).toBe(false);
      expect(checkPausePassword("anything", null)).toBe(false);
      expect(checkPausePassword("anything", undefined)).toBe(false);
    });
  });
});

describe("popup pure helpers", () => {
  describe("isTrackableUrl", () => {
    test("accepts http and https pages", () => {
      expect(isTrackableUrl("https://www.reddit.com/r/x")).toBe(true);
      expect(isTrackableUrl("http://example.com")).toBe(true);
    });

    test("rejects browser, extension, and empty pages", () => {
      expect(isTrackableUrl("chrome://newtab")).toBe(false);
      expect(isTrackableUrl("chrome-extension://abc/options.html")).toBe(false);
      expect(isTrackableUrl("about:blank")).toBe(false);
      expect(isTrackableUrl("")).toBe(false);
      expect(isTrackableUrl(undefined)).toBe(false);
    });
  });

  describe("getDomainFromUrl", () => {
    test("extracts the hostname", () => {
      expect(getDomainFromUrl("https://old.reddit.com/r/x")).toBe("old.reddit.com");
    });

    test("returns null for invalid input", () => {
      expect(getDomainFromUrl("not a url")).toBeNull();
    });
  });

  describe("getInheritedResetInterval", () => {
    test("returns the interval from an existing domain", () => {
      const domainTimers = {
        "example.com": { resetInterval: 8 },
        "other.com": { resetInterval: 8 },
      };
      expect(getInheritedResetInterval(domainTimers)).toBe(8);
    });

    test("falls back to the default with no domains", () => {
      expect(getInheritedResetInterval({})).toBe(DEFAULT_RESET_INTERVAL_HOURS);
      expect(getInheritedResetInterval(null)).toBe(DEFAULT_RESET_INTERVAL_HOURS);
    });

    test("skips domains with an invalid reset interval", () => {
      const domainTimers = {
        "bad.com": { resetInterval: 0 },
        "good.com": { resetInterval: 1 },
      };
      expect(getInheritedResetInterval(domainTimers)).toBe(1);
    });
  });

  describe("getProgressPercent", () => {
    test("computes the remaining percentage", () => {
      expect(getProgressPercent(150, 300)).toBe(50);
      expect(getProgressPercent(300, 300)).toBe(100);
      expect(getProgressPercent(0, 300)).toBe(0);
    });

    test("clamps and guards against bad input", () => {
      expect(getProgressPercent(400, 300)).toBe(100);
      expect(getProgressPercent(-10, 300)).toBe(0);
      expect(getProgressPercent(100, 0)).toBe(0);
      expect(getProgressPercent(NaN, 300)).toBe(0);
    });
  });

  test("default block minutes is five", () => {
    expect(DEFAULT_BLOCK_MINUTES).toBe(5);
  });
});
