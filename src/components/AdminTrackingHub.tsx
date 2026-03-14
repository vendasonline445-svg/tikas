import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Megaphone, Palette, Link2, MousePointerClick, Activity, Monitor, Bug,
  Plus, Trash2, RefreshCw, Search, ExternalLink, ChevronRight, Eye,
  AlertTriangle, CheckCircle2, Clock, Globe, Smartphone, DollarSign,
  TrendingUp, BarChart3, Target, Copy, Zap, Award, ShieldAlert, ArrowDown,
  ArrowUp, Flame, Minus
} from "lucide-react";

type SubTab = "campanhas" | "criativos" | "links" | "cliques" | "eventos" | "sessoes" | "debug";

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: "campanhas", label: "Campanhas", icon: <Megaphone className="h-4 w-4" /> },
  { key: "criativos", label: "Criativos", icon: <Palette className="h-4 w-4" /> },
  { key: "links", label: "Links Rastreados", icon: <Link2 className="h-4 w-4" /> },
  { key: "cliques", label: "Cliques", icon: <MousePointerClick className="h-4 w-4" /> },
  { key: "eventos", label: "Eventos", icon: <Activity className="h-4 w-4" /> },
  { key: "sessoes", label: "Sessões", icon: <Monitor className="h-4 w-4" /> },
  { key: "debug", label: "Debug", icon: <Bug className="h-4 w-4" /> },
];

const db = supabase as any;

const FUNNEL_EVENTS = ["page_view", "view_content", "click_buy", "add_to_cart", "checkout_start", "add_payment_info", "pix_generated", "purchase"] as const;
const FUNNEL_ORDER: Record<string, number> = {};
FUNNEL_EVENTS.forEach((e, i) => { FUNNEL_ORDER[e] = i; });

