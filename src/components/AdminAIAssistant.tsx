import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Brain, Lightbulb, MessageCircle } from "lucide-react";

type Mode = "diagnostico" | "insights" | "assistente";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  visitors?: number;
  conversions?: number;
  revenue?: number;
  totalEvents?: number;
}

export default function AdminAIAssistant({ visitors, conversions, revenue, totalEvents }: Props) {
  const [mode, setMode] = useState<Mode>("assistente");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load funnel context
  useEffect(() => {
    async function loadContext() {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ count: totalEventsCount }, { count: purchases }, { data: recentEvents }] = await Promise.all([
        supabase.from("events").select("*", { count: "exact", head: true })
          .eq("site_id", "mesa-dobravel").gte("created_at", since),
        supabase.from("events").select("*", { count: "exact", head: true })
          .eq("event_name", "purchase").gte("created_at", since),
        supabase.from("events").select("event_name")
          .eq("site_id", "mesa-dobravel").gte("created_at", since)
          .order("created_at", { ascending: false }).limit(100),
      ]);

      const eventCounts = recentEvents?.reduce((acc: any, e: any) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {});

      setContext({
        periodo: "últimas 24h",
        total_eventos: totalEventsCount,
        conversoes: purchases,
        taxa_conversao: totalEventsCount ? ((purchases || 0) / totalEventsCount * 100).toFixed(1) + "%" : "0%",
        eventos_por_tipo: eventCounts,
        // Props from dashboard if available
        ...(visitors != null && { visitantes_dashboard: visitors }),
        ...(conversions != null && { conversoes_dashboard: conversions }),
        ...(revenue != null && { receita_dashboard: revenue }),
      });
    }
    loadContext();
  }, [visitors, conversions, revenue]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (overrideInput?: string) => {
    const text = overrideInput ?? input;
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: newMessages, context, mode },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Erro ao conectar com o assistente. Verifique se a ANTHROPIC_API_KEY está configurada nas secrets.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, context, mode, loading]);

  // Auto-diagnose on mode switch
  useEffect(() => {
    if (mode === "diagnostico" && messages.length === 0 && context) {
      const prompt = "Analise os dados do meu funil das últimas 24h e me diga os 3 principais problemas e oportunidades.";
      setInput(prompt);
      const timer = setTimeout(() => sendMessage(prompt), 500);
      return () => clearTimeout(timer);
    }
  }, [mode, context]);

  const welcomeMessages: Record<Mode, string> = {
    diagnostico: "Analisando seu funil... Identificando gargalos automaticamente.",
    insights: "Pronto para sugerir melhorias. O que você quer otimizar?",
    assistente: "Olá! Sou seu assistente de funil. Pergunte sobre campanhas, conversões, tracking ou qualquer coisa.",
  };

  const modeConfig: Record<Mode, { label: string; icon: React.ElementType; prompt: string }> = {
    diagnostico: { label: "Diagnóstico", icon: Brain, prompt: "Analise meu funil e identifique os principais problemas" },
    insights: { label: "Insights", icon: Lightbulb, prompt: "O que posso fazer para aumentar minha taxa de conversão?" },
    assistente: { label: "Assistente", icon: MessageCircle, prompt: "Como funciona a atribuição de campanhas no FunnelIQ?" },
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">AI Assistant</h1>
            <p className="text-[10px] text-muted-foreground">Powered by Claude (Anthropic)</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(modeConfig) as Mode[]).map((m) => {
            const Icon = modeConfig[m].icon;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setMessages([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {modeConfig[m].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Context bar */}
      {context && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-[10px] text-muted-foreground">
            Contexto ({context.periodo}): {context.total_eventos} eventos · {context.conversoes} conversões · taxa {context.taxa_conversao}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{welcomeMessages[mode]}</p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sugestões</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                modeConfig[mode].prompt,
                "Qual etapa do funil tem mais abandono?",
                "Como melhorar o ROAS das campanhas?",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="text-left text-xs px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seu funil, campanhas ou conversões..."
            className="resize-none text-sm min-h-[44px] max-h-[120px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="sm" className="h-auto px-4">
            {loading ? "..." : "Enviar"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
