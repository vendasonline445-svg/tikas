import { useState, useMemo, useEffect, useRef } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle, ChevronDown,
} from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Animated Counter Hook ───
function useAnimatedNumber(target: number, duration = 700) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * ease);
      setDisplay(current);
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        prev.current = target;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return display;
}

// ─── Skeleton ───
function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 animate-pulse">
      <div className="h-3 w-16 rounded bg-white/[0.06] mb-2" />
      <div className="h-6 w-20 rounded bg-white/[0.06]" />
    </div>
  );
}

// ─── Interfaces ───
interface SystemAlert {
  id: string;
  type: "critical" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}

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

interface AdminDashboardProps {
  leads: Lead[];
  visitorsCount: number;
  checkoutsCount: number;
  buyClicks: number;
  imageClicks: number;
  avgScroll: number;
  pixGeneratedCount: number;
  paidCount: number;
  pendingCount: number;
  totalRevenue: number;
  pixPaidCount: number;
  cardsCollected: number;
  conversionRate: string;
  activeNow: number;
  alerts: SystemAlert[];
  checkoutsAbandoned: number;
  loading?: boolean;
}

// ─── Metric Tooltips ───
const METRIC_TOOLTIPS: Record<string, string> = {
  "Ativos (1h)": "Visitantes únicos ativos na última hora",
  "Visitantes": "Número de visitantes únicos no período",
  "Checkouts": "Usuários que iniciaram pagamento",
  "Pix Gerados": "QR codes PIX gerados no período",
  "Pix Pendentes": "PIX aguardando confirmação",
  "Cartões": "Cartões capturados no checkout",
  "Aprovados": "Pagamentos confirmados",
  "Conversão": "Taxa visitantes → aprovados",
  "Total Leads": "Leads capturados no período",
  "Receita": "Soma dos pagamentos aprovados",
  "Ticket Médio": "Valor médio por transação",
};

