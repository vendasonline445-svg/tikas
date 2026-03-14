/**
 * TikTok Multi-Pixel Tracking Module
 * Loads active pixels from DB, fires Browser (ttq) + Server (Events API) for each.
 * Deduplication via shared event_id. SHA256 hashing for server-side identifiers.
 * Identity cache for cross-event PII enrichment (email/phone coverage).
 */

import { supabase } from "@/integrations/supabase/client";

const DEBUG = "[TikTok Tracking]";

// ── Constants ─────────────────────────────────────────────────────────
const IDENTITY_KEY = "fiq_user_identity";
const TTCLID_KEY = "fiq_ttclid";
const TTCLID_EXP = "fiq_ttclid_exp";

// ── Pixel store ───────────────────────────────────────────────────────

interface TikTokPixel {
  id: string;
  name: string;
  pixel_id: string;
  api_token: string;
  status: string;
}

let _pixels: TikTokPixel[] = [];
let _pixelsLoaded = false;
let _loadPromise: Promise<void> | null = null;

export async function loadPixels(): Promise<TikTokPixel[]> {
  if (_pixelsLoaded) return _pixels;
  if (_loadPromise) {
    await _loadPromise;
    return _pixels;
  }
  _loadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("tiktok_pixels")
        .select("*")
        .eq("status", "active");
      if (error) {
        console.warn(`${DEBUG} Error loading pixels:`, error.message);
        _pixels = [];
      } else {
        _pixels = (data || []) as TikTokPixel[];
        console.log(`${DEBUG} Loaded ${_pixels.length} active pixel(s)`);
      }
    } catch (e) {
      console.warn(`${DEBUG} Failed to load pixels:`, e);
      _pixels = [];
    }
    _pixelsLoaded = true;
  })();
  await _loadPromise;
  return _pixels;
}

export function reloadPixels() {
  _pixelsLoaded = false;
  _loadPromise = null;
}

// ── UTM / ttclid capture ──────────────────────────────────────────────

const TRACKED_PARAMS = [
  "ttclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
];

export function captureTrackingParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    TRACKED_PARAMS.forEach((key) => {
      const value = params.get(key);
      if (value) {
        localStorage.setItem(`tt_${key}`, value);
        console.log(`${DEBUG} Captured ${key}:`, value);
      }
    });
    // Also capture ttclid with expiration (7-day attribution window)
    captureTTClid();
  } catch (e) {
    console.warn(`${DEBUG} Error capturing params:`, e);
  }
}

export function getStoredParam(key: string): string | null {
  try {
    return localStorage.getItem(`tt_${key}`);
  } catch {
    return null;
  }
}

// ── SHA256 hashing ────────────────────────────────────────────────────

export async function sha256(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Event ID generation ───────────────────────────────────────────────

export function generateEventId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// ── Phone normalization ───────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return "+" + digits;
  return "+55" + digits;
}

// ── ttclid cache (7-day attribution window) ───────────────────────────

