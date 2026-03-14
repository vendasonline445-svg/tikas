import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, ShoppingCart, QrCode, CheckCircle2, Wallet, AlertTriangle,
  Flame, Thermometer, Snowflake, X, Clock, ChevronRight, Filter,
  TrendingUp, XCircle, DollarSign, CreditCard, Eye, MousePointerClick,
  Smartphone, Monitor, Globe, Timer, Activity, ArrowDown, Heart, Zap, Shield, Bot, BarChart3, Megaphone, ImageIcon, ShieldAlert, Scan, Target
} from "lucide-react";
import {
  type Lead,
  type TrackerEvent,
  type PipelineStage,
  type TemperatureLevel,
  type EnrichedLead,
  type BotLevel,
  type FunnelStep,
  type ScoredVisitor,
  type PipelineMetrics,
  type BotAnalysisResult,
  enrichLead,
  buildPipeline,
  buildFunnel as buildFunnelEngine,
  calculateMetrics,
  analyzeBots,
  calculateFunnelHealth,
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  TEMPERATURE_CONFIG,
  EVENT_LABELS,
} from "@/lib/crm-pipeline-engine";

// ── Legacy UserEvent type for backward compat in rendering ──
interface UserEvent {
  id: string;
  created_at: string;
  event_type: string;
  event_data: any;
}

// Adapter: convert TrackerEvent to UserEvent shape for rendering compatibility
function trackerToUserEvent(e: TrackerEvent): UserEvent {
  return {
    id: e.id,
    created_at: e.created_at,
    event_type: e.event_name,
    event_data: {
      ...(e.event_data || {}),
      visitor_id: e.visitor_id,
      session_id: e.session_id,
      utm_source: e.source,
      utm_campaign: e.campaign,
    },
  };
}

type ScoreLevel = TemperatureLevel;
type TrafficQuality = "ruim" | "frio" | "morno" | "quente";
type CRMSubTab = "pipeline" | "recovery" | "alerts" | "visitors" | "funnel" | "traffic" | "criativos" | "bots" | "campanhas";

interface CRMFilters {
  paymentMethod: string;
  stage: string;
  cidade: string;
  period: string;
  origin: string;
  device: string;
}

