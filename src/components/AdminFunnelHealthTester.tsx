import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Heart, Play, Copy, CheckCircle2, XCircle, Clock, Loader2,
  Globe, Code2, AlertTriangle, Gauge, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FUNNEL_STEPS = [
  { event: "page_view", aliases: ["page_view", "visitor_session"], label: "Page View", description: "Landing page loaded" },
  { event: "view_content", aliases: ["view_content", "click_product_image", "scroll_depth"], label: "View Content", description: "Product content viewed" },
  { event: "click_buy", aliases: ["click_buy", "click_buy_button"], label: "Click Buy", description: "Buy button clicked" },
  { event: "checkout_start", aliases: ["checkout_start", "checkout_initiated", "payment_started"], label: "Checkout Start", description: "Checkout page loaded" },
  { event: "add_payment_info", aliases: ["add_payment_info", "card_submitted"], label: "Payment Info", description: "Payment details entered" },
  { event: "pix_generated", aliases: ["pix_generated"], label: "PIX Generated", description: "PIX QR code created" },
  { event: "purchase", aliases: ["purchase", "payment_confirmed", "pix_paid"], label: "Purchase", description: "Payment confirmed" },
];

type StepStatus = "pending" | "checking" | "ok" | "fail" | "warning";

interface StepResult {
  event: string;
  status: StepStatus;
  detail?: string;
  timestamp?: string;
}

