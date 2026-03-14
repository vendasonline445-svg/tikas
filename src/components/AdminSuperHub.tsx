import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, Globe, Plus, Users, ShieldCheck } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "superadmin" | "admin" | "client";
  client_id: string | null;
  created_at: string;
}

interface Client {
  id: string;
  client_name: string;
}

interface Site {
  id: string;
  site_id: string;
  client_id: string;
  domain: string | null;
  name: string | null;
  active: boolean;
  created_at: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function TrackerSnippet({ siteId }: { siteId: string }) {
  const { toast } = useToast();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "slcuaijctwvmumgtpxgv";
  const endpoint = `https://${projectId}.supabase.co`;

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  const snippet = `<!-- FunnelIQ Tracker v4.0 -->
<script src="${window.location.origin}/tracker.js?v=4.0" data-site-id="${siteId}" data-endpoint="${endpoint}" data-anon-key="${anonKey}" async></script>`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Cole no &lt;head&gt; do site do cliente:</p>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
        {snippet}
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          toast({ title: "Snippet copiado!" });
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar snippet
      </Button>
    </div>
  );
}

export default function AdminSuperHub() {
  const { profile: myProfile } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  // User invite state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "client">("client");
  const [newClientId, setNewClientId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Site creation state
  const [siteName, setSiteName] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [siteClientId, setSiteClientId] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("profiles" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, client_name").order("client_name"),
      (supabase as any).from("sites").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles((p as any[]) ?? []);
    setClients((c as any[]) ?? []);
    setSites((s as any[]) ?? []);
    setLoading(false);
  }

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase
      .from("profiles" as any)
      .update({ role } as any)
      .eq("id", userId);

    if (error) {
      toast({ title: "Erro ao atualizar role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role atualizado com sucesso" });
      loadData();
    }
  }

  async function updateClientId(userId: string, clientId: string) {
    const { error } = await supabase
      .from("profiles" as any)
      .update({ client_id: clientId || null } as any)
      .eq("id", userId);

    if (error) {
      toast({ title: "Erro ao atualizar cliente", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente vinculado com sucesso" });
      loadData();
    }
  }

  async function inviteUser() {
    if (!newEmail) return;
    setCreating(true);
    const { error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email: newEmail, full_name: newName, role: newRole, client_id: newClientId || null },
    });
    if (error) {
      toast({ title: "Erro ao convidar usuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite enviado", description: `Email enviado para ${newEmail}` });
      setNewEmail(""); setNewName(""); setNewClientId("");
      loadData();
    }
    setCreating(false);
  }

  async function deleteUser(userId: string, userEmail: string) {
    if (userId === myProfile?.id) {
      toast({ title: "Não é possível excluir sua própria conta", variant: "destructive" });
      return;
    }
    if (!confirm(`Remover acesso de ${userEmail}?`)) return;
    const { error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: userId },
    });
    if (error) {
      toast({ title: "Erro ao remover usuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acesso removido" });
      loadData();
    }
  }

  async function createSite() {
    if (!siteName || !siteClientId) return;
    setCreatingSite(true);
    const slug = siteSlug || slugify(siteName);
    const { error } = await (supabase as any).from("sites").insert({
      site_id: slug,
      client_id: siteClientId,
      name: siteName,
      domain: siteDomain || null,
    });
    if (error) {
      toast({ title: "Erro ao criar site", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Site criado com sucesso" });
      setSiteName(""); setSiteDomain(""); setSiteSlug(""); setSiteClientId("");
      loadData();
    }
    setCreatingSite(false);
  }

  async function toggleSiteActive(siteId: string, active: boolean) {
    await (supabase as any).from("sites").update({ active: !active }).eq("id", siteId);
    loadData();
  }

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      superadmin: "bg-primary/20 text-primary",
      admin: "bg-accent/20 text-accent-foreground",
      client: "bg-muted text-muted-foreground",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[role] ?? ""}`}>{role}</span>;
  };

  const clientName = (clientId: string | null) => {
    if (!clientId) return "—";
    return clients.find(c => c.id === clientId)?.client_name ?? clientId.slice(0, 8);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Super Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários, sites e acessos do FunnelIQ.
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="sites" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Sites
          </TabsTrigger>
        </TabsList>

        {/* ═══ USERS TAB ═══ */}
        <TabsContent value="users" className="space-y-6">
          {/* Invite user */}
          <div className="border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-base font-medium">Convidar novo usuário</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <Input placeholder="Nome completo (opcional)" value={newName} onChange={e => setNewName(e.target.value)} />
              <Select value={newRole} onValueChange={(v: "admin" | "client") => setNewRole(v)}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — acesso total ao painel</SelectItem>
                  <SelectItem value="client">Client — vê apenas os próprios dados</SelectItem>
                </SelectContent>
              </Select>
              {newRole === "client" && (
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger><SelectValue placeholder="Vincular a um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={inviteUser} disabled={creating || !newEmail}>
              {creating ? "Enviando convite..." : "Enviar convite por email"}
            </Button>
          </div>

          {/* Users table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Cliente vinculado</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.id === myProfile?.id ? (
                        roleBadge(p.role)
                      ) : (
                        <Select value={p.role} onValueChange={v => updateRole(p.id, v)}>
                          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superadmin">superadmin</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="client">client</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.role === "client" ? (
                        <Select value={p.client_id ?? ""} onValueChange={v => updateClientId(p.id, v)}>
                          <SelectTrigger className="w-44 h-7 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">Acesso total</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {p.id !== myProfile?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() => deleteUser(p.id, p.email)}
                        >
                          Remover
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ SITES TAB ═══ */}
        <TabsContent value="sites" className="space-y-6">
          {/* Create site */}
          <div className="border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-base font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar novo site
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome do site (ex: Loja Principal)"
                value={siteName}
                onChange={e => {
                  setSiteName(e.target.value);
                  if (!siteSlug || siteSlug === slugify(siteName)) {
                    setSiteSlug(slugify(e.target.value));
                  }
                }}
              />
              <Input
                placeholder="Domínio (ex: minhaloja.com.br)"
                value={siteDomain}
                onChange={e => setSiteDomain(e.target.value)}
              />
              <Input
                placeholder="Site ID (slug único)"
                value={siteSlug}
                onChange={e => setSiteSlug(e.target.value)}
              />
              <Select value={siteClientId} onValueChange={setSiteClientId}>
                <SelectTrigger><SelectValue placeholder="Cliente vinculado" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createSite} disabled={creatingSite || !siteName || !siteClientId}>
              {creatingSite ? "Criando..." : "Criar site"}
            </Button>
          </div>

          {/* Sites table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Site ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : sites.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum site cadastrado</TableCell></TableRow>
                ) : sites.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.domain || "—"}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{s.site_id}</code>
                    </TableCell>
                    <TableCell className="text-xs">{clientName(s.client_id)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedSiteId(selectedSiteId === s.site_id ? null : s.site_id)}
                        >
                          Snippet
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleSiteActive(s.id, s.active)}
                        >
                          {s.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Snippet viewer */}
          {selectedSiteId && (
            <div className="border border-border rounded-xl p-5">
              <TrackerSnippet siteId={selectedSiteId} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