function fmtDate(d: string) {
  try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return d; }
}
function fmtMoney(v: number) { return `R$ ${(v / 100).toFixed(2)}`; }
function pct(a: number, b: number) { return b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—"; }

// ── Campaign Health Analyzer ────────────────────────────────────────────
interface CampaignDiag {
  status: "saudável" | "atenção" | "crítica";
  alerts: string[];
  ctr: number;
  roas: number;
  cpa: number;
  convRate: number;
  sessions: number;
  purchases: number;
}

function analyzeCampaign(
  campId: string,
  campName: string,
  attributions: any[],
  costs: any[],
  sessions: any[],
  events: any[],
): CampaignDiag {
  const campAttrs = attributions.filter(a => a.campaign_id === campId);
  const campCosts = costs.filter(c => c.campaign_id === campId);
  const campSessions = sessions.filter(s => s.campaign_id === campId);
  // Also match sessions by utm_campaign name
  const sessionsByName = sessions.filter(s => s.utm_campaign === campName);
  const allSessions = [...new Map([...campSessions, ...sessionsByName].map(s => [s.session_id, s])).values()];
  const sessionIds = new Set(allSessions.map(s => s.session_id));
  const campEvents = events.filter(e => sessionIds.has(e.session_id));

  const totalSpend = campCosts.reduce((s: number, c: any) => s + (c.spend || 0), 0);
  const totalImpressions = campCosts.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
  const totalClicks = campCosts.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
  const revenue = campAttrs.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
  const purchases = campAttrs.length;

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : -1;
  const roas = totalSpend > 0 ? revenue / totalSpend : -1;
  const cpa = purchases > 0 && totalSpend > 0 ? totalSpend / purchases : -1;
  const convRate = allSessions.length > 0 ? (purchases / allSessions.length) * 100 : -1;

  const checkoutEvents = campEvents.filter(e => e.event_name === "checkout_start").length;
  const pixEvents = campEvents.filter(e => e.event_name === "pix_generated").length;

  const alerts: string[] = [];
  let score = 0; // 0 = saudável, 1+ = atenção, 3+ = crítica

  if (ctr >= 0 && ctr < 0.5) { alerts.push("CTR muito baixo (<0.5%)"); score += 2; }
  else if (ctr >= 0 && ctr < 1.0) { alerts.push("CTR baixo (<1%)"); score += 1; }

  if (roas >= 0 && roas < 1.0) { alerts.push(`ROAS negativo (${roas.toFixed(2)}x)`); score += 2; }
  else if (roas >= 0 && roas < 2.0) { alerts.push(`ROAS baixo (${roas.toFixed(2)}x)`); score += 1; }

  if (convRate >= 0 && convRate < 0.5) { alerts.push("Conversão baixa após clique"); score += 1; }

  if (checkoutEvents > 0 && purchases === 0) { alerts.push("Gargalo no checkout → sem compras"); score += 2; }
  if (pixEvents > 0 && purchases === 0) { alerts.push("PIX gerados sem compras"); score += 1; }

  if (cpa > 0 && cpa > 15000) { alerts.push(`CPA alto (${fmtMoney(Math.round(cpa))})`); score += 1; }

  if (allSessions.length === 0 && totalSpend > 0) { alerts.push("Gasto sem sessões rastreadas"); score += 2; }

  const status: CampaignDiag["status"] = score >= 3 ? "crítica" : score >= 1 ? "atenção" : "saudável";

  return { status, alerts, ctr, roas, cpa, convRate, sessions: allSessions.length, purchases };
}

// ── Creative Winner Detector ────────────────────────────────────────────
interface CreativeDiag {
  rank: "top_performer" | "em_teste" | "fraco";
  clicks: number;
  sessions: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  roas: number;
  convRate: number;
}

function analyzeCreative(
  creativeId: string,
  attributions: any[],
  sessions: any[],
  events: any[],
  costs: any[],
): CreativeDiag {
  const crAttrs = attributions.filter(a => a.creative_id === creativeId);
  const crSessions = sessions.filter(s => s.creative_id === creativeId);
  const sessionIds = new Set(crSessions.map(s => s.session_id));
  const crEvents = events.filter(e => sessionIds.has(e.session_id));

  const revenue = crAttrs.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
  const purchases = crAttrs.length;
  const checkouts = crEvents.filter(e => e.event_name === "checkout_start").length;
  const totalSessions = crSessions.length;

  // Get spend for campaigns associated with this creative
  const campaignIds = [...new Set(crSessions.map(s => s.campaign_id).filter(Boolean))];
  const spend = costs.filter(c => campaignIds.includes(c.campaign_id)).reduce((s: number, c: any) => s + (c.spend || 0), 0);

  const roas = spend > 0 ? revenue / spend : -1;
  const convRate = totalSessions > 0 ? (purchases / totalSessions) * 100 : 0;

  let rank: CreativeDiag["rank"] = "em_teste";
  if (totalSessions < 5) {
    rank = "em_teste";
  } else if (purchases >= 2 && convRate >= 1) {
    rank = "top_performer";
  } else if (totalSessions >= 20 && purchases === 0) {
    rank = "fraco";
  } else if (convRate < 0.3 && totalSessions >= 10) {
    rank = "fraco";
  }

  return { rank, clicks: 0, sessions: totalSessions, checkouts, purchases, revenue, roas, convRate };
}

// ── Pixel Optimization Engine ───────────────────────────────────────────
interface PixelAlert {
  type: "missing" | "duplicate" | "out_of_order" | "drop";
  severity: "warn" | "error";
  message: string;
  count: number;
}

function analyzePixelHealth(events: any[]): PixelAlert[] {
  const alerts: PixelAlert[] = [];

  // Group events by visitor
  const byVisitor = new Map<string, any[]>();
  events.forEach(e => {
    if (!e.visitor_id) return;
    if (!byVisitor.has(e.visitor_id)) byVisitor.set(e.visitor_id, []);
    byVisitor.get(e.visitor_id)!.push(e);
  });

  let missingClickBuy = 0;
  let missingPix = 0;
  let outOfOrder = 0;
  let duplicateEvents = 0;

  byVisitor.forEach((visitorEvents) => {
    const sorted = [...visitorEvents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Check for missing prerequisite events
    const hasEvent = (name: string) => sorted.some(e => e.event_name === name);
    if (hasEvent("checkout_start") && !hasEvent("click_buy")) missingClickBuy++;
    if (hasEvent("purchase") && !hasEvent("pix_generated") && !hasEvent("add_payment_info")) missingPix++;

    // Check out-of-order
    let lastIdx = -1;
    sorted.forEach(e => {
      const idx = FUNNEL_ORDER[e.event_name];
      if (idx !== undefined) {
        if (idx < lastIdx) outOfOrder++;
        if (idx > lastIdx) lastIdx = idx;
      }
    });

    // Check duplicates (same event_name within 5 seconds)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].event_name === sorted[i - 1].event_name) {
        const diff = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
        if (diff < 5000) duplicateEvents++;
      }
    }
  });

  if (missingClickBuy > 0) alerts.push({ type: "missing", severity: "warn", message: `checkout_start sem click_buy anterior (${missingClickBuy} visitantes)`, count: missingClickBuy });
  if (missingPix > 0) alerts.push({ type: "missing", severity: "error", message: `purchase sem pix_generated/add_payment_info (${missingPix} visitantes)`, count: missingPix });
  if (outOfOrder > 0) alerts.push({ type: "out_of_order", severity: "warn", message: `${outOfOrder} evento(s) fora de ordem no funil`, count: outOfOrder });
  if (duplicateEvents > 0) alerts.push({ type: "duplicate", severity: "warn", message: `${duplicateEvents} evento(s) duplicado(s) (<5s entre si)`, count: duplicateEvents });

  // Event frequency drop analysis
  const now = Date.now();
  const last24h = events.filter(e => now - new Date(e.created_at).getTime() < 86400000);
  const prev24h = events.filter(e => {
    const t = now - new Date(e.created_at).getTime();
    return t >= 86400000 && t < 172800000;
  });
  if (prev24h.length > 10 && last24h.length < prev24h.length * 0.3) {
    alerts.push({ type: "drop", severity: "error", message: `Queda brusca de eventos: ${prev24h.length} → ${last24h.length} (últimas 24h vs anteriores)`, count: prev24h.length - last24h.length });
  }

  // Missing funnel steps globally
  FUNNEL_EVENTS.forEach((ev, i) => {
    if (i === 0) return;
    const prevCount = events.filter(e => e.event_name === FUNNEL_EVENTS[i - 1]).length;
    const curCount = events.filter(e => e.event_name === ev).length;
    if (prevCount > 0 && curCount === 0) {
      alerts.push({ type: "missing", severity: "warn", message: `Nenhum evento "${ev}" registrado (etapa anterior tem ${prevCount})`, count: 0 });
    }
  });

  return alerts;
}

