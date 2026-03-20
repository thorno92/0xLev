/**
 * Browser Debug Collector
 * Captures console logs, network requests, and UI events during development.
 * Data is periodically sent to /__dev__/logs
 */
(function () {
  "use strict";

  if (window.__DEBUG_COLLECTOR__) return;

  // ── Configuration ──
  const CONFIG = {
    flushInterval: 3000,
    maxBatchSize: 50,
    reportEndpoint: "/__dev__/logs",
  };

  // ── Buffers ──
  const consoleLogs = [];
  const networkRequests = [];
  const sessionEvents = [];

  // ── Helpers ──
  function sanitizeValue(val, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 3) return "[nested]";
    if (val === null || val === undefined) return val;
    if (typeof val === "string") return val.length > 500 ? val.slice(0, 500) + "..." : val;
    if (typeof val === "number" || typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.slice(0, 10).map(function (v) { return sanitizeValue(v, depth + 1); });
    if (typeof val === "object") {
      var out = {};
      var keys = Object.keys(val).slice(0, 20);
      for (var i = 0; i < keys.length; i++) {
        out[keys[i]] = sanitizeValue(val[keys[i]], depth + 1);
      }
      return out;
    }
    return String(val);
  }

  function tryParseJson(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
  }

  function safeStringify(obj) {
    try { return JSON.stringify(obj); } catch (e) { return String(obj); }
  }

  // ── Console Capture ──
  var origConsole = {};
  ["log", "warn", "error", "info", "debug"].forEach(function (level) {
    origConsole[level] = console[level];
    console[level] = function () {
      origConsole[level].apply(console, arguments);
      try {
        var args = Array.prototype.slice.call(arguments).map(function (a) {
          if (a instanceof Error) return { message: a.message, stack: a.stack };
          return sanitizeValue(a);
        });
        consoleLogs.push({
          level: level,
          args: args,
          timestamp: Date.now(),
        });
        if (consoleLogs.length > CONFIG.maxBatchSize * 2) {
          consoleLogs.splice(0, consoleLogs.length - CONFIG.maxBatchSize);
        }
      } catch (e) { /* ignore */ }
    };
  });

  // ── Error Capture ──
  window.addEventListener("error", function (event) {
    consoleLogs.push({
      level: "error",
      args: [{
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null,
      }],
      timestamp: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    consoleLogs.push({
      level: "error",
      args: [{
        type: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : null,
      }],
      timestamp: Date.now(),
    });
  });

  // ── UI Event Capture ──
  function isRecordable(target) {
    if (!target || !target.closest) return true;
    return !target.closest(".no-record");
  }

  function getSelector(el) {
    if (!el || !el.tagName) return "";
    var parts = [];
    while (el && el.tagName && parts.length < 5) {
      var tag = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(tag + "#" + el.id); break; }
      var cls = el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
      parts.unshift(tag + cls);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  try {
    document.addEventListener("click", function (e) {
      if (!isRecordable(e.target)) return;
      sessionEvents.push({
        type: "click",
        selector: getSelector(e.target),
        text: (e.target.textContent || "").slice(0, 50),
        timestamp: Date.now(),
      });
    }, true);

    document.addEventListener("focusin", function (e) {
      if (!isRecordable(e.target)) return;
      sessionEvents.push({
        type: "focus",
        selector: getSelector(e.target),
        tagName: e.target.tagName,
        timestamp: Date.now(),
      });
    }, true);

    // Navigation tracking
    var lastUrl = location.href;
    var navObserver = new MutationObserver(function () {
      if (location.href !== lastUrl) {
        sessionEvents.push({
          type: "navigation",
          from: lastUrl,
          to: location.href,
          timestamp: Date.now(),
        });
        lastUrl = location.href;
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.warn("[Debug] Failed to install UI listeners:", e);
  }

  // ── Fetch Capture ──
  var origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    var opts = arguments[1] || {};
    if (typeof url === "object" && url.url) url = url.url;
    if (typeof url === "string" && url.indexOf("/__dev__/") === 0) {
      return origFetch.apply(window, arguments);
    }

    var startTime = Date.now();
    var method = (opts.method || "GET").toUpperCase();

    return origFetch.apply(window, arguments).then(function (response) {
      networkRequests.push({
        timestamp: startTime,
        type: "fetch",
        method: method,
        url: typeof url === "string" ? url : String(url),
        request: { body: opts.body ? sanitizeValue(tryParseJson(String(opts.body))) : null },
        response: { status: response.status, statusText: response.statusText },
        duration: Date.now() - startTime,
      });
      return response;
    }).catch(function (error) {
      networkRequests.push({
        timestamp: startTime,
        type: "fetch",
        method: method,
        url: typeof url === "string" ? url : String(url),
        request: { body: opts.body ? sanitizeValue(tryParseJson(String(opts.body))) : null },
        error: { message: error.message },
        duration: Date.now() - startTime,
      });
      throw error;
    });
  };

  // ── XHR Capture ──
  var XHR = XMLHttpRequest.prototype;
  var origOpen = XHR.open;
  var origSend = XHR.send;

  XHR.open = function (method, url) {
    this._debugData = { method: method, url: url };
    return origOpen.apply(this, arguments);
  };

  XHR.send = function (body) {
    var xhr = this;
    if (
      xhr._debugData &&
      xhr._debugData.url &&
      xhr._debugData.url.indexOf("/__dev__/") !== 0
    ) {
      xhr._debugData.startTime = Date.now();
      xhr._debugData.requestBody = body ? sanitizeValue(tryParseJson(body)) : null;

      xhr.addEventListener("load", function () {
        try {
          networkRequests.push({
            timestamp: xhr._debugData.startTime,
            type: "xhr",
            method: xhr._debugData.method,
            url: xhr._debugData.url,
            request: { body: xhr._debugData.requestBody },
            response: {
              status: xhr.status,
              statusText: xhr.statusText,
              body: sanitizeValue(tryParseJson(xhr.responseText)),
            },
            duration: Date.now() - xhr._debugData.startTime,
          });
        } catch (e) { /* ignore */ }
      });

      xhr.addEventListener("error", function () {
        try {
          networkRequests.push({
            timestamp: xhr._debugData.startTime,
            type: "xhr",
            method: xhr._debugData.method,
            url: xhr._debugData.url,
            request: { body: xhr._debugData.requestBody },
            error: { message: "XHR network error" },
            duration: Date.now() - xhr._debugData.startTime,
          });
        } catch (e) { /* ignore */ }
      });
    }
    return origSend.apply(this, arguments);
  };

  // ── Flush ──
  function flush() {
    if (consoleLogs.length === 0 && networkRequests.length === 0 && sessionEvents.length === 0) {
      return;
    }

    var payload = {
      consoleLogs: consoleLogs.splice(0, CONFIG.maxBatchSize),
      networkRequests: networkRequests.splice(0, CONFIG.maxBatchSize),
      sessionEvents: sessionEvents.splice(0, CONFIG.maxBatchSize),
    };

    try {
      origFetch.call(window, CONFIG.reportEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify(payload),
        keepalive: true,
      }).catch(function () { /* ignore flush errors */ });
    } catch (e) { /* ignore */ }
  }

  setInterval(flush, CONFIG.flushInterval);
  window.addEventListener("beforeunload", flush);

  window.__DEBUG_COLLECTOR__ = {
    flush: flush,
    getBufferSizes: function () {
      return { console: consoleLogs.length, network: networkRequests.length, session: sessionEvents.length };
    },
  };

  console.debug("[Debug] Debug collector initialized");
})();
