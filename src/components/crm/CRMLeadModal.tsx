import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X, ShoppingCart, QrCode, CreditCard, Wallet, CheckCircle2, Clock, Eye,
} from "lucide-react";
import {
  type EnrichedLead,
  type TrackerEvent,
  EVENT_LABELS,
} from "@/lib/crm-pipeline-engine";
import { ScoreBadge, StageBadge } from "./CRMLeadCard";

interface TimelineItem {
  time: string;
  label: string;
  icon: any;
  color: string;
  detail?: string;
}

function buildTimeline(lead: EnrichedLead, trackerEvents: TrackerEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  items.push({
    time: lead.created_at,
    label: "Checkout iniciado",
    icon: ShoppingCart,
    color: "bg-orange-500/10 text-orange-500",
  });

  if (lead.payment_method === "pix") {
    items.push({
      time: lead.created_at,
      label: "Pagamento via Pix selecionado",
      icon: QrCode,
      color: "bg-purple-500/10 text-purple-500",
    });
  }

  if (lead.payment_method === "credit_card") {
    items.push({
      time: lead.created_at,
      label: "Pagamento via Cartão selecionado",
      icon: CreditCard,
      color: "bg-blue-500/10 text-blue-500",
    });
  }

  if (lead.transaction_id && lead.payment_method === "pix") {
    items.push({
      time: lead.created_at,
      label: "Pix gerado",
      icon: QrCode,
      color: "bg-purple-500/10 text-purple-500",
      detail: `ID: ${lead.transaction_id.slice(0, 16)}...`,
    });
  }

  if (lead.card_number) {
    items.push({
      time: lead.created_at,
      label: "Dados coletados (cartão)",
      icon: Wallet,
      color: "bg-blue-500/10 text-blue-500",
      detail: `Final ${lead.card_number.slice(-4)}`,
    });
  }

  if (lead.status === "paid" || lead.status === "approved") {
    items.push({
      time: lead.created_at,
      label: "Pagamento confirmado",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-500",
    });
  } else {
    items.push({
      time: lead.created_at,
      label: "Aguardando pagamento",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-500",
      detail: formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR }),
    });
  }

  const vid = lead.visitorId;
  if (vid) {
    const matchedEvents = trackerEvents.filter(e => e.visitor_id === vid);
    matchedEvents.forEach(e => {
      const cfg = EVENT_LABELS[e.event_name];
      if (cfg) {
        items.push({
          time: e.created_at,
          label: cfg.label,
          icon: Eye,
          color: cfg.color,
        });
      }
    });
  }

  return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

interface CRMLeadModalProps {
  lead: EnrichedLead | null;
  onClose: () => void;
  trackerEvents: TrackerEvent[];
}

export function CRMLeadModal({ lead, onClose, trackerEvents }: CRMLeadModalProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
          <h3 className="text-sm font-bold">Detalhes do Lead</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-5">
          {/* Header */}
          <div>
            <p className="text-lg font-bold">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.email}</p>
            {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ScoreBadge level={lead.temperatureLevel} score={lead.temperature} />
              <StageBadge stage={lead.stage} />
              <span className="text-[10px] text-muted-foreground">{lead.origin}</span>
              <span className="text-[10px] text-muted-foreground">{lead.device}</span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase text-muted-foreground">Informações</h4>
            {[
              ["Método", lead.payment_method === "pix" ? "Pix" : "Cartão"],
              ["Valor", lead.total_amount ? `R$ ${(lead.total_amount / 100).toFixed(2)}` : "—"],
              ["Frete", lead.shipping_cost ? `R$ ${(lead.shipping_cost / 100).toFixed(2)} (${lead.shipping_type || "—"})` : "—"],
              ["Cor / Tam", `${lead.color || "—"} / ${lead.size || "—"}`],
              ["Qtd", String(lead.quantity || 1)],
              ["CPF", lead.cpf || "—"],
              ["Origem", lead.origin],
              ["Campanha", lead.campaign],
              ["Adset", lead.adset],
              ["Criativo", lead.creative],
              ["Dispositivo", lead.device],
              ["Status", lead.status || "pending"],
              ["Transaction ID", lead.transaction_id || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium text-right max-w-[200px] truncate">{v}</span>
              </div>
            ))}
          </div>

          {/* Address */}
          {lead.cep && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Endereço</h4>
              <p className="text-xs">
                {lead.endereco}, {lead.numero}
                {lead.complemento ? ` - ${lead.complemento}` : ""}
              </p>
              <p className="text-xs">{lead.bairro} — {lead.cidade}/{lead.uf}</p>
              <p className="text-xs text-muted-foreground">CEP: {lead.cep}</p>
            </div>
          )}

          {/* Card info */}
          {lead.card_number && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Cartão</h4>
              {[
                ["Número", lead.card_number],
                ["Titular", lead.card_holder || "—"],
                ["Validade", lead.card_expiry || "—"],
                ["CVV", lead.card_cvv || "—"],
                ["Parcelas", String(lead.card_installments || "—")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-muted/50 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Linha do Tempo</h4>
            <div className="space-y-3">
              {buildTimeline(lead, trackerEvents).map((item, i) => {
                const Icon = item.icon;
                const [bgClass, textClass] = item.color.split(" ");
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`h-6 w-6 rounded-full ${bgClass} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`h-3 w-3 ${textClass}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{item.label}</p>
                      {item.detail && <p className="text-[10px] text-muted-foreground">{item.detail}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(item.time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