// ════════════════════════════════════════════════════════════════════════
export default function AdminTrackingHub({ defaultTab }: { defaultTab?: SubTab }) {
  const [subTab, setSubTab] = useState<SubTab>(defaultTab ?? "campanhas");
  const [loading, setLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [clicks, setClicks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [campaignCosts, setCampaignCosts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ campaign_name: "", platform: "tiktok", campaign_external_id: "" });
  const [newCreative, setNewCreative] = useState({ creative_name: "", campaign_id: "", creative_external_id: "" });
  const [newLink, setNewLink] = useState({ url: "", tracking_id: "", campaign_id: "", creative_id: "" });
  const [newCost, setNewCost] = useState({ campaign_id: "", date: "", spend: "", impressions: "", clicks: "" });
  const [debugVisitorId, setDebugVisitorId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (subTab === "campanhas") {
        const [{ data: camps }, { data: attrs }, { data: costs }, { data: sess }, { data: evts }] = await Promise.all([
          db.from("campaigns").select("*").order("created_at", { ascending: false }).limit(200),
          db.from("attributions").select("*"),
          db.from("campaign_costs").select("*"),
          db.from("sessions").select("*").limit(500),
          db.from("events").select("*").limit(1000),
        ]);
        setCampaigns(camps || []);
        setAttributions(attrs || []);
        setCampaignCosts(costs || []);
        setSessions(sess || []);
        setEvents(evts || []);
      } else if (subTab === "criativos") {
        const [{ data: crs }, { data: camps }, { data: attrs }, { data: sess }, { data: evts }, { data: costs }] = await Promise.all([
          db.from("creatives").select("*, campaigns(campaign_name)").order("created_at", { ascending: false }).limit(200),
          db.from("campaigns").select("id, campaign_name"),
          db.from("attributions").select("*"),
          db.from("sessions").select("*").limit(500),
          db.from("events").select("*").limit(1000),
          db.from("campaign_costs").select("*"),
        ]);
        setCreatives(crs || []);
        setCampaigns(camps || []);
        setAttributions(attrs || []);
        setSessions(sess || []);
        setEvents(evts || []);
        setCampaignCosts(costs || []);
      } else if (subTab === "links") {
        const [{ data: lnks }, { data: camps }, { data: crs }] = await Promise.all([
          db.from("tracked_links").select("*, campaigns(campaign_name), creatives(creative_name)").order("created_at", { ascending: false }).limit(200),
          db.from("campaigns").select("id, campaign_name"),
          db.from("creatives").select("id, creative_name"),
        ]);
        setLinks(lnks || []);
        setCampaigns(camps || []);
        setCreatives(crs || []);
      } else if (subTab === "cliques") {
        const { data } = await db.from("clicks").select("*").order("created_at", { ascending: false }).limit(500);
        setClicks(data || []);
      } else if (subTab === "eventos") {
        const { data } = await db.from("events").select("*").order("created_at", { ascending: false }).limit(500);
        setEvents(data || []);
      } else if (subTab === "sessoes") {
        const { data } = await db.from("sessions").select("*").order("created_at", { ascending: false }).limit(500);
        setSessions(data || []);
      } else if (subTab === "debug") {
        const [{ data: ev }, { data: sess }, { data: attrs }] = await Promise.all([
          db.from("events").select("*").order("created_at", { ascending: false }).limit(500),
          db.from("sessions").select("*").order("created_at", { ascending: false }).limit(200),
          db.from("attributions").select("*, campaigns(campaign_name), creatives(creative_name)").order("created_at", { ascending: false }).limit(100),
        ]);
        setEvents(ev || []);
        setSessions(sess || []);
        setAttributions(attrs || []);
      }
    } catch (e) { console.error("Tracking Hub fetch error:", e); }
    setLoading(false);
  }, [subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CRUD ──
  const addCampaign = async () => {
    if (!newCampaign.campaign_name.trim()) return;
    await db.from("campaigns").insert(newCampaign);
    setNewCampaign({ campaign_name: "", platform: "tiktok", campaign_external_id: "" });
    setAddDialogOpen(false);
    fetchData();
  };
  const deleteCampaign = async (id: string) => { await db.from("campaigns").delete().eq("id", id); fetchData(); };

  const addCreative = async () => {
    if (!newCreative.creative_name.trim()) return;
    await db.from("creatives").insert({ creative_name: newCreative.creative_name, campaign_id: newCreative.campaign_id || null, creative_external_id: newCreative.creative_external_id || null });
    setNewCreative({ creative_name: "", campaign_id: "", creative_external_id: "" });
    setAddDialogOpen(false);
    fetchData();
  };
  const deleteCreative = async (id: string) => { await db.from("creatives").delete().eq("id", id); fetchData(); };

  const addLink = async () => {
    if (!newLink.url.trim() || !newLink.tracking_id.trim()) return;
    await db.from("tracked_links").insert({ url: newLink.url, tracking_id: newLink.tracking_id, campaign_id: newLink.campaign_id || null, creative_id: newLink.creative_id || null });
    setNewLink({ url: "", tracking_id: "", campaign_id: "", creative_id: "" });
    setAddDialogOpen(false);
    fetchData();
  };
  const deleteLink = async (id: string) => { await db.from("tracked_links").delete().eq("id", id); fetchData(); };

  const addCampaignCost = async () => {
    if (!newCost.campaign_id || !newCost.date) return;
    await db.from("campaign_costs").upsert({
      campaign_id: newCost.campaign_id,
      date: newCost.date,
      spend: Math.round(parseFloat(newCost.spend || "0") * 100),
      impressions: parseInt(newCost.impressions || "0"),
      clicks: parseInt(newCost.clicks || "0"),
      cpc: parseFloat(newCost.clicks || "0") > 0 ? (parseFloat(newCost.spend || "0") / parseInt(newCost.clicks || "1")).toFixed(2) : 0,
      ctr: parseFloat(newCost.impressions || "0") > 0 ? (parseInt(newCost.clicks || "0") / parseInt(newCost.impressions || "1") * 100).toFixed(4) : 0,
    }, { onConflict: "campaign_id,date" });
    setNewCost({ campaign_id: "", date: "", spend: "", impressions: "", clicks: "" });
    setCostDialogOpen(false);
    fetchData();
  };

  // ── Computed ──
  const getCampaignRevenue = (cid: string) => attributions.filter(a => a.campaign_id === cid).reduce((s: number, a: any) => s + (a.revenue || 0), 0);
  const getCampaignSales = (cid: string) => attributions.filter(a => a.campaign_id === cid).length;
  const getCampaignSpend = (cid: string) => campaignCosts.filter(c => c.campaign_id === cid).reduce((s: number, c: any) => s + (c.spend || 0), 0);

  const filteredEvents = events.filter(e => !search || e.event_name?.toLowerCase().includes(search.toLowerCase()) || e.visitor_id?.toLowerCase().includes(search.toLowerCase()));
  const filteredSessions = sessions.filter(s => !search || s.visitor_id?.toLowerCase().includes(search.toLowerCase()) || s.utm_source?.toLowerCase().includes(search.toLowerCase()));

  // ── Campaign diagnostics (memoized) ──
  const campaignDiags = useMemo(() => {
    const map = new Map<string, CampaignDiag>();
    campaigns.forEach(c => {
      map.set(c.id, analyzeCampaign(c.id, c.campaign_name, attributions, campaignCosts, sessions, events));
    });
    return map;
  }, [campaigns, attributions, campaignCosts, sessions, events]);

  // ── Creative diagnostics (memoized) ──
  const creativeDiags = useMemo(() => {
    const map = new Map<string, CreativeDiag>();
    creatives.forEach(c => {
      map.set(c.id, analyzeCreative(c.id, attributions, sessions, events, campaignCosts));
    });
    return map;
  }, [creatives, attributions, sessions, events, campaignCosts]);

  // Sort creatives: top_performer first, then em_teste, then fraco
  const sortedCreatives = useMemo(() => {
    const rankOrder = { top_performer: 0, em_teste: 1, fraco: 2 };
    return [...creatives].sort((a, b) => {
      const da = creativeDiags.get(a.id);
      const dba = creativeDiags.get(b.id);
      return (rankOrder[da?.rank || "em_teste"] || 1) - (rankOrder[dba?.rank || "em_teste"] || 1);
    });
  }, [creatives, creativeDiags]);

  // ── Pixel health (memoized) ──
  const pixelAlerts = useMemo(() => analyzePixelHealth(events), [events]);
  const pixelScore = useMemo(() => {
    let score = 100;
    pixelAlerts.forEach(a => { score -= a.severity === "error" ? 20 : 10; });
    return Math.max(0, score);
  }, [pixelAlerts]);

  const baseUrl = window.location.origin;

  const statusBadge = (status: CampaignDiag["status"]) => {
    if (status === "saudável") return <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Saudável</Badge>;
    if (status === "atenção") return <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Atenção</Badge>;
    return <Badge className="text-[9px] bg-red-500/15 text-red-600 border-red-500/30"><ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Crítica</Badge>;
  };

  const rankBadge = (rank: CreativeDiag["rank"]) => {
    if (rank === "top_performer") return <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><Award className="h-2.5 w-2.5 mr-0.5" />Top Performer</Badge>;
    if (rank === "em_teste") return <Badge className="text-[9px] bg-blue-500/15 text-blue-600 border-blue-500/30"><Clock className="h-2.5 w-2.5 mr-0.5" />Em Teste</Badge>;
    return <Badge className="text-[9px] bg-red-500/15 text-red-600 border-red-500/30"><ArrowDown className="h-2.5 w-2.5 mr-0.5" />Fraco</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => { setSubTab(t.key); setSearch(""); setDebugVisitorId(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ══ CAMPANHAS ══ */}
      {subTab === "campanhas" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">Campanhas ({campaigns.length})</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCostDialogOpen(true)}><DollarSign className="h-3.5 w-3.5 mr-1" /> Adicionar Custo</Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Campanha</Button>
            </div>
          </div>

          {/* Summary cards */}
          {campaigns.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card className="p-3 text-center"><DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{fmtMoney(attributions.reduce((s: number, a: any) => s + (a.revenue || 0), 0))}</p><p className="text-[10px] text-muted-foreground">Receita Total</p></Card>
              <Card className="p-3 text-center"><Target className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{attributions.length}</p><p className="text-[10px] text-muted-foreground">Vendas Atribuídas</p></Card>
              <Card className="p-3 text-center"><TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{fmtMoney(campaignCosts.reduce((s: number, c: any) => s + (c.spend || 0), 0))}</p><p className="text-[10px] text-muted-foreground">Gasto Total</p></Card>
              <Card className="p-3 text-center"><BarChart3 className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{(() => { const spend = campaignCosts.reduce((s: number, c: any) => s + (c.spend || 0), 0); const rev = attributions.reduce((s: number, a: any) => s + (a.revenue || 0), 0); return spend > 0 ? (rev / spend).toFixed(2) + "x" : "—"; })()}</p><p className="text-[10px] text-muted-foreground">ROAS</p></Card>
            </div>
          )}

          {/* AI Campaign Health Summary */}
          {campaigns.length > 0 && (() => {
            const criticas = campaigns.filter(c => campaignDiags.get(c.id)?.status === "crítica").length;
            const atencao = campaigns.filter(c => campaignDiags.get(c.id)?.status === "atenção").length;
            const saudaveis = campaigns.filter(c => campaignDiags.get(c.id)?.status === "saudável").length;
            return (
              <Card className="p-3 border-dashed">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-foreground">Diagnóstico Automático de Campanhas</h4>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{saudaveis} saudável(is)</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />{atencao} atenção</span>
                  <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-red-500" />{criticas} crítica(s)</span>
                </div>
              </Card>
            );
          })()}

          {campaigns.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhuma campanha cadastrada ainda.</Card>
          ) : (
            <div className="grid gap-2">
              {campaigns.map(c => {
                const revenue = getCampaignRevenue(c.id);
                const sales = getCampaignSales(c.id);
                const spend = getCampaignSpend(c.id);
                const roas = spend > 0 ? (revenue / spend).toFixed(2) : "—";
                const cpa = sales > 0 && spend > 0 ? fmtMoney(Math.round(spend / sales)) : "—";
                const diag = campaignDiags.get(c.id);
                return (
                  <Card key={c.id} className={`p-3 ${diag?.status === "crítica" ? "border-red-500/30" : diag?.status === "atenção" ? "border-amber-500/30" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{c.campaign_name}</p>
                          {diag && statusBadge(diag.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">{c.platform}</Badge>
                          {c.campaign_external_id && <span className="text-[10px] text-muted-foreground font-mono">{c.campaign_external_id}</span>}
                          <span className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                          <span className="text-muted-foreground">Vendas: <strong className="text-foreground">{sales}</strong></span>
                          <span className="text-muted-foreground">Receita: <strong className="text-foreground">{fmtMoney(revenue)}</strong></span>
                          {spend > 0 && <span className="text-muted-foreground">Gasto: <strong className="text-foreground">{fmtMoney(spend)}</strong></span>}
                          {spend > 0 && <span className="text-muted-foreground">ROAS: <strong className="text-foreground">{roas}x</strong></span>}
                          {cpa !== "—" && <span className="text-muted-foreground">CPA: <strong className="text-foreground">{cpa}</strong></span>}
                          {diag && diag.sessions > 0 && <span className="text-muted-foreground">Sessões: <strong className="text-foreground">{diag.sessions}</strong></span>}
                        </div>
                        {/* Campaign alerts */}
                        {diag && diag.alerts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {diag.alerts.map((a, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteCampaign(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Dialogs */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Nova Campanha</DialogTitle><DialogDescription>Cadastre uma campanha para rastrear</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome da campanha" value={newCampaign.campaign_name} onChange={e => setNewCampaign(p => ({ ...p, campaign_name: e.target.value }))} />
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newCampaign.platform} onChange={e => setNewCampaign(p => ({ ...p, platform: e.target.value }))}>
                  <option value="tiktok">TikTok</option><option value="meta">Meta</option><option value="google">Google</option><option value="other">Outro</option>
                </select>
                <Input placeholder="ID externo (opcional)" value={newCampaign.campaign_external_id} onChange={e => setNewCampaign(p => ({ ...p, campaign_external_id: e.target.value }))} />
                <Button onClick={addCampaign} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
            <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Adicionar Custo de Campanha</DialogTitle><DialogDescription>Registre o gasto diário de uma campanha</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newCost.campaign_id} onChange={e => setNewCost(p => ({ ...p, campaign_id: e.target.value }))}>
                  <option value="">Selecione a campanha</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.campaign_name}</option>)}
                </select>
                <Input type="date" value={newCost.date} onChange={e => setNewCost(p => ({ ...p, date: e.target.value }))} />
                <Input type="number" placeholder="Gasto (R$)" value={newCost.spend} onChange={e => setNewCost(p => ({ ...p, spend: e.target.value }))} />
                <Input type="number" placeholder="Impressões" value={newCost.impressions} onChange={e => setNewCost(p => ({ ...p, impressions: e.target.value }))} />
                <Input type="number" placeholder="Cliques" value={newCost.clicks} onChange={e => setNewCost(p => ({ ...p, clicks: e.target.value }))} />
                <Button onClick={addCampaignCost} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ══ CRIATIVOS ══ */}
      {subTab === "criativos" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Criativos — Winner Detector ({creatives.length})</h3>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Criativo</Button>
          </div>

          {/* Creative ranking summary */}
          {creatives.length > 0 && (() => {
            const tops = creatives.filter(c => creativeDiags.get(c.id)?.rank === "top_performer").length;
            const testes = creatives.filter(c => creativeDiags.get(c.id)?.rank === "em_teste").length;
            const fracos = creatives.filter(c => creativeDiags.get(c.id)?.rank === "fraco").length;
            return (
              <Card className="p-3 border-dashed">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-xs font-bold text-foreground">Classificação Automática de Criativos</h4>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-emerald-500" />{tops} Top Performer(s)</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-500" />{testes} Em Teste</span>
                  <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3 text-red-500" />{fracos} Fraco(s)</span>
                </div>
              </Card>
            );
          })()}

          {creatives.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum criativo cadastrado.</Card>
          ) : (
            <div className="grid gap-2">
              {sortedCreatives.map(c => {
                const diag = creativeDiags.get(c.id);
                return (
                  <Card key={c.id} className={`p-3 ${diag?.rank === "top_performer" ? "border-emerald-500/40 bg-emerald-500/5" : diag?.rank === "fraco" ? "border-red-500/20" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{c.creative_name}</p>
                          {diag && rankBadge(diag.rank)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.campaigns?.campaign_name && <Badge variant="outline" className="text-[10px]">{c.campaigns.campaign_name}</Badge>}
                          {c.creative_external_id && <span className="text-[10px] text-muted-foreground font-mono">{c.creative_external_id}</span>}
                        </div>
                        {diag && (
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                            <span className="text-muted-foreground">Sessões: <strong className="text-foreground">{diag.sessions}</strong></span>
                            <span className="text-muted-foreground">Checkouts: <strong className="text-foreground">{diag.checkouts}</strong></span>
                            <span className="text-muted-foreground">Vendas: <strong className="text-foreground">{diag.purchases}</strong></span>
                            <span className="text-muted-foreground">Receita: <strong className="text-foreground">{fmtMoney(diag.revenue)}</strong></span>
                            {diag.roas >= 0 && <span className="text-muted-foreground">ROAS: <strong className="text-foreground">{diag.roas.toFixed(2)}x</strong></span>}
                            <span className="text-muted-foreground">Conv: <strong className="text-foreground">{diag.convRate.toFixed(1)}%</strong></span>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteCreative(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Novo Criativo</DialogTitle><DialogDescription>Cadastre um criativo</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome do criativo" value={newCreative.creative_name} onChange={e => setNewCreative(p => ({ ...p, creative_name: e.target.value }))} />
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newCreative.campaign_id} onChange={e => setNewCreative(p => ({ ...p, campaign_id: e.target.value }))}>
                  <option value="">Campanha (opcional)</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.campaign_name}</option>)}
                </select>
                <Input placeholder="ID externo (opcional)" value={newCreative.creative_external_id} onChange={e => setNewCreative(p => ({ ...p, creative_external_id: e.target.value }))} />
                <Button onClick={addCreative} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ══ LINKS RASTREADOS ══ */}
      {subTab === "links" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Links Rastreados ({links.length})</h3>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Link</Button>
          </div>
          {links.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum link rastreado.</Card>
          ) : (
            <div className="grid gap-2">
              {links.map(l => {
                const redirectUrl = `${baseUrl}/r/${l.tracking_id}`;
                return (
                  <Card key={l.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-mono text-foreground truncate">{l.url}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] font-mono">{l.tracking_id}</Badge>
                          {l.campaigns?.campaign_name && <Badge variant="outline" className="text-[10px]">{l.campaigns.campaign_name}</Badge>}
                          {l.creatives?.creative_name && <span className="text-[10px] text-muted-foreground">{l.creatives.creative_name}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground font-mono truncate">{redirectUrl}</span>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => navigator.clipboard.writeText(redirectUrl)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteLink(l.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Novo Link Rastreado</DialogTitle><DialogDescription>Cadastre um link com tracking_id.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="URL destino" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
                <Input placeholder="Tracking ID" value={newLink.tracking_id} onChange={e => setNewLink(p => ({ ...p, tracking_id: e.target.value }))} />
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newLink.campaign_id} onChange={e => setNewLink(p => ({ ...p, campaign_id: e.target.value }))}>
                  <option value="">Campanha (opcional)</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.campaign_name}</option>)}
                </select>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newLink.creative_id} onChange={e => setNewLink(p => ({ ...p, creative_id: e.target.value }))}>
                  <option value="">Criativo (opcional)</option>
                  {creatives.map(c => <option key={c.id} value={c.id}>{c.creative_name}</option>)}
                </select>
                <Button onClick={addLink} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ══ CLIQUES ══ */}
      {subTab === "cliques" && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Cliques Recentes ({clicks.length})</h3>
          {clicks.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum clique registrado ainda.</Card>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Session ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Tracking ID</th>
                </tr></thead>
                <tbody>{clicks.map(c => (
                  <tr key={c.id} className="border-t border-border/30">
                    <td className="px-3 py-2">{fmtDate(c.created_at)}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{c.session_id?.slice(0, 20) || "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.tracking_id || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ EVENTOS ══ */}
      {subTab === "eventos" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Eventos ({filteredEvents.length})</h3>
            <div className="flex-1 max-w-xs">
              <Input placeholder="Buscar evento ou visitor_id..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-muted"><tr>
                <th className="px-3 py-2 text-left font-semibold">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Evento</th>
                <th className="px-3 py-2 text-left font-semibold">Visitor ID</th>
                <th className="px-3 py-2 text-left font-semibold">Session ID</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Campaign</th>
                <th className="px-3 py-2 text-left font-semibold">Valor</th>
              </tr></thead>
              <tbody>{filteredEvents.slice(0, 200).map(e => (
                <tr key={e.id} className="border-t border-border/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  <td className="px-3 py-2"><Badge variant={e.event_name === "purchase" ? "default" : "secondary"} className="text-[10px]">{e.event_name}</Badge></td>
                  <td className="px-3 py-2 font-mono text-muted-foreground text-[10px]">{e.visitor_id?.slice(0, 18) || "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground text-[10px]">{e.session_id?.slice(0, 18) || "—"}</td>
                  <td className="px-3 py-2">{e.source || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.campaign || "—"}</td>
                  <td className="px-3 py-2">{e.value ? fmtMoney(e.value) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SESSÕES ══ */}
      {subTab === "sessoes" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Sessões ({filteredSessions.length})</h3>
            <div className="flex-1 max-w-xs">
              <Input placeholder="Buscar visitor_id ou utm_source..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-muted"><tr>
                <th className="px-3 py-2 text-left font-semibold">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Visitor ID</th>
                <th className="px-3 py-2 text-left font-semibold">Session ID</th>
                <th className="px-3 py-2 text-left font-semibold">Device</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Campaign</th>
                <th className="px-3 py-2 text-left font-semibold">ttclid</th>
                <th className="px-3 py-2 text-left font-semibold">Referrer</th>
              </tr></thead>
              <tbody>{filteredSessions.slice(0, 200).map(s => (
                <tr key={s.session_id} className="border-t border-border/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{s.visitor_id?.slice(0, 18)}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground text-[10px]">{s.session_id?.slice(0, 18)}</td>
                  <td className="px-3 py-2">{s.device === "Mobile" ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground" /> : <Monitor className="h-3.5 w-3.5 text-muted-foreground" />}</td>
                  <td className="px-3 py-2">{s.utm_source || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.utm_campaign || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{s.ttclid ? s.ttclid.slice(0, 12) + "…" : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.referrer || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ DEBUG + PIXEL OPTIMIZATION ══ */}
      {subTab === "debug" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Bug className="h-4 w-4" /> Debug de Tracking</h3>
            <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>

          {/* Pixel Health Score */}
          <Card className={`p-4 border-dashed ${pixelScore >= 80 ? "border-emerald-500/30" : pixelScore >= 50 ? "border-amber-500/30" : "border-red-500/30"}`}>
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${pixelScore >= 80 ? "text-emerald-500" : pixelScore >= 50 ? "text-amber-500" : "text-red-500"}`}>{pixelScore}</div>
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-foreground">Pixel Optimization Score</h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {pixelScore >= 80 ? "Tracking saudável — sem problemas críticos" : pixelScore >= 50 ? "Atenção — problemas detectados nos eventos" : "Crítico — múltiplos problemas de tracking detectados"}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pixelScore >= 80 ? "bg-emerald-500" : pixelScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pixelScore}%` }} />
            </div>
          </Card>

          {/* Pixel Alerts */}
          {pixelAlerts.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Alertas do Pixel Optimization Engine</h4>
              <div className="space-y-1.5">
                {pixelAlerts.map((a, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${a.severity === "error" ? "bg-destructive/10" : "bg-amber-500/10"}`}>
                    {a.severity === "error" ? <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                    <div>
                      <p className={`font-medium ${a.severity === "error" ? "text-red-600" : "text-amber-600"}`}>{a.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Tipo: {a.type === "missing" ? "Evento faltando" : a.type === "duplicate" ? "Duplicação" : a.type === "out_of_order" ? "Fora de ordem" : "Queda brusca"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {pixelAlerts.length === 0 && events.length > 0 && (
            <Card className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Nenhuma inconsistência detectada nos eventos</p>
            </Card>
          )}

          {/* Visitor timeline filter */}
          <div className="flex items-center gap-2">
            <Input placeholder="Filtrar por visitor_id..." value={debugVisitorId} onChange={e => setDebugVisitorId(e.target.value)} className="h-8 text-xs max-w-sm" />
            {debugVisitorId && <Button variant="ghost" size="sm" onClick={() => setDebugVisitorId("")} className="text-xs">Limpar</Button>}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "Sessões", value: sessions.length, icon: <Monitor className="h-4 w-4" /> },
              { label: "Eventos", value: events.length, icon: <Activity className="h-4 w-4" /> },
              { label: "Com ttclid", value: sessions.filter(s => s.ttclid).length, icon: <Globe className="h-4 w-4" /> },
              { label: "Purchases", value: events.filter(e => e.event_name === "purchase").length, icon: <CheckCircle2 className="h-4 w-4" /> },
              { label: "Atribuições", value: attributions.length, icon: <Target className="h-4 w-4" /> },
            ].map((m, i) => (
              <Card key={i} className="p-3 text-center">
                <div className="flex items-center justify-center text-muted-foreground mb-1">{m.icon}</div>
                <p className="text-lg font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </Card>
            ))}
          </div>

          {/* Funnel consistency */}
          <Card className="p-4">
            <h4 className="text-xs font-bold text-foreground mb-2">Consistência do Funil</h4>
            <div className="space-y-1">
              {FUNNEL_EVENTS.map(ev => {
                const filtered = debugVisitorId ? events.filter(e => e.visitor_id?.includes(debugVisitorId)) : events;
                const count = filtered.filter(e => e.event_name === ev).length;
                const inconsistent = filtered.filter(e => e.event_name === ev && e.event_data?.is_consistent === false).length;
                return (
                  <div key={ev} className="flex items-center gap-2 text-xs">
                    <span className="w-32 font-mono">{ev}</span>
                    <span className="font-bold text-foreground">{count}</span>
                    {inconsistent > 0 && <Badge variant="destructive" className="text-[9px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{inconsistent} inconsistente(s)</Badge>}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Attribution log */}
          {attributions.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-bold text-foreground mb-2">Atribuições Recentes</h4>
              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {attributions.filter(a => !debugVisitorId || a.session_id?.includes(debugVisitorId)).slice(0, 30).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/20">
                    <span className="text-muted-foreground w-28 shrink-0">{fmtDate(a.created_at)}</span>
                    <Badge variant="default" className="text-[9px]">purchase</Badge>
                    <span className="font-mono text-muted-foreground text-[9px] truncate">{a.session_id?.slice(0, 16) || "—"}</span>
                    {a.campaigns?.campaign_name && <Badge variant="outline" className="text-[9px]">{a.campaigns.campaign_name}</Badge>}
                    {a.creatives?.creative_name && <span className="text-[9px] text-muted-foreground">{a.creatives.creative_name}</span>}
                    <span className="ml-auto font-semibold text-foreground">{fmtMoney(a.revenue || 0)}</span>
                    <Badge variant="secondary" className="text-[8px]">{a.attribution_model}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Visitor timeline */}
          <Card className="p-4">
            <h4 className="text-xs font-bold text-foreground mb-2">Timeline de Eventos {debugVisitorId && `(${debugVisitorId})`}</h4>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {(debugVisitorId ? events.filter(e => e.visitor_id?.includes(debugVisitorId)) : events).slice(0, 50).map(e => (
                <div key={e.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/20">
                  <span className="text-muted-foreground w-28 shrink-0">{fmtDate(e.created_at)}</span>
                  <Badge variant={e.event_name === "purchase" ? "default" : e.event_data?.is_consistent === false ? "destructive" : "secondary"} className="text-[9px] shrink-0">{e.event_name}</Badge>
                  <span className="font-mono text-muted-foreground text-[9px] truncate">{e.visitor_id?.slice(0, 16)}</span>
                  <span className="font-mono text-muted-foreground text-[9px] truncate">{e.session_id?.slice(0, 16)}</span>
                  {e.source && <Badge variant="outline" className="text-[9px]">{e.source}</Badge>}
                  {e.value ? <span className="ml-auto font-semibold text-foreground text-[10px]">{fmtMoney(e.value)}</span> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