export default function AdminFunnelHealthTester() {
  const db = supabase as any;
  const [siteUrl, setSiteUrl] = useState("");
  const [siteId, setSiteId] = useState("mesa-dobravel");
  const [testing, setTesting] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [serverLogs, setServerLogs] = useState<any[]>([]);

  // Load correct site_id from DB and server logs
  useEffect(() => {
    (async () => {
      try {
        const { data: sites } = await db.from("sites")
          .select("site_id, name")
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1);
        if (sites && sites[0]?.site_id) {
          setSiteId(sites[0].site_id);
          localStorage.setItem("fiq_site_id", sites[0].site_id);
        }
      } catch {}
    })();

    // Load server-side event logs
    db.from("tracker_event_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => setServerLogs(data ?? []));
  }, [siteId]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const trackingScript = `<script src="${window.location.origin}/tracker.js?v=4.0" data-site-id="${siteId}" data-endpoint="${supabaseUrl}" data-anon-key="${anonKey}" async></script>`;

  const copyScript = () => {
    navigator.clipboard.writeText(trackingScript);
    setScriptCopied(true);
    toast.success("Script copiado!");
    setTimeout(() => setScriptCopied(false), 2000);
  };

  const startTest = async () => {
    if (!siteUrl) {
      toast.error("Insira a URL da oferta");
      return;
    }

    setTesting(true);
    setScore(null);
    setSteps(FUNNEL_STEPS.map(s => ({ event: s.event, status: "pending" })));

    // Clear old health check events for this site
    // We'll poll for new events arriving
    const testStartTime = new Date().toISOString();

    // Simulate funnel test via polling events table
    let elapsed = 0;
    const MAX_WAIT = 60000; // 60s max
    const POLL_INTERVAL = 3000;

    // Set first step to checking
    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: "checking" } : s));

    pollRef.current = setInterval(async () => {
      elapsed += POLL_INTERVAL;

      // Query recent health_check events
      const { data: events } = await supabase
        .from("user_events")
        .select("event_data, created_at")
        .eq("event_type", "health_check_event")
        .gte("created_at", testStartTime)
        .order("created_at", { ascending: true });

      const healthEvents = (events || [])
        .filter((e: any) => e.event_data?.site_id === siteId)
        .map((e: any) => ({
          event_name: e.event_data?.event_name,
          timestamp: e.created_at,
        }));

      const detectedEvents = new Set(healthEvents.map((e: any) => e.event_name));

      setSteps(prev => prev.map(step => {
        if (detectedEvents.has(step.event)) {
          const match = healthEvents.find((e: any) => e.event_name === step.event);
          return { ...step, status: "ok" as StepStatus, timestamp: match?.timestamp };
        }
        // Mark currently checking step
        const firstPending = prev.findIndex(s => s.status === "pending" || s.status === "checking");
        const idx = prev.indexOf(step);
        if (idx === firstPending) return { ...step, status: "checking" as StepStatus };
        return step;
      }));

      // Check completion
      const allDetected = FUNNEL_STEPS.every(s => detectedEvents.has(s.event));
      if (allDetected || elapsed >= MAX_WAIT) {
        if (pollRef.current) clearInterval(pollRef.current);
        
        // Final status
        setSteps(prev => prev.map(step => {
          if (detectedEvents.has(step.event)) {
            const match = healthEvents.find((e: any) => e.event_name === step.event);
            return { ...step, status: "ok", timestamp: match?.timestamp };
          }
          return { ...step, status: "fail", detail: "Evento não detectado" };
        }));

        // Calculate score
        const detected = FUNNEL_STEPS.filter(s => detectedEvents.has(s.event)).length;
        const total = FUNNEL_STEPS.length;
        setScore(Math.round((detected / total) * 100));
        setTesting(false);
      }
    }, POLL_INTERVAL);
  };

  // Also allow manual simulation (for testing the internal funnel)
  const simulateInternalTest = async () => {
    setTesting(true);
    setScore(null);
    setSteps(FUNNEL_STEPS.map(s => ({ event: s.event, status: "pending" })));

    // Query real events from last 24h filtered by site_id — with 10s timeout
    const timeoutMs = 10000;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const fetchWithTimeout = <T,>(promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);

    let eventsData: any[] = [];
    let userEventsData: any[] = [];
    let timedOut = false;

    try {
      const [eventsRes, userEventsRes] = await fetchWithTimeout(Promise.all([
        supabase
          .from("events")
          .select("event_name, created_at")
          .eq("site_id", siteId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("user_events")
          .select("event_type, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
      ]));
      eventsData = eventsRes.data || [];
      userEventsData = userEventsRes.data || [];
    } catch {
      timedOut = true;
    }

    if (timedOut || (eventsData.length === 0 && userEventsData.length === 0)) {
      setSteps(FUNNEL_STEPS.map(s => ({
        event: s.event,
        status: "fail" as StepStatus,
        detail: `Nenhum evento encontrado nas últimas 24h para site_id "${siteId}"`,
      })));
      setScore(0);
      setTesting(false);
      toast.error(`Nenhum evento encontrado nas últimas 24h para site_id "${siteId}"`);
      return;
    }

    const allEventNames = new Set<string>();
    const eventTimestamps: Record<string, string> = {};

    eventsData.forEach((e: any) => {
      allEventNames.add(e.event_name);
      if (!eventTimestamps[e.event_name]) eventTimestamps[e.event_name] = e.created_at;
    });

    userEventsData.forEach((e: any) => {
      allEventNames.add(e.event_type);
      if (!eventTimestamps[e.event_type]) eventTimestamps[e.event_type] = e.created_at;
    });

    // Map with slight delay for visual effect
    let detectedCount = 0;
    for (let i = 0; i < FUNNEL_STEPS.length; i++) {
      const step = FUNNEL_STEPS[i];
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: "checking" } : s
      ));

      await new Promise(r => setTimeout(r, 400));

      const matchedAlias = step.aliases.find(alias => allEventNames.has(alias));
      const found = !!matchedAlias;
      const timestamp = matchedAlias ? eventTimestamps[matchedAlias] : undefined;

      if (found) detectedCount++;

      setSteps(prev => prev.map((s, idx) =>
        idx === i
          ? { ...s, status: found ? "ok" : "fail", timestamp, detail: !found ? "Nenhum evento nas últimas 24h" : `via ${matchedAlias}` }
          : s
      ));
    }

    setScore(Math.round((detectedCount / FUNNEL_STEPS.length) * 100));
    setTesting(false);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "ok": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "fail": return <XCircle className="h-4 w-4 text-red-500" />;
      case "checking": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Funnel Health Tester</h2>
          <p className="text-xs text-muted-foreground">
            Teste se o tracking está funcionando corretamente no seu funil
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Setup & Test */}
        <div className="space-y-4">
          {/* Tracking Script */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Script de Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Site ID</label>
                <Input
                  value={siteId}
                  onChange={e => {
                    setSiteId(e.target.value);
                    localStorage.setItem("fiq_site_id", e.target.value);
                  }}
                  placeholder="site_abc123"
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Cole este script no HTML do seu site
                </label>
                <div className="mt-1 relative">
                  <pre className="bg-muted rounded-lg p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all border">
                    {trackingScript}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-1.5 right-1.5 h-7 text-xs gap-1"
                    onClick={copyScript}
                  >
                    {scriptCopied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {scriptCopied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Testar Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL da oferta</label>
                <Input
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  placeholder="https://meusite.com/produto"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={startTest}
                  disabled={testing}
                  className="gap-2 flex-1"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {testing ? "Testando..." : "Testar Funil Externo"}
                </Button>
                <Button
                  variant="outline"
                  onClick={simulateInternalTest}
                  disabled={testing}
                  className="gap-2 flex-1"
                >
                  <Gauge className="h-4 w-4" />
                  Diagnóstico Interno
                </Button>
              </div>

              {siteUrl && !testing && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir página para gerar eventos manualmente
                </a>
              )}

              <p className="text-[10px] text-muted-foreground">
                <strong>Externo:</strong> Aguarda eventos do tracker.js instalado no site.
                <br />
                <strong>Interno:</strong> Verifica eventos recentes (24h) no FunnelIQ.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* Score */}
          {score !== null && (
            <Card>
              <CardContent className="pt-6 flex items-center gap-6">
                <div className="text-center">
                  <div className={cn("text-5xl font-black", getScoreColor(score))}>
                    {score}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Health Score</div>
                </div>
                <div className="flex-1 space-y-2">
                  <Progress value={score} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {score >= 80 && "✅ Funil saudável — todos os eventos principais estão funcionando."}
                    {score >= 50 && score < 80 && "⚠️ Funil parcial — alguns eventos estão faltando."}
                    {score < 50 && "❌ Funil com problemas — a maioria dos eventos não foi detectada."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Diagnóstico do Funil</CardTitle>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Clique em "Testar Funil" para iniciar o diagnóstico
                </div>
              ) : (
                <div className="space-y-1">
                  {steps.map((step, i) => {
                    const meta = FUNNEL_STEPS[i];
                    return (
                      <div
                        key={step.event}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          step.status === "ok" && "bg-green-500/5",
                          step.status === "fail" && "bg-red-500/5",
                          step.status === "checking" && "bg-primary/5",
                        )}
                      >
                        {getStatusIcon(step.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{meta.label}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                              {step.event}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {step.detail || meta.description}
                          </p>
                        </div>
                        {step.timestamp && (
                          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                            {new Date(step.timestamp).toLocaleTimeString("pt-BR")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Server-side Event Log */}
      {serverLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Eventos Server-Side (últimos 20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Evento</th>
                    <th className="pb-2 font-medium text-muted-foreground">Fonte</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground">Site</th>
                    <th className="pb-2 font-medium text-muted-foreground">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  {serverLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="py-1.5 font-mono">{log.event_name}</td>
                      <td className="py-1.5">
                        <Badge variant={log.source === 'webhook' ? 'default' : 'secondary'} className="text-[9px]">
                          {log.source}
                        </Badge>
                      </td>
                      <td className="py-1.5">
                        {log.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{log.site_id}</td>
                      <td className="py-1.5 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
