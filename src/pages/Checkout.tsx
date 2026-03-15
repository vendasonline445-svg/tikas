import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUrlWithUtm } from "@/utils/utm";
import { getTrackingContext, trackEvent, trackPageViewOnce } from "@/utils/track-event";
import { toast } from "@/hooks/use-toast";
import { trackFunnelEvent, identifyUser } from "@/lib/tracking-hub";
import { cacheUserIdentity } from "@/lib/tiktok-tracking";
import {
  ArrowLeft, MapPin, Star, Truck, ShieldCheck, Minus, Plus, ChevronRight, Check, ChevronDown, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SIZE_PRICES: Record<string, { price: number; oldPrice: number; discount: number }> = {
  "120x60cm": { price: 69.90, oldPrice: 159.90, discount: 56 },
  "150x60cm": { price: 79.90, oldPrice: 179.90, discount: 55 },
  "180x60cm": { price: 87.60, oldPrice: 199.90, discount: 56 },
  "240x60cm": { price: 109.90, oldPrice: 249.90, discount: 56 },
};

function useCheckoutCountdown() {
  const [time, setTime] = useState({ h: 0, m: 5, s: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) return { h: 2, m: 59, s: 59 };
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const fmt = (n: number) => String(n).padStart(2, "0");
  return { time, display: `${fmt(time.h)}:${fmt(time.m)}:${fmt(time.s)}` };
}

type CartItem = { color: string; size: string; quantity: number };
type StoreCartItem = { productId: string; slug: string; name: string; imageUrl: string; priceCents: number; quantity: number; variant?: Record<string, string> };

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detect store cart items (from /loja products)
  const [storeItems, setStoreItems] = useState<StoreCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('fiq_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const isStoreCheckout = storeItems.length > 0;
  const storeProduct = isStoreCheckout ? storeItems[0] : null;

  // Load mesa cart items: from localStorage cart OR from URL params (single item)
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (isStoreCheckout) return []; // Skip mesa cart if store items exist
    try {
      const saved = localStorage.getItem('mesalar_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Fallback: single item from URL
    const color = searchParams.get("color") || searchParams.get("cor") || "branca";
    const size = searchParams.get("size") || searchParams.get("tamanho") || "180x60cm";
    const qty = parseInt(searchParams.get("qty") || "1", 10);
    return [{ color, size, quantity: qty }];
  });

  const updateCartItemQty = (index: number, qty: number) => {
    if (isStoreCheckout) {
      if (qty <= 0) {
        const updated = storeItems.filter((_, i) => i !== index);
        if (updated.length === 0) {
          localStorage.removeItem('fiq_cart');
          navigate('/loja');
          return;
        }
        setStoreItems(updated);
        localStorage.setItem('fiq_cart', JSON.stringify(updated));
      } else {
        const updated = [...storeItems];
        updated[index] = { ...updated[index], quantity: qty };
        setStoreItems(updated);
        localStorage.setItem('fiq_cart', JSON.stringify(updated));
      }
      return;
    }
    if (qty <= 0) {
      const updated = cartItems.filter((_, i) => i !== index);
      if (updated.length === 0) {
        localStorage.removeItem('mesalar_cart');
        navigate(getUrlWithUtm('/'));
        return;
      }
      setCartItems(updated);
      localStorage.setItem('mesalar_cart', JSON.stringify(updated));
    } else {
      const updated = [...cartItems];
      updated[index] = { ...updated[index], quantity: qty };
      setCartItems(updated);
      localStorage.setItem('mesalar_cart', JSON.stringify(updated));
    }
  };

  // Checkout page: fire checkout_start once on mount
  useEffect(() => {
    window.scrollTo({ top: 0 });
    trackFunnelEvent({
      event: "checkout_start",
      value: subtotalRaw,
      properties: {
        content_type: "product",
        content_id: isStoreCheckout ? storeItems[0]?.slug : "mesa-dobravel",
        content_name: isStoreCheckout ? storeItems[0]?.name : "Mesa Dobrável Retrátil",
        contents: isStoreCheckout
          ? storeItems.map(i => ({ content_id: i.slug, quantity: i.quantity }))
          : cartItems.map(i => ({ content_id: `mesa-dobravel-${i.color}-${i.size}`, quantity: i.quantity })),
        items: isStoreCheckout ? storeItems.length : cartItems.length,
        source: isStoreCheckout ? 'loja' : 'mesa',
      },
    });
    trackPageViewOnce("/checkout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const couponUsed = localStorage.getItem('mesalar_coupon_used') === 'true';
  const savedCoupon = couponUsed ? '' : (localStorage.getItem('mesalar_coupon') || '');
  const couponParam = searchParams.get("cupom") || searchParams.get("coupon") || savedCoupon;
  const couponUpper = couponParam.toUpperCase();
  const hasCoupon = !couponUsed && (couponUpper === "VOLTA25" || couponUpper === "ULTIMA50" || couponUpper === "DESCULPA80");
  const couponDiscount = couponUpper === "DESCULPA80" ? 0.80 : couponUpper === "ULTIMA50" ? 0.50 : couponUpper === "VOLTA25" ? 0.25 : 0;
  const couponLabel = couponUpper === "DESCULPA80" ? "DESCULPA80 (-80%)" : couponUpper === "ULTIMA50" ? "ULTIMA50 (-50%)" : "VOLTA25 (-25%)";
  const timer = useCheckoutCountdown();

  const [shipping, setShipping] = useState("padrao");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressOpen, setAddressOpen] = useState(true);
  const [cpfError, setCpfError] = useState("");
  const productSectionRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [showSummary, setShowSummary] = useState(true);
  
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

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem('mesalar_checkout_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Seed crm identifiers from previously saved form data
        if (parsed.email?.trim()) localStorage.setItem("crm_user_email", parsed.email.trim().toLowerCase());
        if (parsed.phone?.trim()) {
          const digits = parsed.phone.replace(/\D/g, "");
          if (digits.length >= 10) {
            localStorage.setItem("crm_user_phone", digits.startsWith("55") ? `+${digits}` : `+55${digits}`);
          }
        }
        return parsed;
      }
    } catch {}
    return {
      name: "", phone: "", email: "", cep: "",
      uf: "", cidade: "", bairro: "", endereco: "",
      numero: "", complemento: "", cpf: "",
    };
  });

  // Derived totals - unified for both mesa and store products
  const totalQty = isStoreCheckout
    ? storeItems.reduce((sum, i) => sum + i.quantity, 0)
    : cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalRaw = isStoreCheckout
    ? storeItems.reduce((sum, i) => sum + (i.priceCents / 100) * i.quantity, 0)
    : cartItems.reduce((sum, i) => {
        const sp = SIZE_PRICES[i.size] || SIZE_PRICES["180x60cm"];
        return sum + sp.price * i.quantity;
      }, 0);
  const totalOldPrice = isStoreCheckout
    ? subtotalRaw // Store products don't have oldPrice in cart, discount already applied
    : cartItems.reduce((sum, i) => {
        const sp = SIZE_PRICES[i.size] || SIZE_PRICES["180x60cm"];
        return sum + sp.oldPrice * i.quantity;
      }, 0);
  const BASE_DISCOUNT_VALUE = totalOldPrice - subtotalRaw;

  const shippingCost = shipping === "express" ? 14.50 : 0;
  const couponAmount = hasCoupon ? Math.round(subtotalRaw * couponDiscount * 100) / 100 : 0;
  const total = subtotalRaw - couponAmount + shippingCost;
  const totalSavings = BASE_DISCOUNT_VALUE + couponAmount;

  // For backward compat, use first item as "selected"
  const selectedColor = cartItems[0]?.color || "branca";
  const selectedSize = cartItems[0]?.size || "180x60cm";
  const quantity = totalQty;

  const updateField = (field: string, value: string) => {
    setForm((prev: typeof form) => {
      const updated = { ...prev, [field]: value };
      localStorage.setItem('mesalar_checkout_form', JSON.stringify(updated));
      // Persist email/phone for TikTok Advanced Matching (EMQ)
      if (field === "email" && value.trim()) {
        localStorage.setItem("crm_user_email", value.trim().toLowerCase());
      }
      if (field === "phone" && value.trim()) {
        const digits = value.replace(/\D/g, "");
        if (digits.length >= 10) {
          const e164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
          localStorage.setItem("crm_user_phone", e164);
        }
      }
      return updated;
    });
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
        setForm((prev: typeof form) => {
          const updated = {
            ...prev,
            endereco: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
          };
          localStorage.setItem('mesalar_checkout_form', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error("Erro ao buscar CEP", e);
    } finally {
      setCepLoading(false);
    }
  };

  const isAddressComplete = form.cep && form.uf && form.cidade && form.bairro && form.endereco && form.numero;
  const isCpfValid = validateCPF(form.cpf);

  // Scroll to top on mount to show address form first
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isAddressComplete && form.name && form.phone && form.email && isCpfValid) {
      setAddressOpen(false);
      // Scroll to product/shipping section after closing address
      setTimeout(() => {
        productSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
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

    // Identify user for tracking before submitting
    await identifyUser({
      email: form.email,
      phone: form.phone,
      externalId: form.cpf,
    });

    // Cache identity for cross-event PII enrichment (email/phone coverage on all events)
    await cacheUserIdentity(
      form.email,
      form.phone,
      localStorage.getItem("fiq_visitor_id") || localStorage.getItem("mesalar_visitor_id") || undefined
    );

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
        items: isStoreCheckout
          ? storeItems.map((item) => {
              const variantStr = item.variant && Object.keys(item.variant).length > 0
                ? ` - ${Object.values(item.variant).join('/')}`
                : '';
              return {
                id: item.productId || item.slug,
                title: `${item.name}${variantStr}`,
                unitPrice: Math.round(item.priceCents * (1 - couponDiscount)),
                quantity: item.quantity,
                tangible: true,
              };
            })
          : cartItems.map((item) => {
              const sp = SIZE_PRICES[item.size] || SIZE_PRICES["180x60cm"];
              const cl = item.color === "preta" ? "Preta" : "Branca";
              return {
                id: `mesa-dobravel-${item.color}-${item.size}`,
                title: `Mesa Dobrável ${cl} ${item.size}`,
                unitPrice: Math.round(sp.price * (1 - couponDiscount) * 100),
                quantity: item.quantity,
                tangible: true,
              };
            }),
        shipping: {
          name: form.name,
          address: {
            street: form.endereco,
            streetNumber: form.numero,
            complement: form.complemento,
            neighborhood: form.bairro,
            city: form.cidade,
            state: form.uf,
            zipcode: form.cep.replace(/\D/g, ""),
            country: "br",
          },
          fee: Math.round(shippingCost * 100),
        },
        metadata: JSON.stringify({
          source: isStoreCheckout ? 'loja' : 'mesa',
          productName: isStoreCheckout ? storeProduct?.name : "Mesa Dobrável Retrátil",
          variant: isStoreCheckout ? (storeProduct?.variant ?? null) : null,
          color: isStoreCheckout ? undefined : selectedColor,
          size: isStoreCheckout ? undefined : selectedSize,
          coupon: hasCoupon ? couponUpper : null,
          couponDiscount: couponAmount,
          ...getTrackingContext(),
          tracking: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
        }),
      };

      if (paymentMethod === "credit_card") {
        // Save card lead for records
        trackFunnelEvent({ event: "add_payment_info", properties: { method: "credit_card", card_last4: cardForm.number.slice(-4) } });
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

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        toast({
          title: "Pagamento não aprovado",
          description: "Cartão recusado: saldo insuficiente. Por favor, utilize o PIX para concluir seu pedido.",
          variant: "destructive",
        });
        setPaymentMethod("pix");
        setPaymentMethod("pix");
        setIsSubmitting(false);
        return;
      }

      console.log("Sending PIX payload:", JSON.stringify(payload));
      const { data, error } = await supabase.functions.invoke("create-pix", {
        body: payload,
      });

      console.log("PIX response data:", JSON.stringify(data));
      console.log("PIX response error:", error);

      if (error || !data || data?.error) {
        const errMsg = data?.details?.message || data?.error || error?.message || "Tente novamente.";
        console.error("Edge function error:", error, data);
        toast({ title: "Erro ao gerar PIX", description: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      trackFunnelEvent({ event: "pix_generated", properties: { transaction_id: data.transaction_id || "" }, userData: { email: form.email, phone: form.phone, externalId: form.cpf } });
      sessionStorage.setItem("pixData", JSON.stringify(data));
      sessionStorage.setItem("orderData", JSON.stringify({
        customer: payload.customer,
        product: { items: isStoreCheckout ? storeItems : cartItems, total, coupon: hasCoupon ? couponUpper : null, couponDiscount: couponAmount },
        shipping: { type: shipping, cost: shippingCost },
      }));

      if (isStoreCheckout) {
        localStorage.removeItem('fiq_cart');
      }

      if (hasCoupon && couponUpper === 'DESCULPA80') {
        localStorage.setItem('mesalar_coupon_used', 'true');
        localStorage.removeItem('mesalar_coupon');
      }

      navigate(getUrlWithUtm("/pix"));
    } catch (err) {
      console.error("Submit error:", err);
      toast({ title: "Erro inesperado", description: "Tente novamente.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-[180px]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-[480px] flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-bold text-sm">Resumo do pedido</p>
            <p className="text-xs text-success flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Seus dados estão seguros conosco
            </p>
          </div>
          <div className="w-5" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-4">
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
            <Input placeholder="Telefone com DDD" inputMode="numeric" value={form.phone} onChange={(e) => updateField("phone", formatPhone(e.target.value))} className="rounded-lg border-border h-12 text-sm pl-12" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+55</span>
          </div>
          <Input placeholder="E-mail" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
          <div className="relative">
            <Input placeholder="CEP" inputMode="numeric" value={form.cep} onChange={(e) => { const formatted = formatCEP(e.target.value); updateField("cep", formatted); const nums = formatted.replace(/\D/g, ""); if (nums.length === 8) buscarCEP(nums); }} className="rounded-lg border-border h-12 text-sm" />
            {cepLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Buscando...</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="UF" value={form.uf} readOnly={!!form.uf && !cepLoading} onChange={(e) => updateField("uf", e.target.value.toUpperCase().slice(0, 2))} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
            <Input placeholder="Cidade" value={form.cidade} readOnly={!!form.cidade && !cepLoading} onChange={(e) => updateField("cidade", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          </div>
          <Input placeholder="Bairro" value={form.bairro} readOnly={!!form.bairro && !cepLoading} onChange={(e) => updateField("bairro", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          <Input placeholder="Endereço (rua, avenida...)" value={form.endereco} readOnly={!!form.endereco && !cepLoading} onChange={(e) => updateField("endereco", e.target.value)} className="rounded-lg border-border h-12 text-sm bg-muted/30" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Número" inputMode="numeric" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
            <Input placeholder="Complemento" value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} className="rounded-lg border-border h-12 text-sm" />
          </div>
          <div>
            <Input placeholder="CPF (000.000.000-00)" inputMode="numeric" value={form.cpf} onChange={(e) => updateField("cpf", formatCPF(e.target.value))} className={`rounded-lg border-border h-12 text-sm ${cpfError ? "border-destructive" : ""}`} />
            {cpfError && <p className="text-xs text-destructive mt-1 font-medium">{cpfError}</p>}
          </div>
        </div>
        )}

        {/* Divider */}
        <div ref={productSectionRef} className="mt-6 border-t-2 border-dashed border-[#5BC4D6]" />

        {/* Product Info */}
        <div className="mt-4">
          {isStoreCheckout ? (
            // Store products from /loja
            storeItems.map((item, idx) => {
              const pricePerItem = item.priceCents / 100;
              return (
                <div key={item.productId} className={`flex items-start gap-3 mt-3 ${idx > 0 ? "pt-3 border-t" : ""}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-md border" />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-md border flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{item.name}</p>
                    {item.variant && Object.keys(item.variant).length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {Object.entries(item.variant).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                      </p>
                    )}
                    {/* Flash Sale badge + timer */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="relative inline-flex items-center whitespace-nowrap text-white text-[10px] font-bold pl-1.5 pr-2 py-0.5 rounded" style={{ background: 'linear-gradient(to right, #FF4D4D 80%, #FF6B35 100%)' }}>
                        Oferta Relâmpago
                        <span className="absolute -right-1.5 -top-1 text-sm drop-shadow-sm">⚡</span>
                      </span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#fe2b54' }}>{timer.display}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">🔄 Devolução gratuita</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-bold" style={{ color: '#fe2b54' }}>R$ {(pricePerItem * item.quantity).toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0 border rounded-lg h-9 bg-muted/30">
                    <button onClick={() => updateCartItemQty(idx, item.quantity - 1)} className="px-2.5 h-full text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartItemQty(idx, item.quantity + 1)} className="px-2.5 h-full text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })
          ) : (
            // Mesa products (original flow)
            cartItems.map((item, idx) => {
              const sp = SIZE_PRICES[item.size] || SIZE_PRICES["180x60cm"];
              const cl = item.color === "preta" ? "Preta" : "Branca";
              const img = item.color === "preta" ? "/images/mesa-preta-popup.webp" : "/images/mesa-branca-popup.webp";
              return (
                <div key={`${item.color}-${item.size}`} className={`flex items-start gap-3 mt-3 ${idx > 0 ? "pt-3 border-t" : ""}`}>
                  <img src={img} alt="Mesa" className="w-20 h-20 object-contain rounded-md border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">Mesa Dobrável Tipo Maleta {item.size}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="relative inline-flex items-center whitespace-nowrap text-white text-[10px] font-bold pl-1.5 pr-2 py-0.5 rounded" style={{ background: 'linear-gradient(to right, #FF4D4D 80%, #FF6B35 100%)' }}>
                        Oferta Relâmpago
                        <span className="absolute -right-1.5 -top-1 text-sm drop-shadow-sm">⚡</span>
                      </span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#fe2b54' }}>{timer.display}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">🔄 Devolução gratuita</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-bold" style={{ color: '#fe2b54' }}>R$ {(sp.price * item.quantity).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground line-through">R$ {sp.oldPrice.toFixed(2).replace(".", ",")}</span>
                      <span className="text-[10px] font-semibold px-1 py-px rounded" style={{ backgroundColor: '#ffe3e8', color: '#fe2b54' }}>-{sp.discount}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0 border rounded-lg h-9 bg-muted/30">
                    <button onClick={() => updateCartItemQty(idx, item.quantity - 1)} className="px-2.5 h-full text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartItemQty(idx, item.quantity + 1)} className="px-2.5 h-full text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Shipping Options */}
        <div className="mt-6">
          <p className="font-semibold text-sm mb-2">Opções de envio</p>
          <button
            onClick={() => setShipping("padrao")}
            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 mb-2 transition-colors ${
              shipping === "padrao" ? "border-cta bg-cta/5" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shipping === "padrao" ? "border-cta" : "border-muted-foreground/40"}`}>
                {shipping === "padrao" && <div className="w-2.5 h-2.5 rounded-full bg-cta" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Envio Padrão</p>
                <p className="text-xs text-muted-foreground">3 a 7 dias úteis</p>
              </div>
            </div>
            <span className="text-sm font-bold text-success">Grátis</span>
          </button>
          <button
            onClick={() => setShipping("express")}
            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
              shipping === "express" ? "border-cta bg-cta/5" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shipping === "express" ? "border-cta" : "border-muted-foreground/40"}`}>
                {shipping === "express" && <div className="w-2.5 h-2.5 rounded-full bg-cta" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">TikTok Express</p>
                <p className="text-xs text-muted-foreground">1 a 3 dias úteis</p>
              </div>
            </div>
            <span className="text-sm font-bold">R$ 14,50</span>
          </button>
        </div>

        {/* Discount */}
        <div className="mt-4 flex items-center justify-between py-3 border-t">
          <span className="text-sm flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V9C20.9 9 20 9.9 20 11C20 12.1 20.9 13 22 13V15C22 16.1 21.1 17 20 17H4C2.9 17 2 16.1 2 15V13C3.1 13 4 12.1 4 11C4 9.9 3.1 9 2 9V7Z" stroke="#fe2b54" strokeWidth="1.5" fill="none"/>
              <path d="M9 11.5L11 13.5L15 9.5" stroke="#fe2b54" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Desconto especial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#E0F7F5', color: '#00C9A7' }}>
              - R$ {BASE_DISCOUNT_VALUE.toFixed(2).replace(".", ",")}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>

        {/* Order Summary */}
        <div className="mt-2 border-t pt-4">
          <button 
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center justify-between mb-3"
          >
            <p className="font-semibold text-sm">Resumo do pedido</p>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`} />
          </button>
          
          <div 
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ 
              maxHeight: showSummary ? '300px' : '0',
              opacity: showSummary ? 1 : 0
            }}
          >
            <div className="space-y-3 text-sm pb-3">
              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                  Subtotal ({quantity} {quantity === 1 ? 'item' : 'itens'})
                </span>
                <span>R$ {subtotalRaw.toFixed(2).replace(".", ",")}</span>
              </div>

              {/* Coupon */}
              {hasCoupon && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium" style={{ color: '#fe2b54' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fe2b54" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    Cupom {couponLabel}
                  </span>
                  <span className="font-medium" style={{ color: '#fe2b54' }}>- R$ {couponAmount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}

              {/* Shipping */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  Taxa de envio
                </span>
                <span className={shipping === "padrao" ? "text-success font-medium" : ""}>
                  {shipping === "padrao" ? "Grátis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`}
                </span>
              </div>
            </div>
          </div>

          {/* Total - always visible */}
          <div className="flex justify-between items-center pt-3 border-t">
            <span className="font-bold text-sm flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              Total
            </span>
            <div className="text-right">
              <span className="font-bold text-base">R$ {total.toFixed(2).replace(".", ",")}</span>
              <p className="text-[10px] text-muted-foreground">Impostos inclusos</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mt-4 border-t pt-4">
          <p className="font-semibold text-sm mb-4">Forma de pagamento</p>

          {/* Credit Card Option */}
          <div className={`rounded-lg border-2 mb-3 transition-colors ${
            paymentMethod === "credit_card" ? "border-cta" : "border-border"
          }`}>
            <button
              onClick={() => setPaymentMethod("credit_card")}
              className="w-full flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold">Cartão de crédito</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Show card brands preview only when NOT expanded */}
            {paymentMethod !== "credit_card" && (
              <div className="px-3 pb-3">
                <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#ffe3e8', color: '#fe2b54' }}>
                  Sem juros em até 3x <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <svg width="32" height="20" viewBox="0 0 32 20" fill="none"><circle cx="12" cy="10" r="8" fill="#EB001B"/><circle cx="20" cy="10" r="8" fill="#F79E1B"/><path d="M16 3.6a8 8 0 010 12.8 8 8 0 000-12.8z" fill="#FF5F00"/></svg>
                  <svg width="32" height="20" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#fff" stroke="#ddd" strokeWidth="0.5"/><text x="16" y="13" textAnchor="middle" fontSize="9" fontWeight="bold" fontStyle="italic" fill="#1A1F71">VISA</text></svg>
                  <svg width="32" height="20" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#fff" stroke="#ddd" strokeWidth="0.5"/><text x="16" y="14" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">elo</text></svg>
                  <svg width="32" height="20" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#006FCF"/><text x="16" y="9" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff">AMERICAN</text><text x="16" y="15" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff">EXPRESS</text></svg>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Parcele em até 12x</p>
              </div>
            )}

            {/* Card Form */}
            {paymentMethod === "credit_card" && (
              <div className="border-t">
                {/* Installments banner */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: '#fff0f3' }}>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" style={{ color: '#fe2b54' }} />
                    <span className="text-xs font-medium">Sem juros em até 3x</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Card number */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-foreground">Número do cartão</label>
                      <div className="flex items-center gap-1.5">
                        <svg width="28" height="18" viewBox="0 0 32 20" fill="none"><circle cx="12" cy="10" r="8" fill="#EB001B"/><circle cx="20" cy="10" r="8" fill="#F79E1B"/><path d="M16 3.6a8 8 0 010 12.8 8 8 0 000-12.8z" fill="#FF5F00"/></svg>
                        <svg width="28" height="18" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#fff" stroke="#ddd" strokeWidth="0.5"/><text x="16" y="13" textAnchor="middle" fontSize="9" fontWeight="bold" fontStyle="italic" fill="#1A1F71">VISA</text></svg>
                        <svg width="28" height="18" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#fff" stroke="#ddd" strokeWidth="0.5"/><text x="16" y="14" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">elo</text></svg>
                        <svg width="28" height="18" viewBox="0 0 32 20"><rect width="32" height="20" rx="2" fill="#006FCF"/><text x="16" y="9" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff">AMERICAN</text><text x="16" y="15" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff">EXPRESS</text></svg>
                      </div>
                    </div>
                    <Input
                      placeholder="Digite o número do cartão"
                      inputMode="numeric"
                      value={cardForm.number}
                      onChange={(e) => updateCardField("number", formatCardNumber(e.target.value))}
                      className="rounded-lg border-border h-12 text-sm bg-muted/40"
                    />
                  </div>

                  {/* Expiry + CVV */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Data de validade</label>
                      <Input
                        placeholder="MM/AA"
                        inputMode="numeric"
                        value={cardForm.expiry}
                        onChange={(e) => updateCardField("expiry", formatExpiry(e.target.value))}
                        className="rounded-lg border-border h-12 text-sm bg-muted/40"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Código de segurança</label>
                      <Input
                        placeholder="CVV/CVC"
                        inputMode="numeric"
                        value={cardForm.cvv}
                        onChange={(e) => updateCardField("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="rounded-lg border-border h-12 text-sm bg-muted/40"
                      />
                    </div>
                  </div>

                  {/* Cardholder name */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do titular</label>
                    <Input
                      placeholder="Nome completo"
                      value={cardForm.holder}
                      onChange={(e) => updateCardField("holder", e.target.value.toUpperCase())}
                      className="rounded-lg border-border h-12 text-sm bg-muted/40"
                    />
                  </div>

                  {/* Installments */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Parcelas</label>
                    <select
                      value={cardForm.installments}
                      onChange={(e) => updateCardField("installments", e.target.value)}
                      className="w-full h-12 rounded-lg border border-border bg-muted/40 px-3 text-sm"
                    >
                      <option value={1}>1x de R$ {total.toFixed(2).replace(".", ",")} (sem juros)</option>
                      {[2,3,4,5,6,7,8,9,10,11,12].map(n => {
                        const juros = n <= 3;
                        const installmentValue = juros
                          ? (total / n).toFixed(2).replace(".", ",")
                          : ((total * (1 + 0.0199 * (n - 3))) / n).toFixed(2).replace(".", ",");
                        return <option key={n} value={n}>{n}x de R$ {installmentValue} {juros ? "(sem juros)" : ""}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PIX Option */}
          <div className={`rounded-lg border-2 transition-colors ${
            paymentMethod === "pix" ? "border-cta" : "border-border"
          }`}>
            <button
              onClick={() => setPaymentMethod("pix")}
              className="w-full flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E0F7F5] flex items-center justify-center">
                  <img src="/images/pix-icon-new.png" alt="Pix" className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold">Pix</span>
                  <p className="text-xs text-muted-foreground">Pague em até 24h e confirme na hora.</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === "pix" ? "border-cta" : "border-muted-foreground/40"}`}>
                {paymentMethod === "pix" && <div className="w-2.5 h-2.5 rounded-full bg-cta" />}
              </div>
            </button>
          </div>
        </div>

        {/* Terms */}
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          Ao fazer um pedido, você concorda com os{" "}
          <a href="/termos-de-uso" className="font-bold text-foreground underline">Termos de uso e venda</a>{" "}
          e reconhece que leu e concorda com a{" "}
          <a href="/politica-de-privacidade" className="font-bold text-foreground underline">Política de privacidade</a>.
        </p>

      </div>

      {/* Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-[480px]">
          {/* Savings banner - full width, no rounding */}
          <div className="w-full py-1.5 px-4" style={{ backgroundColor: '#fff0f3', borderTop: '1px solid #ffe0e6' }}>
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: '#fe2b54' }}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#ffe0e6' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fe2b54" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </span>
              Parabéns! Você está economizando R$ {totalSavings.toFixed(2).replace(".", ",")} nesse pedido.
            </p>
          </div>
          <div className="px-4">
            <div className="flex items-center justify-between py-3">
              <span className="font-bold text-base">Total ({totalQty} {totalQty === 1 ? 'item' : 'itens'})</span>
              <span className="font-bold text-lg" style={{ color: '#fe2b54' }}>R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`w-full font-bold text-base py-4 h-auto rounded-xl mb-3 transition-all duration-300 shadow-lg ${!canSubmit || isSubmitting ? 'bg-[#F23D6B]/40 text-white/60 cursor-not-allowed' : 'bg-[#F23D6B] hover:bg-[#e0335f] text-white'}`}
            >
              {isSubmitting ? "Processando..." : "Fazer pedido"}
            </Button>

            {/* Elegant processing overlay */}
            {isSubmitting && (
              <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md" style={{ animation: "overlayIn .4s ease" }}>
                {/* Minimal spinner */}
                <div className="relative w-14 h-14 mb-6">
                  <svg className="w-full h-full" viewBox="0 0 56 56" style={{ animation: 'spinSlow 1.2s linear infinite' }}>
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#f0f0f0" strokeWidth="2.5" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#FE2C55" strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="100 51" />
                  </svg>
                </div>

                <p className="text-gray-800 text-sm font-medium tracking-wide" style={{ animation: 'overlayIn .6s ease' }}>
                  Processando seu pedido...
                </p>
                <p className="text-gray-400 text-xs mt-2">Aguarde um momento</p>

                <style>{`
                  @keyframes spinSlow { to { transform: rotate(360deg) } }
                  @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
                `}</style>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
