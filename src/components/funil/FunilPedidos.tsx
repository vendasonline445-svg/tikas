import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SITE_ID = "mesa-dobravel";

export function FunilPedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("checkout_leads")
      .select("*")
      .eq("site_id", SITE_ID)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setPedidos(data ?? []);
        setLoading(false);
      });
  }, []);

  const statusColor: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    pix_generated: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
    card_submitted: "bg-purple-100 text-purple-800",
    checkout_started: "bg-gray-100 text-gray-700",
    failed: "bg-red-100 text-red-800",
  };

  if (loading)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Carregando pedidos...
      </div>
    );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <span className="text-sm text-muted-foreground">
          {pedidos.length} registros
        </span>
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              {["Data", "Nome", "Email", "Valor", "Pagamento", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium text-xs text-muted-foreground"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p, i) => (
              <tr
                key={p.id}
                className={`border-b border-border last:border-0 ${
                  i % 2 === 0 ? "" : "bg-muted/30"
                }`}
              >
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 font-medium">{p.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.email ?? "—"}
                </td>
                <td className="px-4 py-3 font-medium">
                  {p.total_amount
                    ? `R$ ${(Number(p.total_amount) / 100).toFixed(2)}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {p.payment_method ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColor[p.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {p.status ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground text-sm"
                >
                  Nenhum pedido encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
