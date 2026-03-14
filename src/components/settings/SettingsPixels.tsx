import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings2, Plus, Trash2, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import AdminTikTokTab from "@/components/AdminTikTokTab";

interface Pixel {
  id: string;
  name: string;
  pixel_id: string;
  api_token: string;
  status: string;
  created_at: string;
}

interface IntegrationSetting {
  id: string;
  integration_key: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export default function SettingsPixels() {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTiktok, setShowAddTiktok] = useState(false);
  const [newPixel, setNewPixel] = useState({ name: "", pixel_id: "", api_token: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: px }, { data: intg }] = await Promise.all([
      supabase.from("tiktok_pixels").select("*").order("created_at", { ascending: false }),
      supabase.from("integration_settings").select("*").in("integration_key", ["meta", "google_ads"]),
    ]);
    setPixels((px as Pixel[]) || []);
    setIntegrations((intg as IntegrationSetting[]) || []);
    setLoading(false);
  };

  const addTiktokPixel = async () => {
    if (!newPixel.name || !newPixel.pixel_id || !newPixel.api_token) {
      toast.error("Preencha todos os campos");
      return;
    }
    const { error } = await supabase.from("tiktok_pixels").insert({
      name: newPixel.name,
      pixel_id: newPixel.pixel_id,
      api_token: newPixel.api_token,
    });
    if (error) {
      toast.error("Erro ao adicionar pixel");
    } else {
      toast.success("Pixel adicionado!");
      setNewPixel({ name: "", pixel_id: "", api_token: "" });
      setShowAddTiktok(false);
      loadData();
    }
  };

  const deletePixel = async (id: string) => {
    await supabase.from("tiktok_pixels").delete().eq("id", id);
    toast.success("Pixel removido");
    loadData();
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Ativo</Badge>;
    if (status === "warning") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">Atenção</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Desativado</Badge>;
  };

  // Meta Pixel card data
  const metaIntegration = integrations.find(i => i.integration_key === "meta");
  const googleIntegration = integrations.find(i => i.integration_key === "google_ads");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" /> Pixels de Anúncio
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie seus pixels de plataformas de anúncio</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {/* TikTok Pixels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">TikTok Pixel + Events API</h2>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddTiktok(true)}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {pixels.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum pixel TikTok configurado
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pixels.map((px) => (
                  <Card key={px.id}>
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📱</span>
                        <div>
                          <p className="text-sm font-medium">{px.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{px.pixel_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(px.status)}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => deletePixel(px.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Meta Pixel */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Meta Pixel (Facebook / Instagram)</h2>
            <Card>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📘</span>
                  <div>
                    <p className="text-sm font-medium">Meta Pixel</p>
                    <p className="text-[10px] text-muted-foreground">
                      {metaIntegration ? `ID: ${metaIntegration.config?.pixel_id || "—"}` : "Não configurado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {metaIntegration?.enabled
                    ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Ativo</Badge>
                    : <Badge variant="outline" className="text-[10px] text-muted-foreground">Desativado</Badge>
                  }
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Google Ads */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Google Ads</h2>
            <Card>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔵</span>
                  <div>
                    <p className="text-sm font-medium">Google Ads</p>
                    <p className="text-[10px] text-muted-foreground">
                      {googleIntegration ? `ID: ${googleIntegration.config?.conversion_id || "—"}` : "Não configurado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {googleIntegration?.enabled
                    ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Ativo</Badge>
                    : <Badge variant="outline" className="text-[10px] text-muted-foreground">Desativado</Badge>
                  }
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add TikTok Dialog */}
      <Dialog open={showAddTiktok} onOpenChange={setShowAddTiktok}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Pixel TikTok</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input placeholder="Ex: Pixel Principal" value={newPixel.name} onChange={(e) => setNewPixel(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Pixel ID</Label>
              <Input placeholder="Ex: CP1234567890" value={newPixel.pixel_id} onChange={(e) => setNewPixel(p => ({ ...p, pixel_id: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Events API Token</Label>
              <Input type="password" placeholder="Token de acesso" value={newPixel.api_token} onChange={(e) => setNewPixel(p => ({ ...p, api_token: e.target.value }))} />
            </div>
            <Button onClick={addTiktokPixel} className="w-full">Adicionar Pixel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diagnóstico de Qualidade */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-semibold mb-4">Diagnóstico de Qualidade (TikTok EMQ)</h3>
        <AdminTikTokTab diagnosticsOnly={true} />
      </div>
    </div>
  );
}
