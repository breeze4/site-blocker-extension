/**
 * Unit tests for the popup's pure helper functions.
 */

const {
  isTrackableUrl,
  getDomainFromUrl,
  getInheritedRechargeRate,
  getInheritedTokenThreshold,
  getProgressPercent,
  DEFAULT_BLOCK_MINUTES,
  DEFAULT_RECHARGE_RATE,
} = require("../src/popup");

const { removeFromStorage } = require("../src/storage-utils");

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

  describe("getInheritedRechargeRate", () => {
    test("returns the rate from an existing domain", () => {
      const domainTimers = {
        "example.com": { rechargeRate: 8 },
        "other.com": { rechargeRate: 8 },
      };
      expect(getInheritedRechargeRate(domainTimers)).toBe(8);
    });

    test("falls back to the default with no domains", () => {
      expect(getInheritedRechargeRate({})).toBe(DEFAULT_RECHARGE_RATE);
      expect(getInheritedRechargeRate(null)).toBe(DEFAULT_RECHARGE_RATE);
    });

    test("skips domains with an invalid recharge rate", () => {
      const domainTimers = {
        "bad.com": { rechargeRate: 0 },
        "good.com": { rechargeRate: 1 },
      };
      expect(getInheritedRechargeRate(domainTimers)).toBe(1);
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

describe("removeFromStorage", () => {
  afterEach(() => {
    global.chrome.storage.local.remove.mockClear();
  });

  test("resolves for a single key", async () => {
    await expect(removeFromStorage("blockingPaused")).resolves.toBeUndefined();
    expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(
      "blockingPaused",
      expect.any(Function)
    );
  });

  test("resolves for an array of keys", async () => {
    await expect(removeFromStorage(["a", "b"])).resolves.toBeUndefined();
    expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(
      ["a", "b"],
      expect.any(Function)
    );
  });

  test("rejects when chrome.runtime.lastError is set", async () => {
    global.chrome.storage.local.remove.mockImplementationOnce((keys, callback) => {
      const originalLastError = global.chrome.runtime.lastError;
      global.chrome.runtime.lastError = { message: "storage failure" };
      try {
        callback();
      } finally {
        global.chrome.runtime.lastError = originalLastError;
      }
    });
    await expect(removeFromStorage("k")).rejects.toEqual({
      message: "storage failure",
    });
  });
});

describe("popup options link wiring", () => {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");

  test("the Open Options button calls chrome.runtime.openOptionsPage when clicked", async () => {
    document.body.innerHTML = `
      <div id="domainName"></div>
      <div id="timerSection" class="hidden"></div>
      <div id="notTrackedSection" class="hidden"></div>
      <div id="notTrackableSection" class="hidden"></div>
      <button id="openOptionsButton">Open Options</button>
    `;

    // Evaluate the popup script without a CommonJS module object so its
    // auto-run init() executes, as it does in the extension runtime.
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "popup.js"), "utf8");
    const sandbox = vm.createContext({
      chrome: { ...chrome, tabs: { query: () => Promise.resolve([]) } },
      document: window.document,
      window,
      setInterval: () => 0,
      console,
      URL,
    });
    vm.runInContext(source + "\n//# sourceURL=popup.test-eval.js", sandbox);

    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    document.getElementById("openOptionsButton").click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});

describe("getInheritedTokenThreshold", () => {
  test("returns 8 when no domains exist", () => {
    expect(getInheritedTokenThreshold({})).toBe(8);
    expect(getInheritedTokenThreshold(null)).toBe(8);
  });

  test("inherits threshold from an existing domain", () => {
    const dt = { "a.com": { tokenThresholdHours: 4 } };
    expect(getInheritedTokenThreshold(dt)).toBe(4);
  });

  test("skips domains with invalid thresholds", () => {
    const dt = { "a.com": { tokenThresholdHours: 3 }, "b.com": { tokenThresholdHours: 12 } };
    expect(getInheritedTokenThreshold(dt)).toBe(12);
  });

  test("falls back to 8 with no valid threshold", () => {
    const dt = { "a.com": { tokenThresholdHours: 0 } };
    expect(getInheritedTokenThreshold(dt)).toBe(8);
  });
});
