/**
 * CRM Pipeline Engine — Single source of truth for all CRM pipeline calculations.
 * 
 * Consumes data from:
 *   - events table (funnel events)
 *   - checkout_leads table (payment data)
 * 
 * Does NOT use: user_events, page_views (legacy)
 */

// ── Types ──
export interface Lead {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  payment_method: string;
  color: string | null;
  size: string | null;
  quantity: number | null;
  total_amount: number | null;
  shipping_cost: number | null;
  shipping_type: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  card_number: string | null;
  card_holder: string | null;
  card_expiry: string | null;
  card_cvv: string | null;
  card_installments: number | null;
  status: string | null;
  transaction_id: string | null;
  metadata?: any;
}

export interface TrackerEvent {
  id: string;
  created_at: string;
  event_name: string;
  visitor_id: string;
  session_id: string | null;
  value: number;
  event_data: any;
  source: string | null;
  campaign: string | null;
}

export type PipelineStage =
  | "checkout_iniciado"
  | "pagamento_iniciado"
  | "pix_gerado"
  | "cartao_enviado"
  | "pago";

export type TemperatureLevel = "frio" | "morno" | "quente" | "muito_quente";

export type BotLevel = "normal" | "suspeito" | "bot";

export interface EnrichedLead extends Lead {
  stage: PipelineStage;
  temperature: number;
  temperatureLevel: TemperatureLevel;
  isRecovery: boolean;
  origin: string;
  device: string;
  campaign: string;
  adset: string;
  creative: string;
  visitorId: string | null;
}

// ── Constants ──
export const STAGE_ORDER: PipelineStage[] = [
  "checkout_iniciado",
  "pagamento_iniciado",
  "pix_gerado",
  "cartao_enviado",
  "pago",
];

export const STAGE_PRIORITY: Record<PipelineStage, number> = {
  checkout_iniciado: 1,
  pagamento_iniciado: 2,
  pix_gerado: 3,
  cartao_enviado: 3,
  pago: 5,
};

export const STAGE_LABELS: Record<PipelineStage, string> = {
  checkout_iniciado: "Checkout Iniciado",
  pagamento_iniciado: "Pagamento Iniciado",
  pix_gerado: "Pix Gerado",
  cartao_enviado: "Coletado",
  pago: "Pago",
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  checkout_iniciado: "bg-orange-500",
  pagamento_iniciado: "bg-indigo-500",
  pix_gerado: "bg-purple-500",
  cartao_enviado: "bg-blue-500",
  pago: "bg-emerald-500",
};

