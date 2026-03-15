import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye, ShoppingCart, QrCode, CheckCircle2, CreditCard,
  MousePointerClick, Signal, Zap, Globe, Smartphone, Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveEvent {
  id: string;
  event_name: string;
  visitor_id: string;
  session_id: string | null;
  created_at: string;
  event_data: Record<string, unknown> | null;
  source: string | null;
  value: number | null;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  page_view:        { label: "Visitou a página",    icon: <Eye className="h-4 w-4" />,              color: "text-blue-400" },
  view_content:     { label: "Visualizou produto",  icon: <Eye className="h-4 w-4" />,              color: "text-cyan-400" },
  click_buy:        { label: "Clicou em Comprar",    icon: <MousePointerClick className="h-4 w-4" />,color: "text-amber-400" },
  add_to_cart:      { label: "Adicionou ao carrinho",icon: <ShoppingCart className="h-4 w-4" />,     color: "text-orange-400" },
  checkout_start:   { label: "Iniciou checkout",     icon: <ShoppingCart className="h-4 w-4" />,     color: "text-yellow-400" },
  add_payment_info: { label: "Inseriu pagamento",    icon: <CreditCard className="h-4 w-4" />,      color: "text-purple-400" },
  pix_generated:    { label: "PIX gerado",           icon: <QrCode className="h-4 w-4" />,          color: "text-green-400" },
  purchase:         { label: "🎉 COMPRA!",           icon: <CheckCircle2 className="h-4 w-4" />,    color: "text-emerald-400" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 5000) return "agora";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  return `${Math.floor(diff / 3600000)}h atrás`;
}

export default function AdminLiveActivity() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch recent events on mount
  useEffect(() => {
    const fetchRecent = async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last 1h
      const { data } = await supabase
        .from("events")
        .select("id, event_name, visitor_id, session_id, created_at, event_data, source, value")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setEvents(data as LiveEvent[]);

      // Count unique visitors in last 5 min
      const fiveMin = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: activeData } = await supabase
        .from("events")
        .select("visitor_id")
        .gte("created_at", fiveMin);

      if (activeData) {
        const unique = new Set(activeData.map((e: { visitor_id: string }) => e.visitor_id));
        setActiveVisitors(unique.size);
      }
    };
    fetchRecent();
  }, []);

  // Subscribe to realtime events
  useEffect(() => {
    const channel = supabase
      .channel("live-activity-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const newEvent = payload.new as LiveEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
          setActiveVisitors((prev) => prev + 1); // rough increment
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Update "time ago" every 10s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Stats
  const lastHourEvents = events.length;
  const purchases = events.filter((e) => e.event_name === "purchase").length;
  const pixGenerated = events.filter((e) => e.event_name === "pix_generated").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Signal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Live Activity</h2>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
            {isConnected ? "Conectado" : "Desconectado"}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <Globe className="h-5 w-5 mx-auto text-blue-400 mb-1" />
          <div className="text-2xl font-bold">{activeVisitors}</div>
          <div className="text-xs text-muted-foreground">Ativos agora</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <Zap className="h-5 w-5 mx-auto text-amber-400 mb-1" />
          <div className="text-2xl font-bold">{lastHourEvents}</div>
          <div className="text-xs text-muted-foreground">Eventos (1h)</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <QrCode className="h-5 w-5 mx-auto text-green-400 mb-1" />
          <div className="text-2xl font-bold">{pixGenerated}</div>
          <div className="text-xs text-muted-foreground">PIX gerados</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
          <div className="text-2xl font-bold">{purchases}</div>
          <div className="text-xs text-muted-foreground">Compras</div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold">Feed em tempo real</span>
          <span className="text-xs text-muted-foreground ml-auto">{events.length} eventos</span>
        </div>

        <div ref={containerRef} className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aguardando eventos em tempo real...
            </div>
          ) : (
            events.map((evt, i) => {
              const config = EVENT_CONFIG[evt.event_name] || {
                label: evt.event_name,
                icon: <Zap className="h-4 w-4" />,
                color: "text-muted-foreground",
              };
              const isPurchase = evt.event_name === "purchase";
              const device = (evt.event_data as Record<string, unknown>)?.device;
              const pageUrl = (evt.event_data as Record<string, unknown>)?.page_url as string | undefined;
              const page = pageUrl ? (() => { try { return new URL(pageUrl).pathname; } catch { return pageUrl; } })() : null;

              return (
                <div
                  key={evt.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/5",
                    isPurchase && "bg-emerald-500/5",
                    i === 0 && "animate-in fade-in slide-in-from-top-2 duration-300"
                  )}
                >
                  {/* Icon */}
                  <div className={cn("flex-shrink-0 p-2 rounded-lg bg-accent/10", config.color)}>
                    {config.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", isPurchase && "text-emerald-400 font-bold")}>
                        {config.label}
                      </span>
                      {evt.value && evt.value > 0 && (
                        <span className="text-xs font-bold text-emerald-400">
                          R$ {(evt.value / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono truncate max-w-[120px]">{evt.visitor_id}</span>
                      {page && <span className="truncate max-w-[150px]">• {page}</span>}
                      {device && (
                        <span className="flex items-center gap-0.5">
                          • {String(device).toLowerCase().includes("mobile")
                            ? <Smartphone className="h-3 w-3" />
                            : <Monitor className="h-3 w-3" />}
                        </span>
                      )}
                      {evt.source && <span>• {evt.source}</span>}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(evt.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
