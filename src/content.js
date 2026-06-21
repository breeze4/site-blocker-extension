// content.js — injected into every page. Two jobs:
//   1. Block the page on load when the current domain's timer has already expired.
//   2. Show a lightweight, read-only overlay with the time remaining while the
//      domain is actively tracked, kept live via chrome.storage change events.
//
// The background service worker is the single writer that decrements `timeLeft`
// in storage each second, so the overlay just reflects storage — no polling.

const OVERLAY_HOST_ID = "stb-time-left-overlay";

// Resolve the hostname for the current page, or null if it can't be parsed.
function getCurrentDomain() {
  try {
    return new URL(window.location.href).hostname;
  } catch (error) {
    return null;
  }
}

// Compact countdown text: "M:SS" under an hour, "Hh MMm" at or above one hour.
function formatRemaining(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m`;
  }
  return `${minutes}:${pad(seconds)}`;
}

// Percent of the original allowance still remaining, clamped to 0..100.
function remainingPercent(timeLeft, originalTime) {
  if (!Number.isFinite(timeLeft) || !Number.isFinite(originalTime) || originalTime <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (timeLeft / originalTime) * 100));
}

// Green when ample, amber as it depletes, red when nearly out.
function urgencyColor(percent) {
  if (percent <= 15) {
    return "#ff5252";
  }
  if (percent <= 40) {
    return "#ffb300";
  }
  return "#4caf50";
}

// Create the overlay host (once) with an isolated Shadow DOM so page CSS can't
// touch it and it can't touch the page. Returns the host element.
function buildOverlay() {
  const host = document.createElement("div");
  host.id = OVERLAY_HOST_ID;
  // Positioning lives on the host (light DOM) so it stays out of page flow and
  // can't be overridden by the page's stylesheet reaching into the shadow root.
  host.style.cssText = [
    "position:fixed",
    "right:16px",
    "top:16px",
    "z-index:2147483647",
    "pointer-events:none",
    "margin:0",
    "padding:0",
    "border:0",
  ].join(";");

  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .pill {
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #ffffff;
        background: rgba(20, 20, 22, 0.82);
        border-radius: 10px;
        padding: 7px 11px 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
        min-width: 60px;
        text-align: left;
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
      }
      .time {
        display: block;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }
      .track {
        margin-top: 6px;
        height: 3px;
        width: 100%;
        background: rgba(255, 255, 255, 0.18);
        border-radius: 2px;
        overflow: hidden;
      }
      .fill {
        height: 100%;
        width: 0%;
        border-radius: 2px;
        transition: width 0.3s ease, background-color 0.3s ease;
      }
    </style>
    <div class="pill" role="status" aria-live="off">
      <span class="time"></span>
      <div class="track"><div class="fill"></div></div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(host);
  return host;
}

// Render (creating if needed) the overlay for the given timer values.
function renderOverlay(timeLeft, originalTime) {
  let host = document.getElementById(OVERLAY_HOST_ID);
  if (!host || !host.shadowRoot) {
    host = buildOverlay();
  }
  const root = host.shadowRoot;
  const percent = remainingPercent(timeLeft, originalTime);
  const timeEl = root.querySelector(".time");
  const fillEl = root.querySelector(".fill");
  if (timeEl) {
    timeEl.textContent = formatRemaining(timeLeft);
  }
  if (fillEl) {
    fillEl.style.width = `${percent}%`;
    fillEl.style.backgroundColor = urgencyColor(percent);
  }
}

function removeOverlay() {
  const host = document.getElementById(OVERLAY_HOST_ID);
  if (host) {
    host.remove();
  }
}

// Decide overlay visibility from current state. Shown only for a tracked domain
// with positive finite time left and while blocking is not paused.
function syncOverlay(domainTimers, paused) {
  const domain = getCurrentDomain();
  const timer = domain && domainTimers ? domainTimers[domain] : null;
  const active = timer && Number.isFinite(timer.timeLeft) && timer.timeLeft > 0;

  if (paused || !active) {
    removeOverlay();
    return;
  }
  renderOverlay(timer.timeLeft, timer.originalTime);
}

// On load: block an already-expired page, otherwise show the live overlay.
async function init() {
  try {
    const paused = (await StorageUtils.getFromStorage("blockingPaused")) === true;
    const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
    const domain = getCurrentDomain();
    const timer = domain ? domainTimers[domain] : null;

    // If this domain has a timer and it's already exhausted, block the page.
    if (!paused && timer && !(Number.isFinite(timer.timeLeft) && timer.timeLeft > 0)) {
      document.body.innerHTML = "<h1>Access Blocked</h1><p>Your time is up for this site.</p>";
      return;
    }

    syncOverlay(domainTimers, paused);
  } catch (error) {}
}

// Keep the overlay live without polling: the background rewrites domainTimers
// each second and toggles blockingPaused. Re-sync the overlay on either change.
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local" || (!changes.domainTimers && !changes.blockingPaused)) {
      return;
    }
    try {
      const paused = (await StorageUtils.getFromStorage("blockingPaused")) === true;
      const domainTimers = (await StorageUtils.getFromStorage("domainTimers")) || {};
      syncOverlay(domainTimers, paused);
    } catch (error) {}
  });
}

// Check domain status on page load.
init();

// Export pure helpers for unit testing (no-op in the extension runtime, where
// there is no CommonJS module object).
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatRemaining,
    remainingPercent,
    urgencyColor,
    getCurrentDomain,
  };
}
