import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import {
  type EnrichedLead,
  type PipelineStage,
  type TemperatureLevel,
  STAGE_COLORS,
  STAGE_LABELS,
} from "@/lib/crm-pipeline-engine";

export const SCORE_CONFIG: Record<TemperatureLevel, { label: string; icon: any; colorClass: string; bgClass: string }> = {
  muito_quente: { label: "Muito Quente", icon: Flame, colorClass: "text-red-500", bgClass: "bg-red-500/10" },
  quente: { label: "Quente", icon: Flame, colorClass: "text-orange-500", bgClass: "bg-orange-500/10" },
  morno: { label: "Morno", icon: Thermometer, colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  frio: { label: "Frio", icon: Snowflake, colorClass: "text-slate-400", bgClass: "bg-slate-400/10" },
};

export function ScoreBadge({ level, score }: { level: TemperatureLevel; score: number }) {
  const cfg = SCORE_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bgClass} ${cfg.colorClass}`}>
      <Icon className="h-3 w-3" /> {cfg.label} ({score})
    </span>
  );
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

interface CRMLeadCardProps {
  l: EnrichedLead;
  borderColor?: string;
  onClick: (lead: EnrichedLead) => void;
}

export function CRMLeadCard({ l, borderColor, onClick }: CRMLeadCardProps) {
  const ScoreIcon = SCORE_CONFIG[l.temperatureLevel].icon;
  const scoreColor = SCORE_CONFIG[l.temperatureLevel].colorClass;
  return (
    <div
      onClick={() => onClick(l)}
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
}
