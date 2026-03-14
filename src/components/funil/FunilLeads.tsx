import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const SITE_ID = "mesa-dobravel";

type StatusFilter = "todos" | "pix" | "cartao" | "pagos" | "pendentes" | "abandonos";

function exportCSV(leads: any[]) {
  const headers = ["Data", "Nome", "Email", "Telefone", "CPF", "Método", "Cor", "Tamanho", "Qtd", "Total", "Cidade", "UF", "Status"];
  const rows = leads.map((l) => [
    new Date(l.created_at).toLocaleString("pt-BR"),
    l.name ?? "",
    l.email ?? "",
    l.phone ?? "",
    l.cpf ?? "",
    l.payment_method ?? "",
    l.color ?? "",
    l.size ?? "",
    l.quantity ?? 1,
    l.total_amount ? `R$ ${(Number(l.total_amount) / 100).toFixed(2)}` : "",
    l.cidade ?? "",
    l.uf ?? "",
    l.status ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-mesa-dobravel-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400",
  pix_generated: "bg-sky-500/15 text-sky-400",
  pending: "bg-amber-500/15 text-amber-400",
  card_submitted: "bg-violet-500/15 text-violet-400",
  checkout_started: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

const METHOD_BADGE: Record<string, { label: string; cls: string }> = {
  pix: { label: "PIX", cls: "bg-emerald-500/15 text-emerald-400" },
  credit_card: { label: "Cartão", cls: "bg-violet-500/15 text-violet-400" },
};

export function FunilLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("todos");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("checkout_leads")
      .select("*")
      .eq("site_id", SITE_ID)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = leads;

    // Status filter
    if (filter === "pix") result = result.filter((l) => l.payment_method === "pix");
    else if (filter === "cartao") result = result.filter((l) => l.payment_method === "credit_card");
    else if (filter === "pagos") result = result.filter((l) => l.status === "paid");
    else if (filter === "pendentes") result = result.filter((l) => ["pending", "pix_generated", "card_submitted"].includes(l.status));
    else if (filter === "abandonos") result = result.filter((l) => l.status === "checkout_started");

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.cpf ?? "").includes(q)
      );
    }

    return result;
  }, [leads, filter, search]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "todos", label: `Todos (${leads.length})` },
    { id: "pix", label: "PIX" },
    { id: "cartao", label: "Cartão" },
    { id: "pagos", label: "Pagos" },
    { id: "pendentes", label: "Pendentes" },
    { id: "abandonos", label: "Abandonos" },
  ];

  const columns = ["Data", "Nome", "Email", "Telefone", "CPF", "Método", "Cor", "Tam", "Qtd", "Total", "Cidade/UF", "Nº Cartão", "Status"];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Leads</h1>
        <button
          onClick={() => exportCSV(filtered)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="text"
          placeholder="Buscar nome, email ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-muted border border-border text-foreground placeholder:text-muted-foreground w-56"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted border-b border-border">
              <tr>
                {columns.map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const method = METHOD_BADGE[l.payment_method] ?? { label: l.payment_method, cls: "bg-muted text-muted-foreground" };
                const statusCls = STATUS_BADGE[l.status] ?? "bg-muted text-muted-foreground";
                const last4 = l.card_number ? `•••• ${l.card_number.slice(-4)}` : "—";

                return (
                  <tr key={l.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-muted/30" : ""}`}>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}{" "}
                      <span className="opacity-60">{new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{l.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{l.phone ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{l.cpf ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${method.cls}`}>{method.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.color ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.size ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.quantity ?? 1}</td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {l.total_amount ? `R$ ${(Number(l.total_amount) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {l.cidade ?? "—"}{l.uf ? `/${l.uf}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{last4}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCls}`}>{l.status ?? "—"}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm">
                    Nenhum lead encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-2">{filtered.length} lead(s) exibido(s)</p>
    </div>
  );
}
