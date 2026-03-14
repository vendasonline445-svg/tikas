/**
 * Session Replay Collector — Captures scroll, click, mousemove events
 * and batches them to the session_actions table.
 */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const BATCH_INTERVAL = 5000;
const MAX_BATCH = 50;

let buffer: Array<{
  session_id: string;
  event_type: string;
  element: string | null;
  scroll_position: number | null;
  mouse_x: number | null;
  mouse_y: number | null;
  page_url: string;
}> = [];

let initialized = false;

function getSessionId(): string {
  try { return sessionStorage.getItem("mesalar_session_id") || ""; } catch { return ""; }
}

function getElementSelector(el: EventTarget | null): string | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.className && typeof el.className === "string"
    ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
    : "";
  return `${tag}${id}${cls}`.slice(0, 120);
}

function pushAction(type: string, data: Partial<typeof buffer[0]>) {
  const sessionId = getSessionId();
  if (!sessionId) return;
  if (buffer.length >= MAX_BATCH * 2) buffer = buffer.slice(-MAX_BATCH);
  buffer.push({
    session_id: sessionId,
    event_type: type,
    element: data.element || null,
    scroll_position: data.scroll_position ?? null,
    mouse_x: data.mouse_x ?? null,
    mouse_y: data.mouse_y ?? null,
    page_url: window.location.pathname,
  });
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  try {
    await db.from("session_actions").insert(batch);
  } catch (e) {
    console.warn("[SessionReplay] flush error:", e);
    buffer.unshift(...batch);
  }
}

let lastScroll = 0;
let lastMouse = 0;

export function initSessionReplay() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Throttled scroll
  window.addEventListener("scroll", () => {
    const now = Date.now();
    if (now - lastScroll < 1000) return;
    lastScroll = now;
    pushAction("scroll", { scroll_position: Math.round(window.scrollY) });
  }, { passive: true });

  // Click
  document.addEventListener("click", (e) => {
    pushAction("click", {
      element: getElementSelector(e.target),
      mouse_x: Math.round(e.clientX),
      mouse_y: Math.round(e.clientY),
    });
  });

  // Throttled mousemove (every 2s)
  document.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastMouse < 2000) return;
    lastMouse = now;
    pushAction("mousemove", {
      mouse_x: Math.round(e.clientX),
      mouse_y: Math.round(e.clientY),
    });
  }, { passive: true });

  // Flush periodically
  setInterval(flush, BATCH_INTERVAL);
  window.addEventListener("beforeunload", flush);

  console.log("[SessionReplay] Initialized");
}
