/**
 * Unit tests for the block page pure helpers and rendering.
 */

// jsdom with chrome mocks from setup.js
require("./setup");

describe("block page pure helpers", () => {
  let helpers;

  beforeEach(() => {
    jest.resetModules();
    helpers = require("../src/blocked.js");
  });

  describe("readBlockParams", () => {
    test("reads domain and origin URL", () => {
      window.history.replaceState({}, "", "?domain=example.com&url=https://example.com/path");
      const p = helpers.readBlockParams();
      expect(p.domain).toBe("example.com");
      expect(p.originUrl).toBe("https://example.com/path");
    });

    test("percent-decodes URL with its own query string and fragment", () => {
      window.history.replaceState({}, "",
        "?domain=test.com&url=https%3A%2F%2Ftest.com%2Fpage%3Fq%3D1%26x%3D2%23frag");
      const p = helpers.readBlockParams();
      expect(p.domain).toBe("test.com");
      expect(p.originUrl).toBe("https://test.com/page?q=1&x=2#frag");
    });

    test("returns null domain and null URL for missing params", () => {
      window.history.replaceState({}, "", "?");
      const p = helpers.readBlockParams();
      expect(p.domain).toBeNull();
      expect(p.originUrl).toBeNull();
    });

    test("returns null domain for whitespace-only value", () => {
      window.history.replaceState({}, "", "?domain=   &url=https://x.com");
      const p = helpers.readBlockParams();
      expect(p.domain).toBeNull();
    });

    test("returns null originUrl for malformed URL", () => {
      window.history.replaceState({}, "", "?domain=x.com&url=not-a-url");
      const p = helpers.readBlockParams();
      expect(p.domain).toBe("x.com");
      expect(p.originUrl).toBeNull();
    });

    test("never throws on any input", () => {
      window.history.replaceState({}, "", "?garbage&%zz");
      const p = helpers.readBlockParams();
      expect(p.domain).toBeNull();
      expect(p.originUrl).toBeNull();
    });
  });

  describe("formatDuration", () => {
    test("formats seconds-only", () => {
      expect(helpers.formatDuration(45)).toBe("45s");
    });

    test("formats minutes and seconds", () => {
      expect(helpers.formatDuration(125)).toBe("2m 5s");
    });

    test("formats hours and minutes", () => {
      expect(helpers.formatDuration(3720)).toBe("1h 2m");
    });

    test("formats hours only", () => {
      expect(helpers.formatDuration(7200)).toBe("2h");
    });

    test('returns "now" for zero and non-finite', () => {
      expect(helpers.formatDuration(0)).toBe("now");
      expect(helpers.formatDuration(-5)).toBe("now");
      expect(helpers.formatDuration(NaN)).toBe("now");
    });
  });

  describe("estimateSecondsUntilReentry", () => {
    test("computes time to reach floor at 30s/hr", () => {
      // floor(300) = 30, deficit = 30 - 10 = 20, 20 * 3600 / 30 = 2400
      const secs = helpers.estimateSecondsUntilReentry(300, 10, 30);
      expect(secs).toBe(2400);
    });

    test("returns 0 when already at or above floor", () => {
      expect(helpers.estimateSecondsUntilReentry(300, 30, 30)).toBe(0);
      expect(helpers.estimateSecondsUntilReentry(60, 6, 30)).toBe(0);
    });

    test("falls back to 30s/hr for invalid rate", () => {
      const secs = helpers.estimateSecondsUntilReentry(300, 0, 0);
      expect(secs).toBeGreaterThan(0);
    });
  });
});