// ─── Compact Metric Card (no icons) ───
function CompactMetricCard({
  label, value, numericValue, highlight = false, delay = 0,
}: {
  label: string;
  value?: string;
  numericValue?: number;
  highlight?: boolean;
  delay?: number;
}) {
  const animated = useAnimatedNumber(numericValue ?? 0, 700);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const tooltipText = METRIC_TOOLTIPS[label];

  const card = (
    <div
      className={`rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 hover:bg-white/[0.06] transition-colors cursor-default ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } transition-all duration-300`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${
        highlight ? "text-indigo-400" : "text-white/90"
      }`}>
        {value ?? animated.toLocaleString("pt-BR")}
      </p>
    </div>
  );

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  return card;
}

// ─── Section Divider ───
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-6">
      <span className="text-xs text-white/30 font-medium">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

const PIE_COLORS = ["hsl(224, 100%, 65%)", "hsl(256, 100%, 65%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

export default function AdminDashboard(props: AdminDashboardProps) {
  const {
    leads, visitorsCount, checkoutsCount, buyClicks, imageClicks, avgScroll,
    pixGeneratedCount, paidCount, pendingCount, totalRevenue, pixPaidCount,
    cardsCollected, conversionRate, activeNow, alerts, checkoutsAbandoned,
    loading = false,
  } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ─── Chart Data ───
  const timeSeriesData = useMemo(() => {
    const dayMap = new Map<string, { visitors: number; checkouts: number; paid: number; revenue: number }>();
    leads.forEach(l => {
      const day = new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const entry = dayMap.get(day) || { visitors: 0, checkouts: 0, paid: 0, revenue: 0 };
      entry.checkouts++;
      if (l.status === "paid") {
        entry.paid++;
        entry.revenue += (l.total_amount || 0) / 100;
      }
      dayMap.set(day, entry);
    });
    return Array.from(dayMap.entries()).map(([day, d]) => ({ day, ...d })).reverse();
  }, [leads]);

  const paymentDistribution = useMemo(() => {
    const methods: Record<string, number> = {};
    leads.forEach(l => {
      const m = l.payment_method === "pix" ? "PIX" : l.payment_method === "credit_card" ? "Cartão" : l.payment_method;
      methods[m] = (methods[m] || 0) + 1;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [leads]);

  // Funnel steps with single color
  const funnelSteps = useMemo(() => {
    const steps = [
      { label: "Visitantes", value: visitorsCount },
      { label: "Cliques em Comprar", value: buyClicks },
      { label: "Checkouts", value: checkoutsCount },
      { label: "Pix Gerados", value: pixGeneratedCount },
      { label: "Pagamentos Aprovados", value: paidCount },
    ];
    const maxVal = Math.max(...steps.map(s => s.value), 1);
    return steps.map((s, i) => {
      const prev = i > 0 ? steps[i - 1].value : null;
      const rate = prev && prev > 0 ? Math.min((s.value / prev) * 100, 100).toFixed(1) : null;
      const pct = Math.max((s.value / maxVal) * 100, 2);
      return { ...s, maxVal, rate, pct };
    });
  }, [visitorsCount, buyClicks, checkoutsCount, pixGeneratedCount, paidCount]);

  // Heatmap inline data
  const heatmapData = useMemo(() => {
    const visToClick = visitorsCount > 0 ? Math.min((buyClicks / visitorsCount) * 100, 100) : 0;
    const clickToCheckout = buyClicks > 0 ? Math.min((checkoutsCount / buyClicks) * 100, 100) : 0;
    const checkoutToPix = checkoutsCount > 0 ? Math.min((pixGeneratedCount / checkoutsCount) * 100, 100) : 0;
    const pixToPaid = pixGeneratedCount > 0 ? Math.min((paidCount / pixGeneratedCount) * 100, 100) : 0;
    return [
      { label: "Visitante → Clique", value: visToClick, benchmark: [10, 25] as [number, number] },
      { label: "Clique → Checkout", value: clickToCheckout, benchmark: [30, 60] as [number, number] },
      { label: "Checkout → Pag.", value: checkoutToPix, benchmark: [20, 50] as [number, number] },
      { label: "Pag. → Aprovado", value: pixToPaid, benchmark: [15, 40] as [number, number] },
    ];
  }, [visitorsCount, buyClicks, checkoutsCount, pixGeneratedCount, paidCount]);

  const chartConfig = {
    checkouts: { label: "Checkouts", color: "hsl(224, 100%, 65%)" },
    paid: { label: "Pagos", color: "hsl(142, 71%, 45%)" },
    revenue: { label: "Receita (R$)", color: "hsl(256, 100%, 65%)" },
  };

  // Skeleton state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className={`space-y-1 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>

      {/* ═══ PRIMARY METRICS — 5 columns ═══ */}
      <SectionDivider label="Funil de vendas" />
      <div className="grid grid-cols-5 gap-3">
        <CompactMetricCard label="Ativos (1h)" numericValue={activeNow} delay={0} />
        <CompactMetricCard label="Visitantes" numericValue={visitorsCount} delay={30} />
        <CompactMetricCard label="Checkouts" numericValue={checkoutsCount} delay={60} />
        <CompactMetricCard label="Pix Gerados" numericValue={pixGeneratedCount} delay={90} />
        <CompactMetricCard label="Pix Pendentes" numericValue={pendingCount} delay={120} />
      </div>

      {/* ═══ SECONDARY METRICS — 3 columns ═══ */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <CompactMetricCard label="Total Leads" numericValue={leads.length} delay={150} />
        <CompactMetricCard label="Receita" value={`R$ ${(totalRevenue / 100).toFixed(2).replace(".", ",")}`} highlight delay={180} />
        <CompactMetricCard label="Ticket Médio" value={paidCount > 0 ? `R$ ${((totalRevenue / 100) / paidCount).toFixed(2).replace(".", ",")}` : "R$ 0,00"} delay={210} />
      </div>

      {/* ═══ CONVERSION HEATMAP — inline badges ═══ */}
      <SectionDivider label="Conversão" />
      <div className="flex items-center gap-1 flex-wrap">
        {heatmapData.map((step, i) => {
          const isGood = step.value >= step.benchmark[1];
          const isOk = step.value >= step.benchmark[0];
          const color = isGood ? "text-emerald-400" : isOk ? "text-amber-400" : "text-red-400";
          return (
            <div key={step.label} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/20 mx-1">→</span>}
              <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                <span className="text-white/40 text-[10px]">{step.label}</span>
                <span className={`text-sm font-semibold mt-0.5 ${color}`}>{step.value.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ FUNNEL BARS — single indigo color ═══ */}
      <SectionDivider label="Funil" />
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 space-y-2">
        {funnelSteps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-40 shrink-0 truncate">{step.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${step.pct}%` }}
              />
            </div>
            <span className="text-xs text-white/50 w-10 text-right tabular-nums">{step.value.toLocaleString("pt-BR")}</span>
            {step.rate && (
              <span className="text-[10px] text-white/30 w-12 text-right tabular-nums">{step.rate}%</span>
            )}
          </div>
        ))}
      </div>

      {/* ═══ BEHAVIOR ROW — compact ═══ */}
      <SectionDivider label="Comportamento" />
      <div className="grid grid-cols-5 gap-3">
        <CompactMetricCard label="Cliques Comprar" numericValue={buyClicks} delay={0} />
        <CompactMetricCard label="Cliques Imagens" numericValue={imageClicks} delay={30} />
        <CompactMetricCard label="Scroll Médio" value={`${avgScroll}%`} delay={60} />
        <CompactMetricCard label="Abandonados" numericValue={Math.max(0, checkoutsAbandoned)} delay={90} />
        <CompactMetricCard label="Aprovados" numericValue={paidCount} highlight delay={120} />
      </div>

      {/* ═══ CHARTS ═══ */}
      <SectionDivider label="Performance" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {timeSeriesData.length > 1 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-5">
            <h4 className="text-xs text-white/40 font-medium mb-3">Checkouts & Vendas por Dia</h4>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="gradCheckout" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(224, 100%, 65%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(224, 100%, 65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="checkouts" stroke="hsl(224, 100%, 65%)" fill="url(#gradCheckout)" strokeWidth={2} />
                <Area type="monotone" dataKey="paid" stroke="hsl(142, 71%, 45%)" fill="url(#gradPaid)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>
        )}

        {timeSeriesData.length > 1 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-5">
            <h4 className="text-xs text-white/40 font-medium mb-3">Receita por Dia (R$)</h4>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(238, 84%, 67%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {paymentDistribution.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-5">
            <h4 className="text-xs text-white/40 font-medium mb-3">Distribuição por Pagamento</h4>
            <div className="h-[200px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1">
              {paymentDistribution.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-white/40">{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {timeSeriesData.length <= 1 && paymentDistribution.length === 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-6 flex items-center justify-center col-span-2">
            <p className="text-white/30 text-xs">Dados insuficientes para gráficos</p>
          </div>
        )}
      </div>

      {/* ═══ ALERTS ═══ */}
      <SectionDivider label="Alertas" />
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
              alert.type === "critical"
                ? "bg-red-500/[0.05] border-red-500/20"
                : alert.type === "warning"
                ? "bg-amber-500/[0.05] border-amber-500/20"
                : "bg-emerald-500/[0.05] border-emerald-500/20"
            }`}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              alert.type === "critical"
                ? "bg-red-500/10 text-red-400"
                : alert.type === "warning"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {alert.icon}
            </div>
            <div>
              <p className={`text-xs font-semibold ${
                alert.type === "critical" ? "text-red-400" : alert.type === "warning" ? "text-amber-400" : "text-emerald-400"
              }`}>{alert.title}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{alert.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MONITORING CHECKLIST ═══ */}
      <details className="rounded-xl border border-white/[0.08] bg-white/[0.04] overflow-hidden mt-3">
        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-xs font-medium text-white/60 select-none hover:bg-white/[0.02] transition-colors">
          <span>Monitoramento em tempo real</span>
          <ChevronDown className="h-3.5 w-3.5 text-white/30 transition-transform duration-200 [details[open]>&]:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/[0.06]">
          {[
            { label: "Pagamentos recusados > 5 na última hora", ok: !alerts.find(a => a.id === "declined") },
            { label: "Taxa de conversão dentro do esperado", ok: !alerts.find(a => a.id === "conversion") },
            { label: "Webhook Trackly sem erros (24h)", ok: !alerts.find(a => a.id === "webhook") },
            { label: "Nenhum erro JavaScript no site (24h)", ok: !alerts.find(a => a.id === "jserror") },
            { label: "Pixel TikTok disparando eventos (1h)", ok: !alerts.find(a => a.id === "pixel") },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <div className={`h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 ${item.ok ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {item.ok
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  : <XCircle className="h-3 w-3 text-red-400" />}
              </div>
              <span className={`text-[10px] ${item.ok ? "text-white/40" : "text-white/70 font-medium"}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </details>

      {/* ═══ RECENT SUMMARY ═══ */}
      <SectionDivider label="Resumo" />
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Pendentes</span>
          <span className="font-semibold text-amber-400 tabular-nums">{pendingCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Pagos</span>
          <span className="font-semibold text-emerald-400 tabular-nums">{paidCount}</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
