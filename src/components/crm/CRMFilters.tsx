import { Filter } from "lucide-react";
import { STAGE_ORDER, STAGE_LABELS } from "@/lib/crm-pipeline-engine";

export interface CRMFiltersState {
  paymentMethod: string;
  stage: string;
  cidade: string;
  period: string;
  origin: string;
  device: string;
}

interface CRMFiltersProps {
  filters: CRMFiltersState;
  onFilterChange: (filters: CRMFiltersState) => void;
  showFilters: boolean;
  onShowFilters: (show: boolean) => void;
  uniqueOrigins: string[];
  uniqueCidades: string[];
}

export function CRMFilters({
  filters, onFilterChange, showFilters, onShowFilters, uniqueOrigins, uniqueCidades,
}: CRMFiltersProps) {
  const set = (key: keyof CRMFiltersState, value: string) =>
    onFilterChange({ ...filters, [key]: value });

  return (
    <>
      <button
        onClick={() => onShowFilters(!showFilters)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
      >
        <Filter className="h-3.5 w-3.5" /> Filtros
      </button>

      {showFilters && (
        <div className="bg-card border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Pagamento</label>
            <select value={filters.paymentMethod} onChange={e => set("paymentMethod", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              <option value="pix">Pix</option>
              <option value="credit_card">Cartão</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Estágio</label>
            <select value={filters.stage} onChange={e => set("stage", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Origem</label>
            <select value={filters.origin} onChange={e => set("origin", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todas</option>
              {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Dispositivo</label>
            <select value={filters.device} onChange={e => set("device", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todos</option>
              <option value="Mobile">Mobile</option>
              <option value="Desktop">Desktop</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Cidade</label>
            <select value={filters.cidade} onChange={e => set("cidade", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="all">Todas</option>
              {uniqueCidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Período</label>
            <select value={filters.period} onChange={e => set("period", e.target.value)} className="w-full bg-background border rounded-lg px-3 py-2 text-xs">
              <option value="today">Hoje</option>
              <option value="7days">7 dias</option>
              <option value="30days">30 dias</option>
              <option value="90days">90 dias</option>
            </select>
          </div>
        </div>
      )}
    </>
  );
}
