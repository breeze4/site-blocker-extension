/**
 * Blocking hours: one optional daily window per domain, with an on/off toggle.
 * Dates use the local-time Date constructor so the tests pass in any time zone.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TimerUtils = require("../src/timer-utils.js");

// 2026-11-10 at the given local hour, minute, and second.
function at(hours, minutes, seconds = 0) {
  return new Date(2026, 10, 10, hours, minutes, seconds);
}

function timerWith(schedule, extra = {}) {
  return {
    originalTime: 300,
    timeLeft: 300,
    rechargeRate: 30,
    lastVisitTimestamp: Date.now(),
    expiredMessageLogged: false,
    isBlocked: false,
    ...extra,
    ...(schedule === undefined ? {} : { schedule }),
  };
}

const NINE_TO_FIVE = { enabled: true, start: "09:00", end: "17:00" };
const OVERNIGHT = { enabled: true, start: "22:00", end: "02:00" };

describe("parseTimeOfDay and formatTimeOfDay", () => {
  test("parses HH:MM into minutes after midnight", () => {
    expect(TimerUtils.parseTimeOfDay("00:00")).toBe(0);
    expect(TimerUtils.parseTimeOfDay("09:00")).toBe(540);
    expect(TimerUtils.parseTimeOfDay("9:05")).toBe(545);
    expect(TimerUtils.parseTimeOfDay("23:59")).toBe(1439);
  });

  test("rejects malformed and out-of-range values", () => {
    expect(TimerUtils.parseTimeOfDay("24:00")).toBeNull();
    expect(TimerUtils.parseTimeOfDay("12:60")).toBeNull();
    expect(TimerUtils.parseTimeOfDay("noon")).toBeNull();
    expect(TimerUtils.parseTimeOfDay("")).toBeNull();
    expect(TimerUtils.parseTimeOfDay(undefined)).toBeNull();
    expect(TimerUtils.parseTimeOfDay(540)).toBeNull();
  });

  test("formats minutes as a 12-hour clock", () => {
    expect(TimerUtils.formatTimeOfDay(0)).toBe("12:00 AM");
    expect(TimerUtils.formatTimeOfDay(540)).toBe("9:00 AM");
    expect(TimerUtils.formatTimeOfDay(720)).toBe("12:00 PM");
    expect(TimerUtils.formatTimeOfDay(1020)).toBe("5:00 PM");
    expect(TimerUtils.formatTimeOfDay(1439)).toBe("11:59 PM");
  });
});

describe("isWithinWindow", () => {
  test("a daytime window includes its start and excludes its end", () => {
    expect(TimerUtils.isWithinWindow(540, 1020, 539)).toBe(false);
    expect(TimerUtils.isWithinWindow(540, 1020, 540)).toBe(true);
    expect(TimerUtils.isWithinWindow(540, 1020, 1019)).toBe(true);
    expect(TimerUtils.isWithinWindow(540, 1020, 1020)).toBe(false);
  });

  test("a window across midnight covers both sides of midnight", () => {
    expect(TimerUtils.isWithinWindow(1320, 120, 1319)).toBe(false);
    expect(TimerUtils.isWithinWindow(1320, 120, 1320)).toBe(true);
    expect(TimerUtils.isWithinWindow(1320, 120, 1439)).toBe(true);
    expect(TimerUtils.isWithinWindow(1320, 120, 0)).toBe(true);
    expect(TimerUtils.isWithinWindow(1320, 120, 119)).toBe(true);
    expect(TimerUtils.isWithinWindow(1320, 120, 120)).toBe(false);
    expect(TimerUtils.isWithinWindow(1320, 120, 720)).toBe(false);
  });

  test("an equal start and end covers the whole day", () => {
    expect(TimerUtils.isWithinWindow(540, 540, 0)).toBe(true);
    expect(TimerUtils.isWithinWindow(540, 540, 1439)).toBe(true);
  });
});

describe("isBlockingActive and the toggle", () => {
  test("toggle on: active only inside 9:00-17:00 local time", () => {
    const timer = timerWith(NINE_TO_FIVE);
    expect(TimerUtils.isBlockingActive(timer, at(8, 59, 59))).toBe(false);
    expect(TimerUtils.isBlockingActive(timer, at(9, 0))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(16, 59, 59))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(17, 0))).toBe(false);
  });

  test("toggle on: a window across midnight", () => {
    const timer = timerWith(OVERNIGHT);
    expect(TimerUtils.isBlockingActive(timer, at(21, 59))).toBe(false);
    expect(TimerUtils.isBlockingActive(timer, at(23, 30))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(1, 59))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(2, 0))).toBe(false);
  });

  test("toggle off: active at all hours, whatever the window", () => {
    const timer = timerWith({ enabled: false, start: "09:00", end: "17:00" });
    expect(TimerUtils.isBlockingActive(timer, at(3, 0))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(12, 0))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, at(20, 0))).toBe(true);
  });

  test("an existing timer without a schedule stays active at all hours", () => {
    const timer = timerWith(undefined);
    expect(TimerUtils.isBlockingActive(timer, at(3, 0))).toBe(true);
    expect(TimerUtils.normalizeSchedule(timer)).toEqual({
      enabled: false,
      start: "09:00",
      end: "17:00",
      weekdaysOnly: false,
    });
  });

  test("a malformed schedule reads as off with the default window", () => {
    expect(TimerUtils.normalizeSchedule(timerWith("garbage"))).toEqual({
      enabled: false,
      start: "09:00",
      end: "17:00",
      weekdaysOnly: false,
    });
    expect(
      TimerUtils.normalizeSchedule(timerWith({ enabled: "yes", start: "25:00", end: 5 }))
    ).toEqual({ enabled: false, start: "09:00", end: "17:00", weekdaysOnly: false });
    expect(
      TimerUtils.normalizeSchedule(timerWith({ ...NINE_TO_FIVE, weekdaysOnly: "yes" })).weekdaysOnly
    ).toBe(false);
  });

  test("accepts a ms timestamp as well as a Date", () => {
    const timer = timerWith(NINE_TO_FIVE);
    expect(TimerUtils.isBlockingActive(timer, at(10, 0).getTime())).toBe(true);
  });
});

describe("getScheduleStatus and describeSchedule", () => {
  test("inside the window the next change is the end, today", () => {
    const status = TimerUtils.getScheduleStatus(timerWith(NINE_TO_FIVE), at(16, 0));
    expect(status.active).toBe(true);
    expect(status.nextChange.getTime()).toBe(at(17, 0).getTime());
    expect(status.msUntilChange).toBe(60 * 60 * 1000);
  });

  test("after the window the next change is tomorrow's start", () => {
    const status = TimerUtils.getScheduleStatus(timerWith(NINE_TO_FIVE), at(18, 0));
    expect(status.active).toBe(false);
    expect(status.nextChange.getTime()).toBe(new Date(2026, 10, 11, 9, 0).getTime());
  });

  test("inside an overnight window the end is the next morning", () => {
    const status = TimerUtils.getScheduleStatus(timerWith(OVERNIGHT), at(23, 0));
    expect(status.active).toBe(true);
    expect(status.nextChange.getTime()).toBe(new Date(2026, 10, 11, 2, 0).getTime());
  });

  test("no next change when the toggle is off", () => {
    const status = TimerUtils.getScheduleStatus(timerWith(undefined), at(12, 0));
    expect(status.nextChange).toBeNull();
    expect(status.msUntilChange).toBeNull();
  });

  test("describes when blocking ends or starts", () => {
    expect(TimerUtils.describeSchedule(timerWith(NINE_TO_FIVE), at(10, 0))).toBe(
      "Blocking hours 9:00 AM-5:00 PM. Blocking ends at 5:00 PM."
    );
    expect(TimerUtils.describeSchedule(timerWith(NINE_TO_FIVE), at(7, 0))).toBe(
      "Outside blocking hours (9:00 AM-5:00 PM). Blocking starts at 9:00 AM."
    );
    expect(TimerUtils.describeSchedule(timerWith(undefined), at(7, 0))).toBe("");
  });

  test("msUntilNextScheduleChange picks the soonest boundary across domains", () => {
    const timers = {
      "a.com": timerWith(NINE_TO_FIVE),
      "b.com": timerWith(OVERNIGHT),
      "c.com": timerWith(undefined),
    };
    // At 16:30 a.com ends at 17:00 and b.com starts at 22:00.
    expect(TimerUtils.msUntilNextScheduleChange(timers, at(16, 30))).toBe(30 * 60 * 1000);
    expect(TimerUtils.msUntilNextScheduleChange({ "c.com": timerWith(undefined) }, at(1, 0))).toBe(
      null
    );
  });
});

// 2026-11-10 is a Tuesday, so the 13th is a Friday, the 14th a Saturday, the
// 15th a Sunday, and the 16th a Monday.
function on(dayOfMonth, hours, minutes = 0) {
  return new Date(2026, 10, dayOfMonth, hours, minutes);
}

const WEEKDAY_NINE_TO_FIVE = { ...NINE_TO_FIVE, weekdaysOnly: true };
const WEEKDAY_OVERNIGHT = { ...OVERNIGHT, weekdaysOnly: true };
const WEEKDAY_ALL_DAY = { enabled: true, start: "09:00", end: "09:00", weekdaysOnly: true };

describe("weekdays only", () => {
  test("the fixture days are the weekdays the tests assume", () => {
    expect([13, 14, 15, 16].map((d) => on(d, 12).getDay())).toEqual([5, 6, 0, 1]);
  });

  test("active inside the window Monday to Friday, never on the weekend", () => {
    const timer = timerWith(WEEKDAY_NINE_TO_FIVE);
    for (const day of [9, 10, 11, 12, 13, 16]) {
      expect(TimerUtils.isBlockingActive(timer, on(day, 12))).toBe(true);
      expect(TimerUtils.isBlockingActive(timer, on(day, 8, 59))).toBe(false);
      expect(TimerUtils.isBlockingActive(timer, on(day, 17))).toBe(false);
    }
    for (const day of [14, 15]) {
      for (const hour of [0, 9, 12, 16, 23]) {
        expect(TimerUtils.isBlockingActive(timer, on(day, hour))).toBe(false);
      }
    }
  });

  test("weekdays only does nothing while the hours toggle is off", () => {
    const timer = timerWith({ ...WEEKDAY_NINE_TO_FIVE, enabled: false });
    expect(TimerUtils.isBlockingActive(timer, on(14, 12))).toBe(true);
    expect(TimerUtils.isBlockingActive(timer, on(14, 3))).toBe(true);
  });

  test("without weekdays only the weekend blocks as before", () => {
    expect(TimerUtils.isBlockingActive(timerWith(NINE_TO_FIVE), on(14, 12))).toBe(true);
  });

  test("an overnight window belongs to the day it starts", () => {
    const timer = timerWith(WEEKDAY_OVERNIGHT);
    expect(TimerUtils.isBlockingActive(timer, on(13, 23))).toBe(true); // Friday night
    expect(TimerUtils.isBlockingActive(timer, on(14, 1))).toBe(true); // Friday's window
    expect(TimerUtils.isBlockingActive(timer, on(14, 2))).toBe(false);
    expect(TimerUtils.isBlockingActive(timer, on(14, 23))).toBe(false); // Saturday night
    expect(TimerUtils.isBlockingActive(timer, on(15, 1))).toBe(false);
    expect(TimerUtils.isBlockingActive(timer, on(15, 23))).toBe(false); // Sunday night
    expect(TimerUtils.isBlockingActive(timer, on(16, 1))).toBe(false); // Sunday's window
    expect(TimerUtils.isBlockingActive(timer, on(16, 22))).toBe(true); // Monday night
  });

  test("after Friday's window the next change is Monday's start", () => {
    const timer = timerWith(WEEKDAY_NINE_TO_FIVE);
    for (const now of [on(13, 17), on(13, 18), on(14, 12), on(15, 23, 59)]) {
      const status = TimerUtils.getScheduleStatus(timer, now);
      expect(status.active).toBe(false);
      expect(status.nextChange.getTime()).toBe(on(16, 9).getTime());
      expect(status.msUntilChange).toBe(on(16, 9).getTime() - now.getTime());
    }
  });

  test("midweek the next change is the same as without weekdays only", () => {
    const timer = timerWith(WEEKDAY_NINE_TO_FIVE);
    expect(TimerUtils.getScheduleStatus(timer, on(10, 16)).nextChange.getTime()).toBe(
      on(10, 17).getTime()
    );
    expect(TimerUtils.getScheduleStatus(timer, on(10, 18)).nextChange.getTime()).toBe(
      on(11, 9).getTime()
    );
    expect(TimerUtils.getScheduleStatus(timer, on(13, 16)).nextChange.getTime()).toBe(
      on(13, 17).getTime()
    );
  });

  test("an overnight window on Friday ends Saturday morning, then waits for Monday night", () => {
    const timer = timerWith(WEEKDAY_OVERNIGHT);
    const friday = TimerUtils.getScheduleStatus(timer, on(14, 1));
    expect(friday.active).toBe(true);
    expect(friday.nextChange.getTime()).toBe(on(14, 2).getTime());
    const saturday = TimerUtils.getScheduleStatus(timer, on(14, 3));
    expect(saturday.active).toBe(false);
    expect(saturday.nextChange.getTime()).toBe(on(16, 22).getTime());
  });

  test("an equal start and end covers whole weekdays, midnight to midnight", () => {
    const timer = timerWith(WEEKDAY_ALL_DAY);
    const tuesday = TimerUtils.getScheduleStatus(timer, on(10, 3));
    expect(tuesday.active).toBe(true);
    expect(tuesday.nextChange.getTime()).toBe(on(14, 0).getTime());
    const saturday = TimerUtils.getScheduleStatus(timer, on(14, 12));
    expect(saturday.active).toBe(false);
    expect(saturday.nextChange.getTime()).toBe(on(16, 0).getTime());
  });

  test("the status always agrees with isBlockingActive at its next change", () => {
    for (const schedule of [WEEKDAY_NINE_TO_FIVE, WEEKDAY_OVERNIGHT, WEEKDAY_ALL_DAY, OVERNIGHT]) {
      const timer = timerWith(schedule);
      for (let hour = 0; hour < 24 * 9; hour++) {
        const now = new Date(2026, 10, 9, hour, 30);
        const status = TimerUtils.getScheduleStatus(timer, now);
        const justBefore = new Date(status.nextChange.getTime() - 60000);
        expect(TimerUtils.isBlockingActive(timer, justBefore)).toBe(status.active);
        expect(TimerUtils.isBlockingActive(timer, status.nextChange)).toBe(!status.active);
        expect(status.msUntilChange).toBeGreaterThan(0);
      }
    }
  });

  test("describes the weekdays range and names a day two or more days away", () => {
    const timer = timerWith(WEEKDAY_NINE_TO_FIVE);
    expect(TimerUtils.describeSchedule(timer, on(10, 10))).toBe(
      "Blocking hours 9:00 AM-5:00 PM, weekdays. Blocking ends at 5:00 PM."
    );
    expect(TimerUtils.describeSchedule(timer, on(10, 18))).toBe(
      "Outside blocking hours (9:00 AM-5:00 PM, weekdays). Blocking starts at 9:00 AM."
    );
    expect(TimerUtils.describeSchedule(timer, on(13, 18))).toBe(
      "Outside blocking hours (9:00 AM-5:00 PM, weekdays). Blocking starts Monday at 9:00 AM."
    );
    expect(TimerUtils.describeSchedule(timer, on(14, 12))).toBe(
      "Outside blocking hours (9:00 AM-5:00 PM, weekdays). Blocking starts Monday at 9:00 AM."
    );
    expect(TimerUtils.describeSchedule(timer, on(15, 12))).toBe(
      "Outside blocking hours (9:00 AM-5:00 PM, weekdays). Blocking starts at 9:00 AM."
    );
    expect(TimerUtils.describeSchedule(timerWith(WEEKDAY_ALL_DAY), on(10, 12))).toBe(
      "Blocking hours all day, weekdays. Blocking ends Saturday at 12:00 AM."
    );
  });

  test("msUntilNextScheduleChange skips the weekend", () => {
    const timers = { "a.com": timerWith(WEEKDAY_NINE_TO_FIVE) };
    expect(TimerUtils.msUntilNextScheduleChange(timers, on(14, 9))).toBe(48 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Worker behavior at the start and end of blocking hours.
// ---------------------------------------------------------------------------

function loadBackground(storage) {
  const listeners = {};
  const intervals = [];
  const srcDir = path.join(__dirname, "..", "src");

  const chrome = {
    runtime: {
      getManifest: jest.fn(() => ({})),
      getURL: jest.fn((filePath) => `chrome-extension://fake-id/${filePath}`),
      lastError: null,
      onInstalled: { addListener: jest.fn() },
      onMessage: { addListener: jest.fn((l) => (listeners.message = l)) },
    },
    storage: {
      local: {
        get: jest.fn((key, callback) => callback({ [key]: storage[key] })),
        set: jest.fn((items, callback) => {
          Object.assign(storage, items);
          callback();
        }),
        remove: jest.fn((keys, callback) => callback && callback()),
      },
      onChanged: { addListener: jest.fn() },
    },
    tabs: {
      create: jest.fn(),
      get: jest.fn(),
      query: jest.fn(() => Promise.resolve([])),
      update: jest.fn(),
      onActivated: { addListener: jest.fn() },
      onUpdated: { addListener: jest.fn((l) => (listeners.updated = l)) },
      onRemoved: { addListener: jest.fn() },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      get: jest.fn(async () => ({ focused: true })),
      onFocusChanged: { addListener: jest.fn() },
    },
    alarms: {
      create: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve(true)),
      onAlarm: { addListener: jest.fn((l) => (listeners.alarm = l)) },
    },
  };

  const context = vm.createContext({
    chrome,
    console,
    URL,
    URLSearchParams,
    Date,
    Promise,
    crypto: require("crypto").webcrypto,
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
      vm.runInContext(fs.readFileSync(path.join(srcDir, file), "utf8"), context, {
        filename: file,
      });
    });
  };
  vm.runInContext(fs.readFileSync(path.join(srcDir, "background.js"), "utf8"), context, {
    filename: "background.js",
  });
  return { chrome, context, intervals, listeners, storage };
}

async function flush() {
  for (let i = 0; i < 100; i++) {
    await Promise.resolve();
  }
}

const TAB = { id: 1, active: true, windowId: 1, url: "https://example.com/feed" };

describe("worker and blocking hours", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("outside the window an exhausted domain is not blocked and nothing counts down", async () => {
    jest.setSystemTime(at(8, 0));
    const { chrome, intervals, listeners, storage } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 0, isBlocked: true }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(intervals).toHaveLength(1); // only the idle sweep
    expect(storage.timeTracking["example.com"]).toBeUndefined();
  });

  test("outside the window a domain with time left does not count down", async () => {
    jest.setSystemTime(at(18, 0));
    const { intervals, listeners, storage } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 120 }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(intervals).toHaveLength(1);
    expect(storage.domainTimers["example.com"].timeLeft).toBe(120);
  });

  test("inside the window an exhausted domain is blocked as before", async () => {
    jest.setSystemTime(at(10, 0));
    const { chrome, listeners } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 0 }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(chrome.tabs.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ url: expect.stringContaining("blocked.html?") })
    );
  });

  test("weekdays only: on Saturday an exhausted domain is open during the window hours", async () => {
    jest.setSystemTime(on(14, 12));
    const { chrome, intervals, listeners, storage } = loadBackground({
      domainTimers: {
        "example.com": timerWith(WEEKDAY_NINE_TO_FIVE, { timeLeft: 0, isBlocked: true }),
      },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(intervals).toHaveLength(1); // only the idle sweep
    expect(storage.timeTracking["example.com"]).toBeUndefined();
    // The boundary alarm waits for Monday 09:00, plus one second.
    const [, alarmInfo] = chrome.alarms.create.mock.calls[0];
    expect(alarmInfo.when).toBe(on(16, 9).getTime() + 1000);
  });

  test("weekdays only: on Friday an exhausted domain is blocked inside the window", async () => {
    jest.setSystemTime(on(13, 12));
    const { chrome, listeners } = loadBackground({
      domainTimers: {
        "example.com": timerWith(WEEKDAY_NINE_TO_FIVE, { timeLeft: 0, isBlocked: true }),
      },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(chrome.tabs.update).toHaveBeenCalled();
  });

  test("toggle off blocks an exhausted domain at any hour", async () => {
    jest.setSystemTime(at(3, 0));
    const { chrome, listeners } = loadBackground({
      domainTimers: {
        "example.com": timerWith({ enabled: false, start: "09:00", end: "17:00" }, { timeLeft: 0 }),
      },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);

    expect(chrome.tabs.update).toHaveBeenCalled();
  });

  test("the countdown stops when the window ends during a visit", async () => {
    jest.setSystemTime(at(16, 59, 50));
    const { chrome, context, intervals, listeners, storage } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 120 }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);
    expect(intervals).toHaveLength(2);
    chrome.tabs.query.mockResolvedValue([TAB]);

    await intervals[1].callback();
    expect(storage.domainTimers["example.com"].timeLeft).toBe(119);

    jest.setSystemTime(at(17, 0, 1));
    await intervals[1].callback();

    expect(storage.domainTimers["example.com"].timeLeft).toBe(119);
    expect(vm.runInContext("activeTimerIntervalId", context)).toBeNull();
  });

  test("startup sets an alarm for the next window boundary", async () => {
    jest.setSystemTime(at(8, 0));
    const { chrome } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE) },
      timeTracking: {},
    });
    await flush();

    expect(chrome.alarms.create).toHaveBeenCalledWith("blockingHoursBoundary", {
      when: at(9, 0, 1).getTime(),
    });
  });

  test("no alarm when no domain has blocking hours on", async () => {
    jest.setSystemTime(at(8, 0));
    const { chrome } = loadBackground({
      domainTimers: { "example.com": timerWith(undefined) },
      timeTracking: {},
    });
    await flush();

    expect(chrome.alarms.clear).toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  test("at window start the alarm blocks an open tab on an exhausted domain", async () => {
    jest.setSystemTime(at(8, 59, 30));
    const { chrome, listeners } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 0, isBlocked: true }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);
    expect(chrome.tabs.update).not.toHaveBeenCalled();

    jest.setSystemTime(at(9, 0, 1));
    chrome.tabs.query.mockResolvedValue([TAB]);
    chrome.alarms.create.mockClear();
    await listeners.alarm({ name: "blockingHoursBoundary" });

    expect(chrome.tabs.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ url: expect.stringContaining("blocked.html?") })
    );
    // The next boundary is the window end at 17:00.
    expect(chrome.alarms.create).toHaveBeenCalledWith("blockingHoursBoundary", {
      when: at(17, 0, 1).getTime(),
    });
  });

  test("at window start the alarm starts the countdown for an open tab", async () => {
    jest.setSystemTime(at(8, 59, 30));
    const { chrome, intervals, listeners } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 120 }) },
      timeTracking: {},
    });
    await flush();

    await listeners.updated(1, { status: "complete" }, TAB);
    expect(intervals).toHaveLength(1);

    jest.setSystemTime(at(9, 0, 1));
    chrome.tabs.query.mockResolvedValue([TAB]);
    await listeners.alarm({ name: "blockingHoursBoundary" });

    expect(intervals).toHaveLength(2);
  });

  test("a blockTab request outside the window is refused", async () => {
    jest.setSystemTime(at(20, 0));
    const { chrome, listeners } = loadBackground({
      domainTimers: { "example.com": timerWith(NINE_TO_FIVE, { timeLeft: 0 }) },
      timeTracking: {},
    });
    await flush();

    const sendResponse = jest.fn();
    await listeners.message(
      { action: "blockTab", domain: "example.com", url: TAB.url },
      { tab: { id: 1 } },
      sendResponse
    );

    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      reason: "outside-blocking-hours",
    });
  });
});

// ---------------------------------------------------------------------------
// Block page when the window ends.
// ---------------------------------------------------------------------------

describe("block page and blocking hours", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    require("./setup");
    global.TimerUtils = TimerUtils;
    document.body.innerHTML = `
      <span id="blockedDomain"></span>
      <p id="reentryEstimate"></p>
      <p id="alreadyReady" class="hidden"></p>
      <p id="hoursOver" class="hidden"><a id="openSiteLink" href="#">Open the site</a></p>
      <p id="scheduleStatus" class="hidden"></p>
      <button id="resetButton" class="hidden"></button>
      <p id="resetError" class="hidden"></p>
    `;
    window.history.replaceState({}, "", "?domain=example.com&url=https://example.com/feed");
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.TimerUtils;
  });

  function mockTimers(timer) {
    global.StorageUtils = {
      getFromStorage: jest.fn(() => Promise.resolve({ "example.com": timer })),
      setToStorage: jest.fn(() => Promise.resolve()),
    };
  }

  test("inside the window it says when blocking ends", async () => {
    jest.setSystemTime(at(10, 0));
    mockTimers(timerWith(NINE_TO_FIVE, { timeLeft: 0 }));
    const page = require("../src/blocked.js");
    await page.render();

    expect(document.getElementById("scheduleStatus").textContent).toContain(
      "Blocking ends at 5:00 PM"
    );
    expect(document.getElementById("hoursOver").classList.contains("hidden")).toBe(true);
  });

  test("when the window ends the page offers the site again without a reload", async () => {
    jest.setSystemTime(at(16, 59, 0));
    mockTimers(timerWith(NINE_TO_FIVE, { timeLeft: 0 }));
    const page = require("../src/blocked.js");
    await page.render();
    expect(document.getElementById("hoursOver").classList.contains("hidden")).toBe(true);

    // The page armed a re-render for 17:00:01.
    jest.advanceTimersByTime(61 * 1000);
    await flush();

    expect(document.getElementById("hoursOver").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("openSiteLink").getAttribute("href")).toBe(
      "https://example.com/feed"
    );
    expect(document.getElementById("reentryEstimate").classList.contains("hidden")).toBe(true);
  });
});
