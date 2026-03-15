import AdminTrackingConfig from "@/components/AdminTrackingConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

interface Site {
  id: string;
  site_id: string;
  name: string | null;
  domain: string | null;
  active: boolean | null;
}

export default function SettingsTracking() {
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    supabase.from("sites").select("*").eq("active", true).then(({ data }) => {
      setSites((data as Site[]) || []);
    });
  }, []);

  const getSnippet = (siteId: string) => {
    return `<script
  src="https://seu-dominio.com/tracker.js?v=4.0"
  data-site-id="${siteId}"
  data-endpoint="${SUPABASE_URL}"
  data-anon-key="${SUPABASE_ANON_KEY}"
  async
></script>`;
  };

  const copySnippet = (siteId: string) => {
    navigator.clipboard.writeText(getSnippet(siteId));
    toast.success("Snippet copiado!");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Tracking</h1>
        <p className="text-sm text-muted-foreground">Configuração do site e script de instalação</p>
      </div>

      {/* Section 1: Tracking Config */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Configuração do Site</h2>
        <AdminTrackingConfig />
      </div>

      {/* Section 2: Script Installation */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Script de Instalação</h2>
        
        {sites.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum site ativo encontrado. Cadastre um site na aba Administração.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sites.map((site) => (
              <Card key={site.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-primary" />
                      {site.name || site.site_id}
                      {site.domain && (
                        <span className="text-xs text-muted-foreground font-normal">({site.domain})</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">v4.0</Badge>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copySnippet(site.site_id)}>
                        <Copy className="h-3 w-3" /> Copiar snippet
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                    {getSnippet(site.site_id)}
                  </pre>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Cole no &lt;head&gt; de todas as páginas do seu funil.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
