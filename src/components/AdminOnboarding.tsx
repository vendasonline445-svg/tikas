import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, Settings, Radio, Zap } from "lucide-react";

interface OnboardingStep {
  number: number;
  title: string;
  description: string;
  status: "pending" | "done";
}

export default function AdminOnboarding() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSite() {
      if (!profile?.client_id) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("sites")
        .select("site_id")
        .eq("client_id", profile.client_id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      setSiteId(data?.site_id ?? null);
      setLoading(false);
    }
    loadSite();
  }, [profile?.client_id]);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "slcuaijctwvmumgtpxgv";
  const endpoint = `https://${projectId}.supabase.co`;

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  const snippet = siteId
    ? `<!-- FunnelIQ Tracker v4.0 -->
<script src="${window.location.origin}/tracker.js?v=4.0" data-site-id="${siteId}" data-endpoint="${endpoint}" data-anon-key="${anonKey}" async></script>`
    : null;

  const steps: OnboardingStep[] = [
    {
      number: 1,
      title: "Instale o tracker no seu site",
      description: "Cole o snippet abaixo no <head> de todas as páginas do seu funil.",
      status: siteId ? "done" : "pending",
    },
    {
      number: 2,
      title: "Configure seu gateway de pagamento",
      description: "Conecte Hygros, Stripe ou MercadoPago para rastrear conversões.",
      status: "pending",
    },
    {
      number: 3,
      title: "Configure seus pixels de anúncio",
      description: "Conecte TikTok Pixel, Meta Pixel ou Google Ads para atribuição.",
      status: "pending",
    },
    {
      number: 4,
      title: "Aguarde os primeiros eventos",
      description: "Assim que alguém visitar seu funil, os dados aparecerão aqui.",
      status: "pending",
    },
  ];

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-6 space-y-8">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mx-auto" />
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-16 px-6 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Bem-vindo ao FunnelIQ</h1>
        <p className="text-muted-foreground text-sm">
          Siga os passos abaixo para começar a rastrear seu funil de vendas.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.number} className="flex gap-4 p-4 border border-border rounded-xl">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
              step.status === "done"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}>
              {step.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : step.number}
            </div>
            <div>
              <p className="font-medium text-sm">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {snippet && (
        <div className="border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium">Seu snippet de instalação</p>
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
      )}

      {!siteId && (
        <div className="text-center p-6 border border-border rounded-xl bg-muted/30">
          <Settings className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Seu administrador ainda não configurou um site para sua conta.
            <br />
            Entre em contato para receber o snippet de instalação.
          </p>
        </div>
      )}
    </div>
  );
}
