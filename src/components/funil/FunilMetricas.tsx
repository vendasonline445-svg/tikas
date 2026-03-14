import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SITE_ID = "mesa-dobravel";

interface Metricas {
  totalPedidos: number;
  totalPagos: number;
  receitaTotal: number;
  ticketMedio: number;
  taxaConversao: number;
  pixGerados: number;
}

export function FunilMetricas() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    async function calcular() {
      const desde = new Date();
      desde.setDate(desde.getDate() - periodo);

      const { data: leads } = await supabase
        .from("checkout_leads")
        .select("status, total_amount")
        .eq("site_id", SITE_ID)
        .gte("created_at", desde.toISOString());

      if (!leads) return;

      const pagos = leads.filter((l) => l.status === "paid");
      const receita = pagos.reduce(
        (acc, l) => acc + (Number(l.total_amount) || 0),
        0
      );

      setMetricas({
        totalPedidos: leads.length,
        totalPagos: pagos.length,
        receitaTotal: receita / 100,
        ticketMedio: pagos.length > 0 ? receita / 100 / pagos.length : 0,
        taxaConversao:
          leads.length > 0 ? (pagos.length / leads.length) * 100 : 0,
        pixGerados: leads.filter(
          (l) => l.status === "pix_generated" || l.status === "paid"
        ).length,
      });
    }
    calcular();
  }, [periodo]);

  const cards = metricas
    ? [
        { label: "Total de leads", value: metricas.totalPedidos.toString() },
        { label: "Pedidos pagos", value: metricas.totalPagos.toString() },
        {
          label: "Receita total",
          value: `R$ ${metricas.receitaTotal.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`,
        },
        { label: "Ticket médio", value: `R$ ${metricas.ticketMedio.toFixed(2)}` },
        {
          label: "Taxa de conversão",
          value: `${metricas.taxaConversao.toFixed(1)}%`,
        },
        { label: "PIX gerados", value: metricas.pixGerados.toString() },
      ]
    : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Métricas</h1>
        <div className="flex gap-2">
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periodo === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>
      {!metricas ? (
        <div className="text-sm text-muted-foreground">Calculando...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="border border-border rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className="text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
