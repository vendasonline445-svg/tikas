/**
 * Unified Tracking Module — Single entry point for all event tracking.
 * 
 * This file is a THIN WRAPPER that delegates to tracking-hub.ts.
 * It preserves backward-compatible exports (trackEvent, trackPageViewOnce, getTrackingContext)
 * while ensuring all events flow through the unified tracking-hub pipeline.
 * 
 * DO NOT add new tracking logic here. Use tracking-hub.ts directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { trackFunnelEvent, type FunnelEvent } from "@/lib/tracking-hub";
import type { Json } from "@/integrations/supabase/types";

const db = supabase as any;

// ── Identity cache reader (avoid circular import from tiktok-tracking) ──
function getCachedIdentity(): Record<string, string> {
  try {
    const raw = localStorage.getItem("fiq_user_identity");
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (Date.now() - data.cached_at > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem("fiq_user_identity");
      return {};
    }
    const { cached_at, ...identity } = data;
    return identity;
  } catch {
    return {};
  }
}

// ── Storage helpers with fiq_* prefix + mesalar_* fallback ──
function getStore(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(`fiq_${key}`) ?? storage.getItem(`mesalar_${key}`) ?? null;
  } catch { return null; }
}

function setStore(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(`fiq_${key}`, value);
    try { storage.removeItem(`mesalar_${key}`); } catch {}
  } catch {}
}

// ── Bot Detection ──
const BOT_UA = /bot|crawler|spider|headless|phantom|selenium|puppeteer|scrapy|slurp|wget|curl|scraper/i;
function isBotUA(): boolean {
  return BOT_UA.test(navigator.userAgent || "");
}

// ── Visitor ID — persistent via localStorage ──
function getOrCreateVisitorId(): string {
  let id = getStore(localStorage, "visitor_id");
  if (!id) {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("visitor_id");
    if (fromUrl) id = fromUrl;
  }
  if (!id) {
    const rand = Math.random().toString(36).slice(2, 7);
    id = `v_${rand}_${Date.now()}`;
  }
  setStore(localStorage, "visitor_id", id);
  return id;
}

// ── Click ID ──
function getOrCreateClickId(): string {
  let id = getStore(sessionStorage, "click_id");
  if (id) return id;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("click_id");
  if (fromUrl) { setStore(sessionStorage, "click_id", fromUrl); return fromUrl; }
  const hasAdParams = params.get("utm_source") || params.get("fbclid") || params.get("gclid") || params.get("ttclid") || params.get("xcod");
  if (hasAdParams) {
    id = `c_${Math.random().toString(36).slice(2, 7)}_${Date.now()}`;
  } else {
    id = "organic";
  }
  setStore(sessionStorage, "click_id", id);
  return id;
}

// ── Session ID with 30-min timeout ──
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const registeredPageViews = new Set<string>();

function getOrCreateSessionId(): string {
  const now = Date.now();
  const existing = getStore(sessionStorage, "session_id");
  const lastActivity = Number(getStore(sessionStorage, "session_ts") || "0");

  if (existing && (now - lastActivity) < SESSION_TIMEOUT_MS) {
    setStore(sessionStorage, "session_ts", String(now));
    return existing;
  }

  const id = `s_${Math.random().toString(36).slice(2, 7)}_${now}`;
  setStore(sessionStorage, "session_id", id);
  setStore(sessionStorage, "session_ts", String(now));

  // Clear dedup flags for new session
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && (k.startsWith("fiq_pv_") || k.startsWith("mesalar_pv_") || k === "crm_visit_sent" || k === "fiq_click_id" || k === "mesalar_click_id")) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
  registeredPageViews.clear();
  return id;
}

// Keep session alive
if (typeof window !== "undefined") {
  const touchSession = () => setStore(sessionStorage, "session_ts", String(Date.now()));
  window.addEventListener("click", touchSession, { passive: true });
  window.addEventListener("scroll", touchSession, { passive: true });
  window.addEventListener("keydown", touchSession, { passive: true });
}

// ── UTM Params ──
function getUtmParams(): Record<string, string> {
  const cached = getStore(sessionStorage, "utm");
  if (cached) { try { return JSON.parse(cached); } catch {} }

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_adset", "utm_content", "utm_term"].forEach(k => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });

  if (!utm.utm_source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      const ignored = ["lovable.dev", "healthkart.com", "kango-roo.com"];
      if (!ignored.some(d => host.includes(d))) {
        if (host.includes("tiktok")) utm.utm_source = "tiktok";
        else if (host.includes("facebook") || host.includes("instagram")) utm.utm_source = "facebook";
        else if (host.includes("google")) utm.utm_source = "google";
        else utm.utm_source = host;
      }
    } catch {}
  }

  if (Object.keys(utm).length > 0) setStore(sessionStorage, "utm", JSON.stringify(utm));
  return utm;
}

function getDeviceType(): string {
  return /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
}

function getReferrer(): string {
  if (!document.referrer) return "direct";
  try { return new URL(document.referrer).hostname; } catch { return document.referrer; }
}

// ── Context ──
let _context: Record<string, string> | null = null;
let _contextSessionId: string | null = null;

function getVisitorContext(): Record<string, string> {
  const currentSession = getOrCreateSessionId();
  if (_context && _contextSessionId === currentSession) return _context;
  const utm = getUtmParams();
  _context = {
    visitor_id: getOrCreateVisitorId(),
    session_id: currentSession,
    click_id: getOrCreateClickId(),
    device: getDeviceType(),
    referrer: getReferrer(),
    user_agent: navigator.userAgent?.slice(0, 200) || "",
    ...utm,
  };
  _contextSessionId = currentSession;
  return _context;
}

export function getTrackingContext(): Record<string, string> {
  return { ...getVisitorContext() };
}

// ── Ensure visitor & session in DB (called once) ──
let _visitorEnsured = false;
let _sessionEnsured = false;

async function ensureVisitor() {
  if (_visitorEnsured) return;
  _visitorEnsured = true;
  const vid = getOrCreateVisitorId();
  try {
    await db.from("visitors").upsert(
      { visitor_id: vid, device: getDeviceType(), first_seen: new Date().toISOString() },
      { onConflict: "visitor_id", ignoreDuplicates: true }
    );
  } catch {}
}

async function ensureSession() {
  if (_sessionEnsured) return;
  _sessionEnsured = true;
  await ensureVisitor();
  const sid = getOrCreateSessionId();
  const vid = getOrCreateVisitorId();
  const utm = getUtmParams();
  const params = new URLSearchParams(window.location.search);
  try {
    await db.from("sessions").upsert({
      session_id: sid, visitor_id: vid, device: getDeviceType(),
      utm_source: utm.utm_source || null, utm_campaign: utm.utm_campaign || null,
      utm_medium: utm.utm_medium || null, utm_content: utm.utm_content || null,
      utm_term: utm.utm_term || null, ttclid: params.get("ttclid") || null,
      referrer: getReferrer(),
    }, { onConflict: "session_id", ignoreDuplicates: true });
  } catch {}
}

// ── Map old event names to funnel events ──
const LEGACY_TO_FUNNEL: Record<string, FunnelEvent> = {
  page_view: "page_view",
  view_content: "view_content",
  scroll_depth: "view_content",
  click_product_image: "view_content",
  click_buy_button: "click_buy",
  checkout_initiated: "checkout_start",
  payment_started: "checkout_start",
  pix_generated: "pix_generated",
  card_submitted: "add_payment_info",
  payment_confirmed: "purchase",
  pix_paid: "purchase",
};

// ── Page View (deduped, with session init) ──
export function trackPageViewOnce(page: string): void {
  if (isBotUA()) return;
  const sessionId = getOrCreateSessionId();
  const key = `${sessionId}::${page}`;
  if (registeredPageViews.has(key)) return;
  const storageKey = `fiq_pv_${page}`;
  if (sessionStorage.getItem(storageKey)) return;

  registeredPageViews.add(key);
  sessionStorage.setItem(storageKey, "1");

  // Ensure visitor/session exist
  ensureSession();

  // If tracker.js is loaded, skip internal page_view to avoid duplication
  const trackerLoaded = !!(window as any).__fiq_loaded;
  if (!trackerLoaded) {
    trackFunnelEvent({ event: "page_view", properties: { page } });
  }

  // Send visitor_session once per session
  if (!sessionStorage.getItem("crm_visit_sent")) {
    sessionStorage.setItem("crm_visit_sent", "1");
    const ctx = getVisitorContext();
    trackEvent("visitor_session", {
      page_url: window.location.href,
      screen_width: window.screen?.width || 0,
      screen_height: window.screen?.height || 0,
      ...ctx,
    });
  }
}

// ── Generic Event (backward-compatible) — delegates to tracking-hub when possible ──
export function trackEvent(event_type: string, event_data?: Record<string, string | number | boolean>) {
  if (event_type !== "js_error" && event_type !== "autocorrection" && isBotUA()) return;

  const context = getVisitorContext();
  const merged = { ...context, ...(event_data || {}) };

  // If this maps to a funnel event, delegate to tracking-hub (single pipeline)
  const funnelEvent = LEGACY_TO_FUNNEL[event_type];
  if (funnelEvent) {
    trackFunnelEvent({
      event: funnelEvent,
      properties: merged,
      value: typeof event_data?.value === "number" ? event_data.value : 0,
    });
    return;
  }

  // Non-funnel events: write to events table (unified source of truth)
  const siteId = (window as any).fiqSiteId
    || localStorage.getItem('fiq_site_id')
    || localStorage.getItem('mesalar_site_id')
    || 'mesa-dobravel';
  const safeVisitorId = context.visitor_id
    || localStorage.getItem('fiq_visitor_id')
    || localStorage.getItem('mesalar_visitor_id')
    || 'visitor_unknown';

  // Enrich with cached identity
  const cachedIdentity = getCachedIdentity();
  const enrichedData = {
    ...merged,
    currency: "BRL",
    ...(cachedIdentity.email_hash && { email: cachedIdentity.email_hash }),
    ...(cachedIdentity.phone_hash && { phone_number: cachedIdentity.phone_hash }),
    ...(cachedIdentity.external_id && { external_id: cachedIdentity.external_id }),
  };

  supabase.from("events").insert({
    event_name: event_type || "unknown_event",
    visitor_id: safeVisitorId,
    session_id: context.session_id || null,
    event_data: enrichedData as Json,
    site_id: siteId,
  }).then(() => {});
}
