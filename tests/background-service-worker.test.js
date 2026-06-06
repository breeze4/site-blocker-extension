const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBackgroundWithStorage(storage) {
  const listeners = {};
  const savedWrites = [];
  const intervals = [];
  const srcDir = path.join(__dirname, "..", "src");

  const chrome = {
    runtime: {
      getManifest: jest.fn(() => ({})),
      getURL: jest.fn((filePath) => `chrome-extension://fake-id/${filePath}`),
      lastError: null,
      onInstalled: {
        addListener: jest.fn((listener) => {
          listeners.installed = listener;
        }),
      },
      onMessage: {
        addListener: jest.fn((listener) => {
          listeners.message = listener;
        }),
      },
    },
    storage: {
      local: {
        get: jest.fn((key, callback) => {
          callback({ [key]: storage[key] });
        }),
        set: jest.fn((items, callback) => {
          savedWrites.push(items);
          Object.assign(storage, items);
          callback();
        }),
      },
    },
    tabs: {
      create: jest.fn(),
      get: jest.fn(),
      query: jest.fn(() => Promise.resolve([])),
      update: jest.fn(),
      onActivated: {
        addListener: jest.fn((listener) => {
          listeners.activated = listener;
        }),
      },
      onUpdated: {
        addListener: jest.fn((listener) => {
          listeners.updated = listener;
        }),
      },
      onRemoved: {
        addListener: jest.fn((listener) => {
          listeners.removed = listener;
        }),
      },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: {
        addListener: jest.fn((listener) => {
          listeners.focusChanged = listener;
        }),
      },
    },
  };

  const context = vm.createContext({
    chrome,
    console,
    URL,
    Date,
    Promise,
    clearInterval,
    setInterval: jest.fn((callback, delay) => {
      const interval = { callback, delay };
      intervals.push(interval);
      return interval;
    }),
  });

  context.globalThis = context;
  context.importScripts = (...files) => {
    files.forEach((file) => {
      const source = fs.readFileSync(path.join(srcDir, file), "utf8");
      vm.runInContext(source, context, { filename: file });
    });
  };

  const backgroundSource = fs.readFileSync(path.join(srcDir, "background.js"), "utf8");
  vm.runInContext(backgroundSource, context, { filename: "background.js" });

  return { chrome, context, intervals, listeners, savedWrites, storage };
}