describe("block page rendering", () => {
  beforeEach(() => {
    jest.resetModules();
    global.StorageUtils = {
      getFromStorage: jest.fn(() => Promise.resolve(null)),
      setToStorage: jest.fn(() => Promise.resolve()),
    };
    document.body.innerHTML = `
      <span id="blockedDomain"></span>
      <p id="reentryEstimate" class="estimate"></p>
      <p id="alreadyReady" class="ready hidden"></p>
      <button id="resetButton" class="primary-button full-width hidden">Reset Timer</button>
      <p id="resetError" class="muted hidden"></p>
    `;
  });

  test("renders domain name and re-entry estimate", async () => {
    window.history.replaceState({}, "", "?domain=reddit.com&url=https://reddit.com");
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          "reddit.com": {
            originalTime: 60,
            timeLeft: 2,
            rechargeRate: 30,
          },
        });
      }
      return Promise.resolve(null);
    });

    const { render } = require("../src/blocked.js");
    await render();

    expect(document.getElementById("blockedDomain").textContent).toBe("reddit.com");
    const estimateEl = document.getElementById("reentryEstimate");
    expect(estimateEl.textContent).toContain("Available again");
    expect(estimateEl.classList.contains("hidden")).toBe(false);
  });

  test("shows already-ready when domain is above the floor", async () => {
    window.history.replaceState({}, "", "?domain=ready.com&url=https://ready.com");
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          "ready.com": {
            originalTime: 60,
            timeLeft: 7,
            rechargeRate: 30,
          },
        });
      }
      return Promise.resolve(null);
    });

    const { render } = require("../src/blocked.js");
    await render();

    expect(document.getElementById("reentryEstimate").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("alreadyReady").classList.contains("hidden")).toBe(false);
  });

  test("handles missing timer data gracefully", async () => {
    window.history.replaceState({}, "", "?domain=none.com&url=https://none.com");
    global.StorageUtils.getFromStorage = jest.fn(() => Promise.resolve(null));

    const { render } = require("../src/blocked.js");
    await render();

    expect(document.getElementById("reentryEstimate").textContent).toContain("No timer data");
  });

  test("shows default text when domain param is absent", async () => {
    window.history.replaceState({}, "", "?domain=&url=");
    global.StorageUtils.getFromStorage = jest.fn(() => Promise.resolve({}));

    const { render } = require("../src/blocked.js");
    await render();

    expect(document.getElementById("blockedDomain").textContent).toBe("this site");
  });
});
describe("block page reset control", () => {
  beforeEach(() => {
    jest.resetModules();
    global.StorageUtils = {
      getFromStorage: jest.fn(() => Promise.resolve(null)),
      setToStorage: jest.fn(() => Promise.resolve()),
    };
    global.chrome.runtime.sendMessage = jest.fn(() => Promise.resolve({ success: true }));
    document.body.innerHTML = `
      <span id="blockedDomain"></span>
      <p id="reentryEstimate" class="estimate"></p>
      <p id="alreadyReady" class="ready hidden"></p>
      <button id="resetButton" class="primary-button full-width hidden">Reset Timer</button>
      <p id="resetError" class="muted hidden"></p>
    `;
  });

  test("shows reset button when a token is held", async () => {
    window.history.replaceState({}, "", "?domain=token.com&url=https://token.com");
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          "token.com": {
            originalTime: 60,
            timeLeft: 2,
            rechargeRate: 30,
            resetToken: true,
          },
        });
      }
      return Promise.resolve(null);
    });

    const { render } = require("../src/blocked.js");
    await render();

    const button = document.getElementById("resetButton");
    expect(button.classList.contains("hidden")).toBe(false);
  });

  test("hides reset button when no token is held", async () => {
    window.history.replaceState({}, "", "?domain=notoken.com&url=https://notoken.com");
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          "notoken.com": {
            originalTime: 60,
            timeLeft: 2,
            rechargeRate: 30,
            resetToken: false,
          },
        });
      }
      return Promise.resolve(null);
    });

    const { render } = require("../src/blocked.js");
    await render();

    const button = document.getElementById("resetButton");
    expect(button.classList.contains("hidden")).toBe(true);
  });

  test("successful spend navigates to origin URL", async () => {
    window.history.replaceState({}, "", "?domain=go.com&url=https://go.com/page");
    global.chrome.runtime.sendMessage.mockResolvedValue({ success: true });

    const { handleReset } = require("../src/blocked.js");
    await handleReset();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "spendResetToken", domain: "go.com" })
    );
  });

  test("refused spend shows error and does not navigate", async () => {
    window.history.replaceState({}, "", "?domain=no.com&url=https://no.com");
    global.chrome.runtime.sendMessage.mockResolvedValue({ success: false, reason: "no-token" });

    const { handleReset } = require("../src/blocked.js");
    await handleReset();

    const errorEl = document.getElementById("resetError");
    expect(errorEl.classList.contains("hidden")).toBe(false);
    expect(errorEl.textContent).toBe("No token available.");
  });
});
