import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Copy, CheckCircle2, Code2, Globe, Crosshair, Link2, DollarSign, Wrench } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

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

const EMPTY: Partial<TrackingConfig> = {
  selector_buy_button: '',
  selector_checkout_form: '',
  selector_price: '',
  selector_pix_qrcode: '',
  url_checkout: '',
  url_thankyou: '',
  url_upsell: '',
  value_static: null,
  value_selector: '',
  value_attribute: '',
  checkout_type: 'api',
  spa_mode: true,
  debug_mode: false,
};

export default function AdminTrackingConfig() {
  const { isSuperAdmin } = useAuth();
  const [sites, setSites] = useState<{ site_id: string; name: string | null }[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [config, setConfig] = useState<Partial<TrackingConfig>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const db = supabase as any;

  useEffect(() => {
    db.from('sites').select('site_id, name').eq('active', true)
      .then(({ data }: any) => {
        setSites(data ?? []);
        if (data && data[0]) setSelectedSite(data[0].site_id);
      });
  }, []);

  useEffect(() => {
    if (!selectedSite) return;
    db.from('site_tracking_config')
      .select('*')
      .eq('site_id', selectedSite)
      .single()
      .then(({ data }: any) => {
        setConfig(data ?? { ...EMPTY, site_id: selectedSite });
      });
  }, [selectedSite]);

  const snippet = `<script
  src="https://SEU-DOMINIO/tracker.js"
  data-site-id="${selectedSite}"
  data-endpoint="${SUPABASE_URL}"
  data-anon-key="${SUPABASE_ANON_KEY}"
  async
></script>`;

  async function save() {
    setSaving(true);
    const { error } = await db
      .from('site_tracking_config')
      .upsert({ ...config, site_id: selectedSite, updated_at: new Date().toISOString() });

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configuração salva com sucesso');
    }
    setSaving(false);
  }

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setSnippetCopied(true);
    toast.success('Snippet copiado!');
    setTimeout(() => setSnippetCopied(false), 2000);
  };

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
        value={(config[key] as string) ?? ''}
        onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
        className="font-mono text-xs"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Crosshair className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Tracking Config</h2>
          <p className="text-xs text-muted-foreground">
            Configure os seletores e URLs do funil. O tracker.js usa essas configurações para capturar eventos com precisão.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          {/* Site selector */}
          {isSuperAdmin && sites.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Site
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={selectedSite}
                  onChange={e => setSelectedSite(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {sites.map(s => (
                    <option key={s.site_id} value={s.site_id}>{s.name || s.site_id} ({s.site_id})</option>
                  ))}
                </select>
              </CardContent>
            </Card>
          )}

          {/* CSS Selectors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Seletores CSS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {field('Botão de compra', 'selector_buy_button', '.btn-comprar, #cta-buy, [data-buy]',
                'Seletor do botão que inicia o processo de compra.')}
              {field('Formulário de pagamento', 'selector_checkout_form', '#checkout-form, .payment-form',
                'Seletor do formulário de pagamento.')}
              {field('Elemento de preço', 'selector_price', '#price-total, .order-value, [data-price]',
                'Seletor do elemento com o valor do pedido.')}
              {field('QR Code PIX', 'selector_pix_qrcode', '#qr-code, .pix-container, img[alt*="pix"]',
                'Quando aparecer na tela, dispara pix_generated.')}
            </CardContent>
          </Card>

          {/* URLs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4" /> URLs do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {field('URL do Checkout', 'url_checkout', '/checkout, /comprar',
                'Quando acessado, dispara checkout_start.')}
              {field('URL de Obrigado', 'url_thankyou', '/obrigado, /thank-you',
                'Fallback para o evento purchase.')}
              {field('URL de Upsell', 'url_upsell', '/upsell1, /oferta-especial',
                'Páginas de upsell (opcional).')}
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
                  value={config.value_static ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, value_static: e.target.value ? Number(e.target.value) : null }))}
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground">Use para produtos com preço único.</p>
              </div>
              {field('Seletor do valor', 'value_selector', '.total-price, #order-total',
                'Seletor do elemento com valor dinâmico.')}
              {field('Atributo do valor', 'value_attribute', 'data-price',
                'Atributo HTML com o valor (padrão: data-price).')}
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
                  <p className="text-xs text-muted-foreground">Monitorar mudanças de rota (React, Vue, etc.)</p>
                </div>
                <Switch
                  checked={config.spa_mode ?? true}
                  onCheckedChange={v => setConfig(prev => ({ ...prev, spa_mode: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Modo debug</p>
                  <p className="text-xs text-muted-foreground">Logar eventos no console. Desativar em produção.</p>
                </div>
                <Switch
                  checked={config.debug_mode ?? false}
                  onCheckedChange={v => setConfig(prev => ({ ...prev, debug_mode: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </Button>

          {/* Snippet */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Snippet de Instalação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Cole no <code className="bg-muted px-1 rounded">&lt;head&gt;</code> de todas as páginas do funil.
              </p>
              <pre className="bg-muted rounded-lg p-3 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all border">
                {snippet}
              </pre>
              <Button variant="outline" size="sm" className="gap-1" onClick={copySnippet}>
                {snippetCopied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {snippetCopied ? 'Copiado' : 'Copiar snippet'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
