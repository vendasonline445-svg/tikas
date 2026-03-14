import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Users, Building2, Key, Plus, Trash2, RefreshCw, Edit2, Check, X,
  Mail, Phone, FileText, Globe, Shield, Clock, AlertTriangle, CheckCircle2,
  ExternalLink, Copy
} from "lucide-react";

type SubTab = "clientes" | "business_centers" | "api_logs";

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: "clientes", label: "Clientes", icon: <Users className="h-4 w-4" /> },
  { key: "business_centers", label: "Business Centers", icon: <Building2 className="h-4 w-4" /> },
  { key: "api_logs", label: "Logs de API", icon: <FileText className="h-4 w-4" /> },
];

const db = supabase as any;

function fmtDate(d: string) {
  try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return d; }
}

export default function AdminClientHub({ defaultTab }: { defaultTab?: SubTab }) {
  const [subTab, setSubTab] = useState<SubTab>(defaultTab ?? "clientes");
  const [loading, setLoading] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [businessCenters, setBusinessCenters] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Client form
  const [newClient, setNewClient] = useState({ client_name: "", contact_email: "", contact_phone: "", notes: "" });
  // BC form
  const [newBC, setNewBC] = useState({ client_id: "", bc_name: "", bc_external_id: "", platform: "tiktok" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (subTab === "clientes") {
        const [{ data: cls }, { data: bcs }] = await Promise.all([
          db.from("clients").select("*").order("created_at", { ascending: false }),
          db.from("business_centers").select("*"),
        ]);
        setClients(cls || []);
        setBusinessCenters(bcs || []);
      } else if (subTab === "business_centers") {
        const [{ data: bcs }, { data: cls }, { data: camps }] = await Promise.all([
          db.from("business_centers").select("*, clients(client_name)").order("created_at", { ascending: false }),
          db.from("clients").select("id, client_name"),
          db.from("campaigns").select("id, campaign_name, client_id"),
        ]);
        setBusinessCenters(bcs || []);
        setClients(cls || []);
        setCampaigns(camps || []);
      } else if (subTab === "api_logs") {
        const [{ data: logs }, { data: cls }] = await Promise.all([
          db.from("api_logs").select("*, clients(client_name)").order("created_at", { ascending: false }).limit(200),
          db.from("clients").select("id, client_name"),
        ]);
        setApiLogs(logs || []);
        setClients(cls || []);
      }
    } catch (e) { console.error("Client Hub fetch error:", e); }
    setLoading(false);
  }, [subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // CRUD Clients
  const addClient = async () => {
    if (!newClient.client_name.trim()) return;
    await db.from("clients").insert(newClient);
    setNewClient({ client_name: "", contact_email: "", contact_phone: "", notes: "" });
    setAddDialogOpen(false);
    fetchData();
  };
  const deleteClient = async (id: string) => {
    if (!confirm("Tem certeza? Isso removerá o cliente e todos os Business Centers associados.")) return;
    await db.from("clients").delete().eq("id", id);
    fetchData();
  };
  const toggleClientStatus = async (id: string, current: string) => {
    await db.from("clients").update({ status: current === "active" ? "inactive" : "active", updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  // CRUD Business Centers
  const addBC = async () => {
    if (!newBC.client_id || !newBC.bc_name.trim()) return;
    await db.from("business_centers").insert(newBC);
    setNewBC({ client_id: "", bc_name: "", bc_external_id: "", platform: "tiktok" });
    setAddDialogOpen(false);
    fetchData();
  };
  const deleteBC = async (id: string) => {
    await db.from("business_centers").delete().eq("id", id);
    fetchData();
  };
  const toggleBCStatus = async (id: string, current: string) => {
    await db.from("business_centers").update({ status: current === "active" ? "inactive" : "active", updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  const getClientBCCount = (clientId: string) => businessCenters.filter(bc => bc.client_id === clientId).length;

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ══ CLIENTES ══ */}
      {subTab === "clientes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Clientes ({clients.length})</h3>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente</Button>
          </div>

          {/* Summary */}
          {clients.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card className="p-3 text-center"><Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{clients.length}</p><p className="text-[10px] text-muted-foreground">Total de Clientes</p></Card>
              <Card className="p-3 text-center"><CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500 mb-1" /><p className="text-lg font-bold text-foreground">{clients.filter(c => c.status === "active").length}</p><p className="text-[10px] text-muted-foreground">Ativos</p></Card>
              <Card className="p-3 text-center"><Building2 className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{businessCenters.length}</p><p className="text-[10px] text-muted-foreground">Business Centers</p></Card>
              <Card className="p-3 text-center"><Shield className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><p className="text-lg font-bold text-foreground">{businessCenters.filter(bc => bc.access_token).length}</p><p className="text-[10px] text-muted-foreground">OAuth Conectados</p></Card>
            </div>
          )}

          {clients.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum cliente cadastrado. Adicione o primeiro cliente para começar.</Card>
          ) : (
            <div className="grid gap-2">
              {clients.map(c => (
                <Card key={c.id} className={`p-4 ${c.status !== "active" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{c.client_name}</p>
                        <Badge className={`text-[9px] ${c.status === "active" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                          {c.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        {c.contact_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.contact_email}</span>}
                        {c.contact_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.contact_phone}</span>}
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{getClientBCCount(c.id)} BC(s)</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(c.created_at)}</span>
                      </div>
                      {c.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleClientStatus(c.id, c.status)} className="text-xs">
                        {c.status === "active" ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteClient(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Add client dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Cliente</DialogTitle><DialogDescription>Cadastre um novo cliente</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nome do cliente *" value={newClient.client_name} onChange={e => setNewClient(p => ({ ...p, client_name: e.target.value }))} />
                <Input type="email" placeholder="E-mail de contato" value={newClient.contact_email} onChange={e => setNewClient(p => ({ ...p, contact_email: e.target.value }))} />
                <Input placeholder="Telefone" value={newClient.contact_phone} onChange={e => setNewClient(p => ({ ...p, contact_phone: e.target.value }))} />
                <Input placeholder="Notas (opcional)" value={newClient.notes} onChange={e => setNewClient(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={addClient} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ══ BUSINESS CENTERS ══ */}
      {subTab === "business_centers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Business Centers ({businessCenters.length})</h3>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo BC</Button>
          </div>

          {clients.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
              Cadastre pelo menos um cliente antes de adicionar Business Centers.
            </Card>
          ) : businessCenters.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum Business Center cadastrado.</Card>
          ) : (
            <div className="grid gap-2">
              {businessCenters.map(bc => (
                <Card key={bc.id} className={`p-4 ${bc.status !== "active" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">{bc.bc_name}</p>
                        <Badge variant="secondary" className="text-[10px]">{bc.platform}</Badge>
                        <Badge className={`text-[9px] ${bc.status === "active" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                          {bc.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        {bc.clients?.client_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{bc.clients.client_name}</span>}
                        {bc.bc_external_id && <span className="font-mono text-[10px]">ID: {bc.bc_external_id}</span>}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(bc.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {bc.access_token ? (
                          <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><Key className="h-2.5 w-2.5 mr-0.5" />OAuth Conectado</Badge>
                        ) : (
                          <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30"><Key className="h-2.5 w-2.5 mr-0.5" />Sem Token</Badge>
                        )}
                        {bc.token_expires_at && (
                          <span className="text-[10px] text-muted-foreground">Expira: {fmtDate(bc.token_expires_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleBCStatus(bc.id, bc.status)} className="text-xs">
                        {bc.status === "active" ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteBC(bc.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Add BC dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Business Center</DialogTitle><DialogDescription>Vincule um Business Center a um cliente</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newBC.client_id} onChange={e => setNewBC(p => ({ ...p, client_id: e.target.value }))}>
                  <option value="">Selecione o cliente *</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
                <Input placeholder="Nome do Business Center *" value={newBC.bc_name} onChange={e => setNewBC(p => ({ ...p, bc_name: e.target.value }))} />
                <Input placeholder="ID Externo (ex: BC do TikTok)" value={newBC.bc_external_id} onChange={e => setNewBC(p => ({ ...p, bc_external_id: e.target.value }))} />
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newBC.platform} onChange={e => setNewBC(p => ({ ...p, platform: e.target.value }))}>
                  <option value="tiktok">TikTok</option><option value="meta">Meta</option><option value="google">Google</option>
                </select>
                <p className="text-[10px] text-muted-foreground">A conexão OAuth será configurada posteriormente quando a integração com a API for ativada.</p>
                <Button onClick={addBC} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ══ API LOGS ══ */}
      {subTab === "api_logs" && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Logs de API ({apiLogs.length})</h3>

          {apiLogs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Nenhum log de API registrado ainda. Os logs aparecerão quando a integração com a API do TikTok Ads for ativada.
            </Card>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-left font-semibold">Método</th>
                  <th className="px-3 py-2 text-left font-semibold">Endpoint</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr></thead>
                <tbody>{apiLogs.map(log => (
                  <tr key={log.id} className="border-t border-border/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-3 py-2">{log.clients?.client_name || "—"}</td>
                    <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{log.method}</Badge></td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{log.endpoint}</td>
                    <td className="px-3 py-2">
                      <Badge className={`text-[9px] ${log.status_code && log.status_code < 400 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-red-500/15 text-red-600 border-red-500/30"}`}>
                        {log.status_code || "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
