describe("content script block-tab messaging", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "<main>Allowed</main>";
    window.history.replaceState({}, {}, "/some/page");
    global.chrome.runtime.sendMessage = jest.fn();
  });

  test("sends blockTab message instead of replacing the body", async () => {
    global.chrome.runtime.sendMessage.mockResolvedValue({ success: true });
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          localhost: { timeLeft: 0 },
        });
      }
      return Promise.resolve(null);
    });

    require("../src/content.js");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "blockTab" })
    );
    // Body should NOT be replaced when the message succeeds.
    expect(document.body.textContent).not.toContain("Access Blocked");
  });

  test("falls back to replacing the page body when the message is rejected", async () => {
    global.chrome.runtime.sendMessage.mockRejectedValue(new Error("no listener"));
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          localhost: { timeLeft: 0 },
        });
      }
      return Promise.resolve(null);
    });

    require("../src/content.js");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Access Blocked");
    expect(document.body.textContent).toContain("Your time is up for this site.");
  });
});

describe("time-left overlay helpers", () => {
  let helpers;

  beforeEach(() => {
    jest.resetModules();
    helpers = require("../src/content.js");
  });

  test("formatRemaining shows M:SS under an hour", () => {
    expect(helpers.formatRemaining(90)).toBe("1:30");
    expect(helpers.formatRemaining(5)).toBe("0:05");
    expect(helpers.formatRemaining(0)).toBe("0:00");
  });

  test("formatRemaining shows Hh MMm at or above an hour", () => {
    expect(helpers.formatRemaining(3600)).toBe("1h 00m");
    expect(helpers.formatRemaining(3661)).toBe("1h 01m");
    expect(helpers.formatRemaining(7325)).toBe("2h 02m");
  });

  test("formatRemaining is safe for non-finite and negative input", () => {
    expect(helpers.formatRemaining(Infinity)).toBe("0:00");
    expect(helpers.formatRemaining(-1)).toBe("0:00");
    expect(helpers.formatRemaining(NaN)).toBe("0:00");
  });

  test("remainingPercent is the clamped ratio of time left to original", () => {
    expect(helpers.remainingPercent(50, 100)).toBe(50);
    expect(helpers.remainingPercent(0, 100)).toBe(0);
    expect(helpers.remainingPercent(100, 100)).toBe(100);
    expect(helpers.remainingPercent(150, 100)).toBe(100);
    expect(helpers.remainingPercent(-10, 100)).toBe(0);
  });

  test("remainingPercent returns 0 for invalid inputs", () => {
    expect(helpers.remainingPercent(50, 0)).toBe(0);
    expect(helpers.remainingPercent(NaN, 100)).toBe(0);
    expect(helpers.remainingPercent(50, NaN)).toBe(0);
    expect(helpers.remainingPercent(50, Infinity)).toBe(0);
  });

  test("urgencyColor escalates green -> amber -> red as time depletes", () => {
    expect(helpers.urgencyColor(100)).toBe("#4caf50");
    expect(helpers.urgencyColor(41)).toBe("#4caf50");
    expect(helpers.urgencyColor(40)).toBe("#ffb300");
    expect(helpers.urgencyColor(16)).toBe("#ffb300");
    expect(helpers.urgencyColor(15)).toBe("#ff5252");
    expect(helpers.urgencyColor(0)).toBe("#ff5252");
  });
});