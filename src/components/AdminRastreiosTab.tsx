import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Settings, Send, ToggleLeft, ToggleRight, Download } from "lucide-react";

type TrackingStatus = "all" | "enviado" | "em_transito" | "entregue";

interface OrderTracking {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  zipcode: string;
  tracking_code: string | null;
  tracking_url: string | null;
  status: string;
  created_at: string;
}

interface WebhookLog {
  id: string;
  order_id: string | null;
  webhook_url: string;
  status: string;
  response: string | null;
  created_at: string;
}

export default function AdminRastreiosTab() {
  const [orders, setOrders] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<TrackingStatus>("all");
  const [search, setSearch] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [activeTab, setActiveTab] = useState<"rastreios" | "config" | "logs">("rastreios");
  const [manualOrderId, setManualOrderId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualRua, setManualRua] = useState("");
  const [manualNumero, setManualNumero] = useState("");
  const [manualComplemento, setManualComplemento] = useState("");
  const [manualBairro, setManualBairro] = useState("");
  const [manualCep, setManualCep] = useState("");
  const [manualCidade, setManualCidade] = useState("");
  const [manualEstado, setManualEstado] = useState("");
  const [manualProduto, setManualProduto] = useState("");
  const [manualQuantidade, setManualQuantidade] = useState("1");
  const [manualPreco, setManualPreco] = useState("");
  const [sendingManual, setSendingManual] = useState(false);
  const [debugResult, setDebugResult] = useState<{
    status_http: number;
    response_text: string;
    payload_enviado: string;
    webhook_url: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchOrders();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchSettings = async () => {
    const { data } = await supabase.from("tracking_settings" as any).select("*").limit(1);
    const arr = data as any[];
    if (arr && arr[0]) {
      setWebhookUrl(arr[0].webhook_url);
      setWebhookEnabled(arr[0].webhook_enabled);
      setSettingsId(arr[0].id);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    if (settingsId) {
      await supabase.from("tracking_settings" as any).update({ webhook_url: webhookUrl, webhook_enabled: webhookEnabled, updated_at: new Date().toISOString() } as any).eq("id", settingsId);
    } else {
      await supabase.from("tracking_settings" as any).insert({ webhook_url: webhookUrl, webhook_enabled: webhookEnabled } as any);
    }
    toast.success("Configurações salvas!");
    setSavingSettings(false);
  };

  const testWebhook = async () => {
    setTestingWebhook(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-trackly-webhook", {
        body: {
          order_id: "TESTE-001", nome: "Cliente Teste", email: "teste@cliente.com",
          telefone: "(11) 99999-0000", rua: "Rua Teste", numero: "100", complemento: "",
          bairro: "Centro", cep: "01001000", cidade: "São Paulo", estado: "SP",
          produto: "Produto Teste", quantidade: "1", preco_centavos: "9900", webhook_url: webhookUrl,
        },
      });
      if (error) throw error;
      await supabase.from("tracking_webhook_logs" as any).insert({
        webhook_url: webhookUrl,
        status: result.status_http >= 200 && result.status_http < 300 ? "test_success" : "test_error",
        response: result.response_text?.slice(0, 500),
      } as any);
      if (result.status_http >= 200 && result.status_http < 300) {
        toast.success("Webhook enviado com sucesso");
      } else {
        toast.error("Erro ao enviar webhook");
      }
      fetchLogs();
    } catch (err: any) {
      toast.error("Erro ao enviar webhook");
    }
    setTestingWebhook(false);
  };

  const sendTracklyTest = async () => {
    if (!manualName || !manualEmail || !manualCep || !manualProduto) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSendingManual(true);
    setDebugResult(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-trackly-webhook", {
        body: {
          order_id: manualOrderId, nome: manualName, email: manualEmail, telefone: manualPhone,
          rua: manualRua, numero: manualNumero, complemento: manualComplemento, bairro: manualBairro,
          cep: manualCep, cidade: manualCidade, estado: manualEstado, produto: manualProduto,
          quantidade: manualQuantidade, preco_centavos: manualPreco, webhook_url: webhookUrl,
        },
      });
      if (error) throw error;
      const debug = { status_http: result.status_http, response_text: result.response_text, payload_enviado: result.payload_enviado, webhook_url: result.webhook_url };
      setDebugResult(debug);
      await supabase.from("tracking_webhook_logs" as any).insert({
        webhook_url: webhookUrl,
        status: result.status_http >= 200 && result.status_http < 300 ? "test_success" : "test_error",
        response: JSON.stringify(debug).slice(0, 1000),
      } as any);
      if (result.status_http >= 200 && result.status_http < 300) toast.success("Webhook enviado com sucesso");
      else toast.error("Erro ao enviar webhook");
      fetchLogs();
    } catch (err: any) {
      setDebugResult({ status_http: 0, response_text: err.message, payload_enviado: "", webhook_url: webhookUrl });
      toast.error("Erro ao enviar webhook");
    }
    setSendingManual(false);
  };

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase.from("order_tracking").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    if (data) setOrders(data as OrderTracking[]);
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from("tracking_webhook_logs" as any).select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setLogs(data as unknown as WebhookLog[]);
  };

  const exportPaidOrdersCSV = async () => {
    const { data, error } = await supabase.from("checkout_leads").select("*").eq("status", "paid");
    if (error || !data?.length) { toast.error(error ? "Erro ao buscar pedidos" : "Nenhum pedido pago encontrado"); return; }
    const headers = "order_id,customer_name,customer_email,customer_phone,street,number,complement,neighborhood,zipcode,city,state,product_name,quantity,price_in_cents,created_at";
    const rows = data.map((l) =>
      [l.id, l.name, l.email, l.phone || "", l.endereco || "", l.numero || "", l.complemento || "", l.bairro || "", l.cep || "", l.cidade || "", l.uf || "", "Mesa Portátil Dobrável", l.quantity ?? 1, l.total_amount ?? 0, l.created_at]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pedidos_pagos.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} pedidos exportados`);
  };

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.customer_name.toLowerCase().includes(s) || o.customer_email.toLowerCase().includes(s) || o.zipcode?.includes(s) || o.tracking_code?.toLowerCase().includes(s);
  });

  const statusLabel = (s: string) => ({ enviado: "Enviado", em_transito: "Em Trânsito", entregue: "Entregue" }[s] || s);
  const statusColor = (s: string) => ({ enviado: "bg-blue-500/10 text-blue-600", em_transito: "bg-amber-500/10 text-amber-600", entregue: "bg-emerald-500/10 text-emerald-600" }[s] || "bg-muted text-muted-foreground");

  return (
    <div className="space-y-6">
      {/* Sub-tabs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["rastreios", "config", "logs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {t === "rastreios" ? "Rastreios" : t === "config" ? "⚙️ Configuração" : "📋 Logs"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={exportPaidOrdersCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
            <Download className="h-4 w-4" /> CSV Pagos
          </button>
          <button onClick={testWebhook} disabled={testingWebhook || !webhookUrl} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> {testingWebhook ? "Enviando..." : "Testar compra"}
          </button>
        </div>
      </div>

      {/* Config */}
      {activeTab === "config" && (
        <div className="bg-card border rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="h-5 w-5" /> Configuração do Webhook</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Webhook URL</label>
              <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm font-mono bg-background" placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Webhook ativo</span>
              <button onClick={() => setWebhookEnabled(!webhookEnabled)} className="flex items-center gap-2">
                {webhookEnabled ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
                <span className={`text-sm font-medium ${webhookEnabled ? "text-emerald-600" : "text-muted-foreground"}`}>{webhookEnabled ? "ON" : "OFF"}</span>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={saveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">
                {savingSettings ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </div>

          {/* Manual Test */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-md font-bold mb-4">Teste de envio manual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "Order ID", value: manualOrderId, set: setManualOrderId, ph: "ID do pedido" },
                { label: "Nome *", value: manualName, set: setManualName, ph: "Nome do cliente" },
                { label: "Email *", value: manualEmail, set: setManualEmail, ph: "email@exemplo.com" },
                { label: "Telefone", value: manualPhone, set: setManualPhone, ph: "(11) 99999-9999" },
                { label: "Rua", value: manualRua, set: setManualRua, ph: "Rua exemplo" },
                { label: "Número", value: manualNumero, set: setManualNumero, ph: "123" },
                { label: "Complemento", value: manualComplemento, set: setManualComplemento, ph: "Apto 101" },
                { label: "Bairro", value: manualBairro, set: setManualBairro, ph: "Centro" },
                { label: "CEP *", value: manualCep, set: setManualCep, ph: "01001000" },
                { label: "Cidade", value: manualCidade, set: setManualCidade, ph: "São Paulo" },
                { label: "Estado", value: manualEstado, set: setManualEstado, ph: "SP" },
                { label: "Produto *", value: manualProduto, set: setManualProduto, ph: "Nome do produto" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-sm font-medium mb-1">{f.label}</label>
                  <input type="text" value={f.value} onChange={(e) => f.set(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm bg-background" placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade</label>
                <input type="number" value={manualQuantidade} onChange={(e) => setManualQuantidade(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm bg-background" placeholder="1" min="1" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preço (centavos)</label>
                <input type="number" value={manualPreco} onChange={(e) => setManualPreco(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm bg-background" placeholder="9900" />
              </div>
            </div>
            <button onClick={sendTracklyTest} disabled={sendingManual || !webhookUrl} className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
              <Send className="h-4 w-4" /> {sendingManual ? "Enviando..." : "Enviar teste"}
            </button>
          </div>

          {/* Debug Result */}
          {debugResult && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-md font-bold mb-3">Resultado do Webhook</h3>
              <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-xs">
                <div><span className="font-semibold">URL:</span> <span className="break-all">{debugResult.webhook_url}</span></div>
                <div>
                  <span className="font-semibold">HTTP Status:</span>{" "}
                  <span className={debugResult.status_http >= 200 && debugResult.status_http < 300 ? "text-emerald-600" : "text-destructive"}>
                    {debugResult.status_http || "Erro de conexão"}
                  </span>
                </div>
                <div><span className="font-semibold">Payload enviado:</span></div>
                <pre className="bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{decodeURIComponent(debugResult.payload_enviado)}</pre>
                <div><span className="font-semibold">Resposta da API:</span></div>
                <pre className="bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">{debugResult.response_text || "(vazio)"}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {activeTab === "logs" && (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Log de Webhooks</h2>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Data", "Pedido", "URL", "Status", "Resposta"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-xs font-mono">{log.order_id ? log.order_id.slice(0, 8) + "..." : "teste"}</td>
                    <td className="px-4 py-3 text-xs font-mono max-w-[200px] truncate">{log.webhook_url}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${log.status.includes("success") ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">{log.response || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rastreios */}
      {activeTab === "rastreios" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input type="text" placeholder="Buscar por nome, email, CEP ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm" />
            </div>
            <div className="flex gap-2">
              {(["all", "enviado", "em_transito", "entregue"] as TrackingStatus[]).map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                  {s === "all" ? "Todos" : statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border rounded-xl overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum rastreio encontrado</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Pedido", "Cliente", "Produto", "CEP", "Status", "Rastreio", "Data"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{order.order_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                      </td>
                      <td className="px-4 py-3">{order.product_name}</td>
                      <td className="px-4 py-3">{order.zipcode || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {order.tracking_code ? (
                          order.tracking_url ? (
                            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">{order.tracking_code}</a>
                          ) : (
                            <span className="text-xs font-mono">{order.tracking_code}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
