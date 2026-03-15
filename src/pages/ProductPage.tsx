import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "03", s: "59" });
  const [currentImage, setCurrentImage] = useState(0);
  const { addItem, totalItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .single()
      .then(({ data }) => {
        setProduct(data);
        setLoading(false);
        if (data?.variants && Array.isArray(data.variants)) {
          const defaults: Record<string, string> = {};
          (data.variants as any[]).forEach((v: any) => {
            if (v.options?.[0]) defaults[v.name] = v.options[0].value;
          });
          setSelectedVariants(defaults);
        }
      });
  }, [slug]);

  useEffect(() => {
    if (!product?.countdown_minutes) return;
    let total = product.countdown_minutes * 60;
    const timer = setInterval(() => {
      total--;
      if (total <= 0) { clearInterval(timer); return; }
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setTimeLeft({
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0"),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [product]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#FF4C6A] border-t-transparent" />
    </div>
  );

  if (!product) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 bg-white">
      <p className="text-gray-500">Produto não encontrado</p>
      <button onClick={() => navigate("/loja")} className="text-[#FF4C6A] text-sm">← Voltar à loja</button>
    </div>
  );

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const discount = product.original_price_cents
    ? Math.round((1 - product.price_cents / product.original_price_cents) * 100)
    : 0;

  const variants = Array.isArray(product.variants) ? product.variants as any[] : [];
  const images = Array.isArray(product.images) ? product.images as any[] : [];

  const handleBuyNow = () => {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: images[0]?.url ?? "",
      priceCents: product.price_cents,
      variant: selectedVariants,
    });
    const params = new URLSearchParams({
      product: product.slug,
      price: String(product.price_cents),
      name: product.name,
      ...Object.entries(selectedVariants).reduce((acc, [k, v]) => ({
        ...acc, [k.toLowerCase()]: v
      }), {}),
    });
    navigate(`/checkout?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 flex items-center gap-2 px-3 py-2">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm text-gray-400">Pesquisar</span>
        </div>
        <button className="text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        <button onClick={() => navigate("/carrinho")} className="relative text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF4C6A] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </button>
      </header>

      {/* Image carousel */}
      <div className="relative aspect-square bg-gray-50">
        {images.length > 0 ? (
          <img src={images[currentImage]?.url} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">Sem foto</div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {currentImage + 1} / {images.length}
          </div>
        )}
        {/* Swipe indicators */}
        {images.length > 1 && (
          <>
            {currentImage > 0 && (
              <button onClick={() => setCurrentImage(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 text-white rounded-full w-8 h-8 flex items-center justify-center">‹</button>
            )}
            {currentImage < images.length - 1 && (
              <button onClick={() => setCurrentImage(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 text-white rounded-full w-8 h-8 flex items-center justify-center">›</button>
            )}
          </>
        )}
      </div>

      {/* Price overlay section */}
      <div className="bg-white px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {discount > 0 && (
              <span className="bg-[#FF4C6A] text-white text-xs px-2 py-0.5 rounded font-bold">-{discount}%</span>
            )}
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm text-[#FF4C6A] font-medium">R$</span>
              <span className="text-2xl font-bold text-[#FF4C6A]">{(product.price_cents/100).toFixed(2).replace('.',',')}</span>
            </div>
            <svg className="w-5 h-5 text-[#FF4C6A]" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          {product.badge_text && product.countdown_minutes > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-gray-500 flex items-center gap-1 justify-end">
                <span className="text-[#FF4C6A]">⚡</span> OFERTA RELÂMPAGO
              </p>
              <p className="text-xs text-gray-600">
                Termina em <span className="font-mono font-bold">{timeLeft.h}:{timeLeft.m}:{timeLeft.s}</span>
              </p>
            </div>
          )}
        </div>
        {product.original_price_cents && (
          <p className="text-sm text-gray-400 line-through mt-0.5">{fmt(product.original_price_cents)}</p>
        )}
      </div>

      {/* OFF badge */}
      {discount > 0 && (
        <div className="px-4 pb-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#FF4C6A] font-semibold">
            🏷️ {discount}% OFF
          </span>
        </div>
      )}

      {/* Title */}
      <div className="px-4 pb-3">
        <h1 className="text-base font-semibold text-gray-900 leading-snug">{product.name}</h1>
      </div>

      {/* Rating & sold */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-sm">★</span>
          <span className="text-sm font-medium text-gray-800">{product.rating}</span>
          <span className="text-sm text-gray-400">({product.rating_count})</span>
        </div>
        {product.sold_count > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">{product.sold_count?.toLocaleString("pt-BR")} vendidos</span>
          </>
        )}
      </div>

      {/* Shipping info */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
          <div>
            <div className="flex items-center gap-2">
              {product.free_shipping && <span className="text-xs font-semibold text-green-600">Frete grátis</span>}
              <span className="text-xs text-gray-500">
                Receba até {new Date(Date.now() + (product.shipping_days_max || 8) * 86400000).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {product.free_shipping && product.shipping_original_cents > 0 && (
              <p className="text-[11px] text-gray-400">
                Taxa de envio: <span className="line-through">{fmt(product.shipping_original_cents)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Variants */}
      {variants.map((variant: any) => (
        <div key={variant.name} className="px-4 pb-3">
          <p className="text-sm font-medium mb-2 text-gray-800">{variant.name}</p>
          <div className="flex flex-wrap gap-2">
            {variant.options?.map((opt: any) => (
              <button
                key={opt.value}
                onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.name]: opt.value }))}
                className={`rounded-lg border overflow-hidden transition-all ${
                  selectedVariants[variant.name] === opt.value
                    ? 'border-[#FF4C6A] ring-1 ring-[#FF4C6A]'
                    : 'border-gray-200'
                }`}
              >
                {opt.image ? (
                  <img src={opt.image} alt={opt.label} className="w-12 h-12 object-cover" />
                ) : (
                  <span className="px-3 py-1.5 text-sm block">{opt.label}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Proteção do cliente */}
      <div className="px-4 pb-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-500">🛡️</span>
            <span className="text-sm font-semibold text-green-600">Proteção do cliente</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              <span className="text-[11px] text-gray-600">Devolução gratuita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              <span className="text-[11px] text-gray-600">Reembolso automático por danos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              <span className="text-[11px] text-gray-600">Pagamento seguro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              <span className="text-[11px] text-gray-600">Cupom por atraso na coleta</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-800 border-t border-gray-100 pt-3">Descrição</h3>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center z-50">
        <button onClick={() => navigate("/loja")} className="flex flex-col items-center py-2 px-3 text-gray-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span className="text-[10px]">Loja</span>
        </button>
        <button className="flex flex-col items-center py-2 px-3 text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[10px]">Chat</span>
        </button>
        <button
          onClick={() => {
            addItem({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              imageUrl: images[0]?.url ?? "",
              priceCents: product.price_cents,
              variant: selectedVariants,
            });
            navigate("/carrinho");
          }}
          className="flex flex-col items-center py-2 px-3 text-gray-400 relative"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {totalItems > 0 && (
            <span className="absolute -top-0.5 right-1 w-4 h-4 bg-[#FF4C6A] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </button>
        <button
          onClick={handleBuyNow}
          className="flex-1 mx-2 my-1.5 py-3 rounded-lg bg-[#FF4C6A] text-white font-semibold text-sm text-center"
        >
          <div>{fmt(product.price_cents)}</div>
          <div className="text-[11px] font-normal opacity-90">
            Comprar agora {product.free_shipping ? '| Frete grátis' : ''}
          </div>
        </button>
      </div>
    </div>
  );
}
