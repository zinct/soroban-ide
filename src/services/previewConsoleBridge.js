/**
 * Capture console output, UI actions, network calls, and runtime errors from
 * the in-IDE preview iframe and forward them to the parent IDE terminal panel.
 */

export const PREVIEW_LOG_MESSAGE = "soroban:previewLog";

/** Injected into every preview HTML document before the app bundle loads. */
export const PREVIEW_CONSOLE_SCRIPT = `<script>
(function(){
  var LOG_TYPE = ${JSON.stringify(PREVIEW_LOG_MESSAGE)};

  function formatArg(value) {
    if (value == null) return String(value);
    if (value instanceof Error) return value.stack || value.message || String(value);
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch (e) { return String(value); }
    }
    return String(value);
  }

  function postLog(level, message) {
    if (!message) return;
    try {
      window.parent.postMessage({
        source: "soroban-preview",
        type: LOG_TYPE,
        level: level,
        message: message,
        timestamp: Date.now()
      }, "*");
    } catch (e) { /* ignore */ }
  }

  window.__sorobanPreviewLog = postLog;

  function showPreviewError(msg) {
    if (!msg) return;
    postLog("error", msg);
    var el = document.getElementById("__soroban_preview_err__");
    if (!el) {
      el = document.createElement("div");
      el.id = "__soroban_preview_err__";
      el.style.cssText = "position:fixed;inset:16px;z-index:99999;padding:16px 18px;background:rgba(26,0,0,0.96);border:1px solid #f85149;border-radius:10px;color:#fca5a5;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;white-space:pre-wrap;pointer-events:auto;";
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = (el.textContent ? el.textContent + "\\n\\n" : "") + msg;
  }

  function describeClickTarget(el) {
    if (!el || !el.tagName) return null;
    var tag = el.tagName.toLowerCase();
    var text = (el.innerText || el.textContent || el.value || "").replace(/\\s+/g, " ").trim();
    if (text.length > 80) text = text.slice(0, 77) + "...";
    var id = el.id ? "#" + el.id : "";
    var role = el.getAttribute && el.getAttribute("role");
    if (tag === "button" || role === "button") return "button" + id + (text ? ': "' + text + '"' : "");
    if (tag === "a") return "link" + id + (text ? ': "' + text + '"' : "");
    if (tag === "input" && (el.type === "submit" || el.type === "button")) {
      return "input[" + el.type + "]" + id + (text ? ': "' + text + '"' : "");
    }
    var clickable = el.closest && el.closest("button, a, [role=button], label");
    if (clickable && clickable !== el) return describeClickTarget(clickable);
    return null;
  }

  function installUiActionLogging() {
    document.addEventListener("click", function(e) {
      if (e.target && e.target.closest && e.target.closest("#__soroban_preview_err__")) return;
      var desc = describeClickTarget(e.target);
      if (desc) postLog("info", "[ui] click " + desc);
    }, true);

    document.addEventListener("submit", function(e) {
      var form = e.target;
      var name = form && (form.getAttribute("name") || form.id || "form");
      postLog("info", "[ui] submit " + name);
    }, true);

    document.addEventListener("change", function(e) {
      var el = e.target;
      if (!el || !el.tagName) return;
      var tag = el.tagName.toLowerCase();
      if (tag === "select" || (tag === "input" && el.type !== "hidden")) {
        var label = el.name || el.id || tag;
        var val = (el.value || "").slice(0, 40);
        postLog("info", "[ui] change " + label + (val ? ' → "' + val + '"' : ""));
      }
    }, true);
  }

  function installNetworkLogging() {
    if (typeof window.fetch === "function") {
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === "string" ? input : (input && input.url) || String(input);
        var method = ((init && init.method) || "GET").toUpperCase();
        var short = url.length > 100 ? url.slice(0, 97) + "..." : url;
        postLog("info", "[network] " + method + " " + short);
        return origFetch.apply(this, arguments).then(function(res) {
          postLog(res.ok ? "info" : "warn", "[network] " + res.status + " " + method + " " + short);
          return res;
        }).catch(function(err) {
          postLog("error", "[network] failed " + method + " " + short + ": " + (err && err.message ? err.message : err));
          throw err;
        });
      };
    }
  }

  ["log", "info", "warn", "error", "debug"].forEach(function(level) {
    var original = console[level];
    console[level] = function() {
      var message = Array.prototype.map.call(arguments, formatArg).join(" ");
      postLog(level, message);
      if (original) return original.apply(console, arguments);
    };
  });

  window.addEventListener("error", function(e) {
    showPreviewError((e.error && e.error.stack) || e.message || "Script error");
  });

  window.addEventListener("unhandledrejection", function(e) {
    var r = e.reason;
    showPreviewError((r && r.stack) || (r && r.message) || String(r || "Unhandled promise rejection"));
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      installUiActionLogging();
    });
  } else {
    installUiActionLogging();
  }
  installNetworkLogging();

  postLog("info", "[preview] Activity logging on — UI actions, network, console, and wallet calls appear in the Preview terminal tab.");
})();
</script>`;

/** Dispatch a preview log line into the IDE terminal panel. */
export function dispatchPreviewLog(detail) {
  window.dispatchEvent(new CustomEvent("soroban:previewLog", { detail }));
}

/** Format a preview log entry for the terminal history list. */
export function formatPreviewLogEntry(detail) {
  const level = (detail?.level || "log").toLowerCase();
  const message = detail?.message || "";
  let prefix = "›";
  if (level === "error") prefix = "✖";
  else if (level === "warn") prefix = "⚠";
  else if (level === "debug") prefix = "·";
  else if (/^\[ui\]/i.test(message)) prefix = "◆";
  else if (/^\[wallet\]/i.test(message)) prefix = "🔑";
  else if (/^\[network\]/i.test(message)) prefix = "↗";

  const ts = detail?.timestamp
    ? new Date(detail.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return {
    type: level === "error" ? "error" : level === "warn" ? "info" : "output",
    content: ts ? `[${ts}] ${prefix} ${message}` : `${prefix} ${message}`,
    source: "preview",
  };
}

/** Log from the IDE parent (wallet bridge, build events, etc.). */
export function logPreviewActivity(message, level = "info") {
  dispatchPreviewLog({ level, message, timestamp: Date.now() });
}
