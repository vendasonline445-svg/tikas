import {
  Users, ShoppingCart, QrCode, CreditCard, XCircle, DollarSign, Timer, Flame,
} from "lucide-react";
import { type PipelineMetrics } from "@/lib/crm-pipeline-engine";

interface FunnelHealth {
  score: number;
  label: string;
  color: string;
  bg: string;
}

interface CRMStatsProps {
  metrics: PipelineMetrics;
  funnelHealth: FunnelHealth;
}

export function CRMStats({ metrics, funnelHealth }: CRMStatsProps) {
  return (
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
  );
}
