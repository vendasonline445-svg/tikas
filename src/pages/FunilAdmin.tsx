import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";
import { FunilPedidos } from "@/components/funil/FunilPedidos";
import { FunilLeads } from "@/components/funil/FunilLeads";
import { FunilRastreios } from "@/components/funil/FunilRastreios";
import { FunilMetricas } from "@/components/funil/FunilMetricas";
import { FunilCRM } from "@/components/funil/FunilCRM";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingCart, Truck, BarChart2, Contact } from "lucide-react";

type FunilTab = "crm" | "pedidos" | "leads" | "rastreios" | "metricas";

export default function FunilAdmin() {
  const [tab, setTab] = useState<FunilTab>("crm");
  const [leadsCount, setLeadsCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("checkout_leads")
      .select("*", { count: "exact", head: true })
      .eq("site_id", "mesa-dobravel")
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .then(({ count }) => setLeadsCount(count ?? 0));
  }, []);

  const tabs: { id: FunilTab; label: string; icon: React.ElementType; badge?: number | null }[] = [
    { id: "crm", label: "CRM", icon: Contact },
    { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
    { id: "leads", label: "Leads", icon: Users, badge: leadsCount },
    { id: "rastreios", label: "Rastreios", icon: Truck },
    { id: "metricas", label: "Métricas", icon: BarChart2 },
  ];

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <aside className="w-52 border-r border-border flex flex-col">
          <div className="p-5 border-b border-border">
            <p className="font-semibold text-sm">Mesa Dobrável</p>
            <p className="text-xs text-muted-foreground mt-0.5">Painel Operacional</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 justify-between ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </span>
                {t.badge != null && t.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-border">
            <a
              href="/admin"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar ao FunnelIQ
            </a>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {tab === "crm" && <FunilCRM />}
          {tab === "pedidos" && <FunilPedidos />}
          {tab === "leads" && <FunilLeads />}
          {tab === "rastreios" && <FunilRastreios />}
          {tab === "metricas" && <FunilMetricas />}
        </main>
      </div>
    </ProtectedRoute>
  );
}