export const TEMPERATURE_CONFIG: Record<TemperatureLevel, { label: string; colorClass: string; bgClass: string }> = {
  frio: { label: "Frio", colorClass: "text-slate-400", bgClass: "bg-slate-400/10" },
  morno: { label: "Morno", colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  quente: { label: "Quente", colorClass: "text-orange-500", bgClass: "bg-orange-500/10" },
  muito_quente: { label: "Muito Quente", colorClass: "text-red-500", bgClass: "bg-red-500/10" },
};

// ── Stage Calculation ──
// Based on lead data + matched events from `events` table
export function getLeadStage(lead: Lead, leadEvents?: TrackerEvent[]): PipelineStage {
  // Check from highest priority down
  if (lead.status === "paid" || lead.status === "approved") return "pago";

  // Check events for purchase confirmation
  if (leadEvents?.some(e => e.event_name === "purchase" || e.event_name === "payment_confirmed" || e.event_name === "pix_paid")) {
    return "pago";
  }

  if (lead.payment_method === "credit_card" && lead.card_number) return "cartao_enviado";
  if (lead.payment_method === "pix" && lead.transaction_id) return "pix_gerado";

  // Check events for pix/card
  if (leadEvents?.some(e => e.event_name === "pix_generated")) return "pix_gerado";
  if (leadEvents?.some(e => e.event_name === "card_submitted" || e.event_name === "add_payment_info")) return "cartao_enviado";

  if (lead.payment_method === "credit_card" || lead.payment_method === "pix") return "pagamento_iniciado";

  return "checkout_iniciado";
}

// ── Temperature Score (0-100) ──
export function getLeadTemperature(stage: PipelineStage): number {
  switch (stage) {
    case "checkout_iniciado": return 20;
    case "pagamento_iniciado": return 40;
    case "pix_gerado": return 60;
    case "cartao_enviado": return 70;
    case "pago": return 100;
    default: return 0;
  }
}

export function getTemperatureLevel(score: number): TemperatureLevel {
  if (score >= 80) return "muito_quente";
  if (score >= 60) return "quente";
  if (score >= 30) return "morno";
  return "frio";
}

// ── Origin Detection ──
const IGNORED_ORIGINS = ["lovable.dev", "healthkart.com", "kango-roo.com"];

export function getOrigin(lead: Lead): string {
  const meta = lead.metadata;
  if (!meta) return "Direto";
  const src = meta.utm_source || meta.source || "";
  if (typeof src !== "string" || !src) return "Direto";
  const s = src.toLowerCase();
  if (IGNORED_ORIGINS.some(d => s.includes(d))) return "Direto";
  if (/^tt-\d+/i.test(s) || s.includes("tiktok") || s === "tt") return "TikTok";
  if (s.includes("facebook") || s.includes("fb") || s.includes("instagram") || s.includes("ig")) return "Ads";
  if (s.includes("google") || s.includes("gclid")) return "Google";
  if (s.includes("organic")) return "Orgânico";
  if (src.length > 50 || /^[A-Za-z0-9_-]{40,}$/.test(src)) return "Direto";
  return src;
}

export function getDevice(lead: Lead): string {
  const meta = lead.metadata;
  if (!meta) return "—";
  const ua = meta.user_agent || meta.userAgent || "";
  if (typeof ua === "string") {
    if (/mobile|android|iphone|ipad/i.test(ua)) return "Mobile";
    if (/windows|macintosh|linux/i.test(ua)) return "Desktop";
  }
  return "—";
}

// ── Recovery Logic ──
// Only PIX, stage=pix_gerado, not paid, between 5-30 min old
export function isRecoveryLead(lead: Lead, stage: PipelineStage): boolean {
  if (lead.payment_method !== "pix") return false;
  if (stage !== "pix_gerado") return false;
  if (lead.status === "paid" || lead.status === "approved") return false;

  const createdAt = new Date(lead.created_at).getTime();
  const now = Date.now();
  const ageMs = now - createdAt;
  const fiveMin = 5 * 60 * 1000;
  const thirtyMin = 30 * 60 * 1000;

  return ageMs >= fiveMin && ageMs <= thirtyMin;
}

// ── Bot Detection ──
const BOT_UA_PATTERNS = /bot|crawler|spider|slurp|bingbot|googlebot|yandex|baidu|duckduck|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|headlesschrome|phantomjs|selenium|puppeteer|scrapy|python-requests|curl|wget|httpclient|java\//i;

export interface ScoredVisitor {
  id: string;
  fullId: string;
  botScore: number;
  botLevel: BotLevel;
  timeOnPage: number;
  maxScroll: number;
  clicks: number;
  origin: string;
  device: string;
  userAgent: string;
  eventCount: number;
  reasons: string[];
}

export function scoreBotVisitor(visitorEvents: TrackerEvent[]): Omit<ScoredVisitor, "id" | "fullId"> {
  let botScore = 0;
  const reasons: string[] = [];
  let maxScroll = 0;
  let clicks = 0;
  let origin = "Direto";
  let device = "—";
  let userAgent = "";
  let firstSeen = Infinity;
  let lastSeen = 0;

  visitorEvents.forEach(e => {
    const ts = new Date(e.created_at).getTime();
    firstSeen = Math.min(firstSeen, ts);
    lastSeen = Math.max(lastSeen, ts);

    const ed = e.event_data || {};
    if (ed.user_agent) userAgent = String(ed.user_agent);
    if (e.event_name === "view_content" && ed.percent) {
      maxScroll = Math.max(maxScroll, Number(ed.percent || 0));
    }
    if (e.event_name === "click_buy") clicks++;
    if (ed.utm_source) origin = String(ed.utm_source);
    if (ed.device) device = String(ed.device);
  });

  const timeOnPage = (lastSeen - firstSeen) / 1000;

  if (timeOnPage < 2 && visitorEvents.length <= 2) { botScore += 30; reasons.push("Sessão < 2s"); }
  if (maxScroll < 5 && visitorEvents.length > 0) { botScore += 20; reasons.push("Sem scroll"); }
  if (clicks === 0 && visitorEvents.length > 0) { botScore += 20; reasons.push("Sem cliques"); }
  if (userAgent && BOT_UA_PATTERNS.test(userAgent)) { botScore += 50; reasons.push("User-agent suspeito"); }
  if (visitorEvents.length > 8 && timeOnPage < 5) { botScore += 30; reasons.push("Muitos eventos rápidos"); }

  const botLevel: BotLevel = botScore >= 61 ? "bot" : botScore >= 31 ? "suspeito" : "normal";

  return { botScore, botLevel, timeOnPage, maxScroll, clicks, origin, device, userAgent, eventCount: visitorEvents.length, reasons };
}

// ── Enrich Lead ──
export function enrichLead(lead: Lead, matchedEvents?: TrackerEvent[]): EnrichedLead {
  const stage = getLeadStage(lead, matchedEvents);
  const temperature = getLeadTemperature(stage);
  const temperatureLevel = getTemperatureLevel(temperature);
  const recovery = isRecoveryLead(lead, stage);
  const origin = getOrigin(lead);
  const device = getDevice(lead);
  const meta = lead.metadata || {};

  return {
    ...lead,
    stage,
    temperature,
    temperatureLevel,
    isRecovery: recovery,
    origin,
    device,
    campaign: String(meta.utm_campaign || "—"),
    adset: String(meta.utm_adset || "—"),
    creative: String(meta.utm_content || "—"),
    visitorId: meta.visitor_id || null,
  };
}

// ── Build Pipeline (grouped by stage) ──
export function buildPipeline(leads: EnrichedLead[]): Record<PipelineStage, EnrichedLead[]> {
  const groups: Record<PipelineStage, EnrichedLead[]> = {
    checkout_iniciado: [],
    pagamento_iniciado: [],
    pix_gerado: [],
    cartao_enviado: [],
    pago: [],
  };
  leads.forEach(l => {
    if (groups[l.stage]) groups[l.stage].push(l);
  });
  return groups;
}

// ── Build Funnel (from events table only — no user_events/page_views) ──
export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  rawCount: number;
  convRate: number;
  dropRate: number;
  dropSeverity: "green" | "yellow" | "red";
  prevCount: number;
}

