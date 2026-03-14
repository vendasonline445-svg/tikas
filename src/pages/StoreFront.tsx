import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

export default function StoreFront() {
  const [products, setProducts] = useState<any[]>([]);
  const [tab, setTab] = useState<'home' | 'produtos' | 'categorias'>('home');
  const [search, setSearch] = useState("");
  const { totalItems } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("products").select("*")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("sold_count", { ascending: false })
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  const fmt = (c: number) => (c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const discount = (p: any) => p.original_price_cents
    ? Math.round((1 - p.price_cents/p.original_price_cents)*100) : 0;

  const featured = products.filter(p => p.featured);
  const rest = products.filter(p => !p.featured);
  const filtered = (tab === 'produtos' ? products : rest)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const ProductCard = ({ p, topBadge }: { p: any; topBadge?: string }) => (
    <div
      onClick={() => navigate(p.slug === 'mesa-dobravel-portatil' ? '/' : `/p/${p.slug}`)}
      className="bg-white rounded-lg overflow-hidden cursor-pointer border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-50">
        {p.images?.[0]?.url
          ? <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sem foto</div>
        }
        {topBadge && (
          <div className="absolute top-1.5 left-1.5 bg-[#FF4C6A] text-white text-[10px] px-2 py-0.5 rounded font-bold leading-tight">
            {topBadge}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs text-gray-800 line-clamp-2 leading-tight mb-1.5 min-h-[2.5rem] font-medium">
          {p.name}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-[#FF4C6A] font-medium">R$</span>
          <span className="text-lg font-bold text-[#FF4C6A] leading-none">{(p.price_cents/100).toFixed(2).replace('.',',')}</span>
        </div>
        {p.original_price_cents && (
          <p className="text-[11px] text-gray-400 line-through">{fmt(p.original_price_cents)}</p>
        )}
        {discount(p) > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-[#FF4C6A]">🏷️</span>
            <span className="text-[11px] text-[#FF4C6A] font-semibold">{discount(p)}% OFF</span>
          </div>
        )}
        {p.sold_count > 0 && (
          <p className="text-[11px] text-gray-400 mt-0.5">{p.sold_count.toLocaleString("pt-BR")} vendido(s)</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button className="text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700"
            />
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
        </div>

        {/* Store info */}
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
              AC
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Achadinhos Casa Shop</p>
              <p className="text-xs text-gray-500">{products.reduce((s,p)=>s+(p.sold_count||0),0).toLocaleString("pt-BR")} vendido(s)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-[#FF4C6A] text-white text-xs rounded font-medium">Seguir</button>
            <button className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded">Mensagem</button>
          </div>
        </div>

        {/* Coupon banners */}
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 min-w-[180px] shrink-0">
            <div>
              <p className="text-xs font-semibold text-orange-700">Cupom de frete grátis</p>
              <p className="text-[11px] text-orange-600">Sem gasto mínimo</p>
            </div>
            <button className="text-xs bg-[#FF4C6A] text-white px-2.5 py-1 rounded ml-2 font-medium">Resgatar</button>
          </div>
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 min-w-[180px] shrink-0">
            <div>
              <p className="text-xs font-semibold text-orange-700">Até 85% OFF</p>
              <p className="text-[11px] text-orange-600">Em produtos selecionados</p>
            </div>
            <button className="text-xs bg-[#FF4C6A] text-white px-2.5 py-1 rounded ml-2 font-medium">Resgatar</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-100">
          {[
            { id: 'home', label: 'Página inicial' },
            { id: 'produtos', label: 'Produtos' },
            { id: 'categorias', label: 'Categorias' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#FF4C6A] text-[#FF4C6A]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Featured products (TOP 1, 2, 3) */}
        {tab === 'home' && featured.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">Principais produtos</h2>
              <button className="text-xs text-gray-400">›</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {featured.slice(0, 3).map((p, i) => (
                <ProductCard key={p.id} p={p} topBadge={`TOP ${i+1}`} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended */}
        <div>
          {tab === 'home' && (
            <div className="flex items-center justify-center mb-3">
              <div className="flex-1 h-px bg-gray-200" />
              <h2 className="text-sm font-semibold text-gray-800 px-3">Recomendado para você</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(p => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Nenhum produto encontrado
          </div>
        )}
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-16" />

      {/* Bottom nav - matching reference */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        <button className="flex-1 flex flex-col items-center py-2.5 text-[#FF4C6A]">
          <svg className="w-5 h-5 mb-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span className="text-[10px] font-medium">Loja</span>
        </button>
        <button className="flex-1 flex flex-col items-center py-2.5 text-gray-400">
          <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[10px]">Chat</span>
        </button>
        <button onClick={() => navigate("/carrinho")} className="flex-1 flex flex-col items-center py-2.5 text-gray-400 relative">
          <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[10px]">Carrinho</span>
          {totalItems > 0 && (
            <span className="absolute top-1 right-4 w-4 h-4 bg-[#FF4C6A] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