export function captureTTClid() {
  try {
    const ttclid = new URLSearchParams(window.location.search).get("ttclid");
    if (ttclid) {
      localStorage.setItem(TTCLID_KEY, ttclid);
      localStorage.setItem(TTCLID_EXP, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      console.log(`${DEBUG} ttclid cached (7-day window)`);
    }
  } catch {}
}

export function getCachedTTClid(): string | undefined {
  try {
    const exp = localStorage.getItem(TTCLID_EXP);
    if (exp && Date.now() > Number(exp)) {
      localStorage.removeItem(TTCLID_KEY);
      localStorage.removeItem(TTCLID_EXP);
      return undefined;
    }
    return localStorage.getItem(TTCLID_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// ── Identity cache (recovers email/phone coverage across events) ──────

export async function cacheUserIdentity(
  email?: string,
  phone?: string,
  externalId?: string
) {
  const identity: Record<string, string | number> = {
    cached_at: Date.now(),
  };

  if (externalId) identity.external_id = externalId;

  if (email && email.trim()) {
    identity.email_hash = await sha256(email.toLowerCase().trim());
  }

  if (phone && phone.trim()) {
    const digits = phone.replace(/\D/g, "");
    const normalized = "+55" + (digits.startsWith("55") ? digits.slice(2) : digits);
    identity.phone_hash = await sha256(normalized.replace("+", ""));
  }

  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    console.log(`${DEBUG} Identity cached (email: ${!!email}, phone: ${!!phone})`);
  } catch {}
}

function getCachedIdentity(): Record<string, string> {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    // Valid for 30 days
    if (Date.now() - data.cached_at > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(IDENTITY_KEY);
      return {};
    }
    const { cached_at, ...identity } = data;
    return identity;
  } catch {
    return {};
  }
}

function enrichUserData(base: Record<string, any>): Record<string, any> {
  const identity = getCachedIdentity();
  return {
    ...base,
    ...(identity.email_hash && !base.email && { email: identity.email_hash }),
    ...(identity.phone_hash && !base.phone_number && { phone_number: identity.phone_hash }),
    ...(identity.external_id && !base.external_id && { external_id: identity.external_id }),
  };
}

// ── TikTok event name mapping ─────────────────────────────────────────

const TIKTOK_EVENT_MAP: Record<string, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  click_buy: "AddToCart",
  checkout_start: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  pix_generated: "AddPaymentInfo",
  card_submitted: "AddPaymentInfo",
  purchase: "CompletePayment",
  upsell_view: "ViewContent",
  upsell_accept: "Purchase",
};

// ── Build TikTok properties (contents + currency) ─────────────────────

const NEEDS_CONTENTS = [
  "AddToCart", "InitiateCheckout", "AddPaymentInfo", "CompletePayment", "Purchase",
];

function buildTikTokProperties(eventName: string, data: Record<string, any>): Record<string, any> {
  const props: Record<string, any> = {
    currency: "BRL",
    value: Number(data.value ?? data.amount ?? 0),
    ...data,
  };

  // Always set currency to BRL
  props.currency = "BRL";

  if (NEEDS_CONTENTS.includes(eventName)) {
    props.contents = data.contents ?? [{
      content_id: data.product_id ?? data.content_id ?? "mesa-dobravel",
      content_name: data.product_name ?? data.content_name ?? "Mesa Dobrável",
      content_type: "product",
      quantity: Number(data.quantity ?? 1),
      price: Number(data.value ?? data.amount ?? 0),
    }];
    props.content_type = "product";
    props.num_items = Number(data.quantity ?? 1);
  }

  return props;
}

// ── Safe TTQ instance accessor ────────────────────────────────────────

function getTTQInstance(pixelId: string): any | null {
  const ttq = (window as any).ttq;
  if (!ttq) return null;
  try {
    const instance = ttq.instance(pixelId);
    return instance || null;
  } catch (e) {
    console.warn(`${DEBUG} Pixel not ready: ${pixelId}`, e);
    return null;
  }
}

// ── Identify user (browser-side, called per pixel) ────────────────────

export async function identifyTikTokUser(data: {
  email?: string;
  phone?: string;
  externalId?: string;
}) {
  const identifyData: Record<string, string> = {};

  if (data.email && data.email.trim()) {
    identifyData.email = await sha256(data.email.trim().toLowerCase());
  }

  if (data.phone && data.phone.trim()) {
    const normalized = normalizePhone(data.phone).replace("+", "");
    identifyData.phone_number = await sha256(normalized);
  }

  if (data.externalId && data.externalId.trim()) {
    const cleaned = /^\d[\d.\-/]*$/.test(data.externalId.trim())
      ? data.externalId.replace(/\D/g, "")
      : data.externalId.trim();
    identifyData.external_id = cleaned;
  }

  // Enrich from cache
  const cached = getCachedIdentity();
  if (!identifyData.email && cached.email_hash) identifyData.email = cached.email_hash;
  if (!identifyData.phone_number && cached.phone_hash) identifyData.phone_number = cached.phone_hash;
  if (!identifyData.external_id && cached.external_id) identifyData.external_id = cached.external_id;

  const pixels = await loadPixels();
  pixels.forEach((px) => {
    const instance = getTTQInstance(px.pixel_id);
    if (instance) {
      try {
        instance.identify(identifyData);
        console.log(`${DEBUG} identify() on pixel ${px.pixel_id} (hashed)`);
      } catch (e) {
        console.warn(`${DEBUG} identify error for ${px.pixel_id}:`, e);
      }
    }
  });
}

// ── Store user data for server-side events ────────────────────────────

let _userData: {
  email_hash?: string;
  phone_hash?: string;
  external_id_hash?: string;
} = {};

export async function setUserData(data: {
  email?: string;
  phone?: string;
  externalId?: string;
}) {
  if (data.email && data.email.trim()) _userData.email_hash = await sha256(data.email);
  if (data.phone && data.phone.trim()) {
    const normalized = normalizePhone(data.phone).replace("+", "");
    _userData.phone_hash = await sha256(normalized);
  }
  if (data.externalId && data.externalId.trim()) {
    const cleaned = /^\d[\d.\-/]*$/.test(data.externalId.trim())
      ? data.externalId.replace(/\D/g, "")
      : data.externalId.trim();
    _userData.external_id_hash = await sha256(cleaned);
  }
}

export function getUserData() {
  return _userData;
}

// ── Initialize all pixels (browser-side ttq.load) ─────────────────────

async function initializePixels() {
  const pixels = await loadPixels();
  const ttq = (window as any).ttq;
  if (!ttq) {
    console.warn(`${DEBUG} ttq SDK not loaded`);
    return;
  }

  pixels.forEach((px) => {
    try {
      if (!ttq._i || !ttq._i[px.pixel_id]) {
        ttq.load(px.pixel_id, { enableCookie: true });
        console.log(`${DEBUG} Loaded pixel: ${px.pixel_id} (${px.name})`);
      }
    } catch (e) {
      console.warn(`${DEBUG} Error loading pixel ${px.pixel_id}:`, e);
    }
  });
}

// ── Track event (all pixels: Browser + Server) ────────────────────────

interface TrackEventOptions {
  event: string;
  properties?: Record<string, any>;
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
  };
}