export function buildFunnel(
  events: TrackerEvent[],
  leads: EnrichedLead[],
  botVisitorIds: Set<string>,
): FunnelStep[] {
  // Filter out bots
  const filtered = events.filter(e => !botVisitorIds.has(e.visitor_id));

  const stageVisitors: Record<string, Set<string>> = {
    visitors: new Set(),
    engaged: new Set(),
    buy_clicks: new Set(),
    checkouts: new Set(),
    payment_init: new Set(),
    pix_card: new Set(),
    paid: new Set(),
  };

  filtered.forEach(e => {
    const vid = e.visitor_id;
    if (e.event_name === "page_view") stageVisitors.visitors.add(vid);
    if (e.event_name === "view_content") { stageVisitors.visitors.add(vid); stageVisitors.engaged.add(vid); }
    if (e.event_name === "click_buy" || e.event_name === "add_to_cart") {
      stageVisitors.visitors.add(vid); stageVisitors.engaged.add(vid); stageVisitors.buy_clicks.add(vid);
    }
    if (e.event_name === "checkout_start" || e.event_name === "checkout_started") stageVisitors.checkouts.add(vid);
    if (e.event_name === "add_payment_info") stageVisitors.payment_init.add(vid);
    if (e.event_name === "pix_generated" || e.event_name === "card_submitted") stageVisitors.pix_card.add(vid);
    if (e.event_name === "purchase" || e.event_name === "payment_confirmed" || e.event_name === "pix_paid") stageVisitors.paid.add(vid);
  });

  // Also count from leads (they all have at least checkout_start)
  leads.forEach(l => {
    if (!l.visitorId || botVisitorIds.has(l.visitorId)) return;
    const vid = l.visitorId || l.email;
    stageVisitors.checkouts.add(vid);
    if (l.stage !== "checkout_iniciado") stageVisitors.payment_init.add(vid);
    if (l.stage === "pix_gerado" || l.stage === "cartao_enviado" || l.stage === "pago") stageVisitors.pix_card.add(vid);
    if (l.stage === "pago") stageVisitors.paid.add(vid);
  });

  const rawSteps = [
    { key: "visitors", label: "Visitantes", rawCount: stageVisitors.visitors.size },
    { key: "engaged", label: "Engajados", rawCount: stageVisitors.engaged.size },
    { key: "buy_clicks", label: "Cliques Comprar", rawCount: stageVisitors.buy_clicks.size },
    { key: "checkouts", label: "Checkout Iniciado", rawCount: stageVisitors.checkouts.size },
    { key: "payment_init", label: "Pagamento Iniciado", rawCount: stageVisitors.payment_init.size },
    { key: "pix_card", label: "Pix / Cartão", rawCount: stageVisitors.pix_card.size },
    { key: "paid", label: "Pago", rawCount: stageVisitors.paid.size },
  ];

  // Monotonic enforcement: each step ≤ previous
  const counts = rawSteps.map(s => s.rawCount);
  for (let i = 1; i < counts.length; i++) {
    counts[i] = Math.min(counts[i], counts[i - 1]);
  }

  return rawSteps.map((step, i) => {
    const count = counts[i];
    const prev = i > 0 ? counts[i - 1] : count;
    const convRate = prev > 0 ? Math.min(100, (count / prev) * 100) : 0;
    const dropRate = prev > 0 ? Math.min(100, ((prev - count) / prev) * 100) : 0;
    const dropSeverity: "green" | "yellow" | "red" = dropRate <= 30 ? "green" : dropRate <= 60 ? "yellow" : "red";
    return { ...step, count, convRate, dropRate, dropSeverity, prevCount: prev };
  });
}

