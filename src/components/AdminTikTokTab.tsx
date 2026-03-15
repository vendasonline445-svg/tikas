import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Activity, CheckCircle2, AlertTriangle, XCircle,
  Shield, Link2, Clock, Play, Gauge, Search, Globe,
  ChevronRight, RefreshCw, Pencil, Save, X, Settings2
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface Pixel { id: string; name: string; pixel_id: string; api_token: string; status: string; created_at: string; }
interface UserEvent { id: string; event_type: string; event_data: any; created_at: string; }
type DiagStatus = "ok" | "warn" | "error" | "loading";

interface IntegrationSetting {
  id: string;
  integration_key: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

// ── Integration definitions ───────────────────────────────────────────

interface IntegrationDef {
  key: string; name: string; icon: string; group: string; description: string;
  detect: () => boolean;
  configFields: { key: string; label: string; type: "text" | "password" | "toggle" | "tags"; placeholder?: string }[];
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    key: "meta", name: "Meta Pixel", icon: "📘", group: "ads", description: "Facebook / Instagram Ads pixel",
    detect: () => !!(window as any).fbq,
    configFields: [
      { key: "pixel_id", label: "Pixel ID", type: "text", placeholder: "Ex: 123456789012345" },
      { key: "access_token", label: "Conversions API Token", type: "password", placeholder: "Token de acesso" },
      { key: "test_event_code", label: "Código de Teste (opcional)", type: "text", placeholder: "TEST12345" },
    ],
  },
  {
    key: "gtag", name: "Google Analytics", icon: "📊", group: "analytics", description: "Google Analytics 4 (gtag.js)",
    detect: () => !!(window as any).gtag,
    configFields: [
      { key: "measurement_id", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX" },
    ],
  },
  {
    key: "gtm", name: "Google Tag Manager", icon: "🏷️", group: "analytics", description: "Gerenciador de tags do Google",
    detect: () => !!(window as any).google_tag_manager,
    configFields: [
      { key: "container_id", label: "Container ID", type: "text", placeholder: "GTM-XXXXXXX" },
    ],
  },
  {
    key: "clarity", name: "Microsoft Clarity", icon: "🔍", group: "heatmaps", description: "Heatmaps e session recording",
    detect: () => !!(window as any).clarity,
    configFields: [
      { key: "project_id", label: "Project ID", type: "text", placeholder: "Ex: vsbxker0lm" },
    ],
  },
  {
    key: "xtracky", name: "xTracky", icon: "📡", group: "tracking", description: "UTM handler e tracking de parâmetros",
    detect: () => {
      const scripts = document.querySelectorAll("script[src]");
      for (const s of scripts) { if ((s as HTMLScriptElement).src.includes("utm-handler")) return true; }
      return false;
    },
    configFields: [
      { key: "token", label: "Token", type: "text", placeholder: "Token de acesso" },
      { key: "script_url", label: "Script URL", type: "text", placeholder: "https://cdn.jsdelivr.net/..." },
    ],
  },
  {
    key: "utmify", name: "UTMify", icon: "🎯", group: "tracking", description: "Monitoramento de conversões (server-side)",
    detect: () => true,
    configFields: [
      { key: "api_token", label: "API Token", type: "password", placeholder: "Token da UTMify" },
      { key: "event_waiting", label: "Evento: Aguardando Pagamento", type: "text", placeholder: "waiting_payment" },
      { key: "event_paid", label: "Evento: Pago", type: "text", placeholder: "paid" },
    ],
  },
];

const GROUPS: Record<string, { label: string; icon: string }> = {
  ads: { label: "Pixels de Anúncios", icon: "📢" },
  analytics: { label: "Analytics", icon: "📊" },
  heatmaps: { label: "Heatmaps / Session Recording", icon: "🔍" },
  tracking: { label: "Tracking Externo", icon: "🔗" },
};

const TRACKED_INTERNAL = [
  "page_view", "visitor_session", "click_buy_button", "checkout_initiated",
  "pix_generated", "card_submitted", "payment_confirmed"
];

// ── Helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DiagStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
}

