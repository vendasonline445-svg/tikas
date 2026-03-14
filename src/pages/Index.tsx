import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { trackFunnelEvent } from "@/lib/tracking-hub";
import { getUrlWithUtm } from "@/utils/utm";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, trackPageViewOnce } from "@/utils/track-event";
import {
  Star, ChevronLeft, ChevronRight, ShoppingCart, Check,
  Truck, Shield, Package, Clock, Zap, CheckCircle2, X,
  Store, MessageCircle, Share2, MoreHorizontal, Gift, Copy, Camera, MapPin,
  CreditCard, Tag, ShieldCheck, Ticket, Flag, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const PRODUCT_ID = "mesa-dobravel";

const SIZE_PRICES: Record<string, { price: number; oldPrice: number; discount: number }> = {
  "120x60cm": { price: 69.90, oldPrice: 159.90, discount: 56 },
  "150x60cm": { price: 79.90, oldPrice: 179.90, discount: 55 },
  "180x60cm": { price: 87.60, oldPrice: 199.90, discount: 56 },
  "240x60cm": { price: 109.90, oldPrice: 249.90, discount: 56 },
};

const productImages = [
  "/images/mesa-branca-principal.webp",
  "/images/mesa-preta-principal.webp",
  "/images/desc-tamanho.webp",
  "/images/desc-superficie3d.webp",
  "/images/desc-portatil.webp",
  "/images/desc-espaco.webp",
  "/images/desc-transporte.webp",
];

const colorImages = {
  branca: "/images/mesa-branca-popup.webp",
  preta: "/images/mesa-preta-popup.webp",
};

const sizes = ["120x60cm", "150x60cm", "180x60cm", "240x60cm"];

const reviews = [
  {
    name: "Carla S.",
    avatar: "/images/avatar-carla.webp",
    text: "A mesa é bem grande, boa demais! Espaçosa e super prática — montei em segundos e usei para o churrasco com a família toda. Muito resistente, suporta bastante peso sem tremer!",
    rating: 5,
    photos: ["/images/review-carla-1.webp", "/images/review-carla-2.webp"],
  },
  {
    name: "Patrícia F.",
    avatar: "/images/avatar-patricia.webp",
    text: "Ela é muito prática. Material bom, custo muito bom. Amei, pretendo comprar outra!",
    rating: 5,
    photos: ["/images/review-patricia-1.webp", "/images/review-patricia-2.webp"],
  },
  {
    name: "Raquel M.",
    avatar: "/images/avatar-raquel.webp",
    text: "Ela é linda, bem resistente. Me surpreendi com a qualidade, vou usar muito! Chegou no dia certinho.",
    rating: 5,
    photos: ["/images/review-raquel-1.webp", "/images/review-raquel-2.webp", "/images/review-raquel-3.webp"],
  },
  {
    name: "Karine Porto",
    avatar: "/images/avatar-karine.webp",
    text: "Muito boa, bem reforçada. Veio bem embalada na caixa, sem avarias. Gostei muito da mesa!",
    rating: 5,
    photos: ["/images/review-karine-1.webp", "/images/review-karine-2.webp", "/images/review-karine-3.webp"],
  },
  {
    name: "Juliana P.",
    avatar: "/images/avatar-juliana.webp",
    text: "Adorei a minha compra! Chegou no prazo, veio bem embalada. A mesa é linda e muito resistente. Ideal para quem tem pouco espaço, ela é bem fácil para montar. Gosteiii muitoooooo! 😍",
    rating: 5,
    photos: ["/images/review-juliana-1.webp", "/images/review-juliana-2.webp"],
  },
];

const faqs = [
  { q: "Qual o peso que a mesa suporta?", a: "A mesa suporta até 100kg de peso distribuído sobre o tampo, com total segurança e estabilidade." },
  { q: "De que material é feita?", a: "Tampo em HDPE (plástico de alta densidade) e estrutura em aço tubular com pintura epóxi anticorrosiva." },
  { q: "Como funciona o sistema de maleta?", a: "A mesa dobra ao meio e possui uma alça ergonômica, transformando-se em uma maleta compacta fácil de transportar." },
  { q: "Posso usar ao ar livre na chuva?", a: "Sim! O material HDPE é resistente a sol, chuva e umidade. A estrutura possui pintura anticorrosiva." },
  { q: "Qual o prazo de entrega?", a: "Receba em 5 a 8 dias úteis após confirmação do pagamento. Pedidos até 14h são despachados no mesmo dia." },
  { q: "Tem garantia?", a: "Sim! 1 ano de garantia contra defeitos de fabricação." },
];

function useCountdown() {
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
  return time;
}

const fmt = (n: number) => String(n).padStart(2, "0");

function getSectionAtScroll(scrollTop: number): string {
  const docHeight = document.documentElement.scrollHeight;
  const pct = (scrollTop / docHeight) * 100;
  if (pct < 10) return "hero";
  if (pct < 25) return "galeria";
  if (pct < 40) return "detalhes";
  if (pct < 55) return "descricao";
  if (pct < 70) return "avaliacoes";
  if (pct < 85) return "faq";
  return "rodape";
}

const Index = () => {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const swiping = useRef(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("180x60cm");
  const currentSizeData = SIZE_PRICES[selectedSize] || SIZE_PRICES["180x60cm"];
  const PRICE = currentSizeData.price;
  const OLD_PRICE = currentSizeData.oldPrice;
  const DISCOUNT = currentSizeData.discount;
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [colorModalClosing, setColorModalClosing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorModalMode, setColorModalMode] = useState<'cart' | 'buy'>('cart');
  const [modalQty, setModalQty] = useState(1);
  const [flyingDot, setFlyingDot] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exit2Open, setExit2Open] = useState(false);
  const [exitShown, setExitShown] = useState(false);
  const [exit2Shown, setExit2Shown] = useState(false);
  const [couponCopied, setCouponCopied] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [reviewZoomOpen, setReviewZoomOpen] = useState(false);
  const [reviewZoomPhotos, setReviewZoomPhotos] = useState<string[]>([]);
  const [reviewZoomIndex, setReviewZoomIndex] = useState(0);
  const [videoZoomOpen, setVideoZoomOpen] = useState(false);
  const [videoZoomSrc, setVideoZoomSrc] = useState("");
  const videoScrollRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareClosing, setShareClosing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [reportStep, setReportStep] = useState<'menu' | 'reasons' | 'form' | 'done'>('menu');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [cartClosing, setCartClosing] = useState(false);
  const [cartItems, setCartItems] = useState<{color: string; size: string; quantity: number}[]>(() => {
    try {
      const saved = localStorage.getItem('mesalar_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch { return []; }
  });

  const saveCart = (items: {color: string; size: string; quantity: number}[]) => {
    setCartItems(items);
    if (items.length) localStorage.setItem('mesalar_cart', JSON.stringify(items));
    else localStorage.removeItem('mesalar_cart');
  };

  const addToCart = (color: string, size: string, qty: number) => {
    const existing = cartItems.findIndex(i => i.color === color && i.size === size);
    if (existing >= 0) {
      const updated = [...cartItems];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + qty };
      saveCart(updated);
    } else {
      saveCart([...cartItems, { color, size, quantity: qty }]);
    }
  };

  const updateCartItem = (index: number, qty: number) => {
    if (qty <= 0) {
      saveCart(cartItems.filter((_, i) => i !== index));
    } else {
      const updated = [...cartItems];
      updated[index] = { ...updated[index], quantity: qty };
      saveCart(updated);
    }
  };

  const cartTotalQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + (SIZE_PRICES[i.size]?.price || PRICE) * i.quantity, 0);

  const closeCart = () => {
    setCartClosing(true);
    setTimeout(() => { setCartOpen(false); setCartClosing(false); }, 300);
  };
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeClosing, setStoreClosing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'bot' | 'user', text: string}[]>([
    { role: 'bot', text: 'Olá! Como posso te ajudar com informações sobre a Mesa Dobrável Mesalar?' }
  ]);
  const [chatTyping, setChatTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatTyping]);

  const closeStore = () => {
    setStoreClosing(true);
    setTimeout(() => { setStoreOpen(false); setStoreClosing(false); }, 300);
  };

  const closeChat = () => {
    setChatClosing(true);
    setTimeout(() => { setChatOpen(false); setChatClosing(false); }, 300);
  };

  const sendChatMessage = async (text: string) => {
    if (!text.trim() || chatTyping) return;
    const userMsg = text.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatTyping(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role === 'bot' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }));
      history.push({ role: 'user', content: userMsg });

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      const data = await resp.json();
      setChatTyping(false);

      if (data.reply) {
        setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'bot', text: data.error || 'Desculpe, não consegui responder. Tente novamente!' }]);
      }
    } catch {
      setChatTyping(false);
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Erro de conexão. Tente novamente!' }]);
    }
  };

  const handleQuickQuestion = (faq: { q: string; a: string }) => {
    sendChatMessage(faq.q);
  };
  const countdown = useCountdown();
  const [belowFoldReady, setBelowFoldReady] = useState(false);

  // Defer below-fold content to speed up first paint
  useEffect(() => {
    const timer = setTimeout(() => setBelowFoldReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ViewContent event on mount + track page view + scroll depth
  useEffect(() => {
    trackFunnelEvent({
      event: "view_content",
      value: PRICE,
      properties: {
        content_type: "product",
        content_id: "mesa-dobravel",
        content_name: "Mesa Dobrável 180x60cm",
        contents: [{ content_id: "mesa-dobravel", quantity: 1 }],
      },
    });
    trackPageViewOnce("/");

    let maxScroll = 0;
    let lastScrollMilestone = 0;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrollTop / docHeight) * 100);
        if (pct > maxScroll) maxScroll = pct;
        // Track scroll milestones at 25%, 50%, 75%, 90%
        const milestones = [25, 50, 75, 90];
        for (const m of milestones) {
          if (pct >= m && lastScrollMilestone < m) {
            lastScrollMilestone = m;
            trackEvent("scroll_milestone", { percent: m, section: getSectionAtScroll(scrollTop) });
          }
        }
      }
    };

    // Track clicks with position and section for heatmap
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const section = target.closest("[data-section]")?.getAttribute("data-section") ||
        getSectionAtScroll(window.scrollY);
      const rect = document.documentElement;
      const xPct = Math.round((e.clientX / rect.clientWidth) * 100);
      const yPct = Math.round(((e.pageY) / rect.scrollHeight) * 100);
      const elementTag = target.tagName.toLowerCase();
      const elementText = (target.textContent || "").slice(0, 50).trim();
      trackEvent("click_position", {
        x: xPct, y: yPct,
        section,
        element: elementTag,
        element_text: elementText,
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClick);
      if (maxScroll > 0) trackEvent("scroll_depth", { percent: maxScroll });
    };
  }, []);

  // Lock body scroll when modals are open
  useEffect(() => {
    const anyOpen = storeOpen || chatOpen || exitModalOpen || exit2Open || colorModalOpen || cartOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [storeOpen, chatOpen, exitModalOpen, exit2Open, colorModalOpen, cartOpen]);

  useEffect(() => {
    if (exitShown) return; // Stop intercepting once popup was shown

    // Desktop: detect mouse leaving viewport from the top (exit intent)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && e.relatedTarget === null) {
        setExitModalOpen(true);
        setExitShown(true);
      }
    };

    // Back button detection — wait before registering to avoid false triggers
    let popstateReady = false;
    const popstateReadyTimer = setTimeout(() => {
      popstateReady = true;
    }, 2000);

    const handlePopState = () => {
      if (!popstateReady) {
        window.history.pushState(null, "", window.location.href);
        return;
      }
      window.history.pushState(null, "", window.location.href);
      setExitModalOpen(true);
      setExitShown(true);
    };

    window.history.pushState(null, "", window.location.href);

    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("popstate", handlePopState);
      clearTimeout(popstateReadyTimer);
    };
  }, [exitShown]);

  const openColorModal = (mode: 'cart' | 'buy') => {
    setSelectedColor(null);
    setModalQty(1);
    setColorModalMode(mode);
    setColorModalOpen(true);
    trackFunnelEvent({
      event: "add_to_cart",
      value: PRICE,
      properties: {
        content_type: "product",
        content_id: "mesa-dobravel",
        content_name: "Mesa Dobrável 180x60cm",
        contents: [{ content_id: "mesa-dobravel", quantity: 1 }],
      },
    });
  };

  const closeColorModal = () => {
    setColorModalClosing(true);
    setTimeout(() => { setColorModalOpen(false); setColorModalClosing(false); }, 300);
  };

  const nav = useNavigate();

  const handleColorConfirm = () => {
    if (!selectedColor) return;

    if (colorModalMode === 'buy') {
      // Save as single-item cart for checkout
      saveCart([{ color: selectedColor, size: selectedSize, quantity: modalQty }]);
      const params = new URLSearchParams(window.location.search);
      nav(getUrlWithUtm(`/checkout?${params.toString()}`));
    } else {
      addToCart(selectedColor, selectedSize, modalQty);
      closeColorModal();
      setTimeout(() => {
        setFlyingDot(true);
        setTimeout(() => setFlyingDot(false), 800);
      }, 350);
    }
  };

  const handleBuyNow = () => {
    trackFunnelEvent({ event: "click_buy" });
    if (cartItems.length > 0) {
      nav(getUrlWithUtm(`/checkout`));
    } else {
      openColorModal('buy');
    }
  };

  const handleCartCheckout = () => {
    if (cartItems.length === 0) return;
    nav(getUrlWithUtm(`/checkout`));
  };

  const copyCoupon = () => {
    navigator.clipboard.writeText("VOLTA25");
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2000);
  };

  const nextImage = () => setCurrentImage((p) => (p + 1) % productImages.length);
  const prevImage = () => setCurrentImage((p) => (p - 1 + productImages.length) % productImages.length);

  return (
    <div className="min-h-screen bg-white pb-[72px]">
      {/* Flying dot animation */}
      {flyingDot && (
        <div className="fixed z-[100] pointer-events-none" style={{
          animation: 'flyToCart 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          left: '50%',
          bottom: '80px',
        }}>
          <div className="h-4 w-4 rounded-full bg-cta shadow-lg" />
        </div>
      )}
      <style>{`
        @keyframes flyToCart {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          40% { transform: translate(20vw, -40vh) scale(1.3); opacity: 1; }
          100% { transform: translate(35vw, -90vh) scale(0.3); opacity: 0; }
        }
      `}</style>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto max-w-[480px] flex items-center justify-between px-4 py-3">
          <X className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={() => { setExitModalOpen(true); setExitShown(true); }} />
          <div className="flex items-center gap-5">
            <Share2 className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={() => setShareOpen(true)} />
            <div className="relative cursor-pointer" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              {cartTotalQty > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-cta text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">{cartTotalQty}</span>
              )}
            </div>
            <MoreHorizontal className="h-5 w-5 text-muted-foreground cursor-pointer" onClick={() => { setReportStep('menu'); setReportMenuOpen(true); }} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[480px]">
        {/* Product Gallery */}
        <section className="bg-card">
          <div
            className="relative aspect-[4/3] sm:aspect-[4/3] overflow-hidden bg-card cursor-pointer"
            onClick={() => { if (!swiping.current) { trackEvent("click_product_image"); setZoomOpen(true); } }}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; swiping.current = false; }}
            onTouchMove={(e) => {
              const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
              const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
              if (dx > dy && dx > 10) { swiping.current = true; e.preventDefault(); }
              touchEndX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const diff = touchStartX.current - touchEndX.current;
              if (swiping.current && Math.abs(diff) > 50) {
                e.preventDefault();
                if (diff > 0) nextImage();
                else prevImage();
              }
            }}
          >
            <img
              src={productImages[currentImage]}
              alt="Mesa dobrável"
              className="h-full w-full object-contain transition-opacity duration-300"
            />
            <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-sm" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5 text-foreground/70" />
            </button>
            <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-sm" aria-label="Próxima">
              <ChevronRight className="h-5 w-5 text-foreground/70" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-medium text-card">
              {currentImage + 1}/{productImages.length}
            </span>
          </div>
          {/* Thumbnails */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {productImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded border-2 transition-all ${
                  i === currentImage ? "border-cta" : "border-transparent"
                }`}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        {/* Price Banner */}
        <section className="bg-gradient-to-r from-primary to-[hsl(25,80%,55%)] px-4 py-5 text-primary-foreground relative">
          <div className="flex items-end gap-2">
            <span className="text-xl font-black leading-none">R$ {PRICE.toFixed(2).replace(".", ",")}</span>
            <span className="text-xs line-through opacity-60">R$ {OLD_PRICE.toFixed(2).replace(".", ",")}</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-extrabold text-cta">-{DISCOUNT}%</span>
          </div>
          <div className="absolute bottom-2 right-4 text-right">
            <div className="flex items-center gap-1 justify-end mb-2">
              <Zap className="h-3 w-3 fill-primary-foreground" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">Oferta Relâmpago</span>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[10px] font-semibold opacity-80">Termina em:</span>
              <div className="flex items-center gap-0.5">
                {[countdown.h, countdown.m, countdown.s].map((v, i) => (
                  <span key={i} className="flex items-center">
                    {i > 0 && <span className="mx-0.5 text-[10px] font-bold">:</span>}
                    <span className="rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] font-mono font-bold">{fmt(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="px-4">
          {/* Installments */}
          <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>6x de <strong>R$ 18,57</strong> sem juros no cartão</span>
          </div>

          {/* Coupon badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-badge-green px-3 py-1 text-xs font-semibold text-badge-green-foreground">
            <Tag className="h-3.5 w-3.5" />
            Cupom Aplicado
          </div>

          {/* Title */}
          <h1
            className="mt-4 text-base font-bold leading-snug text-foreground cursor-pointer active:opacity-70"
            onClick={() => document.getElementById("buy-bar")?.scrollIntoView({ behavior: "smooth" })}
          >
            Mesa Dobrável Tipo Maleta Prática e Durável 180x60cm — Portátil, Resistente, Fácil de Montar e Guardar
          </h1>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-bold">4.8</span>
            <span className="text-muted-foreground">(207)</span>
            <span className="text-muted-foreground mx-0.5">•</span>
            <span className="text-muted-foreground">4.473 vendidos</span>
          </div>
          <p className="mt-1 text-xs font-medium text-cta">1.2K+ pessoas compraram nos últimos 3 dias</p>

          {/* Shipping */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border p-3">
            <span className="rounded bg-badge-green px-2.5 py-1 text-xs font-bold text-badge-green-foreground flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Frete grátis
            </span>
            <div className="text-sm">
              <span>Receba em <strong>5 - 8 dias úteis</strong></span>
              <div className="text-xs text-muted-foreground">
                Taxa de envio: <span className="line-through">R$ 29,90</span>{" "}
                <span className="font-semibold text-success">Grátis</span>
              </div>
            </div>
          </div>

          {/* Customer Protection */}
          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-sm">Proteção do cliente</span>
              </div>
              <span className="text-xs font-bold text-success">100% Protegido</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span>Devolução gratuita em até 7 dias</span>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <span>Reembolso automático por danos</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
                <span>Pagamento seguro e criptografado</span>
              </div>
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span>Cupom por atraso na entrega</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-success/10 p-3 text-center">
              <p className="text-xs text-foreground/80">
                Sua compra é <strong className="text-success">100% protegida</strong>. Garantimos devolução do valor integral caso o produto não corresponda à descrição.
              </p>
            </div>
          </div>
        </div>

        {/* Gray Divider */}
        <div className="mt-4 h-2 bg-muted/60" />

        <div className="px-4">
          {/* Size Selection */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Tamanho</p>
              <span className="text-muted-foreground text-sm">23 disponíveis</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                      selectedSize === s
                      ? "border-cta bg-cta/5 text-cta"
                      : "border-border text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gray Divider */}
        <div className="mt-4 h-2 bg-muted/60" />

        {belowFoldReady ? (<>

        {/* Video Carousel Section */}
        <div className="px-4 mt-4">
          <h2 className="text-base font-bold mb-3">Vídeos do Produto</h2>
          <div
            ref={videoScrollRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {["/videos/video-0.mp4", "/videos/video-3.mp4", "/videos/video-2.mp4", "/videos/video-1.mp4"].map((src, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[45vw] max-w-[200px] snap-start cursor-pointer relative rounded-xl overflow-hidden bg-muted aspect-[9/16] active:scale-95 transition-transform"
                onClick={() => { setVideoZoomSrc(src); setVideoZoomOpen(true); }}
              >
                <video
                  src={`${src}#t=0.1`}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <svg className="w-5 h-5 text-foreground ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gray Divider */}
        <div className="mt-4 h-2 bg-muted/60" />

        <div className="px-4">
          {/* Reviews */}
          <section className="mt-4">
            <h2 className="text-base font-bold mb-1">Avaliações dos clientes (207)</h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-black">4.8</span>
              <span className="text-muted-foreground text-sm">/5</span>
              <div className="flex gap-0.5 ml-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>

            <div className="divide-y">
              {reviews.map((r, idx) => (
                <div key={idx} className="py-5 first:pt-0">
                  <div className="flex items-center gap-3 mb-2">
                    <img src={r.avatar} alt={r.name} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                    <span className="font-semibold text-sm">{r.name}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{r.text}</p>
                  {r.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {r.photos.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={`Foto ${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                          loading="lazy"
                          onClick={() => { setReviewZoomPhotos(r.photos); setReviewZoomIndex(i); setReviewZoomOpen(true); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Review Filters */}
            <div className="flex items-center gap-4 pt-4 border-t text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Inclui imagens (52)</span>
              <span className="flex items-center gap-1">5 <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> (155)</span>
              <span className="flex items-center gap-1">4 <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> (22)</span>
            </div>
          </section>

          {/* Store Info */}
          <section className="mt-6 border-y py-5">
            <div className="flex items-center gap-3">
              <img src="/images/logo-mesalar.webp" alt="MesaLar" className="h-10 w-10 rounded-lg object-contain" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-badge-green px-2 py-0.5 text-[10px] font-semibold text-badge-green-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Loja Verificada
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">• 706 produtos • 100% recomenda</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Confiança:</span>
              <div className="h-3 flex-1 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, hsl(0, 80%, 50%) 0%, hsl(25, 90%, 50%) 50%, hsl(40, 90%, 50%) 100%)' }}>
              </div>
              <span className="font-bold text-success">100%</span>
            </div>
          </section>

          {/* Product Description */}
          <section className="mt-6">
            <h2 className="text-base font-bold mb-3">Descrição do produto</h2>
            <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
              <p>
                A <strong>Mesa Dobrável Tipo Maleta 180x60cm da MesaLar</strong> é 2 em 1: Mesa de apoio com a portabilidade de uma maleta. Você pode montar, usar e guardar em segundos, sem nenhuma ferramenta! A capacidade total de 180cm permite acomodar até 8 pessoas confortavelmente.
              </p>
              <img src="/images/desc-maleta.webp" alt="Mesa dobrável tipo maleta" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ LEVE E PORTÁTIL:</strong> Design compacto tipo maleta com alça embutida. Fecha como uma mala e cabe em qualquer canto. Leve para camping, festas, feiras ou simplesmente guarde em casa sem ocupar espaço.</p>
              <img src="/images/desc-montagem.webp" alt="Monte em apenas 6 passos" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ MONTAGEM INSTANTÂNEA:</strong> Monte e desmonte em menos de 30 segundos, sem ferramentas! São apenas 6 passos simples — qualquer pessoa consegue montar sozinha, sem esforço.</p>
              <img src="/images/desc-qualidade.webp" alt="Detalhes de qualidade" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ CONSTRUÇÃO REFORÇADA:</strong> Alça de transporte ergonômica, trava de segurança que impede dobramentos acidentais e tampo em HDPE com espessura larga. Material profissional que dura anos.</p>
              <img src="/images/desc-pes.webp" alt="Pés antiderrapantes" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ PÉS ANTIDERRAPANTES:</strong> Borrachas nos pés que protegem seu piso contra riscos e garantem estabilidade total. A mesa não escorrega nem se move durante o uso, mesmo em superfícies lisas.</p>
              <img src="/images/desc-dimensoes.webp" alt="Dimensões e capacidade" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ LEVE E RESISTENTE:</strong> Pesa apenas 11kg mas suporta até 150kg de peso distribuído! Estrutura em aço tubular com pintura anticorrosiva. Acomoda até 8 pessoas com conforto.</p>
              <img src="/images/desc-versatilidade.webp" alt="Versatilidade de ocasiões" className="w-full rounded-xl" loading="lazy" />
              <p><strong>✅ PARA TODAS AS OCASIÕES:</strong> Acampamentos, piqueniques, garagem, festas, cozinha, escritório, bazares, churrascos — essa mesa se adapta a qualquer situação. Use dentro ou fora de casa com a mesma praticidade e resistência.</p>
            </div>
          </section>

          {/* Specs */}
          <section className="mt-6">
            <h2 className="text-base font-bold mb-3">Especificações Técnicas:</h2>
            <ul className="space-y-1.5 text-sm text-foreground/90 list-disc pl-5">
              <li><strong>Dimensões aberta:</strong> 180 x 60 x 74 cm</li>
              <li><strong>Dimensões fechada:</strong> 90 x 60 x 9 cm</li>
              <li><strong>Peso:</strong> aproximadamente 8 kg</li>
              <li><strong>Material do tampo:</strong> HDPE (plástico de alta densidade)</li>
              <li><strong>Estrutura:</strong> Aço tubular com pintura epóxi anticorrosiva</li>
              <li><strong>Capacidade:</strong> suporta até 100 kg</li>
              <li><strong>Cor:</strong> Branco / Cinza Escuro</li>
              <li><strong>Pés:</strong> Antiderrapantes em borracha</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">
              <strong>GARANTIA DE 1 ANO:</strong> A MesaLar é a escolha de milhares de consumidores. Com mais de 4.000 unidades vendidas e nota 4.8 de satisfação, a MesaLar é sinônimo de qualidade e confiança. MesaLar, a escolha inteligente!
            </p>
          </section>

          {/* Shipping Details */}
          <section className="mt-6">
            <h2 className="text-base font-bold mb-3">Envio e Entrega</h2>
            <div className="space-y-0">
              {/* Frete Grátis - highlighted */}
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
                <Truck className="h-5 w-5 mt-0.5 flex-shrink-0 text-cta" />
                <div>
                  <p className="font-semibold text-sm">Frete Grátis para todo o Brasil!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Economize <strong>R$ 29,90</strong> no frete — promoção por tempo limitado.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4">
                <Clock className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Prazo de entrega</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Receba em <strong>5 a 8 dias úteis</strong> após confirmação do pagamento. Pedidos feitos até 14h são despachados no mesmo dia.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4">
                <Package className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Rastreamento completo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Acompanhe seu pedido em tempo real pelo código de rastreio enviado por e-mail e WhatsApp logo após o despacho.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4">
                <Shield className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Entrega garantida</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Entrega garantida e segurada pelos Correios®. Em caso de extravio ou dano no transporte, reenviamos o produto ou devolvemos o valor integral sem custo.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold text-muted-foreground mt-0.5 flex-shrink-0">BR</span>
                <p className="text-xs text-muted-foreground">
                  Envio rápido, seguro e com rastreamento para <strong className="text-foreground">todos os estados do Brasil</strong>. Aproveite essa oferta e leve a praticidade da Mesa Dobrável para o seu dia a dia!
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-6 mb-6">
            <h2 className="text-base font-bold mb-3">Perguntas Frequentes</h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-semibold">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Footer */}
          <footer className="mt-8 border-t pt-6 pb-24">
            <div className="text-center text-xs text-muted-foreground">
              <p>© 2025 MesaLar.</p>
              <p className="mt-1">
                <a href="/politica-de-privacidade" className="text-destructive hover:underline">Política de privacidade</a>
                <span className="mx-1">·</span>
                <a href="/termos-de-uso" className="text-destructive hover:underline">Termos de uso</a>
              </p>
            </div>
          </footer>
        </div>
        </>) : <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" /></div>}
      </div>

      {/* Sticky Bottom Bar */}
      <div id="buy-bar" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-2 py-2 flex items-center gap-1.5">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setStoreOpen(true)} className="flex flex-col items-center text-[10px] text-muted-foreground gap-0.5 min-w-[32px]">
            <Store className="h-5 w-5" />
            <span>Loja</span>
          </button>
          <button onClick={() => setChatOpen(true)} className="flex flex-col items-center text-[10px] text-muted-foreground gap-0.5 min-w-[32px]">
            <MessageCircle className="h-5 w-5" />
            <span>Chat</span>
          </button>
        </div>
        <button onClick={() => openColorModal('cart')} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-cta whitespace-nowrap">
          <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0 text-cta" />
          <span className="text-cta font-bold text-[11px]">Adicionar ao carrinho</span>
        </button>
        <Button onClick={handleBuyNow} className="flex-shrink-0 bg-cta text-cta-foreground hover:bg-cta-hover font-bold text-[11px] py-2.5 px-4 h-auto rounded-lg uppercase tracking-wide whitespace-nowrap">
          COMPRAR AGORA
        </Button>
      </div>

      {/* Color Selection Modal - Bottom Sheet */}
      {colorModalOpen && (
        <div className="fixed inset-0 z-[60]" onClick={closeColorModal}>
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${colorModalClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in-0'}`} />
          <div
            className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl transition-transform duration-300 mx-auto sm:max-w-md ${colorModalClosing ? 'translate-y-full' : 'animate-in slide-in-from-bottom'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Close button */}
            <button
              onClick={closeColorModal}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-5 pt-2 pb-3">
              <p className="text-base font-bold">Selecione as opções</p>
            </div>

            {/* Product header */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <img src="/images/mesa-branca-popup.webp" alt="Mesa Dobrável" className="h-16 w-16 rounded-lg object-contain border bg-muted/30 p-1" />
              <div>
                <p className="font-bold text-sm">Mesa Dobrável Portátil Mesalar</p>
                <p className="text-cta font-extrabold text-lg">R$ {PRICE.toFixed(2).replace('.', ',')}</p>
                <p className="text-xs text-muted-foreground line-through">R$ {OLD_PRICE.toFixed(2).replace('.', ',')}</p>
                <span className="inline-block mt-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5">Economize {DISCOUNT}%</span>
              </div>
            </div>

            {/* Color selection */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Cor: {selectedColor === 'preta' ? 'Preta' : selectedColor === 'branca' ? 'Branca' : 'Selecione'}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "branca", name: "Branca", img: colorImages.branca },
                  { id: "preta", name: "Preta", img: colorImages.preta },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`rounded-2xl border-2 overflow-hidden transition-all relative ${
                      selectedColor === color.id
                        ? "border-cta bg-cta/5 shadow-lg"
                        : "border-border hover:border-cta/50"
                    }`}
                  >
                    {selectedColor === color.id && (
                      <div className="absolute top-2 right-2 bg-cta rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="aspect-[4/3] bg-muted/30 p-3">
                      <img src={color.img} alt={color.name} className="h-full w-full object-contain" />
                    </div>
                    <p className="py-2 text-center text-sm font-medium">{color.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size selection in modal */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Tamanho:</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedSize === s
                        ? "border-cta bg-cta/5 text-cta"
                        : "border-border text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity selector */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Quantidade:</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalQty(q => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:border-cta/50 transition-colors"
                >−</button>
                <span className="text-base font-bold w-6 text-center">{modalQty}</span>
                <button
                  onClick={() => setModalQty(q => q + 1)}
                  className="h-9 w-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:border-cta/50 transition-colors"
                >+</button>
                <span className="ml-auto text-cta font-extrabold text-lg">R$ {(PRICE * modalQty).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Confirm button */}
            <div className="px-5 pb-6">
              <button
                onClick={handleColorConfirm}
                disabled={!selectedColor}
                className={`w-full font-bold text-base py-4 rounded-2xl transition-all ${
                  selectedColor
                    ? 'bg-cta text-white hover:bg-cta-hover'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {colorModalMode === 'buy' ? `Comprar agora - R$ ${(PRICE * modalQty).toFixed(2).replace('.', ',')}` : `Adicionar ao carrinho - R$ ${(PRICE * modalQty).toFixed(2).replace('.', ',')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${shareClosing ? 'opacity-0' : 'opacity-100'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            onClick={() => { setShareClosing(true); setTimeout(() => { setShareOpen(false); setShareClosing(false); }, 300); }}
          />
          <div
            className={`relative w-full max-w-md bg-background rounded-t-2xl transition-transform duration-300 ease-out ${shareClosing ? 'translate-y-full' : 'translate-y-0'}`}
            style={{ animation: shareClosing ? undefined : 'slideUpShare 0.3s ease-out' }}
          >
            <style>{`@keyframes slideUpShare { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-8 h-[3px] rounded-full bg-border/60" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="w-5" />
              <p className="text-[13px] font-medium text-foreground">Enviar para</p>
              <button onClick={() => { setShareClosing(true); setTimeout(() => { setShareOpen(false); setShareClosing(false); }, 300); }} className="p-0.5">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-start justify-evenly px-3 pb-5 pt-1">
              {[
                { name: "Copiar\nlink", icon: <Link className="h-4 w-4 text-white" />, bg: "bg-muted-foreground", action: () => { navigator.clipboard.writeText(window.location.href); setCouponCopied(true); setTimeout(() => setCouponCopied(false), 2000); } },
                { name: "WhatsApp", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.126 1.526 5.86L0 24l6.335-1.652A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.006 0-3.885-.588-5.47-1.597l-.393-.237-3.762.982.999-3.648-.26-.414A9.72 9.72 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/></svg>, bg: "bg-[#25D366]", action: () => window.open(`https://wa.me/?text=${encodeURIComponent('Olha essa mesa dobrável incrível! ' + window.location.href)}`, '_blank') },
                { name: "Instagram\nDirect", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>, bg: "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]", action: () => window.open(`https://www.instagram.com/`, '_blank') },
                { name: "Facebook", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>, bg: "bg-[#1877F2]", action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank') },
                { name: "SMS", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>, bg: "bg-[#34B7F1]", action: () => window.open(`sms:?body=${encodeURIComponent('Olha essa mesa dobrável incrível! ' + window.location.href)}`) },
                { name: "Telegram", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>, bg: "bg-[#0088cc]", action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Olha essa mesa dobrável incrível!')}`, '_blank') },
              ].map((item) => (
                <button key={item.name} onClick={() => { item.action(); }} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div className={`h-10 w-10 rounded-full ${item.bg} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <span className="text-[9px] text-muted-foreground text-center leading-tight whitespace-pre-line">{item.name}</span>
                </button>
              ))}
            </div>
            {couponCopied && <p className="text-center text-[10px] text-cta font-medium pb-2 -mt-2">Link copiado!</p>}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportMenuOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReportMenuOpen(false)} />
          <div className="relative w-full max-w-lg bg-background rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              {(reportStep === 'form') && (
                <button onClick={() => setReportStep('reasons')} className="p-1">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {reportStep === 'reasons' && (
                <button onClick={() => setReportStep('menu')} className="p-1">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {(reportStep === 'menu' || reportStep === 'done') && <div className="w-7" />}
              <h3 className="font-bold text-base flex-1 text-center">Report</h3>
              <button onClick={() => setReportMenuOpen(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step: Menu */}
            {reportStep === 'menu' && (
              <div className="p-5">
                <button
                  onClick={() => setReportStep('reasons')}
                  className="flex items-center gap-3 w-full py-3 text-left"
                >
                  <Flag className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Report</span>
                </button>
              </div>
            )}

            {/* Step: Reasons */}
            {reportStep === 'reasons' && (
              <div className="flex-1 overflow-y-auto">
                <p className="px-5 pt-4 pb-2 text-xs text-muted-foreground font-medium">Selecione um motivo</p>
                {[
                  "Produto perigoso ou inseguro",
                  "Itens tóxicos ou inflamáveis",
                  "Conteúdo discriminatório ou ofensivo",
                  "Produtos ilegais",
                  "Produtos adultos",
                  "Violação de propriedade intelectual",
                  "Informações imprecisas do produto",
                  "Golpe ou fraude",
                  "Possível produto falsificado",
                  "Segurança de menores",
                  "Outro",
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => { setReportReason(reason); setReportStep('form'); }}
                    className="flex items-center justify-between w-full px-5 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm">{reason}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Step: Form */}
            {reportStep === 'form' && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="px-5 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs text-muted-foreground">Motivo: {reportReason}</p>
                </div>
                <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
                  <img src="/images/mesa-branca-principal.webp" alt="Produto" className="h-14 w-14 rounded-lg object-contain border bg-muted/30 p-1" />
                  <div>
                    <p className="text-sm font-medium line-clamp-1">Mesa Dobrável Portátil Mesalar</p>
                    <p className="text-xs text-muted-foreground">Mesalar-BR</p>
                  </div>
                </div>
                <div className="px-5 py-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">Descrição (Opcional):</p>
                    <p className="text-xs text-muted-foreground">{reportDescription.length}/300</p>
                  </div>
                  <textarea
                    maxLength={300}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Compartilhe mais detalhes sobre o problema"
                    className="w-full h-24 border border-border rounded-lg p-3 text-sm resize-none bg-background focus:outline-none focus:ring-1 focus:ring-cta placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    Se você sabe que alguém está em perigo imediato, entre em contato com as autoridades locais imediatamente.
                  </p>
                </div>
                <div className="px-5 pb-6 pt-2">
                  <button
                    onClick={() => { setReportStep('done'); setReportDescription(''); localStorage.setItem('mesalar_coupon', 'DESCULPA80'); }}
                    className="w-full py-3.5 rounded-xl bg-cta text-white font-bold text-sm hover:bg-cta-hover transition-colors"
                  >
                    Reportar
                  </button>
                </div>
              </div>
            )}

            {/* Step: Done */}
            {reportStep === 'done' && (
              <div className="flex-1 flex flex-col items-center px-5 py-10">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-cta" />
                </div>
                <h4 className="font-bold text-base mb-2">Obrigado por reportar</h4>
                <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
                  Analisaremos seu report e tomaremos as medidas necessárias caso haja uma violação das diretrizes.
                </p>

                {/* Coupon */}
                <div className="w-full rounded-2xl border-2 border-dashed border-cta/40 bg-cta/5 p-5 text-center mb-6">
                  <p className="text-xs text-muted-foreground mb-1">Como pedido de desculpas, aqui vai um cupom especial:</p>
                  <p className="text-2xl font-extrabold text-cta tracking-wider my-2">DESCULPA80</p>
                  <p className="text-sm font-semibold text-cta">80% OFF na sua próxima compra</p>
                  <button
                    onClick={() => { localStorage.setItem('mesalar_coupon', 'DESCULPA80'); navigator.clipboard.writeText('DESCULPA80'); setCouponCopied(true); setTimeout(() => setCouponCopied(false), 2000); }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cta hover:underline"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {couponCopied ? 'Copiado!' : 'Copiar cupom'}
                  </button>
                </div>

                <div className="w-full mt-auto pt-4 pb-2">
                  <button
                    onClick={() => setReportMenuOpen(false)}
                    className="w-full py-3.5 rounded-xl bg-cta text-white font-bold text-sm hover:bg-cta-hover transition-colors"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
          <DialogDescription className="sr-only">Imagem ampliada do produto</DialogDescription>
          <DialogTitle className="sr-only">Imagem do produto</DialogTitle>
          <button onClick={() => setZoomOpen(false)} className="absolute top-3 right-3 z-50 h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <X className="h-6 w-6 text-white" />
          </button>
          <div
            className="relative"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; swiping.current = false; }}
            onTouchMove={(e) => {
              const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
              const dy = e.touches[0].clientY - touchStartY.current;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) { swiping.current = true; e.preventDefault(); }
              touchEndX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const diffX = touchStartX.current - touchEndX.current;
              const diffY = e.changedTouches[0].clientY - touchStartY.current;
              if (diffY > 100) { setZoomOpen(false); return; }
              if (swiping.current && Math.abs(diffX) > 50) {
                if (diffX > 0) nextImage();
                else prevImage();
              }
            }}
          >
            <img
              src={productImages[currentImage]}
              alt="Mesa dobrável ampliada"
              className="w-full h-auto rounded-lg"
            />
            <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-medium text-white">
              {currentImage + 1}/{productImages.length}
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Zoom Modal */}
      <Dialog open={videoZoomOpen} onOpenChange={(open) => { setVideoZoomOpen(open); if (!open) setVideoZoomSrc(""); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 border-0 bg-black shadow-none outline-none ring-0 [&>button]:hidden">
          <DialogDescription className="sr-only">Vídeo do produto ampliado</DialogDescription>
          <DialogTitle className="sr-only">Vídeo do produto</DialogTitle>
          <button onClick={() => { setVideoZoomOpen(false); setVideoZoomSrc(""); }} className="absolute top-3 right-3 z-50 h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <X className="h-6 w-6 text-white" />
          </button>
          <div
            onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              const diffY = e.changedTouches[0].clientY - touchStartY.current;
              if (diffY > 100) { setVideoZoomOpen(false); setVideoZoomSrc(""); }
            }}
          >
            {videoZoomSrc && (
              <video
                src={videoZoomSrc}
                className="w-full h-auto max-h-[85vh] rounded-lg"
                controls
                autoPlay
                playsInline
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Photo Zoom Modal */}
      <Dialog open={reviewZoomOpen} onOpenChange={setReviewZoomOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
          <DialogDescription className="sr-only">Foto da avaliação ampliada</DialogDescription>
          <DialogTitle className="sr-only">Foto da avaliação</DialogTitle>
          <button onClick={() => setReviewZoomOpen(false)} className="absolute top-3 right-3 z-50 h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <X className="h-6 w-6 text-white" />
          </button>
          <div
            className="relative"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; swiping.current = false; }}
            onTouchMove={(e) => {
              const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
              const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
              if (dx > dy && dx > 10) { swiping.current = true; e.preventDefault(); }
              touchEndX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const diffX = touchStartX.current - touchEndX.current;
              const diffY = e.changedTouches[0].clientY - touchStartY.current;
              if (diffY > 100) { setReviewZoomOpen(false); return; }
              if (swiping.current && Math.abs(diffX) > 50) {
                if (diffX > 0) setReviewZoomIndex((prev) => Math.min(prev + 1, reviewZoomPhotos.length - 1));
                else setReviewZoomIndex((prev) => Math.max(prev - 1, 0));
              }
            }}
          >
            <img
              src={reviewZoomPhotos[reviewZoomIndex]}
              alt="Foto da avaliação ampliada"
              className="w-full h-auto rounded-lg"
            />
            {reviewZoomPhotos.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setReviewZoomIndex((prev) => Math.max(prev - 1, 0)); }} disabled={reviewZoomIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center disabled:opacity-30">
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setReviewZoomIndex((prev) => Math.min(prev + 1, reviewZoomPhotos.length - 1)); }} disabled={reviewZoomIndex === reviewZoomPhotos.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-foreground/30 backdrop-blur-sm flex items-center justify-center disabled:opacity-30">
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              </>
            )}
            <span className="absolute bottom-3 right-3 rounded-full bg-foreground/60 px-2.5 py-1 text-xs font-medium text-white">
              {reviewZoomIndex + 1}/{reviewZoomPhotos.length}
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {exitModalOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => { setExitModalOpen(false); if (!exit2Shown) { setExit2Open(true); setExit2Shown(true); } }}>
          <div className="absolute inset-0 bg-black/60 animate-in fade-in-0" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl transition-transform duration-300 mx-auto sm:max-w-md animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Close button */}
            <button
              onClick={() => { setExitModalOpen(false); if (!exit2Shown) { setExit2Open(true); setExit2Shown(true); } }}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-5 pt-2 pb-3">
              <p className="text-base font-bold">Ei, espera! 🎁</p>
            </div>

            {/* Coupon Box */}
            <div className="mx-5 rounded-lg border-2 border-dashed border-coupon-border bg-coupon-bg p-3 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Cupom de Desconto</p>
              <p className="text-2xl font-black tracking-wider text-destructive mb-0.5">VOLTA25</p>
              <p className="text-xs"><strong>25% OFF</strong> na sua compra</p>
              <p className="text-xs mt-1.5">⏳ Expira em <strong className="text-destructive">{fmt(countdown.m)}:{fmt(countdown.s)}</strong></p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.max(5, ((countdown.m * 60 + countdown.s) / 300) * 100)}%` }} />
              </div>
            </div>

            {/* Product header */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <img
                src={selectedColor === 'preta' ? '/images/mesa-preta-popup.webp' : '/images/mesa-branca-popup.webp'}
                alt="Mesa Dobrável"
                className="h-16 w-16 rounded-lg object-contain border bg-muted/30 p-1"
              />
              <div>
                <p className="font-bold text-sm">Mesa Dobrável Portátil Mesalar</p>
                <p className="text-cta font-extrabold text-lg">R$ {((SIZE_PRICES[selectedSize]?.price ?? 69.90) * 0.75).toFixed(2).replace('.', ',')}</p>
                <p className="text-xs text-muted-foreground line-through">R$ {(SIZE_PRICES[selectedSize]?.price ?? 69.90).toFixed(2).replace('.', ',')}</p>
                <span className="inline-block mt-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5">+25% OFF com cupom</span>
              </div>
            </div>

            {/* Color selection */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Cor: {selectedColor === 'preta' ? 'Preta' : selectedColor === 'branca' ? 'Branca' : 'Selecione'}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "branca", name: "Branca", img: "/images/mesa-branca-popup.webp" },
                  { id: "preta", name: "Preta", img: "/images/mesa-preta-popup.webp" },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`rounded-2xl border-2 overflow-hidden transition-all relative ${
                      selectedColor === color.id
                        ? "border-cta bg-cta/5 shadow-lg"
                        : "border-border hover:border-cta/50"
                    }`}
                  >
                    {selectedColor === color.id && (
                      <div className="absolute top-2 right-2 bg-cta rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="aspect-[4/3] bg-muted/30 p-3">
                      <img src={color.img} alt={color.name} className="h-full w-full object-contain" />
                    </div>
                    <p className="py-2 text-center text-sm font-medium">{color.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size selection */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Tamanho:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(SIZE_PRICES).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedSize === s
                        ? "border-cta bg-cta/5 text-cta"
                        : "border-border text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm button */}
            <div className="px-5 pb-6">
              <button
                onClick={() => {
                  if (selectedColor && selectedSize) {
                    saveCart([{ color: selectedColor, size: selectedSize, quantity: 1 }]);
                    setExitModalOpen(false);
                    nav(getUrlWithUtm(`/checkout?cupom=VOLTA25`));
                  }
                }}
                disabled={!selectedColor}
                className={`w-full font-bold text-base py-4 rounded-2xl transition-all ${
                  selectedColor
                    ? 'bg-cta text-white hover:bg-cta-hover'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Aproveitar desconto 🔥 - R$ {((SIZE_PRICES[selectedSize]?.price ?? 69.90) * 0.75).toFixed(2).replace('.', ',')}
              </button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Válido por tempo limitado. Não perca!</p>
            </div>
          </div>
        </div>
      )}

      {/* Second Exit Modal - 50% OFF (Last chance) */}
      {exit2Open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setExit2Open(false)}>
          <div className="absolute inset-0 bg-black/60 animate-in fade-in-0" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl transition-transform duration-300 mx-auto sm:max-w-md animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <button
              onClick={() => setExit2Open(false)}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-5 pt-2 pb-3">
              <p className="text-base font-bold">Última chance! 🔥</p>
            </div>

            {/* 50% OFF Coupon Box */}
            <div className="mx-5 rounded-lg border-2 border-dashed border-destructive bg-destructive/5 p-3 mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Oferta Final Exclusiva</p>
              <p className="text-2xl font-black tracking-wider text-destructive mb-0.5">ULTIMA50</p>
              <p className="text-xs"><strong>50% OFF</strong> — só agora!</p>
              <p className="text-xs mt-1.5">⏳ Expira em <strong className="text-destructive">{fmt(countdown.m)}:{fmt(countdown.s)}</strong></p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.max(5, ((countdown.m * 60 + countdown.s) / 300) * 100)}%` }} />
              </div>
            </div>

            {/* Product header with 50% price */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <img
                src={selectedColor === 'preta' ? '/images/mesa-preta-popup.webp' : '/images/mesa-branca-popup.webp'}
                alt="Mesa Dobrável"
                className="h-16 w-16 rounded-lg object-contain border bg-muted/30 p-1"
              />
              <div>
                <p className="font-bold text-sm">Mesa Dobrável Portátil Mesalar</p>
                <p className="text-cta font-extrabold text-lg">R$ {((SIZE_PRICES[selectedSize]?.price ?? 69.90) * 0.50).toFixed(2).replace('.', ',')}</p>
                <p className="text-xs text-muted-foreground line-through">R$ {(SIZE_PRICES[selectedSize]?.price ?? 69.90).toFixed(2).replace('.', ',')}</p>
                <span className="inline-block mt-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold px-1.5 py-0.5">+50% OFF com cupom</span>
              </div>
            </div>

            {/* Color selection */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Cor: {selectedColor === 'preta' ? 'Preta' : selectedColor === 'branca' ? 'Branca' : 'Selecione'}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "branca", name: "Branca", img: "/images/mesa-branca-popup.webp" },
                  { id: "preta", name: "Preta", img: "/images/mesa-preta-popup.webp" },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`rounded-2xl border-2 overflow-hidden transition-all relative ${
                      selectedColor === color.id
                        ? "border-cta bg-cta/5 shadow-lg"
                        : "border-border hover:border-cta/50"
                    }`}
                  >
                    {selectedColor === color.id && (
                      <div className="absolute top-2 right-2 bg-cta rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="aspect-[4/3] bg-muted/30 p-3">
                      <img src={color.img} alt={color.name} className="h-full w-full object-contain" />
                    </div>
                    <p className="py-2 text-center text-sm font-medium">{color.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size selection */}
            <div className="px-5 pb-4">
              <p className="text-sm font-semibold mb-2">Tamanho:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(SIZE_PRICES).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedSize === s
                        ? "border-cta bg-cta/5 text-cta"
                        : "border-border text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm button */}
            <div className="px-5 pb-6">
              <button
                onClick={() => {
                  if (selectedColor && selectedSize) {
                    saveCart([{ color: selectedColor, size: selectedSize, quantity: 1 }]);
                    setExit2Open(false);
                    nav(getUrlWithUtm(`/checkout?cupom=ULTIMA50`));
                  }
                }}
                disabled={!selectedColor}
                className={`w-full font-bold text-base py-4 rounded-2xl transition-all ${
                  selectedColor
                    ? 'bg-destructive text-white hover:bg-destructive/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Garantir com 50% OFF 🔥 - R$ {((SIZE_PRICES[selectedSize]?.price ?? 69.90) * 0.50).toFixed(2).replace('.', ',')}
              </button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Última oferta. Após fechar, o desconto será perdido!</p>
            </div>
          </div>
        </div>
      )}

      {storeOpen && (
        <div className="fixed inset-0 z-[60]" onClick={closeStore}>
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${storeClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in-0'}`} />
          <div
            className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto transition-transform duration-300 mx-auto sm:max-w-md ${storeClosing ? 'translate-y-full' : 'animate-in slide-in-from-bottom'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Close button */}
            <button
              onClick={closeStore}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="px-5 pt-2 pb-3 border-b">
              <p className="text-base font-bold">Informações da Loja</p>
            </div>
          <div className="px-5 py-4 space-y-5">
            {/* Store header */}
            <div className="flex items-center gap-3">
              <img src="/images/logo-mesalar.webp" alt="Mesalar" className="h-12 w-12 rounded-full object-contain border" />
              <div>
                <p className="font-bold text-sm">Mesalar</p>
                <p className="text-xs text-muted-foreground">Loja Oficial de Móveis</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-semibold">4.8 (15.234 avaliações)</span>
                </div>
              </div>
            </div>

            {/* Horário */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Horário de Atendimento</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Segunda - Sexta</span><span className="font-medium">09:00 - 18:00</span></div>
                <div className="flex justify-between"><span>Sábado</span><span className="font-medium">10:00 - 16:00</span></div>
                <div className="flex justify-between"><span>Domingo</span><span className="font-medium text-muted-foreground">Fechado</span></div>
              </div>
            </div>

            {/* Localização */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Localização</span>
              </div>
              <p className="text-sm text-muted-foreground">Av. Manoel Ribas, 2660 - Vista Alegre</p>
              <p className="text-sm text-muted-foreground">Curitiba - PR, 80810-345</p>
            </div>

            {/* Políticas */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Políticas da Loja</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">📦 Devolução Gratuita</p>
                  <p className="text-xs text-muted-foreground">7 dias para devolução sem custo adicional</p>
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">✅ Garantia Mesalar</p>
                  <p className="text-xs text-muted-foreground">1 ano de garantia contra defeitos de fabricação</p>
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">🚚 Frete Grátis</p>
                  <p className="text-xs text-muted-foreground">Entrega gratuita para todo o Brasil</p>
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">🔒 Pagamento Seguro</p>
                  <p className="text-xs text-muted-foreground">Transações protegidas e criptografadas</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t text-center">
              <div>
                <p className="text-lg font-black text-cta">2.4M</p>
                <p className="text-[10px] text-muted-foreground">Seguidores</p>
              </div>
              <div>
                <p className="text-lg font-black text-cta">52K</p>
                <p className="text-[10px] text-muted-foreground">Produtos</p>
              </div>
              <div>
                <p className="text-lg font-black text-cta">98%</p>
                <p className="text-[10px] text-muted-foreground">Satisfação</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Chat Modal - Bottom Sheet */}
      {chatOpen && (
        <div className="fixed inset-0 z-[60]" onClick={closeChat}>
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${chatClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in-0'}`} />
          <div
            className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] flex flex-col transition-transform duration-300 mx-auto sm:max-w-md ${chatClosing ? 'translate-y-full' : 'animate-in slide-in-from-bottom'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Close button */}
            <button
              onClick={closeChat}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="px-5 pt-2 pb-3 border-b">
              <p className="text-base font-bold">Chat - Mesa Dobrável Mesalar</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[300px] max-h-[60vh]">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-cta text-white rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick questions */}
            <div className="border-t px-4 py-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Perguntas rápidas:</p>
              <div className="flex flex-wrap gap-2">
                {faqs.map((faq, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(faq)}
                    className="text-xs border border-border rounded-full px-3 py-1.5 text-foreground hover:bg-muted transition-colors"
                  >
                    {faq.q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(chatInput); }} className="border-t px-4 py-3 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua pergunta..."
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-cta"
              />
              <button type="submit" disabled={chatTyping || !chatInput.trim()} className="bg-cta text-white rounded-full p-2.5 disabled:opacity-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cart - Bottom Sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60]" onClick={closeCart}>
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${cartClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in-0'}`} />
          <div
            className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl transition-transform duration-300 mx-auto sm:max-w-md ${cartClosing ? 'translate-y-full' : 'animate-in slide-in-from-bottom'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <button
              onClick={closeCart}
              className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="px-5 pt-2 pb-3 border-b">
              <p className="text-base font-bold text-center">Carrinho de compras ({cartTotalQty})</p>
            </div>

            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">Seu carrinho está vazio</p>
                <p className="text-sm text-muted-foreground text-center mb-6">Vamos preenchê-lo com seus produtos favoritos e ótimas ofertas!</p>
                <button onClick={closeCart} className="bg-cta text-white font-bold text-sm py-3 px-10 rounded-full hover:bg-cta-hover transition-colors">
                  Começar a comprar
                </button>
              </div>
            ) : (
              <div className="px-5 py-4">
                {cartItems.map((item, idx) => (
                  <div key={`${item.color}-${item.size}`} className="flex gap-3 pb-4 border-b mb-4 last:mb-0">
                    <img
                      src={item.color === 'preta' ? '/images/mesa-preta-popup.webp' : '/images/mesa-branca-popup.webp'}
                      alt="Mesa Dobrável"
                      className="h-20 w-20 rounded-lg object-contain border bg-muted/30 p-1 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-sm">Mesa Dobrável Portátil Mesalar</p>
                      <p className="text-xs text-muted-foreground">Cor: {item.color === 'preta' ? 'Preta' : 'Branca'} · {item.size}</p>
                      <p className="text-cta font-extrabold text-base mt-1">R$ {((SIZE_PRICES[item.size]?.price || PRICE) * item.quantity).toFixed(2).replace('.', ',')}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => updateCartItem(idx, item.quantity - 1)}
                          className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                        >
                          <span className="text-sm font-bold">−</span>
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItem(idx, item.quantity + 1)}
                          className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                        >
                          <span className="text-sm font-bold">+</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-extrabold text-cta">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>

                {/* Checkout button */}
                <button
                  onClick={handleCartCheckout}
                  className="w-full bg-cta text-white font-bold text-base py-3.5 rounded-2xl mt-4 hover:bg-cta-hover transition-colors"
                >
                  Finalizar compra
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