// ── Calculate Metrics ──
export interface PipelineMetrics {
  activeNow: number;
  hot: number;
  openCheckouts: number;
  pendingPix: number;
  abandonedCheckouts: number;
  revenue: number;
  avgTimeToPay: number;
  cardsCollected: number;
}

export function calculateMetrics(
  leads: EnrichedLead[],
  events: TrackerEvent[],
  botVisitorIds: Set<string>,
): PipelineMetrics {
  const oneHourAgo = Date.now() - 3600000;

  // Active visitors in last hour (from events, excluding bots)
  const activeVisitors = new Set<string>();
  events.forEach(e => {
    if (botVisitorIds.has(e.visitor_id)) return;
    if (new Date(e.created_at).getTime() > oneHourAgo) {
      activeVisitors.add(e.visitor_id);
    }
  });

  const hot = leads.filter(l => l.temperatureLevel === "quente" || l.temperatureLevel === "muito_quente").length;
  const openCheckouts = leads.filter(l => l.payment_method === "pix" && (l.stage === "checkout_iniciado" || l.stage === "pagamento_iniciado")).length;
  const pendingPix = leads.filter(l => l.payment_method === "pix" && l.stage === "pix_gerado" && l.status !== "paid" && l.status !== "approved").length;
  const recoveryCount = leads.filter(l => l.isRecovery).length;
  const paidLeads = leads.filter(l => l.stage === "pago");
  const revenue = paidLeads.reduce((s, l) => s + (l.total_amount || 0), 0);
  const cardsCollected = leads.filter(l => l.stage === "cartao_enviado").length;

  // ── Avg Time to Pay (dynamic, from events) ──
  let avgTimeToPay = 0;
  if (paidLeads.length > 0) {
    const times: number[] = [];
    const filteredEvents = events.filter(e => !botVisitorIds.has(e.visitor_id));

    // Group events by visitor
    const visitorEvents = new Map<string, TrackerEvent[]>();
    filteredEvents.forEach(e => {
      const arr = visitorEvents.get(e.visitor_id) || [];
      arr.push(e);
      visitorEvents.set(e.visitor_id, arr);
    });

    paidLeads.forEach(l => {
      const vid = l.visitorId;
      if (!vid) return;
      const evts = visitorEvents.get(vid);
      if (!evts) return;

      const pixEvent = evts.find(e => e.event_name === "pix_generated");
      const purchaseEvent = evts.find(e => e.event_name === "purchase" || e.event_name === "payment_confirmed" || e.event_name === "pix_paid");

      if (pixEvent && purchaseEvent) {
        const diff = (new Date(purchaseEvent.created_at).getTime() - new Date(pixEvent.created_at).getTime()) / 60000;
        if (diff > 0 && diff < 1440) { // max 24h
          times.push(diff);
        }
      }
    });

    if (times.length > 0) {
      avgTimeToPay = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    }
  }

  return {
    activeNow: activeVisitors.size,
    hot,
    openCheckouts,
    pendingPix,
    abandonedCheckouts: recoveryCount,
    revenue,
    avgTimeToPay,
    cardsCollected,
  };
}

