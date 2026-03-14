import {
  type EnrichedLead,
  type PipelineStage,
  STAGE_COLORS,
  STAGE_LABELS,
} from "@/lib/crm-pipeline-engine";
import { CRMLeadCard } from "./CRMLeadCard";

interface CRMPipelineProps {
  pipeline: Record<PipelineStage, EnrichedLead[]>;
  filteredLeads: EnrichedLead[];
  onSelectLead: (lead: EnrichedLead) => void;
}

const PIPELINE_STAGES: PipelineStage[] = [
  "checkout_iniciado", "pagamento_iniciado", "pix_gerado", "cartao_enviado", "pago"
];

export function CRMPipeline({ pipeline, filteredLeads, onSelectLead }: CRMPipelineProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {PIPELINE_STAGES.map(stage => {
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
              <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                {items.length === 0 ? (
                  <div className="glass-card rounded-xl p-4 text-center">
                    <p className="text-[11px] text-muted-foreground">Nenhum lead</p>
                  </div>
                ) : (
                  <>
                    {items.slice(0, 30).map(l => (
                      <CRMLeadCard key={l.id} l={l} onClick={onSelectLead} />
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
  );
}
