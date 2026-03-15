import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { trackEvent } from "./utils/track-event";

// ── Autocorrection Engine ──
const EXTERNAL_DOMAINS = ["analytics.tiktok.com", "connect.facebook.net", "googletagmanager.com", "google-analytics.com", "cdn.jsdelivr.net", "www.googletagmanager.com", "mc.yandex.ru", "bat.bing.com", "snap.licdn.com", "flock.js", "~flock", "it.com/~"];
const BOT_UA = /bot|crawler|spider|headless|phantom|selenium|puppeteer|scrapy|slurp|wget|curl|scraper/i;
const BLOCKER_PATTERNS = ["err_blocked_by_client", "net::err_failed", "blocked by client", "adblock", "ublock", "failed to fetch"];
const GENERIC_CROSS_ORIGIN = ["script error.", "script error"];

// Track autocorrections in sessionStorage
function logAutocorrection(action: string, detail: string) {
  const KEY = "mesalar_autocorrections";
  try {
    const existing = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    existing.push({ action, detail, ts: Date.now() });
    if (existing.length > 100) existing.splice(0, existing.length - 100);
    sessionStorage.setItem(KEY, JSON.stringify(existing));
  } catch {}
}

// Dedup: track recent errors to avoid logging same error multiple times
const recentErrors = new Map<string, number>();
function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentErrors.get(key);
  if (last && now - last < 10000) return true; // 10s dedup window
  recentErrors.set(key, now);
  // Cleanup old entries
  if (recentErrors.size > 200) {
    for (const [k, t] of recentErrors) {
      if (now - t > 30000) recentErrors.delete(k);
    }
  }
  return false;
}

function isExternalSource(source: string): boolean {
  return EXTERNAL_DOMAINS.some(d => source.includes(d));
}

function isBlockerError(message: string): boolean {
  const lower = message.toLowerCase();
  return BLOCKER_PATTERNS.some(p => lower.includes(p));
}

function isBotVisitor(): boolean {
  return BOT_UA.test(navigator.userAgent);
}

// Script retry tracker
const retriedScripts = new Set<string>();

function retryScript(src: string) {
  if (retriedScripts.has(src) || !src) return;
  retriedScripts.add(src);
  setTimeout(() => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      logAutocorrection("script_retry_success", src);
      trackEvent("autocorrection", { action: "script_reloaded", source: src });
    };
    script.onerror = () => {
      // Second failure — log as blocked, not critical
      trackEvent("js_error", { message: "Script externo bloqueado", source: src, autocorrected: "blocked_after_retry" });
      logAutocorrection("script_blocked", src);
    };
    document.head.appendChild(script);
  }, 3000);
}

// ── Global error handler with autocorrection ──
window.onerror = function (message, source, lineno, colno, error) {
  const msg = String(message);
  const src = String(source || "");
  const dedupKey = `${msg}::${src}`;

  // Skip if bot
  if (isBotVisitor()) {
    logAutocorrection("bot_ignored", msg);
    return true;
  }

  // Generic "Script error." = cross-origin external script
  if (GENERIC_CROSS_ORIGIN.includes(msg.toLowerCase().trim())) {
    logAutocorrection("cross_origin_ignored", msg);
    if (!isDuplicate(dedupKey)) {
      trackEvent("js_error", { message: "Script externo bloqueado", source: src || "cross-origin", autocorrected: "cross_origin" });
    }
    return true;
  }

  // Skip if blocker
  if (isBlockerError(msg)) {
    logAutocorrection("blocker_ignored", msg);
    if (!isDuplicate(dedupKey)) {
      trackEvent("js_error", { message: "Script bloqueado por extensão", source: src, autocorrected: "blocker" });
    }
    return true;
  }

  // External script error — don't log as critical
  if (isExternalSource(src)) {
    logAutocorrection("external_ignored", src);
    if (!isDuplicate(dedupKey)) {
      trackEvent("js_error", { message: msg, source: src, autocorrected: "external" });
    }
    return true;
  }

  // Dedup
  if (isDuplicate(dedupKey)) return true;

  console.warn("[GlobalError]", { message, source, lineno, colno, error: error?.message });
  trackEvent("js_error", { message: msg, source: src, line: lineno || 0 });
  return true;
};

window.addEventListener("error", (event) => {
  if (event.target && (event.target as HTMLElement).tagName === "SCRIPT") {
    const src = (event.target as HTMLScriptElement).src;
    
    // Bot — ignore completely
    if (isBotVisitor()) {
      logAutocorrection("bot_script_ignored", src);
      event.preventDefault();
      return;
    }

    // External script — try to reload
    if (isExternalSource(src)) {
      console.warn("[ScriptLoadError] Tentando recarregar:", src);
      retryScript(src);
      event.preventDefault();
      return;
    }

    // Internal script failure
    if (!isDuplicate(`script::${src}`)) {
      console.warn("[ScriptLoadError]", src);
      trackEvent("js_error", { message: "Script load failed", source: src });
    }
    event.preventDefault();
  }
}, true);

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason);

  if (isBotVisitor()) {
    logAutocorrection("bot_promise_ignored", msg);
    event.preventDefault();
    return;
  }

  if (isBlockerError(msg)) {
    logAutocorrection("blocker_promise_ignored", msg);
    event.preventDefault();
    return;
  }

  if (isDuplicate(`promise::${msg}`)) {
    event.preventDefault();
    return;
  }

  console.warn("[UnhandledPromise]", event.reason);
  trackEvent("js_error", { message: msg });
  event.preventDefault();
});

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Persist autocorrection count for admin panel
    try {
      const corrections = JSON.parse(sessionStorage.getItem("mesalar_autocorrections") || "[]");
      sessionStorage.setItem("mesalar_autocorrection_count", String(corrections.length));
    } catch {}
  });
}

createRoot(document.getElementById("root")!).render(<App />);