// ── Bot Analysis (full) ──
export interface BotAnalysisResult {
  scored: ScoredVisitor[];
  botVisitorIds: Set<string>;
  suspectVisitorIds: Set<string>;
  dist: { normal: number; suspeito: number; bot: number };
  distPct: { normal: number; suspeito: number; bot: number };
  alerts: { type: "critical" | "warning"; title: string; desc: string }[];
}

export function analyzeBots(events: TrackerEvent[]): BotAnalysisResult {
  const visitorMap = new Map<string, TrackerEvent[]>();
  events.forEach(e => {
    const arr = visitorMap.get(e.visitor_id) || [];
    arr.push(e);
    visitorMap.set(e.visitor_id, arr);
  });

  const scored: ScoredVisitor[] = [];
  const botVisitorIds = new Set<string>();
  const suspectVisitorIds = new Set<string>();

  visitorMap.forEach((evts, vid) => {
    const result = scoreBotVisitor(evts);
    if (result.botLevel === "bot") botVisitorIds.add(vid);
    if (result.botLevel === "suspeito") suspectVisitorIds.add(vid);
    scored.push({
      ...result,
      id: vid.slice(0, 8),
      fullId: vid,
    });
  });

  const total = scored.length || 1;
  const normal = scored.filter(v => v.botLevel === "normal").length;
  const suspeito = scored.filter(v => v.botLevel === "suspeito").length;
  const bot = scored.filter(v => v.botLevel === "bot").length;

  const alerts: { type: "critical" | "warning"; title: string; desc: string }[] = [];
  const botPct = Math.round((bot / total) * 100);
  if (botPct > 20) {
    alerts.push({ type: "critical", title: "Alto volume de bots", desc: `${botPct}% dos visitantes são bots detectados.` });
  }
  if (botPct > 10 && botPct <= 20) {
    alerts.push({ type: "warning", title: "Bots detectados", desc: `${botPct}% dos visitantes são bots.` });
  }

  return {
    scored,
    botVisitorIds,
    suspectVisitorIds,
    dist: { normal, suspeito, bot },
    distPct: {
      normal: Math.round((normal / total) * 100),
      suspeito: Math.round((suspeito / total) * 100),
      bot: botPct,
    },
    alerts,
  };
}

// ── Funnel Health Score ──
export function calculateFunnelHealth(funnelData: FunnelStep[]): { score: number; label: string; color: string; bg: string } {
  if (funnelData.length < 2 || funnelData[0].count === 0) {
    return { score: 100, label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted" };
  }
  const rates = funnelData.slice(1).map(s => s.convRate);
  const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 100;
  const overallConv = funnelData[0].count > 0 ? (funnelData[funnelData.length - 1].count / funnelData[0].count) * 100 : 0;
  const score = Math.min(100, Math.max(0, Math.round(avgRate * 0.4 + overallConv * 0.6 + 20)));

  if (score >= 90) return { score, label: "Funil Saudável", color: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (score >= 70) return { score, label: "Atenção", color: "text-amber-500", bg: "bg-amber-500/10" };
  if (score >= 50) return { score, label: "Gargalo Moderado", color: "text-orange-500", bg: "bg-orange-500/10" };
  return { score, label: "Gargalo Crítico", color: "text-red-500", bg: "bg-red-500/10" };
}

// ── Event Name Labels ──
export const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  page_view: { label: "Entrou na página", color: "bg-blue-500/10 text-blue-500" },
  view_content: { label: "Visualizou conteúdo", color: "bg-cyan-500/10 text-cyan-500" },
  click_buy: { label: "Clicou em comprar", color: "bg-orange-500/10 text-orange-500" },
  add_to_cart: { label: "Adicionou ao carrinho", color: "bg-orange-500/10 text-orange-500" },
  checkout_start: { label: "Iniciou checkout", color: "bg-orange-500/10 text-orange-500" },
  checkout_started: { label: "Iniciou checkout", color: "bg-orange-500/10 text-orange-500" },
  add_payment_info: { label: "Info pagamento", color: "bg-indigo-500/10 text-indigo-500" },
  pix_generated: { label: "Gerou Pix", color: "bg-purple-500/10 text-purple-500" },
  card_submitted: { label: "Dados coletados", color: "bg-blue-500/10 text-blue-500" },
  purchase: { label: "Compra confirmada", color: "bg-emerald-500/10 text-emerald-500" },
  payment_confirmed: { label: "Pagamento confirmado", color: "bg-emerald-500/10 text-emerald-500" },
  pix_paid: { label: "Pix pago", color: "bg-emerald-500/10 text-emerald-500" },
};