// Score config using temperature levels
const SCORE_CONFIG: Record<TemperatureLevel, { label: string; icon: any; colorClass: string; bgClass: string }> = {
  muito_quente: { label: "Muito Quente", icon: Flame, colorClass: "text-red-500", bgClass: "bg-red-500/10" },
  quente: { label: "Quente", icon: Flame, colorClass: "text-orange-500", bgClass: "bg-orange-500/10" },
  morno: { label: "Morno", icon: Thermometer, colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  frio: { label: "Frio", icon: Snowflake, colorClass: "text-slate-400", bgClass: "bg-slate-400/10" },
};

// ── Component ──
export default function AdminCRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trackerEvents, setTrackerEvents] = useState<TrackerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<EnrichedLead | null>(null);
  const [subTab, setSubTab] = useState<CRMSubTab>("pipeline");
  const [filters, setFilters] = useState<CRMFilters>({
    paymentMethod: "all",
    stage: "all",
    cidade: "all",
    period: "30days",
    origin: "all",
    device: "all",
  });
  const [showFilters, setShowFilters] = useState(false);

  const db = supabase as any;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const daysMap: Record<string, number> = { today: 0, "7days": 7, "30days": 30, "90days": 90 };
    const days = daysMap[filters.period] ?? 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Only fetch from events + checkout_leads (no user_events, no page_views)
    const [leadsRes, eventsRes] = await Promise.all([
      supabase.from("checkout_leads").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      db.from("events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(3000),
    ]);

    setLeads((leadsRes.data as Lead[]) || []);
    setTrackerEvents((eventsRes.data as TrackerEvent[]) || []);
    if (!silent) setLoading(false);
  }, [filters.period]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);
  useEffect(() => {
    const channel = supabase
      .channel("crm-leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "checkout_leads" }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // ── Bot Analysis (first, so we can exclude bots everywhere) ──
  const botAnalysis = useMemo(() => analyzeBots(trackerEvents), [trackerEvents]);

  // ── Adapt events for legacy rendering ──
  const events = useMemo(() => trackerEvents.map(trackerToUserEvent), [trackerEvents]);
  const pageViewCount = useMemo(() => trackerEvents.filter(e => e.event_name === "page_view").length, [trackerEvents]);

  // ── Enriched leads (using engine) ──
  const enrichedLeads = useMemo(() => {
    // Group events by visitor_id for matching
    const eventsByVisitor = new Map<string, TrackerEvent[]>();
    trackerEvents.forEach(e => {
      const arr = eventsByVisitor.get(e.visitor_id) || [];
      arr.push(e);
      eventsByVisitor.set(e.visitor_id, arr);
    });

    return leads.map(l => {
      const vid = l.metadata?.visitor_id;
      const matchedEvents = vid ? eventsByVisitor.get(vid) : undefined;
      return enrichLead(l, matchedEvents);
    });
  }, [leads, trackerEvents]);

  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter(l => {
      if (filters.paymentMethod !== "all" && l.payment_method !== filters.paymentMethod) return false;
      if (filters.stage !== "all" && l.stage !== filters.stage) return false;
      if (filters.cidade !== "all" && l.cidade !== filters.cidade) return false;
      if (filters.origin !== "all" && l.origin !== filters.origin) return false;
      if (filters.device !== "all" && l.device !== filters.device) return false;
      return true;
    });
  }, [enrichedLeads, filters]);

  // ── Metrics (using engine) ──
  const metrics = useMemo(() =>
    calculateMetrics(enrichedLeads, trackerEvents, botAnalysis.botVisitorIds),
    [enrichedLeads, trackerEvents, botAnalysis]
  );

  // ── Funnel ──
  const [funnelDevice, setFunnelDevice] = useState("all");
  const [funnelOrigin, setFunnelOrigin] = useState("all");
  const [funnelCreative, setFunnelCreative] = useState("all");
  const [funnelRealtime, setFunnelRealtime] = useState("all");
  const [funnelBotFilter, setFunnelBotFilter] = useState("exclude_bots");

  // Legacy buildFunnel wrapper for filtered subsets
  const buildFunnel = useCallback((filteredUserEvents: UserEvent[], filteredLeads: EnrichedLead[], pvCount: number) => {
    // Convert UserEvents back to TrackerEvent-like for engine
    const asTracker: TrackerEvent[] = filteredUserEvents.map(e => ({
      id: e.id,
      created_at: e.created_at,
      event_name: e.event_type,
      visitor_id: e.event_data?.visitor_id || e.event_data?.session_id || e.id,
      session_id: e.event_data?.session_id || null,
      value: e.event_data?.value || 0,
      event_data: e.event_data,
      source: e.event_data?.utm_source || null,
      campaign: e.event_data?.utm_campaign || null,
    }));

    const botIds = funnelBotFilter !== "all" ? botAnalysis.botVisitorIds : new Set<string>();
    const steps = buildFunnelEngine(asTracker, filteredLeads, botIds);

    // Ensure visitor count uses pvCount as floor
    if (steps.length > 0 && pvCount > steps[0].count) {
      steps[0] = { ...steps[0], count: pvCount, rawCount: pvCount };
    }

    // Add icon/color for rendering
    const icons = [Eye, MousePointerClick, ShoppingCart, ShoppingCart, Wallet, QrCode, CheckCircle2];
    const colors = ["bg-blue-500", "bg-cyan-500", "bg-orange-400", "bg-orange-500", "bg-indigo-500", "bg-purple-500", "bg-emerald-500"];
    return steps.map((s, i) => ({ ...s, icon: icons[i] || Eye, color: colors[i] || "bg-muted" }));
  }, [botAnalysis, funnelBotFilter]);

  // Determine device from event
  const getEventDevice = (e: UserEvent): string => {
    const d = e.event_data?.device;
    if (typeof d === "string") {
      const dl = d.toLowerCase();
      if (dl === "mobile" || dl === "desktop" || dl === "tablet") return dl;
    }
    const ua = String(e.event_data?.user_agent || "");
    if (/ipad|tablet/i.test(ua)) return "tablet";
    if (/mobile|android|iphone/i.test(ua)) return "mobile";
    if (/windows|macintosh|linux/i.test(ua)) return "desktop";
    return "unknown";
  };

  // Domains to ignore as traffic sources (platform/spam)
  const IGNORED_ORIGINS = ["lovable.dev", "healthkart.com", "kango-roo.com"];

  const getEventOrigin = (e: UserEvent): string => {
    const src = String(e.event_data?.utm_source || "");
    if (!src) return "Direto";
    const s = src.toLowerCase();
    // Ignore platform/spam domains
    if (IGNORED_ORIGINS.some(d => s.includes(d))) return "";
    // Normalize TikTok SCK codes (TT-timestamp-random)
    if (/^tt-\d+/i.test(s) || s.includes("tiktok") || s === "tt") return "TikTok";
    if (s.includes("facebook") || s.includes("fb") || s.includes("instagram")) return "Ads";
    if (s.includes("google")) return "Google";
    if (s.includes("organic")) return "Orgânico";
    // Filter long click IDs
    if (src.length > 50 || /^[A-Za-z0-9_-]{40,}$/.test(src)) return "Direto";
    return src;
  };

  // ── Traffic-enriched bot data (adds quality/score for traffic analysis) ──
  type TrafficScoredVisitor = ScoredVisitor & { quality: TrafficQuality; score: number; isBot: boolean; fullId: string };

  const trafficBotData = useMemo(() => {
    const visitorMap = new Map<string, UserEvent[]>();
    events.forEach(e => {
      const key = e.event_data?.visitor_id || e.event_data?.session_id || e.id;
      const arr = visitorMap.get(key) || [];
      arr.push(e);
      visitorMap.set(key, arr);
    });

    const scored: TrafficScoredVisitor[] = [];
    visitorMap.forEach((evts, key) => {
      let qualityScore = 5;
      evts.forEach(e => {
        if (e.event_type === "scroll_depth" || e.event_type === "view_content") {
          const pct = Number(e.event_data?.percent || 0);
          if (pct > 30) qualityScore += 10;
        }
        if (e.event_type === "click_buy" || e.event_type === "click_buy_button") qualityScore += 20;
        if (e.event_type === "checkout_start" || e.event_type === "checkout_started") qualityScore += 40;
        if (e.event_type === "pix_generated") qualityScore += 60;
        if (e.event_type === "card_submitted") qualityScore += 50;
        if (e.event_type === "purchase" || e.event_type === "payment_confirmed" || e.event_type === "pix_paid") qualityScore += 100;
      });

      const botEntry = botAnalysis.scored.find(s => s.fullId === key);
      let quality: TrafficQuality = "quente";
      if (qualityScore <= 10) quality = "ruim";
      else if (qualityScore <= 30) quality = "frio";
      else if (qualityScore <= 60) quality = "morno";

      scored.push({
        id: key.slice(0, 8),
        fullId: key,
        botScore: botEntry?.botScore || 0,
        botLevel: botEntry?.botLevel || "normal",
        timeOnPage: botEntry?.timeOnPage || 0,
        maxScroll: botEntry?.maxScroll || 0,
        clicks: botEntry?.clicks || 0,
        origin: botEntry?.origin || "Direto",
        device: botEntry?.device || "—",
        userAgent: botEntry?.userAgent || "",
        eventCount: evts.length,
        reasons: botEntry?.reasons || [],
        quality,
        score: qualityScore,
        isBot: botEntry?.botLevel === "bot",
      });
    });

    return scored;
  }, [events, botAnalysis]);

  // ── Filtered funnel data ──
  const funnelData = useMemo(() => {
    const now = Date.now();
    const realtimeMap: Record<string, number> = { "5m": 5 * 60000, "30m": 30 * 60000, "1h": 3600000 };

    let fe = events;
    let fl = enrichedLeads;
    let pvc = pageViewCount;

    if (funnelRealtime !== "all" && realtimeMap[funnelRealtime]) {
      const since = now - realtimeMap[funnelRealtime];
      fe = fe.filter(e => new Date(e.created_at).getTime() > since);
      fl = fl.filter(l => new Date(l.created_at).getTime() > since);
      pvc = 0;
    }

    if (funnelDevice !== "all") {
      fe = fe.filter(e => getEventDevice(e) === funnelDevice);
      fl = fl.filter(l => l.device.toLowerCase() === funnelDevice);
      pvc = 0;
    }

    if (funnelOrigin !== "all") {
      fe = fe.filter(e => getEventOrigin(e) === funnelOrigin);
      fl = fl.filter(l => l.origin === funnelOrigin);
      pvc = 0;
    }

    if (funnelCreative !== "all") {
      fe = fe.filter(e => String(e.event_data?.utm_content || "") === funnelCreative);
      fl = fl.filter(l => l.creative === funnelCreative);
      pvc = 0;
    }

    if (funnelBotFilter !== "all") {
      fe = fe.filter(e => {
        const vid = e.event_data?.visitor_id || e.event_data?.session_id || e.id;
        if (funnelBotFilter === "exclude_bots") return !botAnalysis.botVisitorIds.has(vid);
        if (funnelBotFilter === "valid") return !botAnalysis.botVisitorIds.has(vid) && !botAnalysis.suspectVisitorIds.has(vid);
        return true;
      });
      pvc = 0;
    }

    return buildFunnel(fe, fl, pvc);
  }, [events, enrichedLeads, pageViewCount, funnelDevice, funnelOrigin, funnelCreative, funnelRealtime, funnelBotFilter, buildFunnel, botAnalysis]);

  // ── Device comparison ──
  const deviceComparison = useMemo(() => {
    const devices = ["mobile", "desktop", "tablet"];
    return devices.map(dev => {
      const de = events.filter(e => getEventDevice(e) === dev);
      const dl = enrichedLeads.filter(l => l.device.toLowerCase() === dev);
      const funnel = buildFunnel(de, dl, 0);
      const visitors = funnel[0]?.count || 0;
      const paid = funnel[funnel.length - 1]?.count || 0;
      const convRate = visitors > 0 ? (paid / visitors * 100) : 0;
      return { device: dev, visitors, paid, convRate };
    }).filter(d => d.visitors > 0);
  }, [events, enrichedLeads, buildFunnel]);

  const uniqueCreatives = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => {
      const c = e.event_data?.utm_content;
      if (c && typeof c === "string") set.add(c);
    });
    return Array.from(set).sort();
  }, [events]);

  const funnelHealth = useMemo(() => {
    if (funnelData.length < 2 || funnelData[0].count === 0) return { score: 100, label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted" };
    const rates = funnelData.slice(1).map(s => s.convRate);
    const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 100;
    const overallConv = funnelData[0].count > 0 ? (funnelData[funnelData.length - 1].count / funnelData[0].count) * 100 : 0;
    const score = Math.round(avgRate * 0.4 + overallConv * 0.6 + 20);
    const clamped = Math.min(100, Math.max(0, score));
    if (clamped >= 90) return { score: clamped, label: "Funil Saudável", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (clamped >= 70) return { score: clamped, label: "Atenção", color: "text-amber-500", bg: "bg-amber-500/10" };
    if (clamped >= 50) return { score: clamped, label: "Gargalo Moderado", color: "text-orange-500", bg: "bg-orange-500/10" };
    return { score: clamped, label: "Gargalo Crítico", color: "text-red-500", bg: "bg-red-500/10" };
  }, [funnelData]);

  // ── Radar de Conversão (enhanced diagnostic) ──
  const radarConversao = useMemo(() => {
    if (funnelData.length < 2 || funnelData[0].count === 0) return null;

    // Find biggest bottleneck
    let worstIdx = 1;
    let worstDrop = 0;
    funnelData.slice(1).forEach((step, i) => {
      if (step.dropRate > worstDrop) {
        worstDrop = step.dropRate;
        worstIdx = i + 1;
      }
    });

    const bottleneckStep = funnelData[worstIdx];
    const prevStep = funnelData[worstIdx - 1];
    const overallConv = funnelData[0].count > 0 ? (funnelData[funnelData.length - 1].count / funnelData[0].count * 100) : 0;

    type DiagItem = { title: string; desc: string; cause: string; severity: "critical" | "warning" | "info" };
    type Suggestion = { icon: string; text: string; priority: "alta" | "média" | "baixa" };

    const diagnostics: DiagItem[] = [];
    const suggestions: Suggestion[] = [];

    const visitors = funnelData[0]?.count || 0;
    const engaged = funnelData[1]?.count || 0;
    const buyClicks = funnelData[2]?.count || 0;
    const checkouts = funnelData[3]?.count || 0;
    const paymentInit = funnelData[4]?.count || 0;
    const pixCard = funnelData[5]?.count || 0;
    const paid = funnelData[6]?.count || 0;

    // ── Case 1: Low engagement ──
    if (visitors > 20 && engaged / visitors < 0.3) {
      diagnostics.push({
        title: "Baixo engajamento na página",
        desc: `Apenas ${((engaged / visitors) * 100).toFixed(1)}% dos visitantes interagem. A maioria sai sem scrollar ou clicar.`,
        cause: "Conteúdo acima da dobra pode não estar gerando interesse, ou o carregamento está lento.",
        severity: "warning",
      });
      suggestions.push(
        { icon: "🎯", text: "Melhorar headline e primeira dobra da página", priority: "alta" },
        { icon: "📱", text: "Verificar velocidade de carregamento no mobile", priority: "alta" },
        { icon: "🎨", text: "Adicionar elementos visuais que prendam atenção", priority: "média" },
      );
    }

    // ── Case 2: Low buy click rate ──
    if (visitors > 20 && buyClicks / visitors < 0.05) {
      diagnostics.push({
        title: "Baixa taxa de clique em comprar",
        desc: `Apenas ${((buyClicks / visitors) * 100).toFixed(1)}% dos visitantes clicam no botão de compra.`,
        cause: "Possível problema na copy, proposta de valor ou destaque do botão. O CTA pode não estar visível o suficiente.",
        severity: buyClicks / visitors < 0.02 ? "critical" : "warning",
      });
      suggestions.push(
        { icon: "💰", text: "Destacar preço e desconto mais claramente", priority: "alta" },
        { icon: "🛒", text: "Tornar o botão de compra mais visível e urgente", priority: "alta" },
        { icon: "⭐", text: "Adicionar mais prova social acima do botão", priority: "média" },
        { icon: "🎁", text: "Testar oferta com bônus ou frete grátis", priority: "média" },
      );
    }

    // ── Case 3: Interest but no checkout ──
    if (buyClicks > 5 && checkouts / buyClicks < 0.3) {
      diagnostics.push({
        title: "Interesse sem conversão em checkout",
        desc: `Usuários clicam em comprar (${buyClicks}) mas poucos iniciam checkout (${checkouts}).`,
        cause: "Usuários demonstram interesse mas não iniciam checkout. Possível problema no preço, frete ou no processo de seleção.",
        severity: "warning",
      });
      suggestions.push(
        { icon: "💵", text: "Revisar preço ou adicionar parcelas mais atrativas", priority: "alta" },
        { icon: "🚚", text: "Oferecer frete grátis ou reduzido", priority: "média" },
      );
    }

    // ── Case 4: High checkout abandonment ──
    if (checkouts > 5 && pixCard / checkouts < 0.4) {
      diagnostics.push({
        title: "Alto abandono no checkout",
        desc: `Apenas ${((pixCard / checkouts) * 100).toFixed(0)}% dos checkouts resultam em tentativa de pagamento.`,
        cause: "Alta taxa de abandono no checkout. Possível fricção no formulário ou falta de confiança.",
        severity: "critical",
      });
      suggestions.push(
        { icon: "📋", text: "Simplificar formulário de checkout", priority: "alta" },
        { icon: "🔒", text: "Adicionar selos de segurança no checkout", priority: "alta" },
        { icon: "⏱", text: "Adicionar timer de urgência no checkout", priority: "média" },
      );
    }

    // ── Case 5: Payment not completing ──
    if (pixCard > 3 && paid / pixCard < 0.3) {
      diagnostics.push({
        title: "Pagamento iniciado mas não concluído",
        desc: `Apenas ${((paid / pixCard) * 100).toFixed(0)}% das tentativas de pagamento são concluídas.`,
        cause: "Usuários iniciam pagamento mas não concluem. Pode faltar urgência ou clareza nas instruções de Pix/Cartão.",
        severity: "warning",
      });
      suggestions.push(
        { icon: "📱", text: "Verificar se QR code Pix funciona corretamente", priority: "alta" },
        { icon: "💳", text: "Verificar integração de pagamento por cartão", priority: "alta" },
        { icon: "📩", text: "Implementar lembrete de pagamento Pix", priority: "média" },
      );
    }

    // ── Case 6: Traffic quality ──
    if (visitors > 50 && engaged / visitors < 0.15) {
      diagnostics.push({
        title: "Possível tráfego de baixa qualidade",
        desc: `Grande volume de visitantes (${visitors}) com baixíssima interação (${((engaged / visitors) * 100).toFixed(1)}%).`,
        cause: "Pode ser tráfego automatizado, público errado ou criativo enganoso que atrai público sem intenção de compra.",
        severity: "critical",
      });
      suggestions.push(
        { icon: "🎯", text: "Revisar segmentação de público nas campanhas", priority: "alta" },
        { icon: "🤖", text: "Verificar aba de Bots para tráfego suspeito", priority: "alta" },
        { icon: "📊", text: "Testar novos criativos com público diferente", priority: "média" },
      );
    }

    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((s, i, arr) => arr.findIndex(x => x.text === s.text) === i);

    // Main bottleneck label
    const bottleneckLabel = `${prevStep.label} → ${bottleneckStep.label}`;
    const bottleneckRate = bottleneckStep.convRate;

    // Smart summary
    let summary = "";
    if (diagnostics.length === 0) {
      summary = "Seu funil está funcionando bem. Nenhum gargalo crítico detectado.";
    } else {
      const main = diagnostics[0];
      summary = `Seu funil apresenta ${main.severity === "critical" ? "gargalo crítico" : "atenção"} na etapa de ${bottleneckLabel}. ${main.desc} ${main.cause}`;
    }

    return {
      diagnostics,
      suggestions: uniqueSuggestions,
      overallConv,
      bottleneckLabel,
      bottleneckRate,
      bottleneckDrop: worstDrop,
      summary,
      healthScore: funnelHealth.score,
      healthLabel: funnelHealth.label,
      healthColor: funnelHealth.color,
      healthBg: funnelHealth.bg,
    };
  }, [funnelData, funnelHealth]);

  // Note: radarHeatmapInsights, radarSessionInsights, radarDeviceInsights are defined after their dependencies below

  // ── Device Funnel Analysis ──
  const deviceFunnelAnalysis = useMemo(() => {
    const devices = ["mobile", "desktop", "tablet"];
    const results: { device: string; visitors: number; paid: number; convRate: number; alerts: string[] }[] = [];

    devices.forEach(dev => {
      const de = events.filter(e => getEventDevice(e) === dev);
      const dl = enrichedLeads.filter(l => l.device.toLowerCase() === dev);
      const funnel = buildFunnel(de, dl, 0);
      const visitors = funnel[0]?.count || 0;
      const engaged = funnel[1]?.count || 0;
      const paid = funnel[funnel.length - 1]?.count || 0;
      const convRate = visitors > 0 ? (paid / visitors * 100) : 0;
      const alerts: string[] = [];

      if (visitors > 20 && convRate < 1) alerts.push("Conversão muito baixa. Verificar qualidade do tráfego.");
      if (visitors > 20 && engaged / visitors < 0.1) alerts.push("Quase nenhuma interação. Possível tráfego automatizado.");
      if (dev === "desktop" && visitors > 50 && paid === 0) alerts.push("Zero vendas em desktop. Verificar layout ou tráfego.");

      if (visitors > 0) results.push({ device: dev, visitors, paid, convRate, alerts });
    });

    return results;
  }, [events, enrichedLeads, buildFunnel]);

  // ── Session Replay Data (visitor timelines) ──
  const visitorSessions = useMemo(() => {
    const visitorMap = new Map<string, { events: UserEvent[]; firstSeen: number; lastSeen: number; device: string; origin: string }>();
    events.forEach(e => {
      const vid = e.event_data?.visitor_id || e.event_data?.session_id;
      if (!vid) return;
      const key = String(vid);
      // Skip bots
      if (botAnalysis.botVisitorIds.has(key)) return;

      const time = new Date(e.created_at).getTime();
      const existing = visitorMap.get(key);
      if (existing) {
        existing.events.push(e);
        existing.firstSeen = Math.min(existing.firstSeen, time);
        existing.lastSeen = Math.max(existing.lastSeen, time);
      } else {
        visitorMap.set(key, {
          events: [e],
          firstSeen: time,
          lastSeen: time,
          device: String(e.event_data?.device || "—"),
          origin: String(e.event_data?.utm_source || "Direto"),
        });
      }
    });

    return Array.from(visitorMap.entries())
      .map(([id, data]) => ({
        id: id.slice(0, 8),
        fullId: id,
        events: data.events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        duration: Math.round((data.lastSeen - data.firstSeen) / 1000),
        device: data.device,
        origin: data.origin,
        eventCount: data.events.length,
        firstSeen: data.firstSeen,
      }))
      .filter(s => s.eventCount >= 2)
      .sort((a, b) => b.firstSeen - a.firstSeen)
      .slice(0, 50);
  }, [events, botAnalysis]);

  // ── Heatmap Data ──
  const heatmapData = useMemo(() => {
    const clicksBySection = new Map<string, number>();
    const scrollDepths: number[] = [];

    events.forEach(e => {
      if (botAnalysis.botVisitorIds.has(e.event_data?.visitor_id)) return;

      if (e.event_type === "click_position") {
        const section = String(e.event_data?.section || "unknown");
        clicksBySection.set(section, (clicksBySection.get(section) || 0) + 1);
      }
      if (e.event_type === "scroll_depth" || e.event_type === "scroll_milestone") {
        const pct = Number(e.event_data?.percent || 0);
        if (pct > 0) scrollDepths.push(pct);
      }
    });

    const totalClicks = Array.from(clicksBySection.values()).reduce((s, v) => s + v, 0) || 1;
    const sections = Array.from(clicksBySection.entries())
      .map(([section, clicks]) => ({ section, clicks, pct: Math.round((clicks / totalClicks) * 100) }))
      .sort((a, b) => b.clicks - a.clicks);

    // Scroll depth distribution
    const scrollBuckets = [
      { label: "0-25%", min: 0, max: 25, count: 0 },
      { label: "25-50%", min: 25, max: 50, count: 0 },
      { label: "50-75%", min: 50, max: 75, count: 0 },
      { label: "75-90%", min: 75, max: 90, count: 0 },
      { label: "90-100%", min: 90, max: 100, count: 0 },
    ];
    scrollDepths.forEach(d => {
      for (const b of scrollBuckets) {
        if (d >= b.min && d < b.max) { b.count++; break; }
        if (d >= 90 && b.min === 90) { b.count++; break; }
      }
    });
    const maxBucket = Math.max(...scrollBuckets.map(b => b.count), 1);

    return { sections, scrollBuckets, maxBucket, totalClicks, totalScrollEvents: scrollDepths.length };
  }, [events, botAnalysis]);

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [funnelSubView, setFunnelSubView] = useState<"funnel" | "replay" | "heatmap" | "radar">("funnel");

  // ── Radar: Heatmap Insights (must be after heatmapData) ──
  const radarHeatmapInsights = useMemo(() => {
    const insights: { icon: string; text: string }[] = [];
    if (heatmapData.sections.length > 0) {
      const heroClicks = heatmapData.sections.find(s => s.section === "hero");
      const buySection = heatmapData.sections.find(s => s.section === "detalhes" || s.section === "galeria");
      if (heroClicks && heroClicks.pct < 10 && heatmapData.totalClicks > 20) {
        insights.push({ icon: "👆", text: "Poucos cliques no topo da página. CTA pode não estar visível." });
      }
      if (!buySection || (buySection.pct < 5 && heatmapData.totalClicks > 20)) {
        insights.push({ icon: "🛒", text: "CTA pouco visível ou pouco atrativo. Considere reposicionar." });
      }
    }
    if (heatmapData.totalScrollEvents > 10) {
      const below50 = heatmapData.scrollBuckets.filter(b => b.min >= 50).reduce((s, b) => s + b.count, 0);
      const total = heatmapData.scrollBuckets.reduce((s, b) => s + b.count, 0) || 1;
      if (below50 / total < 0.3) {
        insights.push({ icon: "📜", text: "Maioria dos visitantes não chega ao meio da página. Conteúdo acima da dobra pode não estar gerando interesse." });
      }
    }
    return insights;
  }, [heatmapData]);

  // ── Radar: Session Insights (must be after visitorSessions) ──
  const radarSessionInsights = useMemo(() => {
    const insights: { icon: string; text: string }[] = [];
    if (visitorSessions.length > 5) {
      const shortSessions = visitorSessions.filter(s => s.duration < 3).length;
      const shortPct = (shortSessions / visitorSessions.length) * 100;
      if (shortPct > 40) {
        insights.push({ icon: "⚡", text: `${shortPct.toFixed(0)}% dos visitantes saem em menos de 3 segundos. Possível tráfego de baixa qualidade ou criativo enganoso.` });
      }
      const scrollersNoBuy = visitorSessions.filter(s => {
        const hasScroll = s.events.some(e => e.event_type === "scroll_depth" || e.event_type === "scroll_milestone");
        const hasBuy = s.events.some(e => e.event_type === "click_buy_button");
        return hasScroll && !hasBuy;
      }).length;
      const scrollerPct = (scrollersNoBuy / visitorSessions.length) * 100;
      if (scrollerPct > 60) {
        insights.push({ icon: "👀", text: `${scrollerPct.toFixed(0)}% dos visitantes rolam a página mas não clicam em comprar. Oferta pode não estar convincente.` });
      }
    }
    return insights;
  }, [visitorSessions]);

  // ── Radar: Device Insights (must be after deviceFunnelAnalysis) ──
  const radarDeviceInsights = useMemo(() => {
    const insights: { icon: string; text: string }[] = [];
    if (deviceFunnelAnalysis.length >= 2) {
      const mobile = deviceFunnelAnalysis.find(d => d.device === "mobile");
      const desktop = deviceFunnelAnalysis.find(d => d.device === "desktop");
      if (mobile && desktop && mobile.convRate > 2 && desktop.convRate < 0.5 && desktop.visitors > 20) {
        insights.push({ icon: "💻", text: `Conversão muito baixa em desktop (${desktop.convRate.toFixed(1)}%) vs mobile (${mobile.convRate.toFixed(1)}%). Problema possível de layout ou responsividade.` });
      }
      if (desktop && desktop.visitors > 50 && desktop.paid === 0) {
        insights.push({ icon: "🖥", text: "Zero vendas em desktop apesar de tráfego significativo. Verificar layout ou qualidade do tráfego." });
      }
    }
    return insights;
  }, [deviceFunnelAnalysis]);

  const bottleneckAlerts = useMemo(() => {
    const alerts: { type: "critical" | "warning"; title: string; desc: string }[] = [];
    const visitors = funnelData.find(s => s.key === "visitors")?.count || 0;
    const buyClicks = funnelData.find(s => s.key === "buy_clicks")?.count || 0;
    const checkouts = funnelData.find(s => s.key === "checkouts")?.count || 0;
    const pixCard = funnelData.find(s => s.key === "pix_card")?.count || 0;
    const paid = funnelData.find(s => s.key === "paid")?.count || 0;
    if (visitors > 20 && buyClicks / visitors < 0.05) {
      alerts.push({ type: "warning", title: "Baixa taxa de clique em comprar", desc: `Apenas ${((buyClicks / visitors) * 100).toFixed(1)}% dos visitantes clicam em comprar.` });
    }
    if (checkouts > 5 && pixCard / checkouts < 0.4) {
      alerts.push({ type: "critical", title: "Abandono alto no checkout", desc: `Apenas ${((pixCard / checkouts) * 100).toFixed(0)}% dos checkouts geram Pix ou enviam cartão.` });
    }
    if (pixCard > 3 && paid / pixCard < 0.3) {
      alerts.push({ type: "critical", title: "Abandono após geração de Pix/Cartão", desc: `Apenas ${((paid / pixCard) * 100).toFixed(0)}% resultam em pagamento.` });
    }
    return alerts;
  }, [funnelData]);

  // ── Traffic Quality Analysis ──
  const trafficAnalysis = useMemo(() => {
    const scored = trafficBotData;
    const total = scored.length || 1;
    const dist = {
      ruim: scored.filter(v => v.quality === "ruim").length,
      frio: scored.filter(v => v.quality === "frio").length,
      morno: scored.filter(v => v.quality === "morno").length,
      quente: scored.filter(v => v.quality === "quente").length,
    };
    const distPct = {
      ruim: Math.round((dist.ruim / total) * 100),
      frio: Math.round((dist.frio / total) * 100),
      morno: Math.round((dist.morno / total) * 100),
      quente: Math.round((dist.quente / total) * 100),
    };

    const sourceMap = new Map<string, { visitors: number; checkouts: number; paid: number; totalScore: number }>();
    scored.forEach(v => {
      const src = v.origin || "Direto";
      const existing = sourceMap.get(src) || { visitors: 0, checkouts: 0, paid: 0, totalScore: 0 };
      existing.visitors++;
      existing.totalScore += v.score;
      if (v.score >= 40) existing.checkouts++;
      if (v.score >= 100) existing.paid++;
      sourceMap.set(src, existing);
    });

    const leadsByOrigin = new Map<string, { checkouts: number; paid: number }>();
    enrichedLeads.forEach(l => {
      const src = l.origin;
      const existing = leadsByOrigin.get(src) || { checkouts: 0, paid: 0 };
      existing.checkouts++;
      if (l.stage === "pago") existing.paid++;
      leadsByOrigin.set(src, existing);
    });

    const sources = Array.from(sourceMap.entries()).map(([name, data]) => {
      const leadData = leadsByOrigin.get(name);
      return {
        name, visitors: data.visitors,
        checkouts: leadData?.checkouts || data.checkouts,
        paid: leadData?.paid || data.paid,
        convRate: data.visitors > 0 ? ((leadData?.paid || data.paid) / data.visitors * 100) : 0,
        avgQuality: data.visitors > 0 ? Math.round(data.totalScore / data.visitors) : 0,
      };
    }).sort((a, b) => b.visitors - a.visitors);

    const trafficAlerts: { type: "critical" | "warning"; title: string; desc: string }[] = [...botAnalysis.alerts];
    if (dist.ruim > total * 0.4) {
      trafficAlerts.push({ type: "warning", title: "Alta taxa de tráfego ruim", desc: `${distPct.ruim}% dos visitantes saem sem interagir.` });
    }
    if (dist.frio > total * 0.5) {
      trafficAlerts.push({ type: "warning", title: "Grande volume de visitantes frios", desc: `${distPct.frio}% dos visitantes tem baixa interação.` });
    }
    sources.forEach(s => {
      if (s.visitors > 10 && s.convRate < 1 && s.avgQuality < 20) {
        trafficAlerts.push({ type: "warning", title: `Campanha "${s.name}" com tráfego de baixa qualidade`, desc: `${s.visitors} visitantes, ${s.paid} pagamentos (${s.convRate.toFixed(1)}%).` });
      }
    });

    return { scored, dist, distPct, sources, trafficAlerts, botCount: botAnalysis.dist.bot, total: scored.length };
  }, [botAnalysis, enrichedLeads]);

  // ── Creative Analysis ──
  const creativeAnalysis = useMemo(() => {
    type CreativeData = {
      id: string;
      platform: string;
      campaign: string;
      adGroup: string;
      visitors: number;
      totalTimeOnPage: number;
      totalScroll: number;
      buyClicks: number;
      checkouts: number;
      pixGenerated: number;
      paid: number;
      events: UserEvent[];
    };

    const creativeMap = new Map<string, CreativeData>();

    // Group events by creative (utm_content)
    events.forEach(e => {
      const ed = e.event_data || {};
      const creativeId = ed.utm_content || ed.creative_id || ed.ad_id || "";
      if (!creativeId) return;

      const key = String(creativeId);
      const existing = creativeMap.get(key) || {
        id: key,
        platform: String(ed.utm_source || "Desconhecido"),
        campaign: String(ed.utm_campaign || "—"),
        adGroup: String(ed.utm_term || ed.ad_group || "—"),
        visitors: 0,
        totalTimeOnPage: 0,
        totalScroll: 0,
        buyClicks: 0,
        checkouts: 0,
        pixGenerated: 0,
        paid: 0,
        events: [],
      };

      existing.events.push(e);

      if (e.event_type === "page_view") existing.visitors++;
      if (e.event_type === "scroll_depth") {
        existing.totalScroll += Number(ed.percent || 0);
      }
      if (e.event_type === "click_buy_button") existing.buyClicks++;
      if (e.event_type === "checkout_initiated") existing.checkouts++;
      if (e.event_type === "pix_generated") existing.pixGenerated++;
      if (e.event_type === "card_submitted") existing.checkouts = Math.max(existing.checkouts, existing.checkouts);
      if (e.event_type === "payment_confirmed" || e.event_type === "pix_paid") existing.paid++;

      creativeMap.set(key, existing);
    });

    // Also count from enrichedLeads
    enrichedLeads.forEach(l => {
      const meta = l.metadata || {};
      const creativeId = meta.utm_content || meta.creative_id || "";
      if (!creativeId) return;
      const key = String(creativeId);
      const existing = creativeMap.get(key);
      if (!existing) return;
      // Count checkouts and payments from actual leads
      existing.checkouts = Math.max(existing.checkouts, 1);
      if (l.stage === "pago") existing.paid++;
      if (l.payment_method === "pix" && l.transaction_id) existing.pixGenerated++;
    });

    type ScoredCreative = CreativeData & {
      avgTimeOnPage: number;
      avgScroll: number;
      convRate: number;
      score: number;
      scoreLabel: string;
      scoreColor: string;
      alerts: { type: "critical" | "warning"; msg: string }[];
    };

    const scored: ScoredCreative[] = Array.from(creativeMap.values())
      .filter(c => c.visitors >= 1 || c.buyClicks >= 1 || c.checkouts >= 1)
      .map(c => {
        const v = Math.max(c.visitors, 1);
        const avgTimeOnPage = c.totalTimeOnPage / v;
        const scrollEvents = c.events.filter(e => e.event_type === "scroll_depth").length;
        const avgScroll = scrollEvents > 0 ? c.totalScroll / scrollEvents : 0;
        const buyRate = c.buyClicks / v;
        const checkoutRate = v > 0 ? c.checkouts / v : 0;
        const payRate = v > 0 ? c.paid / v : 0;
        const convRate = v > 0 ? (c.paid / v) * 100 : 0;

        // Score 0-100
        let score = 0;
        score += Math.min(buyRate * 100, 25); // max 25 for buy click rate
        score += Math.min(checkoutRate * 100, 25); // max 25 for checkout rate
        score += Math.min(payRate * 200, 30); // max 30 for payment rate
        score += Math.min(avgScroll / 5, 10); // max 10 for scroll
        score += Math.min(avgTimeOnPage / 3, 10); // max 10 for time
        score = Math.round(Math.min(100, score));

        const scoreLabel = score >= 90 ? "Excelente" : score >= 70 ? "Bom" : score >= 50 ? "Fraco" : "Ruim";
        const scoreColor = score >= 90 ? "text-emerald-500 bg-emerald-500/10" : score >= 70 ? "text-blue-500 bg-blue-500/10" : score >= 50 ? "text-amber-500 bg-amber-500/10" : "text-red-500 bg-red-500/10";

        // Alerts
        const alerts: { type: "critical" | "warning"; msg: string }[] = [];
        if (v >= 50 && buyRate < 0.01) {
          alerts.push({ type: "critical", msg: "Possível criativo com baixa intenção de compra." });
        }
        if (v >= 20 && avgTimeOnPage < 3) {
          alerts.push({ type: "warning", msg: "Usuários estão saindo rapidamente. Possível clique acidental ou promessa errada no anúncio." });
        }
        if (c.buyClicks >= 10 && c.checkouts < c.buyClicks * 0.1) {
          alerts.push({ type: "warning", msg: "Criativo gera curiosidade mas não intenção de compra." });
        }
        if (c.checkouts >= 5 && c.paid < c.checkouts * 0.1) {
          alerts.push({ type: "warning", msg: "Criativo pode estar prometendo algo diferente da oferta." });
        }

        return { ...c, avgTimeOnPage, avgScroll, convRate, score, scoreLabel, scoreColor, alerts };
      })
      .sort((a, b) => b.visitors - a.visitors);

    // Global alerts
    const globalAlerts: { type: "critical" | "warning"; title: string; desc: string }[] = [];
    scored.forEach(c => {
      c.alerts.forEach(a => {
        globalAlerts.push({ type: a.type, title: `Criativo "${c.id.slice(0, 20)}"`, desc: a.msg });
      });
    });

    return { creatives: scored, alerts: globalAlerts };
  }, [events, enrichedLeads]);

  // ── Selected creative for drill-down ──
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null);

  const selectedCreativeData = useMemo(() => {
    if (!selectedCreative) return null;
    return creativeAnalysis.creatives.find(c => c.id === selectedCreative) || null;
  }, [selectedCreative, creativeAnalysis]);

  // ── Alerts ──
  const crmAlerts = useMemo(() => {
    const alerts: { type: "critical" | "warning"; title: string; desc: string }[] = [];
    const total = enrichedLeads.length;
    if (total < 5) return alerts;

    const paid = enrichedLeads.filter(l => l.stage === "pago").length;
    const pixGenerated = enrichedLeads.filter(l => l.payment_method === "pix" && l.transaction_id).length;
    const pixPaid = enrichedLeads.filter(l => l.payment_method === "pix" && l.stage === "pago").length;
    // Cartão enviado = dados coletados, não é venda pendente nem abandono
    const checkoutOnly = enrichedLeads.filter(l => l.stage === "checkout_iniciado").length;

    if (total > 10 && paid / total < 0.05) {
      alerts.push({ type: "critical", title: "Conversão geral muito baixa", desc: `Apenas ${paid} de ${total} leads converteram (${((paid / total) * 100).toFixed(1)}%).` });
    }
    if (pixGenerated > 3 && pixPaid / pixGenerated < 0.3) {
      alerts.push({ type: "warning", title: "Muitos Pix gerados sem pagamento", desc: `${pixGenerated} Pix gerados, mas apenas ${pixPaid} pagos (${((pixPaid / pixGenerated) * 100).toFixed(0)}%). Possível problema no pagamento.` });
    }
    // Alerta de cartão removido: cartão enviado = coletado (não é pendência)
    if (checkoutOnly > total * 0.6) {
      alerts.push({ type: "warning", title: "Alto abandono no checkout", desc: `${checkoutOnly} leads abandonaram no checkout (${((checkoutOnly / total) * 100).toFixed(0)}%). Revise a oferta.` });
    }

    // Click buy rate from events
    const buyClicks = events.filter(e => e.event_type === "click_buy_button").length;
    const pageViews = events.filter(e => e.event_type === "page_view").length;
    if (pageViews > 20 && buyClicks / pageViews < 0.05) {
      alerts.push({ type: "warning", title: "Poucos cliques em comprar", desc: `Apenas ${buyClicks} cliques em ${pageViews} visitas (${((buyClicks / pageViews) * 100).toFixed(1)}%). A página pode precisar de ajustes.` });
    }

    return alerts;
  }, [enrichedLeads, events]);

  // ── Pipeline grouped ──
  const pipeline = useMemo(() => {
    return buildPipeline(filteredLeads);
  }, [filteredLeads]);

  // ── Recovery leads ──
  const recoveryLeads = useMemo(() => {
    return enrichedLeads
      .filter(l => l.isRecovery)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [enrichedLeads]);

  // ── Recent visitors (from events) ──
  const recentVisitors = useMemo(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const visitors = new Map<string, { id: string; lastAction: string; lastTime: string; scroll: number; origin: string; device: string; timeOnPage: number }>();
    
    events
      .filter(e => new Date(e.created_at).getTime() > fiveMinAgo)
      .forEach(e => {
        const key = e.event_data?.visitor_id || e.event_data?.session_id || e.id;
        const existing = visitors.get(key);
        const eventTime = new Date(e.created_at).getTime();
        
        if (!existing || eventTime > new Date(existing.lastTime).getTime()) {
          const scroll = e.event_type === "scroll_depth" ? (e.event_data?.percent || 0) : (existing?.scroll || 0);
          visitors.set(key, {
            id: typeof key === "string" ? key.slice(0, 8) : String(key).slice(0, 8),
            lastAction: EVENT_LABELS[e.event_type]?.label || e.event_type,
            lastTime: e.created_at,
            scroll,
            origin: e.event_data?.utm_source || existing?.origin || "Direto",
            device: e.event_data?.device || existing?.device || "—",
            timeOnPage: existing ? Math.round((eventTime - (eventTime - 60000)) / 1000) : 0,
          });
        }
      });
    
    return Array.from(visitors.values()).slice(0, 20);
  }, [events]);

  // ── Unique values for filters ──
  const uniqueCidades = useMemo(() => {
    const set = new Set(leads.map(l => l.cidade).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [leads]);

  const uniqueOrigins = useMemo(() => {
    const set = new Set(enrichedLeads.map(l => l.origin));
    return Array.from(set).sort();
  }, [enrichedLeads]);

  // ── Build timeline for selected lead ──
  const buildTimeline = (lead: EnrichedLead) => {
    const items: { time: string; label: string; icon: any; color: string; detail?: string }[] = [];

    items.push({
      time: lead.created_at,
      label: "Checkout iniciado",
      icon: ShoppingCart,
      color: "bg-orange-500/10 text-orange-500",
    });

    if (lead.payment_method === "pix") {
      items.push({
        time: lead.created_at,
        label: "Pagamento via Pix selecionado",
        icon: QrCode,
        color: "bg-purple-500/10 text-purple-500",
      });
    }

    if (lead.payment_method === "credit_card") {
      items.push({
        time: lead.created_at,
        label: "Pagamento via Cartão selecionado",
        icon: CreditCard,
        color: "bg-blue-500/10 text-blue-500",
      });
    }

    if (lead.transaction_id && lead.payment_method === "pix") {
      items.push({
        time: lead.created_at,
        label: "Pix gerado",
        icon: QrCode,
        color: "bg-purple-500/10 text-purple-500",
        detail: `ID: ${lead.transaction_id.slice(0, 16)}...`,
      });
    }

    if (lead.card_number) {
      items.push({
        time: lead.created_at,
        label: "Dados coletados (cartão)",
        icon: Wallet,
        color: "bg-blue-500/10 text-blue-500",
        detail: `Final ${lead.card_number.slice(-4)}`,
      });
    }

    if (lead.status === "paid" || lead.status === "approved") {
      items.push({
        time: lead.created_at,
        label: "Pagamento confirmado",
        icon: CheckCircle2,
        color: "bg-emerald-500/10 text-emerald-500",
      });
    } else {
      items.push({
        time: lead.created_at,
        label: "Aguardando pagamento",
        icon: Clock,
        color: "bg-amber-500/10 text-amber-500",
        detail: formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR }),
      });
    }

    // Add matched events from tracker
    const vid = lead.visitorId;
    if (vid) {
      const matchedEvents = trackerEvents.filter(e => e.visitor_id === vid);
      matchedEvents.forEach(e => {
        const cfg = EVENT_LABELS[e.event_name];
        if (cfg) {
          items.push({
            time: e.created_at,
            label: cfg.label,
            icon: Eye,
            color: cfg.color,
          });
        }
      });
    }

    return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  };

  const ScoreBadge = ({ level, score }: { level: ScoreLevel; score: number }) => {
    const cfg = SCORE_CONFIG[level];
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bgClass} ${cfg.colorClass}`}>
        <Icon className="h-3 w-3" /> {cfg.label} ({score})
      </span>
    );
  };

  const StageBadge = ({ stage }: { stage: PipelineStage }) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );

  const LeadCard = ({ l, borderColor }: { l: EnrichedLead; borderColor?: string }) => {
    const ScoreIcon = SCORE_CONFIG[l.temperatureLevel].icon;
    const scoreColor = SCORE_CONFIG[l.temperatureLevel].colorClass;
    return (
      <div
        onClick={() => setSelectedLead(l)}
        className={`glass-card ${borderColor || ""} rounded-xl p-3.5 cursor-pointer hover:scale-[1.02] transition-all duration-200 hover:shadow-lg group`}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-bold truncate flex-1 mr-2">{l.name}</p>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${SCORE_CONFIG[l.temperatureLevel].bgClass} ${scoreColor}`}>
            <ScoreIcon className="h-3 w-3" />
            {SCORE_CONFIG[l.temperatureLevel].label}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{l.email}</p>
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2">
            {l.total_amount ? (
              <span className="text-sm font-bold text-primary">
                R$ {(l.total_amount / 100).toFixed(2).replace(".", ",")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {l.cidade || "—"}/{l.uf || "—"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground">{l.payment_method === "pix" ? "Pix" : "Cartão"}</span>
            <span className="text-[9px] text-muted-foreground">· {l.origin}</span>
          </div>
          <span className="text-[9px] text-muted-foreground">
            {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ═══ HEALTH SCORE + QUICK METRICS ═══ */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Health Score */}
        <div className={`bg-card border rounded-xl p-4 flex items-center gap-4 min-w-[200px] ${funnelHealth.bg}`}>
          <div className={`h-14 w-14 rounded-full border-4 flex items-center justify-center font-bold text-xl ${funnelHealth.color}`} style={{ borderColor: "currentColor" }}>
            {funnelHealth.score}
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Saúde do Funil</p>
            <p className={`text-sm font-bold ${funnelHealth.color}`}>{funnelHealth.label}</p>
          </div>
        </div>
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 flex-1">
          {[
            { label: "Ativos (1h)", value: metrics.activeNow, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Leads Quentes", value: metrics.hot, icon: Flame, color: "text-red-500", bg: "bg-red-500/10" },
            { label: "Checkouts Abertos", value: metrics.openCheckouts, icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Cartões Coletados", value: metrics.cardsCollected, icon: CreditCard, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Pix Pendentes", value: metrics.pendingPix, icon: QrCode, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Abandonos", value: metrics.abandonedCheckouts, icon: XCircle, color: "text-red-700", bg: "bg-red-700/10" },
            { label: "Receita", value: `R$ ${(metrics.revenue / 100).toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Tempo Médio Pgto", value: `~${metrics.avgTimeToPay}min`, icon: Timer, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-card border rounded-xl p-3">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center mb-1.5 ${m.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${m.color}`} />
                </div>
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{m.label}</p>
                <p className="text-lg font-bold mt-0.5">{m.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SUB-TABS + FILTERS ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "pipeline" as const, label: "Pipeline", icon: TrendingUp, badge: filteredLeads.length },
            { key: "funnel" as const, label: "Funil", icon: Zap, badge: 0 },
            { key: "recovery" as const, label: "Recuperação", icon: Clock, badge: recoveryLeads.length },
            { key: "visitors" as const, label: "Online", icon: Activity, badge: recentVisitors.length },
            { key: "alerts" as const, label: "Alertas", icon: AlertTriangle, badge: crmAlerts.length + bottleneckAlerts.length },
            { key: "traffic" as const, label: "Tráfego", icon: Shield, badge: trafficAnalysis.trafficAlerts.length },
            { key: "criativos" as const, label: "Criativos", icon: Megaphone, badge: creativeAnalysis.alerts.length },
            { key: "bots" as const, label: "Bots", icon: Bot, badge: botAnalysis.dist.bot + botAnalysis.dist.suspeito },
            { key: "campanhas" as const, label: "Campanhas", icon: BarChart3, badge: 0 },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {t.badge > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                  t.key === "alerts" ? "bg-destructive text-destructive-foreground" :
                  t.key === "recovery" ? "bg-amber-500 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Filter className="h-3.5 w-3.5" /> Filtros
        </button>
      </div>

      {/* ═══ FILTERS PANEL ═══ */}
      {showFilters && (
        <div className="bg-card border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Pagamento</label>
            <select value={filters.paymentMethod} onChange={e => setFilters(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              <option value="pix">Pix</option>
              <option value="credit_card">Cartão</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Estágio</label>
            <select value={filters.stage} onChange={e => setFilters(f => ({ ...f, stage: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Origem</label>
            <select value={filters.origin} onChange={e => setFilters(f => ({ ...f, origin: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todas</option>
              {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Dispositivo</label>
            <select value={filters.device} onChange={e => setFilters(f => ({ ...f, device: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              <option value="Mobile">Mobile</option>
              <option value="Desktop">Desktop</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Cidade</label>
            <select value={filters.cidade} onChange={e => setFilters(f => ({ ...f, cidade: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todas</option>
              {uniqueCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Período</label>
            <select value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value }))} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="today">Hoje</option>
              <option value="7days">7 dias</option>
              <option value="30days">30 dias</option>
              <option value="90days">90 dias</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando CRM...</p>
      ) : (
        <>
          {/* ═══ PIPELINE ═══ */}
          {subTab === "pipeline" && (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {(["checkout_iniciado", "pagamento_iniciado", "pix_gerado", "cartao_enviado", "pago"] as PipelineStage[]).map(stage => {
                  const items = pipeline[stage];
                  const stageRevenue = items.reduce((sum, l) => sum + (l.status === "paid" ? (l.total_amount || 0) / 100 : 0), 0);
                  return (
                    <div key={stage} className="w-[280px] flex-shrink-0">
                      {/* Column Header */}
                      <div className="glass-card rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${STAGE_COLORS[stage]}`} />
                            <h3 className="text-xs font-bold uppercase tracking-wider">{STAGE_LABELS[stage]}</h3>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
                        </div>
                        {stageRevenue > 0 && (
                          <p className="text-[10px] text-success font-semibold mt-1.5">R$ {stageRevenue.toFixed(2).replace(".", ",")}</p>
                        )}
                      </div>
                      {/* Column Cards */}
                      <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {items.length === 0 ? (
                          <div className="glass-card rounded-xl p-4 text-center">
                            <p className="text-[11px] text-muted-foreground">Nenhum lead</p>
                          </div>
                        ) : (
                          <>
                            {items.slice(0, 30).map(l => (
                              <LeadCard key={l.id} l={l} />
                            ))}
                            {items.length > 30 && (
                              <p className="text-[10px] text-muted-foreground text-center py-2">+ {items.length - 30} leads</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredLeads.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum lead encontrado com os filtros atuais</p>
              )}
            </div>
          )}

          {/* ═══ FUNNEL MAP ═══ */}
          {subTab === "funnel" && (
            <div className="space-y-6">
              {/* Sub-navigation */}
              <div className="flex items-center gap-2">
                {([
                  { key: "funnel" as const, label: "📊 Funil", },
                  { key: "radar" as const, label: "🎯 Radar de Conversão" },
                  { key: "replay" as const, label: "🎬 Replays de Sessão" },
                  { key: "heatmap" as const, label: "🔥 Heatmap" },
                ] as const).map(v => (
                  <button
                    key={v.key}
                    onClick={() => setFunnelSubView(v.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${funnelSubView === v.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {/* ── FUNNEL VIEW ── */}
              {funnelSubView === "funnel" && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Mapa do Funil de Conversão
                  </h3>

                  {/* Funnel Filters */}
                  <div className="bg-card border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Dispositivo</label>
                      <select value={funnelDevice} onChange={e => setFunnelDevice(e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
                        <option value="all">Todos</option>
                        <option value="mobile">📱 Mobile</option>
                        <option value="desktop">💻 Desktop</option>
                        <option value="tablet">📟 Tablet</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Origem</label>
                      <select value={funnelOrigin} onChange={e => setFunnelOrigin(e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
                        <option value="all">Todas</option>
                        {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Criativo</label>
                      <select value={funnelCreative} onChange={e => setFunnelCreative(e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
                        <option value="all">Todos</option>
                        {uniqueCreatives.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Tempo Real</label>
                      <select value={funnelRealtime} onChange={e => setFunnelRealtime(e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
                        <option value="all">Todo período</option>
                        <option value="5m">Últimos 5 min</option>
                        <option value="30m">Últimos 30 min</option>
                        <option value="1h">Última 1 hora</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Filtro de Bots</label>
                      <select value={funnelBotFilter} onChange={e => setFunnelBotFilter(e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
                        <option value="all">Todos os visitantes</option>
                        <option value="exclude_bots">Excluir bots</option>
                        <option value="valid">Somente tráfego válido</option>
                      </select>
                    </div>
                  </div>

                  {/* Active filter tags */}
                  {(funnelDevice !== "all" || funnelOrigin !== "all" || funnelCreative !== "all" || funnelRealtime !== "all" || funnelBotFilter !== "all") && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Filtros ativos:</span>
                      {funnelDevice !== "all" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">{funnelDevice}</span>}
                      {funnelOrigin !== "all" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-semibold">{funnelOrigin}</span>}
                      {funnelCreative !== "all" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-semibold">{funnelCreative}</span>}
                      {funnelRealtime !== "all" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">⏱ {funnelRealtime}</span>}
                      {funnelBotFilter !== "all" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold">🤖 {funnelBotFilter === "exclude_bots" ? "Sem bots" : "Só válidos"}</span>}
                      <button onClick={() => { setFunnelDevice("all"); setFunnelOrigin("all"); setFunnelCreative("all"); setFunnelRealtime("all"); setFunnelBotFilter("all"); }} className="text-[10px] text-destructive hover:underline">Limpar</button>
                    </div>
                  )}

                  {/* Visual Funnel */}
                  <div className="space-y-0">
                    {funnelData.map((step, i) => {
                      const Icon = step.icon;
                      const maxCount = funnelData[0].count || 1;
                      const widthPct = Math.max(25, (step.count / maxCount) * 100);
                      const dropColor = step.dropSeverity === "green" ? "text-emerald-500" : step.dropSeverity === "yellow" ? "text-amber-500" : "text-red-500";
                      const dropBg = step.dropSeverity === "green" ? "bg-emerald-500" : step.dropSeverity === "yellow" ? "bg-amber-500" : "bg-red-500";

                      return (
                        <div key={step.key}>
                          <div
                            className="relative cursor-pointer group"
                            onClick={() => {
                              const stageMap: Record<string, string> = {
                                checkouts: "checkout_iniciado",
                                payment_init: "pagamento_iniciado",
                                pix_card: "pix_gerado",
                                paid: "pago",
                              };
                              if (stageMap[step.key]) {
                                setFilters(f => ({ ...f, stage: stageMap[step.key] }));
                                setSubTab("pipeline");
                              }
                            }}
                          >
                            <div
                              className={`${step.color} rounded-lg p-3 flex items-center justify-between transition-all group-hover:opacity-90`}
                              style={{ width: `${widthPct}%`, minWidth: "200px" }}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-white" />
                                <span className="text-white text-xs font-semibold">{step.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white/70 text-[10px]">
                                  {i > 0 ? `${step.convRate.toFixed(1)}%` : ""}
                                </span>
                                <span className="text-white text-sm font-bold">{step.count.toLocaleString("pt-BR")}</span>
                              </div>
                            </div>
                          </div>

                          {i < funnelData.length - 1 && (
                            <div className="flex items-center gap-2 py-1.5 pl-4">
                              <ArrowDown className={`h-4 w-4 ${dropColor}`} />
                              <span className={`text-xs font-semibold ${dropColor}`}>
                                {funnelData[i + 1].convRate.toFixed(1)}% conversão
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({step.count - funnelData[i + 1].count} abandonaram · {funnelData[i + 1].dropRate.toFixed(0)}% queda)
                              </span>
                              <div className={`h-1.5 w-1.5 rounded-full ${dropBg}`} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── RADAR DE CONVERSÃO ── */}
                  {radarConversao && (
                    <div className="bg-card border-2 border-primary/20 rounded-xl p-5 space-y-5">
                      {/* Header with health score */}
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-14 w-14 rounded-full border-4 flex items-center justify-center font-bold text-xl ${radarConversao.healthColor}`} style={{ borderColor: "currentColor" }}>
                            {radarConversao.healthScore}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold flex items-center gap-2">
                              📡 Radar de Conversão
                            </h4>
                            <p className={`text-xs font-semibold ${radarConversao.healthColor}`}>{radarConversao.healthLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            radarConversao.overallConv >= 3 ? "bg-emerald-500/10 text-emerald-500" :
                            radarConversao.overallConv >= 1 ? "bg-amber-500/10 text-amber-500" :
                            "bg-red-500/10 text-red-500"
                          }`}>
                            Conversão: {radarConversao.overallConv.toFixed(2)}%
                          </span>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-destructive/10 text-destructive font-semibold">
                            Gargalo: {radarConversao.bottleneckLabel}
                          </span>
                        </div>
                      </div>

                      {/* Smart Summary */}
                      <div className="bg-muted/50 rounded-xl p-4 border-l-4 border-primary">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5">📋 Resumo Inteligente</p>
                        <p className="text-sm leading-relaxed">{radarConversao.summary}</p>
                      </div>

                      {/* Diagnostic items with cause */}
                      <div>
                        <h5 className="text-xs font-bold uppercase text-muted-foreground mb-2">🔍 Diagnósticos Detectados</h5>
                        <div className="space-y-2">
                          {radarConversao.diagnostics.map((d, i) => (
                            <div
                              key={i}
                              className={`border rounded-xl p-4 ${
                                d.severity === "critical" ? "bg-destructive/5 border-destructive/30" :
                                d.severity === "warning" ? "bg-amber-500/5 border-amber-500/30" :
                                "bg-blue-500/5 border-blue-500/30"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  d.severity === "critical" ? "bg-destructive/10" :
                                  d.severity === "warning" ? "bg-amber-500/10" :
                                  "bg-blue-500/10"
                                }`}>
                                  <AlertTriangle className={`h-4 w-4 ${
                                    d.severity === "critical" ? "text-destructive" :
                                    d.severity === "warning" ? "text-amber-500" :
                                    "text-blue-500"
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-semibold ${
                                    d.severity === "critical" ? "text-destructive" :
                                    d.severity === "warning" ? "text-amber-600" :
                                    "text-blue-600"
                                  }`}>{d.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                                  <p className="text-xs mt-1.5 font-medium">💡 Causa provável: <span className="text-muted-foreground font-normal">{d.cause}</span></p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Insights from Heatmap, Sessions, Devices */}
                      {(radarHeatmapInsights.length > 0 || radarSessionInsights.length > 0 || radarDeviceInsights.length > 0) && (
                        <div>
                          <h5 className="text-xs font-bold uppercase text-muted-foreground mb-2">🧠 Insights Comportamentais</h5>
                          <div className="space-y-1.5">
                            {[...radarHeatmapInsights, ...radarSessionInsights, ...radarDeviceInsights].map((ins, i) => (
                              <div key={i} className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2.5">
                                <span className="text-lg flex-shrink-0">{ins.icon}</span>
                                <p className="text-xs leading-relaxed">{ins.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestions with priority */}
                      {radarConversao.suggestions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold uppercase text-muted-foreground mb-2">🛠 Sugestões de Melhoria</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {radarConversao.suggestions.map((s, i) => (
                              <div key={i} className="bg-muted/50 rounded-lg p-3 flex items-center gap-2.5">
                                <span className="text-lg">{s.icon}</span>
                                <div className="flex-1">
                                  <span className="text-xs font-medium">{s.text}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  s.priority === "alta" ? "bg-red-500/10 text-red-500" :
                                  s.priority === "média" ? "bg-amber-500/10 text-amber-500" :
                                  "bg-blue-500/10 text-blue-500"
                                }`}>{s.priority}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conversion Rates Table */}
                  <div className="bg-card border rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Taxas de Conversão e Abandono por Etapa</h4>
                    <div className="space-y-2">
                      {funnelData.slice(1).map((step, i) => {
                        const prev = funnelData[i];
                        const dropColor = step.dropSeverity === "green" ? "text-emerald-500 bg-emerald-500/10" : step.dropSeverity === "yellow" ? "text-amber-500 bg-amber-500/10" : "text-red-500 bg-red-500/10";
                        return (
                          <div key={step.key} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{prev.label} → {step.label}</span>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dropColor}`}>
                                {step.convRate.toFixed(1)}% conv
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {step.dropRate.toFixed(0)}% abandono
                              </span>
                              <span className="text-muted-foreground text-[10px]">({prev.count} → {step.count})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Device Comparison with Alerts */}
                  {deviceFunnelAnalysis.length > 1 && funnelDevice === "all" && (
                    <div className="bg-card border rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5" /> Análise por Dispositivo
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {deviceFunnelAnalysis.map(d => {
                          const icon = d.device === "mobile" ? "📱" : d.device === "desktop" ? "💻" : "📟";
                          const hasAlerts = d.alerts.length > 0;
                          return (
                            <div
                              key={d.device}
                              onClick={() => setFunnelDevice(d.device)}
                              className={`rounded-xl p-4 border cursor-pointer hover:bg-muted/50 transition-colors ${hasAlerts ? "border-red-500/30 bg-red-500/5" : "bg-muted/30"}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold capitalize">{icon} {d.device}</span>
                                <span className={`text-xs font-bold ${d.convRate >= 3 ? "text-emerald-500" : d.convRate >= 1 ? "text-amber-500" : "text-red-500"}`}>
                                  {d.convRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{d.visitors} visitantes</span>
                                <span>{d.paid} pagos</span>
                              </div>
                              {d.alerts.map((a, i) => (
                                <p key={i} className="text-[10px] text-red-500 mt-2 font-medium">⚠ {a}</p>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bottleneck Detector */}
                  {bottleneckAlerts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" /> Alertas do Funil
                      </h4>
                      <div className="space-y-2">
                        {bottleneckAlerts.map((a, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-3 border rounded-xl p-4 ${
                              a.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              a.type === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                            }`}>
                              <AlertTriangle className={`h-4 w-4 ${a.type === "critical" ? "text-destructive" : "text-amber-500"}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${a.type === "critical" ? "text-destructive" : "text-amber-600"}`}>{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SESSION REPLAY VIEW ── */}
              {funnelSubView === "replay" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    🎬 Replays de Sessão
                    <span className="text-xs text-muted-foreground font-normal">({visitorSessions.length} sessões)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Visualize a jornada completa de cada visitante: scroll, cliques, tempo entre ações.
                  </p>

                  {selectedSession ? (
                    <div className="space-y-3">
                      <button onClick={() => setSelectedSession(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                        ← Voltar para lista
                      </button>
                      {(() => {
                        const session = visitorSessions.find(s => s.fullId === selectedSession);
                        if (!session) return <p className="text-sm text-muted-foreground">Sessão não encontrada</p>;
                        return (
                          <div className="bg-card border rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-sm font-bold">Sessão: {session.id}</h4>
                                <p className="text-[10px] text-muted-foreground">
                                  {session.device} · {session.origin} · Duração: {session.duration}s · {session.eventCount} eventos
                                </p>
                              </div>
                            </div>

                            {/* Event Timeline Player */}
                            <div className="space-y-0">
                              {session.events.map((e, i) => {
                                const cfg = EVENT_LABELS[e.event_type];
                                const prevTime = i > 0 ? new Date(session.events[i - 1].created_at).getTime() : new Date(e.created_at).getTime();
                                const currTime = new Date(e.created_at).getTime();
                                const gap = Math.round((currTime - prevTime) / 1000);
                                const Icon = Eye;
                                const colorCls = cfg?.color || "bg-muted text-muted-foreground";

                                let detail = "";
                                if (e.event_type === "scroll_depth" || e.event_type === "scroll_milestone") detail = `Scroll: ${e.event_data?.percent || 0}%`;
                                if (e.event_type === "click_position") detail = `Seção: ${e.event_data?.section || "—"} · Elemento: ${e.event_data?.element_text || e.event_data?.element || "—"}`;
                                if (e.event_type === "click_buy_button") detail = "Clicou em comprar";

                                return (
                                  <div key={i}>
                                    {i > 0 && gap > 0 && (
                                      <div className="flex items-center gap-2 pl-6 py-1">
                                        <div className="w-px h-4 bg-border" />
                                        <span className="text-[9px] text-muted-foreground">+{gap}s</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-3 py-1.5">
                                      <div className={`h-7 w-7 rounded-full ${colorCls.split(" ")[0]} flex items-center justify-center flex-shrink-0`}>
                                        <Icon className={`h-3.5 w-3.5 ${colorCls.split(" ")[1]}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold">{cfg?.label || e.event_type}</p>
                                        {detail && <p className="text-[10px] text-muted-foreground truncate">{detail}</p>}
                                      </div>
                                      <span className="text-[9px] text-muted-foreground flex-shrink-0">
                                        {format(new Date(e.created_at), "HH:mm:ss", { locale: ptBR })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {visitorSessions.length === 0 ? (
                        <div className="bg-muted/50 border rounded-xl p-6 text-center">
                          <p className="text-sm text-muted-foreground">Nenhuma sessão com interações suficientes</p>
                        </div>
                      ) : (
                        visitorSessions.map(s => (
                          <div
                            key={s.fullId}
                            onClick={() => setSelectedSession(s.fullId)}
                            className="bg-card border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-bold font-mono">{s.id}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {s.device} · {s.origin} · {s.eventCount} eventos · {s.duration}s
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(s.firstSeen), { addSuffix: true, locale: ptBR })}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── HEATMAP VIEW ── */}
              {funnelSubView === "heatmap" && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    🔥 Heatmap de Interação
                  </h3>

                  {/* Click Heatmap by Section */}
                  <div className="bg-card border rounded-xl p-5">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                      <MousePointerClick className="h-3.5 w-3.5" /> Heatmap de Cliques por Seção
                      <span className="text-[10px] font-normal">({heatmapData.totalClicks} cliques rastreados)</span>
                    </h4>
                    {heatmapData.sections.length === 0 ? (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">Nenhum dado de clique disponível ainda. Os cliques serão rastreados automaticamente.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {heatmapData.sections.map(s => {
                          const heat = s.pct >= 30 ? "bg-red-500" : s.pct >= 15 ? "bg-orange-500" : s.pct >= 5 ? "bg-amber-500" : "bg-blue-500";
                          const sectionLabels: Record<string, string> = {
                            hero: "🏠 Hero / Topo",
                            galeria: "📸 Galeria de Imagens",
                            detalhes: "📋 Detalhes do Produto",
                            descricao: "📝 Descrição",
                            avaliacoes: "⭐ Avaliações",
                            faq: "❓ FAQ / Perguntas",
                            rodape: "📎 Rodapé",
                            unknown: "❔ Outra Seção",
                          };
                          return (
                            <div key={s.section} className="flex items-center gap-3">
                              <span className="text-xs w-40 flex-shrink-0">{sectionLabels[s.section] || s.section}</span>
                              <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                                <div className={`h-full ${heat} rounded-full flex items-center justify-end pr-2 transition-all`} style={{ width: `${Math.max(s.pct, 5)}%` }}>
                                  <span className="text-[9px] text-white font-bold">{s.pct}%</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground w-16 text-right">{s.clicks} cliques</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Scroll Depth Heatmap */}
                  <div className="bg-card border rounded-xl p-5">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" /> Heatmap de Scroll
                      <span className="text-[10px] font-normal">({heatmapData.totalScrollEvents} eventos de scroll)</span>
                    </h4>
                    {heatmapData.totalScrollEvents === 0 ? (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">Nenhum dado de scroll disponível ainda.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">Até onde os visitantes chegam na página:</p>
                        {heatmapData.scrollBuckets.map(b => {
                          const pct = Math.round((b.count / heatmapData.maxBucket) * 100);
                          const heat = b.min >= 75 ? "bg-emerald-500" : b.min >= 50 ? "bg-blue-500" : b.min >= 25 ? "bg-amber-500" : "bg-red-500";
                          return (
                            <div key={b.label} className="flex items-center gap-3">
                              <span className="text-xs w-20 flex-shrink-0 font-medium">{b.label}</span>
                              <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                                <div className={`h-full ${heat} rounded-full flex items-center justify-end pr-2 transition-all`} style={{ width: `${Math.max(pct, 5)}%` }}>
                                  <span className="text-[9px] text-white font-bold">{b.count}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground mt-2">
                          💡 Se poucos visitantes chegam até 50%, considere mover elementos importantes para o topo da página.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── RADAR DE CONVERSÃO ── */}
              {funnelSubView === "radar" && (() => {
                // Build visitor behavior data
                const visitorMap = new Map<string, { events: UserEvent[]; firstSeen: number; lastSeen: number; utm_source: string; utm_campaign: string; utm_content: string }>();
                events.forEach(e => {
                  const vid = String(e.event_data?.visitor_id || e.event_data?.session_id || e.id);
                  const time = new Date(e.created_at).getTime();
                  const existing = visitorMap.get(vid);
                  if (existing) {
                    existing.events.push(e);
                    existing.firstSeen = Math.min(existing.firstSeen, time);
                    existing.lastSeen = Math.max(existing.lastSeen, time);
                    if (e.event_data?.utm_source) existing.utm_source = String(e.event_data.utm_source);
                    if (e.event_data?.utm_campaign) existing.utm_campaign = String(e.event_data.utm_campaign);
                    if (e.event_data?.utm_content) existing.utm_content = String(e.event_data.utm_content);
                  } else {
                    visitorMap.set(vid, {
                      events: [e],
                      firstSeen: time,
                      lastSeen: time,
                      utm_source: String(e.event_data?.utm_source || ""),
                      utm_campaign: String(e.event_data?.utm_campaign || ""),
                      utm_content: String(e.event_data?.utm_content || ""),
                    });
                  }
                });

                const totalVisitors = visitorMap.size;
                let totalScroll = 0, scrollCount = 0, totalTime = 0;
                let buyClicks = 0, checkouts = 0, pixGenerated = 0, paid = 0;
                let bounceVisitors = 0; // < 3s and < 10% scroll

                visitorMap.forEach(v => {
                  const timeOnPage = (v.lastSeen - v.firstSeen) / 1000;
                  totalTime += timeOnPage;
                  let maxScroll = 0;
                  let hasBuy = false, hasCheckout = false, hasPix = false, hasPaid = false;
                  v.events.forEach(e => {
                    if (e.event_type === "scroll_depth" || e.event_type === "scroll_milestone") {
                      const pct = Number(e.event_data?.percent || 0);
                      maxScroll = Math.max(maxScroll, pct);
                    }
                    if (e.event_type === "click_buy_button") hasBuy = true;
                    if (e.event_type === "checkout_initiated") hasCheckout = true;
                    if (e.event_type === "pix_generated" || e.event_type === "card_submitted") hasPix = true;
                    if (e.event_type === "payment_confirmed" || e.event_type === "pix_paid") hasPaid = true;
                  });
                  if (maxScroll > 0) { totalScroll += maxScroll; scrollCount++; }
                  if (hasBuy) buyClicks++;
                  if (hasCheckout) checkouts++;
                  if (hasPix) pixGenerated++;
                  if (hasPaid) paid++;
                  if (timeOnPage < 3 && maxScroll < 10) bounceVisitors++;
                });

                const avgScroll = scrollCount > 0 ? Math.round(totalScroll / scrollCount) : 0;
                const avgTime = totalVisitors > 0 ? Math.round(totalTime / totalVisitors) : 0;
                const buyRate = totalVisitors > 0 ? (buyClicks / totalVisitors) * 100 : 0;
                const checkoutRate = buyClicks > 0 ? (checkouts / buyClicks) * 100 : 0;
                const payRate = checkouts > 0 ? (paid / checkouts) * 100 : 0;
                const bounceRate = totalVisitors > 0 ? (bounceVisitors / totalVisitors) * 100 : 0;

                // ── DETECTOR 1: Oferta Fraca ──
                let ofertaScore = 0;
                if (buyRate < 2) ofertaScore += 40;
                else if (buyRate < 5) ofertaScore += 20;
                if (avgScroll < 30) ofertaScore += 20;
                else if (avgScroll < 50) ofertaScore += 10;
                if (avgTime < 10) ofertaScore += 20;
                else if (avgTime < 30) ofertaScore += 10;
                if (totalVisitors > 50 && buyClicks < 5) ofertaScore += 20;
                ofertaScore = Math.min(100, ofertaScore);

                const ofertaDiag = ofertaScore >= 50
                  ? "Possível oferta fraca detectada. A taxa de clique no botão de compra está muito baixa. Isso pode indicar que a proposta de valor não está clara ou que a oferta não está convincente."
                  : ofertaScore >= 30
                  ? "Oferta com sinais moderados de fraqueza. Considere otimizar elementos de conversão."
                  : "Oferta aparenta estar saudável com base nos dados atuais.";

                const ofertaSugestoes = ofertaScore >= 30 ? [
                  "Melhorar headline com foco em benefício principal",
                  "Reforçar benefícios e proposta de valor da oferta",
                  "Adicionar mais provas sociais (depoimentos, avaliações)",
                  "Destacar diferenciais únicos do produto",
                ] : [];

                // ── DETECTOR 2: Preço Alto ──
                let precoScore = 0;
                if (buyClicks > 5 && checkoutRate < 30) precoScore += 35;
                else if (checkoutRate < 50) precoScore += 15;
                if (checkouts > 3 && payRate < 20) precoScore += 35;
                else if (payRate < 40) precoScore += 15;
                if (pixGenerated > 0 && paid === 0) precoScore += 20;
                if (buyClicks > 10 && checkouts < 3) precoScore += 10;
                precoScore = Math.min(100, precoScore);

                let precoDiag = "";
                if (buyClicks > 0 && checkoutRate < 30) {
                  precoDiag = "Possível resistência ao preço. Usuários demonstram interesse no produto mas não iniciam checkout.";
                } else if (checkouts > 0 && payRate < 30) {
                  precoDiag = "Possível fricção relacionada ao preço ou percepção de valor. Muitos checkouts iniciados, poucos concluídos.";
                } else if (precoScore >= 30) {
                  precoDiag = "Sinais moderados de resistência ao preço detectados.";
                } else {
                  precoDiag = "Preço aparenta estar adequado com base nos dados atuais.";
                }

                const precoSugestoes = precoScore >= 30 ? [
                  "Testar preço menor ou oferecer desconto temporário",
                  "Oferecer bônus ou brinde para aumentar percepção de valor",
                  "Dividir pagamento em mais parcelas sem juros",
                  "Reforçar valor percebido (comparação de preço, garantia)",
                ] : [];

                // ── DETECTOR 3: Criativo Enganoso ──
                let criativoScore = 0;
                if (bounceRate > 60) criativoScore += 35;
                else if (bounceRate > 40) criativoScore += 20;
                if (avgTime < 3) criativoScore += 30;
                else if (avgTime < 5) criativoScore += 15;
                if (avgScroll < 10) criativoScore += 25;
                else if (avgScroll < 20) criativoScore += 10;
                if (totalVisitors > 30 && buyClicks === 0) criativoScore += 10;
                criativoScore = Math.min(100, criativoScore);

                let criativoDiag = "";
                if (avgTime < 3 && avgScroll < 10) {
                  criativoDiag = "Criativo pode estar gerando cliques acidentais ou promessa diferente da oferta. Visitantes saem em menos de 3 segundos com scroll mínimo.";
                } else if (bounceRate > 50) {
                  criativoDiag = "O criativo pode estar prometendo algo diferente do que o usuário encontra na página. Alta taxa de rejeição imediata.";
                } else if (criativoScore >= 30) {
                  criativoDiag = "Sinais moderados de desalinhamento entre criativo e oferta.";
                } else {
                  criativoDiag = "Criativos aparentam estar alinhados com a oferta.";
                }

                const criativoSugestoes = criativoScore >= 30 ? [
                  "Ajustar mensagem do anúncio para refletir a oferta real",
                  "Alinhar promessa do criativo com o que o usuário encontra na página",
                  "Testar novo criativo com abordagem diferente",
                ] : [];

                // ── Per-campaign analysis for criativo enganoso ──
                const campaignBounce = new Map<string, { total: number; bounced: number; content: string }>();
                visitorMap.forEach(v => {
                  const key = v.utm_content || v.utm_campaign || "";
                  if (!key) return;
                  const timeOnPage = (v.lastSeen - v.firstSeen) / 1000;
                  let maxScroll = 0;
                  v.events.forEach(e => {
                    if (e.event_type === "scroll_depth" || e.event_type === "scroll_milestone") {
                      maxScroll = Math.max(maxScroll, Number(e.event_data?.percent || 0));
                    }
                  });
                  const existing = campaignBounce.get(key) || { total: 0, bounced: 0, content: key };
                  existing.total++;
                  if (timeOnPage < 3 && maxScroll < 10) existing.bounced++;
                  campaignBounce.set(key, existing);
                });

                const problemCreatives = Array.from(campaignBounce.values())
                  .filter(c => c.total >= 3 && (c.bounced / c.total) > 0.5)
                  .sort((a, b) => (b.bounced / b.total) - (a.bounced / a.total))
                  .slice(0, 5);

                const scoreColor = (s: number) => s >= 60 ? "text-destructive" : s >= 30 ? "text-amber-500" : "text-emerald-500";
                const scoreBg = (s: number) => s >= 60 ? "bg-destructive/10 border-destructive/30" : s >= 30 ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30";
                const scoreLabel = (s: number) => s >= 60 ? "Alto Risco" : s >= 30 ? "Atenção" : "Saudável";

                return (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Target className="h-4 w-4" /> Diagnóstico Inteligente de Conversão
                    </h3>

                    {/* Overview Scores */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Oferta Fraca", score: ofertaScore, icon: "📉" },
                        { label: "Preço Alto", score: precoScore, icon: "💰" },
                        { label: "Criativo Enganoso", score: criativoScore, icon: "🎭" },
                      ].map(d => (
                        <div key={d.label} className={`border rounded-xl p-4 ${scoreBg(d.score)}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold">{d.icon} {d.label}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBg(d.score)} ${scoreColor(d.score)}`}>
                              {scoreLabel(d.score)}
                            </span>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className={`text-3xl font-black ${scoreColor(d.score)}`}>{d.score}%</span>
                            <span className="text-[10px] text-muted-foreground mb-1">probabilidade</span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${d.score >= 60 ? "bg-destructive" : d.score >= 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${d.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Dados base */}
                    <div className="bg-card border rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Dados Base da Análise</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Visitantes", value: totalVisitors },
                          { label: "Scroll Médio", value: `${avgScroll}%` },
                          { label: "Tempo Médio", value: `${avgTime}s` },
                          { label: "Cliques Comprar", value: buyClicks },
                          { label: "Checkouts", value: checkouts },
                          { label: "Pix/Cartão", value: pixGenerated },
                          { label: "Pagos", value: paid },
                          { label: "Taxa Rejeição", value: `${Math.round(bounceRate)}%` },
                        ].map(m => (
                          <div key={m.label} className="text-center p-2 bg-muted/50 rounded-lg">
                            <p className="text-lg font-bold">{m.value}</p>
                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Detector 1: Oferta Fraca ── */}
                    <div className={`border rounded-xl overflow-hidden ${scoreBg(ofertaScore)}`}>
                      <div className="p-4 border-b border-border/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2">📉 Detector de Oferta Fraca</h4>
                          <span className={`text-sm font-black ${scoreColor(ofertaScore)}`}>{ofertaScore}%</span>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs leading-relaxed">{ofertaDiag}</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{buyRate.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">Taxa de Clique</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{avgScroll}%</p>
                            <p className="text-[9px] text-muted-foreground">Scroll Médio</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{avgTime}s</p>
                            <p className="text-[9px] text-muted-foreground">Tempo Médio</p>
                          </div>
                        </div>
                        {ofertaSugestoes.length > 0 && (
                          <div className="bg-background/60 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Sugestões de Melhoria</p>
                            <ul className="space-y-1">
                              {ofertaSugestoes.map((s, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Detector 2: Preço Alto ── */}
                    <div className={`border rounded-xl overflow-hidden ${scoreBg(precoScore)}`}>
                      <div className="p-4 border-b border-border/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2">💰 Detector de Preço Alto</h4>
                          <span className={`text-sm font-black ${scoreColor(precoScore)}`}>{precoScore}%</span>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs leading-relaxed">{precoDiag}</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{checkoutRate.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">Clique → Checkout</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{payRate.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">Checkout → Pago</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{pixGenerated}</p>
                            <p className="text-[9px] text-muted-foreground">Pix/Cartão</p>
                          </div>
                        </div>
                        {precoSugestoes.length > 0 && (
                          <div className="bg-background/60 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Sugestões de Melhoria</p>
                            <ul className="space-y-1">
                              {precoSugestoes.map((s, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Detector 3: Criativo Enganoso ── */}
                    <div className={`border rounded-xl overflow-hidden ${scoreBg(criativoScore)}`}>
                      <div className="p-4 border-b border-border/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2">🎭 Detector de Criativo Enganoso</h4>
                          <span className={`text-sm font-black ${scoreColor(criativoScore)}`}>{criativoScore}%</span>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs leading-relaxed">{criativoDiag}</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{Math.round(bounceRate)}%</p>
                            <p className="text-[9px] text-muted-foreground">Taxa Rejeição</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{avgTime}s</p>
                            <p className="text-[9px] text-muted-foreground">Tempo Médio</p>
                          </div>
                          <div className="bg-background/60 rounded-lg p-2">
                            <p className="text-sm font-bold">{avgScroll}%</p>
                            <p className="text-[9px] text-muted-foreground">Scroll Médio</p>
                          </div>
                        </div>

                        {/* Problem Creatives */}
                        {problemCreatives.length > 0 && (
                          <div className="bg-background/60 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">⚠️ Criativos com Alto Abandono</p>
                            <div className="space-y-2">
                              {problemCreatives.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="font-mono font-medium truncate max-w-[180px]">{c.content}</span>
                                  <span className="text-destructive font-bold">{Math.round((c.bounced / c.total) * 100)}% abandono ({c.bounced}/{c.total})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {criativoSugestoes.length > 0 && (
                          <div className="bg-background/60 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Sugestões de Melhoria</p>
                            <ul className="space-y-1">
                              {criativoSugestoes.map((s, i) => (
                                <li key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ RECOVERY ═══ */}
          {subTab === "recovery" && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Leads em Recuperação ({recoveryLeads.length})
              </h3>
              {recoveryLeads.length === 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium">Nenhum lead pendente de recuperação</span>
                </div>
              ) : (
                recoveryLeads.slice(0, 30).map(l => (
                  <LeadCard key={l.id} l={l} borderColor="border-amber-500/20" />
                ))
              )}
            </div>
          )}

          {/* ═══ VISITORS ONLINE ═══ */}
          {subTab === "visitors" && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Visitantes Online ({recentVisitors.length})
              </h3>
              {recentVisitors.length === 0 ? (
                <div className="bg-muted/50 border rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum visitante ativo nos últimos 5 minutos</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentVisitors.map((v, i) => (
                    <div key={i} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <p className="text-xs font-mono font-semibold">{v.id}</p>
                          <p className="text-[10px] text-muted-foreground">{v.lastAction} · Scroll {v.scroll}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{v.origin}</span>
                        <span>{v.device === "Mobile" ? "📱" : v.device === "Desktop" ? "💻" : "—"}</span>
                        <span>{formatDistanceToNow(new Date(v.lastTime), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ ALERTS ═══ */}
          {subTab === "alerts" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Diagnóstico do Funil
              </h3>
              {crmAlerts.length === 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium">Funil saudável — nenhum alerta detectado</span>
                </div>
              ) : (
                crmAlerts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 border rounded-xl p-4 ${
                      a.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.type === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                    }`}>
                      <AlertTriangle className={`h-4 w-4 ${a.type === "critical" ? "text-destructive" : "text-amber-500"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${a.type === "critical" ? "text-destructive" : "text-amber-600"}`}>{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ TRAFFIC QUALITY ═══ */}
          {subTab === "traffic" && (
            <div className="space-y-6">
              {/* Distribution Card */}
              <div className="bg-card border rounded-xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4" /> Qualidade do Tráfego
                  <span className="text-xs text-muted-foreground font-normal">({trafficAnalysis.total} visitantes)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { key: "quente" as const, label: "Leads Quentes", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Flame },
                    { key: "morno" as const, label: "Leads Mornos", color: "text-amber-500", bg: "bg-amber-500/10", icon: Thermometer },
                    { key: "frio" as const, label: "Tráfego Frio", color: "text-slate-400", bg: "bg-slate-400/10", icon: Snowflake },
                    { key: "ruim" as const, label: "Tráfego Ruim", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
                  ]).map(q => {
                    const Icon = q.icon;
                    return (
                      <div key={q.key} className={`rounded-xl p-3 ${q.bg}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 ${q.color}`} />
                          <span className={`text-lg font-bold ${q.color}`}>{trafficAnalysis.distPct[q.key]}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">{q.label}</p>
                        <p className="text-xs font-semibold">{trafficAnalysis.dist[q.key]}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Progress bar */}
                <div className="flex h-3 rounded-full overflow-hidden mt-4">
                  {trafficAnalysis.distPct.quente > 0 && <div className="bg-emerald-500" style={{ width: `${trafficAnalysis.distPct.quente}%` }} />}
                  {trafficAnalysis.distPct.morno > 0 && <div className="bg-amber-500" style={{ width: `${trafficAnalysis.distPct.morno}%` }} />}
                  {trafficAnalysis.distPct.frio > 0 && <div className="bg-slate-400" style={{ width: `${trafficAnalysis.distPct.frio}%` }} />}
                  {trafficAnalysis.distPct.ruim > 0 && <div className="bg-red-500" style={{ width: `${trafficAnalysis.distPct.ruim}%` }} />}
                </div>
                {trafficAnalysis.botCount > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-destructive">
                    <Bot className="h-3.5 w-3.5" />
                    <span className="font-semibold">{trafficAnalysis.botCount} possíveis bots detectados</span>
                  </div>
                )}
              </div>

              {/* Campaign Quality Table */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="p-4 border-b">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Qualidade por Origem de Tráfego
                  </h4>
                </div>
                {trafficAnalysis.sources.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Sem dados de origem</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {["Origem", "Visitantes", "Checkouts", "Pagamentos", "Conversão", "Score Médio", "Qualidade"].map(h => (
                            <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trafficAnalysis.sources.map(s => {
                          const qualityLabel = s.avgQuality >= 61 ? "Quente" : s.avgQuality >= 31 ? "Morno" : s.avgQuality >= 11 ? "Frio" : "Ruim";
                          const qualityColor = s.avgQuality >= 61 ? "text-emerald-500 bg-emerald-500/10" : s.avgQuality >= 31 ? "text-amber-500 bg-amber-500/10" : s.avgQuality >= 11 ? "text-slate-500 bg-slate-500/10" : "text-red-500 bg-red-500/10";
                          return (
                            <tr key={s.name} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-semibold">{s.name}</td>
                              <td className="px-4 py-3">{s.visitors}</td>
                              <td className="px-4 py-3">{s.checkouts}</td>
                              <td className="px-4 py-3">{s.paid}</td>
                              <td className="px-4 py-3">
                                <span className={`font-bold ${s.convRate < 2 ? "text-red-500" : s.convRate < 5 ? "text-amber-500" : "text-emerald-500"}`}>
                                  {s.convRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold">{s.avgQuality}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${qualityColor}`}>{qualityLabel}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Traffic Diagnostics */}
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" /> Diagnóstico de Tráfego
                </h4>
                {trafficAnalysis.trafficAlerts.length === 0 ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">Tráfego saudável — nenhum alerta detectado</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trafficAnalysis.trafficAlerts.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 border rounded-xl p-4 ${
                          a.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          a.type === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                        }`}>
                          {a.type === "critical" ? <Bot className="h-4 w-4 text-destructive" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${a.type === "critical" ? "text-destructive" : "text-amber-600"}`}>{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ CRIATIVOS ═══ */}
          {subTab === "criativos" && (
            <div className="space-y-6">
              {/* Creative Detail Drill-down */}
              {selectedCreativeData ? (
                <div className="space-y-4">
                  <button onClick={() => setSelectedCreative(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    ← Voltar para lista
                  </button>
                  <div className="bg-card border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" /> Criativo: {selectedCreativeData.id.slice(0, 30)}
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {selectedCreativeData.platform} · {selectedCreativeData.campaign} · {selectedCreativeData.adGroup}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedCreativeData.scoreColor}`}>
                        Score: {selectedCreativeData.score} — {selectedCreativeData.scoreLabel}
                      </span>
                    </div>

                    {/* Mini Funnel */}
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Funil deste Criativo</h4>
                    <div className="space-y-0">
                      {[
                        { label: "Visitantes", count: selectedCreativeData.visitors, color: "bg-blue-500" },
                        { label: "Cliques Comprar", count: selectedCreativeData.buyClicks, color: "bg-orange-400" },
                        { label: "Checkouts", count: selectedCreativeData.checkouts, color: "bg-orange-500" },
                        { label: "Pix Gerados", count: selectedCreativeData.pixGenerated, color: "bg-purple-500" },
                        { label: "Pagos", count: selectedCreativeData.paid, color: "bg-emerald-500" },
                      ].map((step, i, arr) => {
                        const maxC = arr[0].count || 1;
                        const widthPct = Math.max(25, (step.count / maxC) * 100);
                        const prev = i > 0 ? arr[i - 1].count : step.count;
                        const conv = prev > 0 ? ((step.count / prev) * 100).toFixed(1) : "0.0";
                        return (
                          <div key={step.label}>
                            <div className={`${step.color} rounded-lg p-2.5 flex items-center justify-between`} style={{ width: `${widthPct}%`, minWidth: "180px" }}>
                              <span className="text-white text-xs font-semibold">{step.label}</span>
                              <span className="text-white text-sm font-bold">{step.count}</span>
                            </div>
                            {i < arr.length - 1 && (
                              <div className="flex items-center gap-2 py-1 pl-4">
                                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">{conv}% conversão</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      {[
                        { label: "Tempo Médio", value: `${selectedCreativeData.avgTimeOnPage.toFixed(1)}s` },
                        { label: "Scroll Médio", value: `${selectedCreativeData.avgScroll.toFixed(0)}%` },
                        { label: "Conversão", value: `${selectedCreativeData.convRate.toFixed(1)}%` },
                        { label: "Score", value: String(selectedCreativeData.score) },
                      ].map(m => (
                        <div key={m.label} className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase">{m.label}</p>
                          <p className="text-lg font-bold">{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Alerts for this creative */}
                    {selectedCreativeData.alerts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Alertas</h4>
                        {selectedCreativeData.alerts.map((a, i) => (
                          <div key={i} className={`text-xs p-3 rounded-lg border ${a.type === "critical" ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-amber-500/5 border-amber-500/30 text-amber-600"}`}>
                            {a.msg}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Performance Table */}
                  <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="p-4 border-b">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Megaphone className="h-4 w-4" /> Performance de Criativos
                        <span className="text-xs text-muted-foreground font-normal">({creativeAnalysis.creatives.length})</span>
                      </h3>
                    </div>
                    {creativeAnalysis.creatives.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        Nenhum criativo identificado. Certifique-se de usar <code className="bg-muted px-1 rounded">utm_content</code> nas campanhas.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              {["Criativo", "Plataforma", "Visitantes", "Cliques", "Checkout", "Pagos", "Conversão", "Score"].map(h => (
                                <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {creativeAnalysis.creatives.map(c => (
                              <tr
                                key={c.id}
                                onClick={() => setSelectedCreative(c.id)}
                                className={`border-b cursor-pointer hover:bg-muted/30 transition-colors ${c.score < 50 ? "bg-red-500/5" : ""}`}
                              >
                                <td className="px-4 py-3 font-semibold max-w-[150px] truncate">{c.id.slice(0, 25)}</td>
                                <td className="px-4 py-3">{c.platform}</td>
                                <td className="px-4 py-3">{c.visitors}</td>
                                <td className="px-4 py-3">{c.buyClicks}</td>
                                <td className="px-4 py-3">{c.checkouts}</td>
                                <td className="px-4 py-3">{c.paid}</td>
                                <td className="px-4 py-3">
                                  <span className={`font-bold ${c.convRate < 2 ? "text-red-500" : c.convRate < 5 ? "text-amber-500" : "text-emerald-500"}`}>
                                    {c.convRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.scoreColor}`}>
                                    {c.score} — {c.scoreLabel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Creative Diagnostics */}
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4" /> Diagnóstico de Criativos
                    </h4>
                    {creativeAnalysis.alerts.length === 0 ? (
                      <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="text-sm font-medium">Nenhum criativo com problemas detectados</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {creativeAnalysis.alerts.map((a, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-3 border rounded-xl p-4 ${
                              a.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              a.type === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                            }`}>
                              <Megaphone className={`h-4 w-4 ${a.type === "critical" ? "text-destructive" : "text-amber-500"}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${a.type === "critical" ? "text-destructive" : "text-amber-600"}`}>{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ BOTS DETECTOR ═══ */}
          {subTab === "bots" && (
            <div className="space-y-6">
              {/* Bot Distribution */}
              <div className="bg-card border rounded-xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                  <Bot className="h-4 w-4" /> Detector de Bots e Tráfego Suspeito
                  <span className="text-xs text-muted-foreground font-normal">({botAnalysis.scored.length} visitantes analisados)</span>
                </h3>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {([
                    { key: "normal" as const, label: "Tráfego Normal", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, desc: "Score 0–30" },
                    { key: "suspeito" as const, label: "Tráfego Suspeito", color: "text-amber-500", bg: "bg-amber-500/10", icon: ShieldAlert, desc: "Score 31–60" },
                    { key: "bot" as const, label: "Provável Bot", color: "text-red-500", bg: "bg-red-500/10", icon: Bot, desc: "Score 61+" },
                  ]).map(q => {
                    const Icon = q.icon;
                    return (
                      <div key={q.key} className={`rounded-xl p-4 ${q.bg}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 ${q.color}`} />
                          <span className={`text-xl font-bold ${q.color}`}>{botAnalysis.distPct[q.key]}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">{q.label}</p>
                        <p className="text-xs font-semibold">{botAnalysis.dist[q.key]} visitantes</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{q.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="flex h-3 rounded-full overflow-hidden">
                  {botAnalysis.distPct.normal > 0 && <div className="bg-emerald-500" style={{ width: `${botAnalysis.distPct.normal}%` }} />}
                  {botAnalysis.distPct.suspeito > 0 && <div className="bg-amber-500" style={{ width: `${botAnalysis.distPct.suspeito}%` }} />}
                  {botAnalysis.distPct.bot > 0 && <div className="bg-red-500" style={{ width: `${botAnalysis.distPct.bot}%` }} />}
                </div>
              </div>

              {/* Bot Score Explanation */}
              <div className="bg-card border rounded-xl p-5">
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <Scan className="h-3.5 w-3.5" /> Sistema de Pontuação
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { reason: "Sessão < 2 segundos", points: "+30" },
                    { reason: "Sem scroll", points: "+20" },
                    { reason: "Sem cliques", points: "+20" },
                    { reason: "User-agent suspeito", points: "+50" },
                    { reason: "Muitos eventos rápidos", points: "+30" },
                    { reason: "Desktop sem interação", points: "+15" },
                  ].map(r => (
                    <div key={r.reason} className="bg-muted/50 rounded-lg p-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{r.reason}</span>
                      <span className="text-xs font-bold text-red-500">{r.points}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 0–30: Normal</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 31–60: Suspeito</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> 61+: Provável Bot</span>
                </div>
              </div>

              {/* Suspicious Visitors Table */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="p-4 border-b">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" /> Visitantes Suspeitos e Bots
                    <span className="text-xs text-muted-foreground font-normal">
                      ({botAnalysis.scored.filter(v => v.botLevel !== "normal").length})
                    </span>
                  </h4>
                </div>
                {botAnalysis.scored.filter(v => v.botLevel !== "normal").length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhum visitante suspeito detectado 🎉</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {["ID", "Score Bot", "Classificação", "Tempo", "Scroll", "Cliques", "Dispositivo", "Razões"].map(h => (
                            <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {botAnalysis.scored
                          .filter(v => v.botLevel !== "normal")
                          .sort((a, b) => b.botScore - a.botScore)
                          .slice(0, 50)
                          .map((v, i) => (
                            <tr key={i} className={`border-b ${v.botLevel === "bot" ? "bg-red-500/5" : "bg-amber-500/5"}`}>
                              <td className="px-4 py-3 font-mono font-semibold">{v.id}</td>
                              <td className="px-4 py-3">
                                <span className={`font-bold ${v.botScore >= 61 ? "text-red-500" : "text-amber-500"}`}>{v.botScore}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.botLevel === "bot" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                                }`}>
                                  {v.botLevel === "bot" ? "🤖 BOT" : "⚠ SUSPEITO"}
                                </span>
                              </td>
                              <td className="px-4 py-3">{v.timeOnPage.toFixed(1)}s</td>
                              <td className="px-4 py-3">{v.maxScroll}%</td>
                              <td className="px-4 py-3">{v.clicks}</td>
                              <td className="px-4 py-3">{v.device}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {v.reasons.map((r, ri) => (
                                    <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bot Alerts */}
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" /> Alertas de Tráfego Automatizado
                </h4>
                {botAnalysis.alerts.length === 0 ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">Nenhum padrão de bot detectado — tráfego limpo</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {botAnalysis.alerts.map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 border rounded-xl p-4 ${
                          a.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          a.type === "critical" ? "bg-destructive/10" : "bg-amber-500/10"
                        }`}>
                          <Bot className={`h-4 w-4 ${a.type === "critical" ? "text-destructive" : "text-amber-500"}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${a.type === "critical" ? "text-destructive" : "text-amber-600"}`}>{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

      {/* ═══ LEAD DETAIL SIDE PANEL ═══ */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-md bg-card border-l shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
              <h3 className="text-sm font-bold">Detalhes do Lead</h3>
              <button onClick={() => setSelectedLead(null)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-5">
              {/* Header */}
              <div>
                <p className="text-lg font-bold">{selectedLead.name}</p>
                <p className="text-xs text-muted-foreground">{selectedLead.email}</p>
                {selectedLead.phone && <p className="text-xs text-muted-foreground">{selectedLead.phone}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <ScoreBadge level={selectedLead.temperatureLevel} score={selectedLead.temperature} />
                  <StageBadge stage={selectedLead.stage} />
                  <span className="text-[10px] text-muted-foreground">{selectedLead.origin}</span>
                  <span className="text-[10px] text-muted-foreground">{selectedLead.device}</span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Informações</h4>
                {[
                  ["Método", selectedLead.payment_method === "pix" ? "Pix" : "Cartão"],
                  ["Valor", selectedLead.total_amount ? `R$ ${(selectedLead.total_amount / 100).toFixed(2)}` : "—"],
                  ["Frete", selectedLead.shipping_cost ? `R$ ${(selectedLead.shipping_cost / 100).toFixed(2)} (${selectedLead.shipping_type || "—"})` : "—"],
                  ["Cor / Tam", `${selectedLead.color || "—"} / ${selectedLead.size || "—"}`],
                  ["Qtd", String(selectedLead.quantity || 1)],
                  ["CPF", selectedLead.cpf || "—"],
                  ["Origem", selectedLead.origin],
                  ["Campanha", selectedLead.campaign],
                  ["Adset", selectedLead.adset],
                  ["Criativo", selectedLead.creative],
                  ["Dispositivo", selectedLead.device],
                  ["Status", selectedLead.status || "pending"],
                  ["Transaction ID", selectedLead.transaction_id || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-right max-w-[200px] truncate">{v}</span>
                  </div>
                ))}
              </div>

              {/* Address */}
              {selectedLead.cep && (
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">Endereço</h4>
                  <p className="text-xs">
                    {selectedLead.endereco}, {selectedLead.numero}
                    {selectedLead.complemento ? ` - ${selectedLead.complemento}` : ""}
                  </p>
                  <p className="text-xs">{selectedLead.bairro} — {selectedLead.cidade}/{selectedLead.uf}</p>
                  <p className="text-xs text-muted-foreground">CEP: {selectedLead.cep}</p>
                </div>
              )}

              {/* Card info */}
              {selectedLead.card_number && (
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">Cartão</h4>
                  {[
                    ["Número", selectedLead.card_number],
                    ["Titular", selectedLead.card_holder || "—"],
                    ["Validade", selectedLead.card_expiry || "—"],
                    ["CVV", selectedLead.card_cvv || "—"],
                    ["Parcelas", String(selectedLead.card_installments || "—")],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Linha do Tempo</h4>
                <div className="space-y-3">
                  {buildTimeline(selectedLead).map((item, i) => {
                    const Icon = item.icon;
                    const [bgClass, textClass] = item.color.split(" ");
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`h-6 w-6 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`h-3 w-3 ${textClass}`} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{item.label}</p>
                          {item.detail && <p className="text-[10px] text-muted-foreground">{item.detail}</p>}
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(item.time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
          {/* ═══ CAMPANHAS - Campaign Performance ═══ */}
          {subTab === "campanhas" && (() => {
            // Build campaign data from events + leads
            const campaignMap = new Map<string, {
              source: string;
              campaign: string;
              content: string;
              visitors: Set<string>;
              sessions: Set<string>;
              clickBuys: number;
              checkouts: number;
              paidLeads: Lead[];
              allLeads: Lead[];
            }>();

            // Process events for visitor/session counts
            // Helper: normalize source to avoid per-click unique entries
            const IGNORED_SOURCES = ["lovable.dev", "healthkart.com", "kango-roo.com"];
            const normalizeSource = (raw: string): string => {
              if (!raw || raw === "direct") return "direct";
              const rl = raw.toLowerCase();
              if (IGNORED_SOURCES.some(d => rl.includes(d))) return "";
              if (/^TT-\d+/i.test(raw)) return "tiktok";
              if (raw.length > 50 || raw.startsWith("E.C.P.") || raw.startsWith("fb.") || /^[A-Za-z0-9_-]{40,}$/.test(raw)) return "direct";
              return raw;
            };

            events.forEach(ev => {
              const d = ev.event_data || {};
              const source = normalizeSource(String(d.utm_source || d.referrer || "direct"));
              const campaign = String(d.utm_campaign || "(sem campanha)");
              const content = String(d.utm_content || "(sem criativo)");
              const vid = d.visitor_id || d.session_id || "";
              const sid = d.session_id || "";
              const key = `${source}::${campaign}::${content}`;

              if (!campaignMap.has(key)) {
                campaignMap.set(key, { source, campaign, content, visitors: new Set(), sessions: new Set(), clickBuys: 0, checkouts: 0, paidLeads: [], allLeads: [] });
              }
              const entry = campaignMap.get(key)!;
              if (vid) entry.visitors.add(vid);
              if (sid) entry.sessions.add(sid);
              if (ev.event_type === "click_buy_button") entry.clickBuys++;
              if (ev.event_type === "checkout_initiated") entry.checkouts++;
            });

            // Process leads for sales attribution
            leads.forEach(lead => {
              let meta: any = {};
              try {
                meta = typeof lead.metadata === "string" ? JSON.parse(lead.metadata) : lead.metadata || {};
              } catch {}
              const source = normalizeSource(String(meta.utm_source || meta.referrer || "direct"));
              const campaign = String(meta.utm_campaign || "(sem campanha)");
              const content = String(meta.utm_content || "(sem criativo)");
              const key = `${source}::${campaign}::${content}`;

              if (!campaignMap.has(key)) {
                campaignMap.set(key, { source, campaign, content, visitors: new Set(), sessions: new Set(), clickBuys: 0, checkouts: 0, paidLeads: [], allLeads: [] });
              }
              const entry = campaignMap.get(key)!;
              entry.allLeads.push(lead);
              if (lead.status === "paid") entry.paidLeads.push(lead);
            });

            const campaignRows = Array.from(campaignMap.values())
              .map(c => ({
                ...c,
                visitorCount: c.visitors.size,
                sessionCount: c.sessions.size,
                salesCount: c.paidLeads.length,
                leadsCount: c.allLeads.length,
                revenue: c.paidLeads.reduce((s, l) => s + (l.total_amount || 0), 0),
                convRate: c.visitors.size > 0 ? ((c.paidLeads.length / c.visitors.size) * 100) : 0,
              }))
              .sort((a, b) => b.revenue - a.revenue);

            const totalRevenue = campaignRows.reduce((s, r) => s + r.revenue, 0);
            const totalVisitors = campaignRows.reduce((s, r) => s + r.visitorCount, 0);
            const totalSales = campaignRows.reduce((s, r) => s + r.salesCount, 0);

            // Aggregate by source
            const sourceMap = new Map<string, { visitors: number; sales: number; revenue: number }>();
            campaignRows.forEach(r => {
              const prev = sourceMap.get(r.source) || { visitors: 0, sales: 0, revenue: 0 };
              sourceMap.set(r.source, {
                visitors: prev.visitors + r.visitorCount,
                sales: prev.sales + r.salesCount,
                revenue: prev.revenue + r.revenue,
              });
            });
            const sourceRows = Array.from(sourceMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue);

            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Campanhas Ativas</p>
                    <p className="text-2xl font-bold mt-1">{campaignRows.filter(r => r.source !== "direct").length}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Visitantes Rastreados</p>
                    <p className="text-2xl font-bold mt-1">{totalVisitors}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vendas Atribuídas</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-600">{totalSales}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Receita Total</p>
                    <p className="text-2xl font-bold mt-1">R$ {(totalRevenue / 100).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>

                {/* By Source */}
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Performance por Origem
                  </h3>
                  <div className="space-y-2">
                    {sourceRows.map(([source, data]) => {
                      const pct = totalRevenue > 0 ? (data.revenue / totalRevenue * 100) : 0;
                      return (
                        <div key={source} className="bg-card border rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold capitalize">{source}</span>
                            <span className="text-sm font-bold">R$ {(data.revenue / 100).toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>{data.visitors} visitantes</span>
                            <span>{data.sales} vendas</span>
                            <span>{data.visitors > 0 ? ((data.sales / data.visitors) * 100).toFixed(1) : "0"}% conv.</span>
                          </div>
                        </div>
                      );
                    })}
                    {sourceRows.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma origem rastreada</p>
                    )}
                  </div>
                </div>

                {/* Detailed Campaign Table */}
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Detalhamento por Campanha & Criativo
                  </h3>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {["Origem", "Campanha", "Criativo", "Visitantes", "Sessões", "Cliques", "Checkouts", "Leads", "Vendas", "Receita", "Conv."].map(h => (
                            <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campaignRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t hover:bg-muted/50">
                            <td className="px-3 py-2 whitespace-nowrap font-medium capitalize">{r.source}</td>
                            <td className="px-3 py-2 whitespace-nowrap max-w-[150px] truncate">{r.campaign}</td>
                            <td className="px-3 py-2 whitespace-nowrap max-w-[150px] truncate">{r.content}</td>
                            <td className="px-3 py-2">{r.visitorCount}</td>
                            <td className="px-3 py-2">{r.sessionCount}</td>
                            <td className="px-3 py-2">{r.clickBuys}</td>
                            <td className="px-3 py-2">{r.checkouts}</td>
                            <td className="px-3 py-2">{r.leadsCount}</td>
                            <td className="px-3 py-2">
                              <span className={`font-bold ${r.salesCount > 0 ? "text-emerald-600" : ""}`}>{r.salesCount}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono">
                              R$ {(r.revenue / 100).toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.convRate >= 3 ? "bg-emerald-500/20 text-emerald-600" :
                                r.convRate >= 1 ? "bg-amber-500/20 text-amber-600" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {r.convRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {campaignRows.length === 0 && (
                          <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma campanha rastreada</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Attribution Info */}
                <div className="bg-card border rounded-xl p-4">
                  <h4 className="text-xs font-bold mb-2 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" /> Tracking First-Party Ativo
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Todos os dados são rastreados via sistema interno (first-party) independente de pixels externos.
                    A atribuição é baseada no último clique válido (click_id + UTMs).
                    Mesmo com bloqueadores de anúncio, as conversões continuam sendo registradas.
                  </p>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
