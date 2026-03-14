import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, AlertTriangle, Check, RefreshCw, Clock } from "lucide-react";
import { getUrlWithUtm } from "@/utils/utm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { trackFunnelEvent } from "@/lib/tracking-hub";
import { trackPageViewOnce } from "@/utils/track-event";

const PIX_TIMEOUT_MINUTES = 15;

function usePixCountdown() {
  const target = useMemo(() => Date.now() + PIX_TIMEOUT_MINUTES * 60 * 1000, []);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const expired = diff === 0;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return { display: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired };
}

const PixPayment = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showCheckBtn, setShowCheckBtn] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pixData = JSON.parse(sessionStorage.getItem("pixData") || "{}");
  const orderData = JSON.parse(sessionStorage.getItem("orderData") || "{}");
  const transactionId = pixData?.id || pixData?.transactionId || "";

  const { display: timer, expired } = usePixCountdown();

  // Stop polling when expired
  useEffect(() => {
    if (expired && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [expired]);

  const checkPaymentStatus = useCallback(async () => {
    if (!transactionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-pix-status", {
        body: { transactionId },
      });
      if (!error && data?.paid) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPaid(true);
        const purchaseValue = orderData?.product?.total || pixData?.amount / 100 || 87.60;
        const orderId = transactionId || `order-${Date.now()}`;
        trackFunnelEvent({
          event: "purchase",
          value: purchaseValue,
          properties: {
            transaction_id: transactionId,
            method: "pix",
            order_id: orderId,
            content_type: "product",
            content_id: "mesa-dobravel",
            content_name: "Mesa Dobrável Retrátil",
            contents: [{ content_id: "mesa-dobravel", quantity: orderData?.product?.quantity || 1 }],
          },
          userData: orderData?.customer ? {
            email: orderData.customer.email,
            phone: orderData.customer.phone,
            externalId: orderData.customer.cpf,
          } : undefined,
        });
        const returnTo = sessionStorage.getItem("pixReturnTo");
        if (returnTo === "/taxa-alfandega") {
          sessionStorage.removeItem("pixReturnTo");
          setTimeout(() => navigate(getUrlWithUtm("/obrigado-upsell")), 2000);
        } else {
          setTimeout(() => navigate(getUrlWithUtm("/obrigado")), 2000);
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, [transactionId, navigate]);

  useEffect(() => {
    if (!transactionId) return;
    pollingRef.current = setInterval(checkPaymentStatus, 5000);
    checkPaymentStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [transactionId, checkPaymentStatus]);

  useEffect(() => {
    // add_payment_info already fired in Checkout — only track page view here
    trackPageViewOnce("/pix");
  }, []);

  const pixInfo = pixData?.pix || pixData?.pixQrCode || pixData?.qr_code_data || {};
  const qrCode = pixInfo?.qrcode || pixInfo?.qr_code || pixInfo?.emv || pixData?.pix_qr_code || pixData?.qrcode || pixData?.qr_code || pixData?.emv || "";
  const pixCode = qrCode;

  const total = orderData?.product?.total || (pixData?.amount ? pixData.amount / 100 : null) || (pixData?.value ? pixData.value / 100 : null) || 87.60;

  const handleCopy = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setShowCheckBtn(true), 5000);
    }
  };

  const nowDate = new Date();
  const deadline = new Date(nowDate.getTime() + PIX_TIMEOUT_MINUTES * 60 * 1000);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const deadlineStr = `${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}, ${deadline.getDate()} de ${meses[deadline.getMonth()]} ${deadline.getFullYear()}`;

  const qrImageUrl = qrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrCode)}`
    : "";

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #f0f2f8 0%, #fdf0f2 50%, #f8f8fa 100%)" }}>
        <div className="text-center p-8 rounded-2xl bg-white shadow-lg border border-border/30 mx-4">
          <div className="w-16 h-16 rounded-full bg-[#22c55e] flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground mb-2">Pagamento confirmado!</h1>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #f0f2f8 0%, #fdf0f2 50%, #f8f8fa 100%)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-border/40 px-4 py-3.5">
        <div className="mx-auto max-w-[480px] flex items-center gap-3">
          <button onClick={() => navigate(getUrlWithUtm("/"))} className="text-foreground hover:opacity-70 transition-opacity">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-bold text-[15px] tracking-tight">Código do pagamento</p>
          </div>
          <div className="w-5" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-4">
        {/* Payment Status Card */}
        <div
          className="mt-5 rounded-2xl p-6 relative"
          style={{
            background: expired
              ? "linear-gradient(180deg, #fce8ec 0%, #f5d0d0 100%)"
              : "linear-gradient(180deg, #dfe3f0 0%, #f0e8f0 60%, #fce8ec 100%)",
          }}
        >
          {/* Yellow clock icon top-right */}
          {!expired && (
            <div className="absolute top-5 right-5 h-12 w-12 rounded-full bg-[#f59e0b] flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
          )}

          <div className="pr-16">
            <h1 className="text-[22px] font-extrabold leading-tight text-foreground tracking-tight">
              {expired ? "Pagamento expirado" : "Aguardando o pagamento"}
            </h1>
            <p className="text-[28px] font-black mt-0.5 text-foreground tracking-tight">
              R$ {total.toFixed(2).replace(".", ",")}
            </p>
          </div>

          {/* Countdown */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {expired ? "Tempo esgotado" : "Seu pagamento expira em:"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm ${
                expired ? "bg-muted-foreground" : "bg-[#ef4444]"
              }`}
            >
              <Clock className="h-3 w-3" />
              {timer}
            </span>
          </div>

          {!expired && (
            <p className="text-sm text-muted-foreground mt-1.5">
              Prazo <strong className="text-foreground">{deadlineStr}</strong>
            </p>
          )}
        </div>

        {/* Expired state */}
        {expired ? (
          <div className="mt-5 rounded-2xl bg-white border border-border/30 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-bold text-base mb-2">O tempo para pagamento expirou</h2>
            <p className="text-sm text-muted-foreground mb-5">
              O código PIX não é mais válido. Gere um novo código para concluir sua compra.
            </p>
            <Button
              onClick={() => navigate(getUrlWithUtm("/checkout" + (orderData?.product?.color ? `?color=${orderData.product.color}&size=${orderData.product.size || "180x60cm"}` : "")))}
              className="w-full font-bold text-[15px] py-4 h-auto rounded-2xl shadow-md text-white"
              style={{ background: "linear-gradient(135deg, #e8687a 0%, #d4556a 100%)" }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Gerar novo PIX
            </Button>
          </div>
        ) : (
          <>
            {/* PIX Code Card */}
            <div className="mt-5 rounded-2xl bg-white border border-border/30 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-6">
                <img src="/images/pix-logo.png" alt="Pix" className="h-5 object-contain" />
                <span className="font-bold text-sm tracking-tight">Pix</span>
              </div>

              <p className="text-lg font-semibold text-foreground break-all leading-relaxed mb-6">
                {pixCode
                  ? pixCode.length > 40 ? pixCode.slice(0, 40) + "..." : pixCode
                  : "Gerando código..."}
              </p>

              <Button
                onClick={handleCopy}
                disabled={!pixCode}
                className="w-full font-bold text-[15px] py-4 h-auto rounded-2xl shadow-md transition-all active:scale-[0.98] text-white"
                style={{
                  background: copied
                    ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                    : "linear-gradient(135deg, #e8687a 0%, #d4556a 100%)",
                }}
              >
                {copied ? (
                  <><Check className="mr-2 h-4 w-4" /> Copiado!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> Copiar</>
                )}
              </Button>
            </div>

            {/* Check payment button - only after copying */}
            {showCheckBtn && (
            <div className="mt-5 text-center">
              <button
                onClick={async () => {
                  setChecking(true);
                  await checkPaymentStatus();
                  setTimeout(() => setChecking(false), 2000);
                }}
                disabled={checking}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {checking ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" />
                    Verificando pagamento...
                  </span>
                ) : (
                  "Já fez o pagamento?"
                )}
              </button>
            </div>
            )}

            {/* How to pay */}
            <div className="mt-6 rounded-2xl bg-white border border-border/30 p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <h3 className="font-bold text-sm mb-2 tracking-tight">Como fazer pagamentos com PIX?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Copie o código de pagamento acima, selecione Pix no seu app de internet ou de banco e cole o código.
              </p>
            </div>

            {/* Warning */}
            <div className="mt-4 mb-10 rounded-2xl bg-[#fef9ee] border border-[#f5dea0] p-5 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
              <h3 className="font-bold text-sm flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-4 w-4 text-[#c9952a]" /> Atenção:
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Os bancos reforçaram a segurança do Pix e podem exibir avisos preventivos. Não se preocupe, sua transação está protegida.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PixPayment;