describe("background service worker session accounting", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-05T12:00:05.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("startup repairs malformed top-level timer storage with defaults", async () => {
    const storage = {
      domainTimers: "corrupt",
      timeTracking: {},
    };

    const { savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const timerWrite = savedWrites.find((write) => write.domainTimers);

    expect(timerWrite).toBeDefined();
    expect(timerWrite.domainTimers["www.reddit.com"]).toMatchObject({
      originalTime: 60,
      timeLeft: 60,
      resetInterval: 24,
      expiredMessageLogged: false,
    });
    expect(finalStorage.domainTimers["www.reddit.com"]).toEqual(
      timerWrite.domainTimers["www.reddit.com"]
    );
  });

  test("startup repairs malformed top-level time tracking storage", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: "corrupt",
    };

    const { savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const trackingWrite = savedWrites.find((write) => write.timeTracking);

    expect(trackingWrite).toBeDefined();
    expect(trackingWrite.timeTracking).toEqual({});
    expect(finalStorage.timeTracking).toEqual({});
  });

  test("losing browser focus does not subtract time when a session start is in the future", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {},
          allTimeTotal: 60,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now() + 5000,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { chrome, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    await Promise.resolve();

    await listeners.focusChanged(chrome.windows.WINDOW_ID_NONE);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.allTimeTotal).toBe(60);
    expect(finalTimeTracking.dailyTotals["2026-06-05"]).toBe(0);
    expect(finalTimeTracking.currentSessionStart).toBeNull();
  });

  test("focus loss repairs malformed top-level time tracking storage at runtime", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {},
    };

    const { chrome, listeners, savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    savedWrites.length = 0;
    finalStorage.timeTracking = "corrupt";

    await listeners.focusChanged(chrome.windows.WINDOW_ID_NONE);

    const trackingWrite = savedWrites.find((write) => write.timeTracking);

    expect(trackingWrite).toBeDefined();
    expect(trackingWrite.timeTracking).toEqual({});
    expect(finalStorage.timeTracking).toEqual({});
  });

  test("losing browser focus does not preserve non-finite stored totals", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {
            "2026-06-05": Infinity,
          },
          allTimeTotal: Infinity,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { chrome, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    await Promise.resolve();

    await listeners.focusChanged(chrome.windows.WINDOW_ID_NONE);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.allTimeTotal).toBe(5);
    expect(finalTimeTracking.dailyTotals["2026-06-05"]).toBe(5);
    expect(finalTimeTracking.currentSessionStart).toBeNull();
  });

  test("idle session cleanup does not subtract time when last active is before session start", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {},
          allTimeTotal: 60,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now(),
          lastActiveTimestamp: Date.now() - 2 * 60 * 1000,
        },
      },
    };

    const { context, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await vm.runInContext("endIdleSessions()", context);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.allTimeTotal).toBe(60);
    expect(finalTimeTracking.dailyTotals["2026-06-05"]).toBe(0);
    expect(finalTimeTracking.currentSessionStart).toBeNull();
  });

  test("active timer ticks keep the session from being cleaned up as idle", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, context, intervals, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );
    expect(intervals).toHaveLength(2);

    jest.setSystemTime(new Date("2026-06-05T12:02:35.000Z"));
    chrome.tabs.query.mockResolvedValue([{ id: 1, active: true, url: "https://example.com/feed" }]);

    await intervals[1].callback();
    await vm.runInContext("endIdleSessions()", context);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.currentSessionStart).toBe(
      new Date("2026-06-05T12:00:05.000Z").getTime()
    );
    expect(finalTimeTracking.lastActiveTimestamp).toBe(Date.now());
  });

  test("idle cleanup does not close tracking while the domain has an active timer", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { context, intervals, listeners, savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );
    expect(intervals).toHaveLength(2);

    finalStorage.timeTracking["example.com"].lastActiveTimestamp =
      new Date("2026-06-05T12:00:00.000Z").getTime();
    jest.setSystemTime(new Date("2026-06-05T12:03:00.000Z"));

    await vm.runInContext("endIdleSessions()", context);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.currentSessionStart).toBe(
      new Date("2026-06-05T12:00:05.000Z").getTime()
    );
    expect(finalTimeTracking.allTimeTotal).toBe(0);
    expect(finalTimeTracking.dailyTotals).toEqual({});
  });

  test("all time analytics include the current active session", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {},
          allTimeTotal: 60,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { context } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const result = await vm.runInContext('calculateTimeSpent("example.com", "alltime")', context);

    expect(result).toBe(65);
  });

  test("rolling analytics ignore non-finite daily totals", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {
            "2026-06-05": Infinity,
          },
          allTimeTotal: 0,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: null,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { context } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const result = await vm.runInContext('calculateTimeSpent("example.com", "24h")', context);

    expect(result).toBe(0);
  });

  test("all time analytics ignore non-finite stored totals", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {},
          allTimeTotal: Infinity,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { context } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const result = await vm.runInContext('calculateTimeSpent("example.com", "alltime")', context);

    expect(result).toBe(5);
  });

  test("analytics ignore negative stored totals", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {
        "example.com": {
          dailyTotals: {
            "2026-06-05": -10,
          },
          allTimeTotal: -10,
          trackingStartDate: "2026-06-05",
          lastResetDate: "2026-06-05",
          currentSessionStart: Date.now() - 5000,
          lastActiveTimestamp: Date.now(),
        },
      },
    };

    const { context } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const last24h = await vm.runInContext('calculateTimeSpent("example.com", "24h")', context);
    const allTime = await vm.runInContext('calculateTimeSpent("example.com", "alltime")', context);

    expect(last24h).toBe(5);
    expect(allTime).toBe(5);
  });

  test("tab updates block domains with non-finite time left immediately", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: Infinity,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, intervals, listeners } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );

    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { url: "chrome://newtab" });
    expect(intervals).toHaveLength(1);
  });

  test("blocked domains do not start a time tracking session", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 0,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, listeners, savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );

    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { url: "chrome://newtab" });

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.currentSessionStart).toBeNull();
    expect(finalStorage.timeTracking["example.com"].currentSessionStart).toBeNull();
  });

  test("starting a timer repairs malformed tracking data for that domain", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {
        "example.com": "corrupt",
      },
    };

    const { listeners, savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking).toEqual({
      dailyTotals: {},
      allTimeTotal: 0,
      trackingStartDate: "2026-06-05",
      lastResetDate: "2026-06-05",
      currentSessionStart: Date.now(),
      lastActiveTimestamp: Date.now(),
    });
    expect(finalStorage.timeTracking["example.com"]).toEqual(finalTimeTracking);
  });

  test("malformed unrelated timer records do not stop a valid tab timer from starting", async () => {
    const storage = {
      domainTimers: {
        "broken.example.com": null,
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { intervals, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );

    expect(intervals).toHaveLength(2);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.currentSessionStart).toBe(Date.now());
    expect(finalTimeTracking.lastActiveTimestamp).toBe(Date.now());
  });

  test("active tab handling repairs malformed top-level timer storage at runtime", async () => {
    const storage = {
      domainTimers: {},
      timeTracking: {},
    };

    const { listeners, savedWrites, storage: finalStorage } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    savedWrites.length = 0;
    finalStorage.domainTimers = "corrupt";

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );

    const timerWrite = savedWrites.find((write) => write.domainTimers);

    expect(timerWrite).toBeDefined();
    expect(timerWrite.domainTimers).toEqual({});
    expect(finalStorage.domainTimers).toEqual({});
  });

  test("timer self-stop on active tab change ends the previous tracking session", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, intervals, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );
    expect(intervals).toHaveLength(2);

    jest.setSystemTime(new Date("2026-06-05T12:00:10.000Z"));
    chrome.tabs.query.mockResolvedValue([{ id: 2, url: "https://other.example/" }]);

    await intervals[1].callback();

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.allTimeTotal).toBe(5);
    expect(finalTimeTracking.dailyTotals["2026-06-05"]).toBe(5);
    expect(finalTimeTracking.currentSessionStart).toBeNull();
  });

  test("closing an inactive tab does not restart active tab tracking", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, intervals, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );
    expect(intervals).toHaveLength(2);

    jest.setSystemTime(new Date("2026-06-05T12:00:10.000Z"));
    chrome.tabs.query.mockResolvedValue([{ id: 1, active: true, url: "https://example.com/feed" }]);

    await listeners.removed(2, { windowId: 1, isWindowClosing: false });

    expect(intervals).toHaveLength(2);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking["example.com"];

    expect(finalTimeTracking.allTimeTotal).toBe(0);
    expect(finalTimeTracking.dailyTotals).toEqual({});
    expect(finalTimeTracking.currentSessionStart).toBe(new Date("2026-06-05T12:00:05.000Z").getTime());
  });

  test("a newer tab event is processed after an in-flight tab handler finishes", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
        "other.example": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, context, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const pendingGets = [];
    chrome.storage.local.get = jest.fn((key, callback) => {
      pendingGets.push({ key, callback });
    });

    const firstTabPromise = vm.runInContext(
      'handleTimerForTab({ id: 1, active: true, url: "https://example.com/feed" })',
      context
    );
    await Promise.resolve();
    expect(pendingGets).toHaveLength(1);

    const secondTabPromise = vm.runInContext(
      'handleTimerForTab({ id: 2, active: true, url: "https://other.example/feed" })',
      context
    );
    await secondTabPromise;

    let firstSettled = false;
    firstTabPromise.then(() => {
      firstSettled = true;
    });

    for (let i = 0; i < 100 && (!firstSettled || pendingGets.length > 0); i++) {
      if (pendingGets.length > 0) {
        const { key, callback } = pendingGets.shift();
        callback({ [key]: storage[key] });
      }
      for (let flush = 0; flush < 5; flush++) {
        await vm.runInContext("Promise.resolve()", context);
      }
      await Promise.resolve();
    }
    expect(firstSettled).toBe(true);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalTimeTracking = timeTrackingWrites.at(-1).timeTracking;

    expect(finalTimeTracking["example.com"].currentSessionStart).toBeNull();
    expect(finalTimeTracking["other.example"].currentSessionStart).toBe(Date.now());
  });

  test("focus loss during an in-flight tab handler prevents starting a stale timer", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, context, intervals, listeners, savedWrites } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    const pendingGets = [];
    chrome.storage.local.get = jest.fn((key, callback) => {
      pendingGets.push({ key, callback });
    });

    const tabPromise = vm.runInContext(
      'handleTimerForTab({ id: 1, active: true, url: "https://example.com/feed" })',
      context
    );
    await Promise.resolve();
    expect(pendingGets).toHaveLength(1);

    const focusPromise = listeners.focusChanged(chrome.windows.WINDOW_ID_NONE);
    await Promise.resolve();
    expect(pendingGets).toHaveLength(2);

    let tabSettled = false;
    let focusSettled = false;
    tabPromise.then(() => {
      tabSettled = true;
    });
    focusPromise.then(() => {
      focusSettled = true;
    });

    for (let i = 0; i < 100 && (!tabSettled || !focusSettled || pendingGets.length > 0); i++) {
      if (pendingGets.length > 0) {
        const { key, callback } = pendingGets.shift();
        callback({ [key]: storage[key] });
      }
      for (let flush = 0; flush < 5; flush++) {
        await vm.runInContext("Promise.resolve()", context);
      }
      await Promise.resolve();
    }

    expect(tabSettled).toBe(true);
    expect(focusSettled).toBe(true);
    expect(intervals).toHaveLength(1);

    const timeTrackingWrites = savedWrites.filter((write) => write.timeTracking);
    const finalWrite = timeTrackingWrites.at(-1);

    expect(finalWrite?.timeTracking?.["example.com"]?.currentSessionStart ?? null).toBeNull();
  });

  test("focus loss during an in-flight timer tick prevents stale countdown decrement", async () => {
    const storage = {
      domainTimers: {
        "example.com": {
          originalTime: 300,
          timeLeft: 300,
          resetInterval: 24,
          lastResetTimestamp: Date.now(),
          expiredMessageLogged: false,
        },
      },
      timeTracking: {},
    };

    const { chrome, intervals, listeners } = loadBackgroundWithStorage(storage);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    await listeners.updated(
      1,
      { status: "complete" },
      { id: 1, active: true, url: "https://example.com/feed" }
    );
    expect(intervals).toHaveLength(2);

    const pendingGets = [];
    chrome.storage.local.get = jest.fn((key, callback) => {
      pendingGets.push({ key, callback });
    });
    chrome.tabs.query.mockResolvedValue([{ id: 1, active: true, url: "https://example.com/feed" }]);

    const tickPromise = intervals[1].callback();
    for (let i = 0; i < 10 && pendingGets.length === 0; i++) {
      await Promise.resolve();
    }
    expect(pendingGets).toHaveLength(1);

    const focusPromise = listeners.focusChanged(chrome.windows.WINDOW_ID_NONE);
    for (let i = 0; i < 10 && pendingGets.length === 1; i++) {
      await Promise.resolve();
    }
    expect(pendingGets).toHaveLength(2);

    let tickSettled = false;
    let focusSettled = false;
    tickPromise.then(() => {
      tickSettled = true;
    });
    focusPromise.then(() => {
      focusSettled = true;
    });

    for (let i = 0; i < 100 && (!tickSettled || !focusSettled || pendingGets.length > 0); i++) {
      if (pendingGets.length > 0) {
        const { key, callback } = pendingGets.shift();
        callback({ [key]: storage[key] });
      }
      await Promise.resolve();
    }

    expect(tickSettled).toBe(true);
    expect(focusSettled).toBe(true);
    expect(storage.domainTimers["example.com"].timeLeft).toBe(300);
  });
});
