import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Plus, Copy, CheckCircle2, Code2, Crosshair,
  Link2, DollarSign, Wrench, Settings, ChevronDown, ChevronUp,
  Zap, Trash2, ExternalLink
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface Site {
  id: string;
  site_id: string;
  client_id: string;
  domain: string | null;
  name: string | null;
  active: boolean;
  created_at: string;
}

interface TrackingConfig {
  site_id: string;
  selector_buy_button: string;
  selector_checkout_form: string;
  selector_price: string;
  selector_pix_qrcode: string;
  url_checkout: string;
  url_thankyou: string;
  url_upsell: string;
  value_static: number | null;
  value_selector: string;
  value_attribute: string;
  checkout_type: string;
  spa_mode: boolean;
  debug_mode: boolean;
}

interface TikTokPixel {
  id: string;
  pixel_id: string;
  name: string;
  api_token: string;
  status: string;
  client_id: string | null;
  created_at: string;
}

const EMPTY_CONFIG: Omit<TrackingConfig, "site_id"> = {
  selector_buy_button: "",
  selector_checkout_form: "",
  selector_price: "",
  selector_pix_qrcode: "",
  url_checkout: "",
  url_thankyou: "",
  url_upsell: "",
  value_static: null,
  value_selector: "",
  value_attribute: "",
  checkout_type: "api",
  spa_mode: true,
  debug_mode: false,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function SnippetBlock({ siteId, onCopy }: { siteId: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);

  const snippet = `<!-- FunnelIQ Tracker v4.0 -->
<script
  src="${window.location.origin}/tracker.js?v=4.0"
  data-site-id="${siteId}"
  data-endpoint="${SUPABASE_URL}"
  data-anon-key="${SUPABASE_ANON_KEY}"
  async
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Code2 className="h-4 w-4" /> Snippet de Instalação
          <Badge variant="outline" className="text-[10px] ml-auto">v4.0</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cole no <code className="bg-muted px-1 rounded">&lt;head&gt;</code> de{" "}
          <strong>todas as páginas</strong> do seu funil.
        </p>
        <pre className="bg-muted rounded-lg p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all border">
          {snippet}
        </pre>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
          {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado!" : "Copiar snippet"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SiteConfigPanel({
  site,
  onClose,
}: {
  site: Site;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? profile?.id;

  const [config, setConfig] = useState<Partial<TrackingConfig>>({ ...EMPTY_CONFIG, site_id: site.site_id });
  const [saving, setSaving] = useState(false);

  // TikTok pixel state
  const [pixels, setPixels] = useState<TikTokPixel[]>([]);
  const [newPixelId, setNewPixelId] = useState("");
  const [newPixelName, setNewPixelName] = useState("");
  const [newApiToken, setNewApiToken] = useState("");
  const [addingPixel, setAddingPixel] = useState(false);
  const [showPixelForm, setShowPixelForm] = useState(false);

  useEffect(() => {
    // Load tracking config
    (supabase as any)
      .from("site_tracking_config")
      .select("*")
      .eq("site_id", site.site_id)
      .single()
      .then(({ data }: any) => {
        if (data) setConfig({ ...EMPTY_CONFIG, ...data });
      });

    // Load TikTok pixels
    supabase
      .from("tiktok_pixels")
      .select("*")
      .eq("client_id", clientId)
      .then(({ data }) => setPixels((data as TikTokPixel[]) ?? []));
  }, [site.site_id, clientId]);

  async function saveConfig() {
    setSaving(true);
    const payload = { ...config, site_id: site.site_id, updated_at: new Date().toISOString() };
    const { error } = await (supabase as any)
      .from("site_tracking_config")
      .upsert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva com sucesso!" });
    }
    setSaving(false);
  }

  async function addPixel() {
    if (!newPixelId) return;
    setAddingPixel(true);
    const { error } = await supabase.from("tiktok_pixels").insert({
      pixel_id: newPixelId,
      name: newPixelName || `Pixel ${site.site_id}`,
      api_token: newApiToken,
      client_id: clientId,
      status: "active",
    });
    if (error) {
      toast({ title: "Erro ao adicionar pixel", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pixel adicionado!" });
      setNewPixelId(""); setNewPixelName(""); setNewApiToken("");
      setShowPixelForm(false);
      supabase.from("tiktok_pixels").select("*").eq("client_id", clientId)
        .then(({ data }) => setPixels((data as TikTokPixel[]) ?? []));
    }
    setAddingPixel(false);
  }

  async function removePixel(pixelId: string) {
    await supabase.from("tiktok_pixels").delete().eq("id", pixelId);
    setPixels(prev => prev.filter(p => p.id !== pixelId));
    toast({ title: "Pixel removido" });
  }

  const field = (
    label: string,
    key: keyof TrackingConfig,
    placeholder: string,
    hint?: string
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        placeholder={placeholder}
        value={(config[key] as string) ?? ""}
        onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
        className="font-mono text-xs h-8"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="border border-border rounded-xl p-5 space-y-5 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Configuração: {site.name || site.site_id}</span>
          <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono text-muted-foreground">
            {site.site_id}
          </code>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          {/* CSS Selectors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Crosshair className="h-4 w-4" /> Seletores CSS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {field("Botão de compra", "selector_buy_button", ".btn-comprar, #cta-buy, [data-buy]",
                "Seletor do botão que inicia o processo de compra.")}
              {field("Formulário de pagamento", "selector_checkout_form", "#checkout-form, .payment-form",
                "Seletor do formulário de pagamento.")}
              {field("Elemento de preço", "selector_price", "#price-total, .order-value, [data-price]",
                "Seletor do elemento com o valor do pedido.")}
              {field("QR Code PIX", "selector_pix_qrcode", "#qr-code, .pix-container, img[alt*='pix']",
                "Quando aparecer na tela, dispara pix_generated.")}
            </CardContent>
          </Card>

          {/* Funnel URLs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4" /> URLs do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {field("URL do Checkout", "url_checkout", "/checkout, /comprar",
                "Quando acessado, dispara checkout_start.")}
              {field("URL de Obrigado", "url_thankyou", "/obrigado, /thank-you",
                "Fallback para o evento purchase.")}
              {field("URL de Upsell", "url_upsell", "/upsell1, /oferta-especial",
                "Páginas de upsell (opcional).")}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Order Value */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Valor do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor fixo (R$)</Label>
                <Input
                  type="number"
                  placeholder="197.00"
                  value={config.value_static ?? ""}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      value_static: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">Use para produtos com preço único.</p>
              </div>
              {field("Seletor do valor", "value_selector", ".total-price, #order-total",
                "Seletor do elemento com valor dinâmico.")}
              {field("Atributo do valor", "value_attribute", "data-price",
                "Atributo HTML com o valor.")}
            </CardContent>
          </Card>

          {/* Advanced */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Avançado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Modo SPA</p>
                  <p className="text-[10px] text-muted-foreground">
                    Monitorar mudanças de rota (React, Vue, etc.)
                  </p>
                </div>
                <Switch
                  checked={config.spa_mode ?? true}
                  onCheckedChange={v => setConfig(prev => ({ ...prev, spa_mode: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Modo debug</p>
                  <p className="text-[10px] text-muted-foreground">
                    Logar eventos no console. Desativar em produção.
                  </p>
                </div>
                <Switch
                  checked={config.debug_mode ?? false}
                  onCheckedChange={v => setConfig(prev => ({ ...prev, debug_mode: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>

          {/* Snippet */}
          <SnippetBlock
            siteId={site.site_id}
            onCopy={() => {}}
          />
        </div>
      </div>

      {/* TikTok Pixel Section */}
      <div className="border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#fe2c55]" />
            <span className="text-sm font-medium">TikTok Pixels</span>
            {pixels.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{pixels.length}</Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowPixelForm(!showPixelForm)}
          >
            <Plus className="h-3 w-3" />
            Adicionar pixel
          </Button>
        </div>

        {showPixelForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
            <Input
              placeholder="Pixel ID (ex: ABCDEF123)"
              value={newPixelId}
              onChange={e => setNewPixelId(e.target.value)}
              className="text-xs h-8"
            />
            <Input
              placeholder="Nome (ex: Pixel Checkout)"
              value={newPixelName}
              onChange={e => setNewPixelName(e.target.value)}
              className="text-xs h-8"
            />
            <Input
              placeholder="API Token (Events API)"
              value={newApiToken}
              onChange={e => setNewApiToken(e.target.value)}
              className="text-xs h-8"
            />
            <div className="md:col-span-3 flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={addPixel}
                disabled={addingPixel || !newPixelId}
              >
                {addingPixel ? "Adicionando..." : "Adicionar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPixelForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {pixels.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum pixel configurado. Adicione seu TikTok Pixel ID para ativar o rastreio de eventos.
          </p>
        ) : (
          <div className="space-y-2">
            {pixels.map(pixel => (
              <div
                key={pixel.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#fe2c55]/10 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-[#fe2c55]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{pixel.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{pixel.pixel_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      pixel.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {pixel.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removePixel(pixel.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminClientSiteManager() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const clientId = profile?.client_id ?? profile?.id;

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Add site form
  const [siteName, setSiteName] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadSites = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sites")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setSites((data as Site[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadSites(); }, [loadSites]);

  // Auto-open add form if no sites
  useEffect(() => {
    if (!loading && sites.length === 0) setShowAddForm(true);
  }, [loading, sites.length]);

  async function createSite() {
    if (!siteName || !clientId) return;
    setCreating(true);
    const slug = siteSlug || slugify(siteName);

    const { error: siteError } = await (supabase as any).from("sites").insert({
      site_id: slug,
      client_id: clientId,
      name: siteName,
      domain: siteDomain || null,
      active: true,
    });

    if (siteError) {
      toast({ title: "Erro ao criar site", description: siteError.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    // Create default tracking config
    await (supabase as any).from("site_tracking_config").insert({
      site_id: slug,
      checkout_type: "api",
      spa_mode: true,
      debug_mode: false,
    });

    toast({ title: "Site criado!", description: `${siteName} (${slug}) está pronto para configurar.` });
    setSiteName(""); setSiteDomain(""); setSiteSlug("");
    setShowAddForm(false);
    await loadSites();
    // Auto-open config for the new site
    setSelectedSiteId(slug);
    setCreating(false);
  }

  async function toggleActive(siteId: string, active: boolean) {
    await (supabase as any).from("sites").update({ active: !active }).eq("id", siteId);
    await loadSites();
  }

  const selectedSite = sites.find(s => s.site_id === selectedSiteId);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Meus Sites
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie seus sites, configure o tracking e obtenha o snippet de instalação.
          </p>
        </div>
        {sites.length > 0 && !showAddForm && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar site
          </Button>
        )}
      </div>

      {/* Add Site Form */}
      {showAddForm && (
        <div className="border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-base font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {sites.length === 0 ? "Adicione seu primeiro site" : "Novo site"}
          </h2>

          {sites.length === 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
              Configure seu site para ativar o rastreio de funil, campanhas e conversões.
              Será gerado um Site ID único que identifica seu site no FunnelIQ.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome do site</Label>
              <Input
                placeholder="ex: Minha Loja Principal"
                value={siteName}
                onChange={e => {
                  setSiteName(e.target.value);
                  if (!siteSlug || siteSlug === slugify(siteName)) {
                    setSiteSlug(slugify(e.target.value));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Domínio (opcional)</Label>
              <Input
                placeholder="ex: minhaloja.com.br"
                value={siteDomain}
                onChange={e => setSiteDomain(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Site ID (gerado automaticamente)</Label>
              <Input
                placeholder="ex: minha-loja"
                value={siteSlug}
                onChange={e => setSiteSlug(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Identificador único usado no snippet de rastreio. Não pode ser alterado depois.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={createSite}
              disabled={creating || !siteName}
            >
              {creating ? "Criando..." : "Criar site"}
            </Button>
            {sites.length > 0 && (
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Sites List */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Carregando seus sites...
        </div>
      ) : sites.length === 0 && !showAddForm ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-3">
          <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Nenhum site cadastrado ainda.</p>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar meu primeiro site
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(site => (
            <div key={site.id} className="space-y-0">
              {/* Site row */}
              <div className="border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{site.name || site.site_id}</p>
                    <code className="bg-muted px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground">
                      {site.site_id}
                    </code>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        site.active
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {site.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  {site.domain && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {site.domain}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={selectedSiteId === site.site_id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      setSelectedSiteId(selectedSiteId === site.site_id ? null : site.site_id)
                    }
                  >
                    <Settings className="h-3 w-3" />
                    Configurar
                    {selectedSiteId === site.site_id ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleActive(site.id, site.active)}
                  >
                    {site.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>

              {/* Expanded config panel */}
              {selectedSiteId === site.site_id && selectedSite && (
                <div className="border border-t-0 border-border rounded-b-xl overflow-hidden">
                  <SiteConfigPanel
                    site={selectedSite}
                    onClose={() => setSelectedSiteId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help section */}
      {sites.length > 0 && (
        <div className="border border-border/60 rounded-xl p-4 bg-muted/10 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Como funciona?
          </p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Adicione seu site com nome e domínio</li>
            <li>Clique em "Configurar" para definir os seletores CSS e URLs do funil</li>
            <li>Copie o snippet de instalação e cole no &lt;head&gt; do seu site</li>
            <li>
              O tracker irá capturar automaticamente os eventos:{" "}
              <code className="bg-muted px-1 rounded">
                page_view → view_content → click_buy → checkout_start → purchase
              </code>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