function StatusBadge({ active, detected }: { active: boolean; detected: boolean }) {
  if (active && detected) return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">Ativo</Badge>;
  if (active && !detected) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">Configurado</Badge>;
  return <Badge variant="secondary" className="opacity-60">Desativado</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function AdminTikTokTab({ diagnosticsOnly = false }: { diagnosticsOnly?: boolean } = {}) {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSetting[]>([]);

  // Add TikTok pixel
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", pixel_id: "", api_token: "" });
  const [adding, setAdding] = useState(false);

  // Edit TikTok pixel
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", pixel_id: "", api_token: "" });
  const [saving, setSaving] = useState(false);

  // TikTok hub dialog
  const [tiktokHubOpen, setTiktokHubOpen] = useState(false);

  // Integration hub dialog
  const [hubKey, setHubKey] = useState<string | null>(null);
  const [hubConfig, setHubConfig] = useState<Record<string, any>>({});
  const [hubEnabled, setHubEnabled] = useState(true);
  const [hubSaving, setHubSaving] = useState(false);

  // Testing
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{ event: string; status: DiagStatus; msg: string }[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simResults, setSimResults] = useState<string[]>([]);

  // ── Data Fetching ───────────────────────────────────────────────────

  useEffect(() => { fetchPixels(); fetchRecentEvents(); fetchIntegrationSettings(); }, []);

  const fetchPixels = async () => {
    setLoading(true);
    const { data } = await supabase.from("tiktok_pixels").select("*").order("created_at", { ascending: false });
    setPixels((data as Pixel[]) || []);
    setLoading(false);
  };

  const fetchRecentEvents = async () => {
    setEventsLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from("user_events").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(500);
    setEvents((data as UserEvent[]) || []);
    setEventsLoading(false);
  };

  const fetchIntegrationSettings = async () => {
    const { data } = await supabase.from("integration_settings").select("*");
    setIntegrationSettings((data as IntegrationSetting[]) || []);
  };

  // ── TikTok CRUD ─────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!form.name || !form.pixel_id || !form.api_token) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    setAdding(true);
    const { error } = await supabase.from("tiktok_pixels").insert({ name: form.name, pixel_id: form.pixel_id, api_token: form.api_token, status: "active" });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Pixel adicionado!" }); setForm({ name: "", pixel_id: "", api_token: "" }); setShowAddForm(false); fetchPixels(); }
    setAdding(false);
  };

  const toggleStatus = async (pixel: Pixel) => {
    const newStatus = pixel.status === "active" ? "inactive" : "active";
    await supabase.from("tiktok_pixels").update({ status: newStatus }).eq("id", pixel.id);
    fetchPixels();
  };

  const deletePixel = async (id: string) => {
    if (!confirm("Remover este pixel?")) return;
    await supabase.from("tiktok_pixels").delete().eq("id", id);
    fetchPixels();
  };

  const startEdit = (px: Pixel) => { setEditingId(px.id); setEditForm({ name: px.name, pixel_id: px.pixel_id, api_token: px.api_token }); };

  const saveEdit = async (id: string) => {
    if (!editForm.name || !editForm.pixel_id || !editForm.api_token) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    setSaving(true);
    await supabase.from("tiktok_pixels").update({ name: editForm.name, pixel_id: editForm.pixel_id, api_token: editForm.api_token }).eq("id", id);
    toast({ title: "Salvo!" }); setEditingId(null); fetchPixels();
    setSaving(false);
  };

  // ── Integration Hub CRUD ────────────────────────────────────────────

  const openHub = (key: string) => {
    const setting = integrationSettings.find((s) => s.integration_key === key);
    const def = INTEGRATION_DEFS.find((d) => d.key === key);
    if (setting) {
      setHubConfig({ ...setting.config });
      setHubEnabled(setting.enabled);
    } else {
      // Initialize with empty config
      const emptyConfig: Record<string, any> = {};
      def?.configFields.forEach((f) => { emptyConfig[f.key] = ""; });
      setHubConfig(emptyConfig);
      setHubEnabled(false);
    }
    setHubKey(key);
  };

  const saveHub = async () => {
    if (!hubKey) return;
    setHubSaving(true);
    const def = INTEGRATION_DEFS.find((d) => d.key === hubKey);
    const existing = integrationSettings.find((s) => s.integration_key === hubKey);

    if (existing) {
      await supabase.from("integration_settings")
        .update({ enabled: hubEnabled, config: hubConfig, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("integration_settings")
        .insert({ integration_key: hubKey, name: def?.name || hubKey, enabled: hubEnabled, config: hubConfig });
    }

    toast({ title: "Configuração salva!" });
    setHubSaving(false);
    setHubKey(null);
    fetchIntegrationSettings();
  };

  // ── Diagnostics ─────────────────────────────────────────────────────

  const events24hCount = useMemo(() => {
    const h24ago = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter((e) => TRACKED_INTERNAL.includes(e.event_type) && new Date(e.created_at).getTime() > h24ago).length;
  }, [events]);

  const diagnostics = useMemo(() => {
    const activePixels = pixels.filter((p) => p.status === "active");
    const hasPixels = activePixels.length > 0;
    const ttqLoaded = typeof window !== "undefined" && !!(window as any).ttq;
    const relevantEvents = events.filter((e) => TRACKED_INTERNAL.includes(e.event_type));
    const hasEvents = relevantEvents.length > 0;
    const total = relevantEvents.length || 1;

    const eventIdCoverage = Math.round((relevantEvents.filter((e) => e.event_data && ("event_id" in e.event_data || "visitor_id" in e.event_data)).length / total) * 100);
    const emailCoverage = Math.round((relevantEvents.filter((e) => e.event_data?.email && String(e.event_data.email).trim()).length / total) * 100);
    const phoneCoverage = Math.round((relevantEvents.filter((e) => e.event_data?.phone && String(e.event_data.phone).trim()).length / total) * 100);
    const extIdCoverage = Math.round((relevantEvents.filter((e) => e.event_data?.visitor_id && String(e.event_data.visitor_id).trim()).length / total) * 100);
    const currencyCoverage = Math.round((relevantEvents.filter((e) => e.event_data?.currency === "BRL").length / total) * 100);
    const contentsCoverage = Math.round((relevantEvents.filter((e) => e.event_data?.contents && Array.isArray(e.event_data.contents)).length / total) * 100);

    let dupCount = 0;
    const sorted = [...relevantEvents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].event_type === sorted[i - 1].event_type) {
        const diff = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
        if (diff < 2000 && sorted[i].event_data?.visitor_id === sorted[i - 1].event_data?.visitor_id) dupCount++;
      }
    }

    let ttclidDetected = false;
    try { ttclidDetected = !!localStorage.getItem("fiq_ttclid") || !!localStorage.getItem("tt_ttclid"); } catch {}

    // Score calculation (0-100)
    let score = 0;
    // Infrastructure (35pts)
    if (hasPixels) score += 15;
    if (ttqLoaded || hasPixels) score += 10;
    if (hasEvents) score += 10;
    // Data quality (55pts)
    if (eventIdCoverage > 80) score += 15; else if (eventIdCoverage > 50) score += 8;
    if (extIdCoverage > 80) score += 10; else if (extIdCoverage > 50) score += 5;
    if (emailCoverage > 20) score += 10; else if (emailCoverage > 5) score += 5;
    if (phoneCoverage > 20) score += 10; else if (phoneCoverage > 5) score += 5;
    if (currencyCoverage > 90) score += 5; else if (currencyCoverage > 50) score += 2;
    if (contentsCoverage > 80) score += 5; else if (contentsCoverage > 30) score += 2;
    // Attribution (10pts)
    if (dupCount === 0) score += 5; else if (dupCount < 3) score += 2;
    if (ttclidDetected) score += 5; else if (hasPixels) score += 3;
    score = Math.min(score, 100);

    return { hasPixels, ttqLoaded, hasEvents, eventIdCoverage, emailCoverage, phoneCoverage, extIdCoverage, currencyCoverage, contentsCoverage, dupCount, ttclidDetected, score, totalEvents: relevantEvents.length };
  }, [pixels, events]);

  const scoreColor = diagnostics.score >= 80 ? "text-emerald-500" : diagnostics.score >= 50 ? "text-amber-500" : "text-red-500";
  const scoreBg = diagnostics.score >= 80 ? "bg-emerald-500/10" : diagnostics.score >= 50 ? "bg-amber-500/10" : "bg-red-500/10";

  // ── Test / Simulate ─────────────────────────────────────────────────

  const runPixelTest = async () => {
    setTesting(true); setTestResults([]);
    const results: typeof testResults = [];
    for (const ev of ["ViewContent", "AddToCart", "InitiateCheckout", "CompletePayment"]) {
      try {
        const { trackTikTokEvent } = await import("@/lib/tiktok-tracking");
        await trackTikTokEvent({ event: ev, properties: { content_type: "product", content_id: "test", value: 1, currency: "BRL", _test: true } });
        results.push({ event: ev, status: "ok", msg: "Enviado" });
      } catch (err: any) { results.push({ event: ev, status: "error", msg: err?.message || "Falha" }); }
      setTestResults([...results]);
      await new Promise((r) => setTimeout(r, 400));
    }
    setTesting(false);
  };

  const simulateConversion = async () => {
    setSimulating(true); setSimResults([]);
    const log = (msg: string) => setSimResults((p) => [...p, msg]);
    try {
      const { getTrackingContext } = await import("@/utils/track-event");
      const ctx = getTrackingContext();
      log(`✅ visitor_id: ${ctx.visitor_id || "gerado"}`);
      const { trackTikTokEvent } = await import("@/lib/tiktok-tracking");
      for (const ev of ["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"]) {
        log(`📤 ${ev}...`);
        await trackTikTokEvent({ event: ev, properties: { content_id: "sim", value: 87.6, currency: "BRL", _test: true } });
        log(`✅ ${ev}`);
        await new Promise((r) => setTimeout(r, 300));
      }
      log("🎉 Concluído!");
    } catch (err: any) { log(`❌ ${err?.message || "Erro"}`); }
    setSimulating(false);
  };

  const recentTikTokEvents = useMemo(() =>
    events.filter((e) => TRACKED_INTERNAL.includes(e.event_type)).slice(0, 30).map((e) => ({
      type: e.event_type, visitorId: e.event_data?.visitor_id || "—", campaign: e.event_data?.utm_campaign || "—", time: e.created_at,
    })),
  [events]);

  // ── Group integrations ──────────────────────────────────────────────

  const groupedIntegrations = useMemo(() => {
    const groups: Record<string, (IntegrationDef & { setting?: IntegrationSetting; detected: boolean })[]> = {};
    INTEGRATION_DEFS.forEach((def) => {
      if (!groups[def.group]) groups[def.group] = [];
      const setting = integrationSettings.find((s) => s.integration_key === def.key);
      const detected = typeof window !== "undefined" ? def.detect() : false;
      groups[def.group].push({ ...def, setting, detected });
    });
    return groups;
  }, [integrationSettings]);

  // ── Hub dialog data ─────────────────────────────────────────────────

  const hubDef = hubKey ? INTEGRATION_DEFS.find((d) => d.key === hubKey) : null;

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  // ── Diagnostics-only mode (for embedding in Settings > Pixels) ────
  if (diagnosticsOnly) {
    return (
      <div className="space-y-4">
        {/* Health Score */}
        <div className={`rounded-xl p-4 ${scoreBg} flex items-center gap-4 border ${diagnostics.score >= 80 ? "border-emerald-500/20" : diagnostics.score >= 50 ? "border-amber-500/20" : "border-red-500/20"}`}>
          <Gauge className={`h-10 w-10 ${scoreColor}`} />
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">Pixel Health Score</p>
            <p className={`text-3xl font-black ${scoreColor}`}>{diagnostics.score} <span className="text-base font-medium text-muted-foreground">/ 100</span></p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.totalEvents}</p><p>Eventos</p></div>
            <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.extIdCoverage}%</p><p>Matching</p></div>
            <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.dupCount}</p><p>Duplicados</p></div>
          </div>
        </div>

        {/* Diagnostics grid */}
        <div className="grid gap-2">
          {[
            { label: "Pixels ativos", status: (diagnostics.hasPixels ? "ok" : "error") as DiagStatus, detail: `${pixels.filter((p) => p.status === "active").length}` },
            { label: "Event ID", status: (diagnostics.eventIdCoverage > 80 ? "ok" : diagnostics.eventIdCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.eventIdCoverage}%` },
            { label: "Advanced Matching", status: (diagnostics.extIdCoverage > 80 ? "ok" : diagnostics.extIdCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.extIdCoverage}%` },
            { label: "Currency BRL", status: (diagnostics.currencyCoverage > 90 ? "ok" : diagnostics.currencyCoverage > 50 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.currencyCoverage}%` },
            { label: "Contents", status: (diagnostics.contentsCoverage > 80 ? "ok" : diagnostics.contentsCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.contentsCoverage}%` },
            { label: "Duplicatas", status: (diagnostics.dupCount === 0 ? "ok" : diagnostics.dupCount < 3 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.dupCount}` },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2"><StatusIcon status={item.status} /><span className="text-sm">{item.label}</span></div>
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            </div>
          ))}
        </div>

        {/* EMQ Coverage */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Email", value: diagnostics.emailCoverage },
            { label: "Telefone", value: diagnostics.phoneCoverage },
            { label: "External ID", value: diagnostics.extIdCoverage },
            { label: "IP (server)", value: 100 },
          ].map((item, i) => (
            <div key={i} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold ${item.value >= 70 ? "text-emerald-500" : item.value >= 30 ? "text-amber-500" : "text-red-500"}`}>{item.value}%</p>
              <div className="w-full h-1.5 rounded-full bg-muted mt-1"><div className={`h-1.5 rounded-full ${item.value >= 70 ? "bg-emerald-500" : item.value >= 30 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${item.value}%` }} /></div>
            </div>
          ))}
        </div>

        {/* Recent Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Search className="h-4 w-4" /> Eventos Recentes ({recentTikTokEvents.length})</h3>
            <Button variant="ghost" size="sm" onClick={fetchRecentEvents}><RefreshCw className="h-3 w-3" /></Button>
          </div>
          {eventsLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : recentTikTokEvents.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum evento.</p> : (
            <div className="rounded-lg border overflow-hidden max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-3 py-2 font-medium">Evento</th><th className="text-left px-3 py-2 font-medium">Visitor</th><th className="text-left px-3 py-2 font-medium">Hora</th></tr></thead>
                <tbody>{recentTikTokEvents.map((ev, i) => (
                  <tr key={i} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{ev.type}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{String(ev.visitorId).slice(0, 18)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(ev.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Gerenciador de Integrações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pixels.filter((p) => p.status === "active").length} pixel(s) ativo(s) · {integrationSettings.filter((s) => s.enabled).length} integrações ativas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchPixels(); fetchRecentEvents(); fetchIntegrationSettings(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* ═══════════ ALL INTEGRATIONS BY GROUP ═══════════ */}
      {(Object.entries(GROUPS) as [string, { label: string; icon: string }][]).map(([groupKey, groupMeta]) => {
        const items = groupedIntegrations[groupKey] || [];
        const isTiktokGroup = groupKey === "ads";
        if (!isTiktokGroup && items.length === 0) return null;

        return (
          <div key={groupKey} className="space-y-3">
            <h2 className="font-bold text-sm flex items-center gap-2"><span className="text-lg">{groupMeta.icon}</span> {groupMeta.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isTiktokGroup && (
                <Card className="transition-all hover:shadow-md cursor-pointer" onClick={() => setTiktokHubOpen(true)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎵</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">TikTok Pixel + Events API</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pixels.filter((p) => p.status === "active").length} pixel(s) · Score: {diagnostics.score}/100</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={diagnostics.score >= 80 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : diagnostics.score >= 50 ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-red-500/15 text-red-600 border-red-500/30"}>
                          {diagnostics.score >= 80 ? "Saudável" : diagnostics.score >= 50 ? "Atenção" : "Crítico"}
                        </Badge>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {items.map((integ) => {
                const isEnabled = integ.setting?.enabled ?? false;
                return (
                  <Card key={integ.key} className={`transition-all hover:shadow-md cursor-pointer ${!isEnabled && !integ.detected ? "opacity-40" : ""}`} onClick={() => openHub(integ.key)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{integ.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{integ.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{integ.description}</p>
                          {integ.setting?.config && Object.values(integ.setting.config).some((v) => v && String(v).trim()) && (
                            <p className="text-xs font-mono text-muted-foreground mt-1">
                              {Object.entries(integ.setting.config).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge active={isEnabled} detected={integ.detected} />
                          <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ═══════════ TIKTOK HUB DIALOG ═══════════ */}
      <Dialog open={tiktokHubOpen} onOpenChange={setTiktokHubOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><span className="text-xl">🎵</span> TikTok Pixel + Events API</DialogTitle>
            <DialogDescription>Gerencie pixels, diagnósticos e eventos do TikTok.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Health Score */}
            <div className={`rounded-xl p-4 ${scoreBg} flex items-center gap-4 border ${diagnostics.score >= 80 ? "border-emerald-500/20" : diagnostics.score >= 50 ? "border-amber-500/20" : "border-red-500/20"}`}>
              <Gauge className={`h-10 w-10 ${scoreColor}`} />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Pixel Health Score</p>
                <p className={`text-3xl font-black ${scoreColor}`}>{diagnostics.score} <span className="text-base font-medium text-muted-foreground">/ 100</span></p>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.totalEvents}</p><p>Eventos</p></div>
                <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.extIdCoverage}%</p><p>Matching</p></div>
                <div className="text-center"><p className="text-lg font-bold text-foreground">{diagnostics.dupCount}</p><p>Duplicados</p></div>
              </div>
            </div>

            {/* Pixel Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Pixels Cadastrados <Badge variant="secondary">{pixels.length}</Badge></h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
              </div>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : pixels.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum pixel cadastrado.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {pixels.map((px) => {
                    const isEditing = editingId === px.id;
                    return (
                      <div key={px.id} className={`rounded-lg border p-4 ${!isEditing && px.status !== "active" ? "opacity-50" : ""}`}>
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold text-muted-foreground uppercase">Editando Pixel</p><Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Nome</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background mt-1" /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Pixel ID</label><input value={editForm.pixel_id} onChange={(e) => setEditForm({ ...editForm, pixel_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono mt-1" /></div>
                            <div><label className="text-xs font-medium text-muted-foreground">Events API Access Token</label><input value={editForm.api_token} onChange={(e) => setEditForm({ ...editForm, api_token: e.target.value })} type="password" className="w-full border rounded-lg px-3 py-2 text-sm bg-background mt-1" /></div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(px.id)} disabled={saving} className="flex-1"><Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Salvando..." : "Salvar"}</Button>
                              <Button variant="destructive" size="sm" onClick={() => deletePixel(px.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3"><span className="text-xl">🎵</span><div><p className="font-semibold text-sm">{px.name}</p><p className="text-xs text-muted-foreground font-mono mt-0.5">{px.pixel_id}</p></div></div>
                              <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => startEdit(px)}><Pencil className="h-3.5 w-3.5" /></Button><Switch checked={px.status === "active"} onCheckedChange={() => toggleStatus(px)} /></div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                              <StatusBadge active={px.status === "active"} detected={!!(window as any).ttq} />
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> {events24hCount} eventos/24h</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Diagnostics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Diagnóstico Avançado</h3>
              <div className="grid gap-2">
                {[
                  { label: "Pixels ativos", status: (diagnostics.hasPixels ? "ok" : "error") as DiagStatus, detail: `${pixels.filter((p) => p.status === "active").length}` },
                  { label: "SDK ttq", status: (diagnostics.ttqLoaded ? "ok" : "warn") as DiagStatus, detail: diagnostics.ttqLoaded ? "Carregado" : "Normal no admin" },
                  { label: "Eventos", status: (diagnostics.hasEvents ? "ok" : "warn") as DiagStatus, detail: `${diagnostics.totalEvents}` },
                  { label: "Event ID", status: (diagnostics.eventIdCoverage > 80 ? "ok" : diagnostics.eventIdCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.eventIdCoverage}%` },
                  { label: "Advanced Matching", status: (diagnostics.extIdCoverage > 80 ? "ok" : diagnostics.extIdCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.extIdCoverage}%` },
                  { label: "Currency BRL", status: (diagnostics.currencyCoverage > 90 ? "ok" : diagnostics.currencyCoverage > 50 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.currencyCoverage}%` },
                  { label: "Contents", status: (diagnostics.contentsCoverage > 80 ? "ok" : diagnostics.contentsCoverage > 30 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.contentsCoverage}%` },
                  { label: "Duplicatas", status: (diagnostics.dupCount === 0 ? "ok" : diagnostics.dupCount < 3 ? "warn" : "error") as DiagStatus, detail: `${diagnostics.dupCount}` },
                  { label: "ttclid", status: (diagnostics.ttclidDetected ? "ok" : "warn") as DiagStatus, detail: diagnostics.ttclidDetected ? "Detectado" : "Sem ttclid" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2"><StatusIcon status={item.status} /><span className="text-sm">{item.label}</span></div>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Email", value: diagnostics.emailCoverage },
                  { label: "Telefone", value: diagnostics.phoneCoverage },
                  { label: "External ID", value: diagnostics.extIdCoverage },
                  { label: "IP (server)", value: 100 },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-xl font-bold ${item.value >= 70 ? "text-emerald-500" : item.value >= 30 ? "text-amber-500" : "text-red-500"}`}>{item.value}%</p>
                    <div className="w-full h-1.5 rounded-full bg-muted mt-1"><div className={`h-1.5 rounded-full ${item.value >= 70 ? "bg-emerald-500" : item.value >= 30 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${item.value}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={runPixelTest} disabled={testing} className="flex-1"><Play className="h-3.5 w-3.5 mr-1" /> {testing ? "Testando..." : "Testar Pixel"}</Button>
                <Button variant="outline" size="sm" onClick={simulateConversion} disabled={simulating} className="flex-1"><Link2 className="h-3.5 w-3.5 mr-1" /> {simulating ? "Simulando..." : "Simular Conversão"}</Button>
              </div>
              {testResults.length > 0 && <div className="rounded-lg bg-muted/30 p-3 space-y-1">{testResults.map((r, i) => <div key={i} className="flex items-center gap-2 text-xs"><StatusIcon status={r.status} /><span className="font-mono">{r.event}</span><span className="text-muted-foreground">— {r.msg}</span></div>)}</div>}
              {simResults.length > 0 && <div className="rounded-lg bg-muted/30 p-3 font-mono text-xs space-y-0.5 max-h-[200px] overflow-y-auto">{simResults.map((line, i) => <p key={i} className={line.startsWith("❌") ? "text-red-500" : "text-foreground"}>{line}</p>)}</div>}
            </div>

            {/* Recent Events */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Search className="h-4 w-4" /> Eventos Recentes ({recentTikTokEvents.length})</h3>
                <Button variant="ghost" size="sm" onClick={fetchRecentEvents}><RefreshCw className="h-3 w-3" /></Button>
              </div>
              {eventsLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : recentTikTokEvents.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum evento.</p> : (
                <div className="rounded-lg border overflow-hidden max-h-[280px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-3 py-2 font-medium">Evento</th><th className="text-left px-3 py-2 font-medium">Visitor</th><th className="text-left px-3 py-2 font-medium">Campanha</th><th className="text-left px-3 py-2 font-medium">Hora</th></tr></thead>
                    <tbody>{recentTikTokEvents.map((ev, i) => (
                      <tr key={i} className="border-t border-border/30 hover:bg-muted/20">
                        <td className="px-3 py-1.5 font-mono">{ev.type}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{String(ev.visitorId).slice(0, 18)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{String(ev.campaign).slice(0, 25)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(ev.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════ ADD TIKTOK PIXEL DIALOG ═══════════ */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Pixel TikTok</DialogTitle><DialogDescription>Preencha os dados do pixel.</DialogDescription></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><label className="text-xs font-medium text-muted-foreground">Nome</label><input placeholder="Ex: Campanha Principal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Pixel ID</label><input placeholder="Ex: D6GM4RBC77UAAN00B800" value={form.pixel_id} onChange={(e) => setForm({ ...form, pixel_id: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background font-mono mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Events API Access Token</label><input placeholder="Token de acesso" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} type="password" className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background mt-1" /></div>
            <Button onClick={handleAdd} disabled={adding} className="w-full">{adding ? "Adicionando..." : "Adicionar Pixel"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════ INTEGRATION HUB DIALOG ═══════════ */}
      <Dialog open={!!hubKey} onOpenChange={() => setHubKey(null)}>
        <DialogContent className="max-w-lg">
          {hubDef && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><span className="text-xl">{hubDef.icon}</span> {hubDef.name}</DialogTitle>
                <DialogDescription>{hubDef.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div><p className="text-sm font-medium">Integração ativa</p><p className="text-xs text-muted-foreground">Ativar ou desativar esta integração</p></div>
                  <Switch checked={hubEnabled} onCheckedChange={setHubEnabled} />
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuração</h4>
                  {hubDef.configFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <input type={field.type === "password" ? "password" : "text"} placeholder={field.placeholder} value={hubConfig[field.key] || ""} onChange={(e) => setHubConfig({ ...hubConfig, [field.key]: e.target.value })} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background mt-1 font-mono" />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                  <div className="flex items-center gap-2 text-sm"><StatusIcon status={hubEnabled ? "ok" : "error"} /><span>{hubEnabled ? "Integração ativa" : "Integração desativada"}</span></div>
                  <div className="flex items-center gap-2 text-sm"><StatusIcon status={(typeof window !== "undefined" && hubDef.detect()) ? "ok" : "warn"} /><span>{(typeof window !== "undefined" && hubDef.detect()) ? "SDK detectado no site" : "SDK não detectado nesta página"}</span></div>
                </div>
                <Button onClick={saveHub} disabled={hubSaving} className="w-full"><Save className="h-3.5 w-3.5 mr-1" /> {hubSaving ? "Salvando..." : "Salvar Configuração"}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
