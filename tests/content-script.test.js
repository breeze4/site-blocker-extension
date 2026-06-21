describe("content script blocking", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "<main>Allowed</main>";
    window.history.replaceState({}, "", "/current-page");
  });

  test("blocks the current domain when stored time left is non-finite", async () => {
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          localhost: {
            timeLeft: Infinity,
          },
        });
      }
      return Promise.resolve(null);
    });

    require("../src/content.js");
    await Promise.resolve();
    await Promise.resolve();

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
    expect(helpers.formatRemaining(-30)).toBe("0:00");
    expect(helpers.formatRemaining(NaN)).toBe("0:00");
  });

  test("remainingPercent is the clamped ratio of time left to original", () => {
    expect(helpers.remainingPercent(30, 60)).toBe(50);
    expect(helpers.remainingPercent(60, 60)).toBe(100);
    expect(helpers.remainingPercent(0, 60)).toBe(0);
    expect(helpers.remainingPercent(90, 60)).toBe(100);
    expect(helpers.remainingPercent(-5, 60)).toBe(0);
  });

  test("remainingPercent returns 0 for invalid inputs", () => {
    expect(helpers.remainingPercent(30, 0)).toBe(0);
    expect(helpers.remainingPercent(Infinity, 60)).toBe(0);
    expect(helpers.remainingPercent(30, NaN)).toBe(0);
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
