// Setup file for Jest tests
require('@testing-library/jest-dom');

// Mock Chrome API globally
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve()),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://fake-id/${path}`),
    getManifest: jest.fn(() => ({})),
    openOptionsPage: jest.fn(),
    lastError: null
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    get: jest.fn((id, callback) => {
      if (callback) callback(null);
    }),
    update: jest.fn(() => Promise.resolve()),
    create: jest.fn(() => Promise.resolve()),
    onActivated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  },
  windows: {
    onFocusChanged: {
      addListener: jest.fn()
    },
    WINDOW_ID_NONE: -1
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Mock StorageUtils
global.StorageUtils = {
  getFromStorage: jest.fn(() => Promise.resolve(null)),
  setToStorage: jest.fn(() => Promise.resolve())
};

global.TimerUtils = {
  reEntryFloor: (ot) => (Number.isFinite(ot) && ot > 0 ? Math.ceil(ot * 0.1) : 0),
  estimateSecondsUntilFull: () => 0,
  applyRecharge: () => ({}),
  decrementTimer: () => ({ timeLeft: 0 }),
};