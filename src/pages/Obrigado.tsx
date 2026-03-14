import { useEffect } from "react";
import { CheckCircle, Package, Truck, Mail } from "lucide-react";
import { trackTikTokEvent } from "@/lib/tiktok-tracking";
import { trackPageViewOnce } from "@/utils/track-event";

const Obrigado = () => {
  const orderDataStr = sessionStorage.getItem("orderData");
  const orderData = orderDataStr ? JSON.parse(orderDataStr) : null;
  const pixDataStr = sessionStorage.getItem("pixData");
  const pixData = pixDataStr ? JSON.parse(pixDataStr) : null;
  const customerName = orderData?.customer?.name || "Cliente";
  const customerEmail = orderData?.customer?.email || "";

  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageViewOnce("/obrigado");

    // Purchase already fired in PixPayment — skip duplicate here
    console.log("[TikTok] Obrigado page loaded — Purchase already sent from PixPayment");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-sm border-b border-border/40 px-4 py-3.5">
        <div className="mx-auto max-w-[480px] text-center">
          <img src="/images/logo-mesalar.png" alt="Mesa Lar" className="h-8 mx-auto" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-4 py-8">
        {/* Success Icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-20 w-20 rounded-full flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}>
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">
            Obrigado, {customerName}! 🎉
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-[320px]">
            Seu pedido foi confirmado com sucesso e já está sendo processado pela nossa equipe.
          </p>
        </div>

        {/* Order Status Card */}
        <div className="rounded-2xl bg-card border border-border/30 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] mb-4">
          <h2 className="font-bold text-sm mb-4 tracking-tight text-foreground">Status do pedido</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(34,197,94,0.12)" }}>
                <CheckCircle className="h-4.5 w-4.5 text-[#16a34a]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Pagamento confirmado</p>
                <p className="text-[11px] text-muted-foreground">Seu pagamento foi aprovado</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(234,179,8,0.12)" }}>
                <Package className="h-4.5 w-4.5 text-[#ca8a04]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Preparando envio</p>
                <p className="text-[11px] text-muted-foreground">Seu pedido está sendo separado</p>
              </div>
            </div>

            <div className="flex items-center gap-3 opacity-40">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Truck className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Em transporte</p>
                <p className="text-[11px] text-muted-foreground">Aguardando despacho</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Info */}
        <div className="rounded-2xl bg-card border border-border/30 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] mb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0" style={{ background: "rgba(234,88,12,0.1)" }}>
              <Mail className="h-4 w-4" style={{ color: "#ea580c" }} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground mb-1">Código de rastreio</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                O código de rastreio já foi enviado para o seu e-mail {customerEmail && <strong className="text-foreground">{customerEmail}</strong>}. Caso não tenha recebido, verifique a pasta de <strong className="text-foreground">Spam</strong> — ele estará lá!
              </p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="rounded-2xl bg-[#fef9ee] border border-[#f5dea0] p-5 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Caso tenha alguma dúvida, entre em contato conosco pelo e-mail de suporte. Estamos aqui para ajudar! 💬
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
          Mesa Lar • Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default Obrigado;