export async function trackTikTokEvent(options: TrackEventOptions) {
  const { event, properties = {}, userData } = options;
  const eventId = generateEventId();
  const timestamp = new Date().toISOString();
  const ttclid = getCachedTTClid() || getStoredParam("ttclid");

  // Resolve TikTok event name
  const tiktokEvent = TIKTOK_EVENT_MAP[event] || event;

  // Always use visitor_id as external_id for EMQ
  const visitorId = (() => {
    try { return localStorage.getItem("mesalar_visitor_id") || localStorage.getItem("fiq_visitor_id") || ""; } catch { return ""; }
  })();

  // Auto-read stored email/phone from localStorage
  const storedEmail = (() => {
    try { return localStorage.getItem("crm_user_email") || ""; } catch { return ""; }
  })();
  const storedPhone = (() => {
    try { return localStorage.getItem("crm_user_phone") || ""; } catch { return ""; }
  })();

  // Merge: explicit userData > stored values > empty string
  const effectiveUserData = {
    email: (userData?.email || storedEmail || "").trim().toLowerCase(),
    phone: (userData?.phone || storedPhone || "").trim(),
    externalId: (userData?.externalId || visitorId || "").trim(),
  };

  // Always set user data and identify for better EMQ
  if (effectiveUserData.externalId || effectiveUserData.email || effectiveUserData.phone) {
    await setUserData(effectiveUserData);
    await identifyTikTokUser(effectiveUserData);
  }

  const pixels = await loadPixels();
  if (pixels.length === 0) {
    console.warn(`${DEBUG} No active pixels — skipping ${tiktokEvent}`);
    return;
  }

  // Build enriched properties with contents + currency
  const enrichedProps = buildTikTokProperties(tiktokEvent, properties);

  // Browser-side: fire on each pixel instance
  pixels.forEach((px) => {
    const instance = getTTQInstance(px.pixel_id);
    if (instance) {
      try {
        instance.track(tiktokEvent, enrichedProps, { event_id: eventId });
        console.log(`${DEBUG} ${tiktokEvent} fired (browser) — pixel ${px.pixel_id}, event_id: ${eventId}`);
      } catch (e) {
        console.warn(`${DEBUG} Pixel error for ${px.pixel_id}:`, e);
      }
    }
  });

  // Server-side: send to each pixel via edge function with enriched user data
  const storedUser = getUserData();
  const baseUserData = {
    email: storedUser.email_hash || "",
    phone_number: storedUser.phone_hash || "",
    external_id: storedUser.external_id_hash || visitorId || "",
    ttclid: ttclid || "",
    user_agent: navigator.userAgent,
    page_url: window.location.href,
  };

  // Enrich with cached identity (fills email/phone for non-checkout events)
  const enrichedUser = enrichUserData(baseUserData);

  pixels.forEach((px) => {
    const serverPayload = {
      event: tiktokEvent,
      event_id: eventId,
      timestamp,
      pixel_code: px.pixel_id,
      api_token: px.api_token,
      user: enrichedUser,
      properties: enrichedProps,
    };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/tiktok-events-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify(serverPayload),
    })
      .then((res) => res.json())
      .then((data) => console.log(`${DEBUG} ${tiktokEvent} server response (${px.pixel_id}):`, data))
      .catch((err) => console.warn(`${DEBUG} ${tiktokEvent} server error (${px.pixel_id}):`, err));
  });
}

// ── Page view for SPA ─────────────────────────────────────────────────

export async function trackPageView() {
  const pixels = await loadPixels();

  pixels.forEach((px) => {
    const instance = getTTQInstance(px.pixel_id);
    if (instance) {
      try {
        instance.page();
      } catch (e) {
        console.warn(`${DEBUG} page() error for ${px.pixel_id}:`, e);
      }
    }
  });
  console.log(`${DEBUG} page() fired on ${pixels.length} pixel(s)`);
}

// ── Init (call on app mount) ──────────────────────────────────────────

export async function initTikTokTracking() {
  captureTrackingParams();
  await initializePixels();
  console.log(`${DEBUG} Tracking initialized`);
}
